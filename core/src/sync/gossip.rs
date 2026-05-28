// core/src/sync/gossip.rs
// UDP/WebSocket gossip protocol for CRDT delta-state synchronisation.
// Best-effort: errors are logged at WARN level and never crash the process.

use std::sync::Arc;
use std::time::Duration;
use parking_lot::RwLock;
use tokio::time::sleep;
use tracing::{info, warn, debug};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::graph::store::PCCMStore;
use crate::sync::delta::DeltaState;
use crate::graph::node::now_ms;

pub struct GossipConfig {
    /// How often to gossip (milliseconds). Default: 50ms.
    pub sync_interval_ms: u64,
    /// List of peer WebSocket URLs: "ws://host:port"
    pub peer_addresses: Vec<String>,
    /// Maximum serialized delta size in bytes. Default: 65536 (64KB).
    pub max_delta_bytes: usize,
}

impl Default for GossipConfig {
    fn default() -> Self {
        Self {
            sync_interval_ms: 50,
            peer_addresses: vec![],
            max_delta_bytes: 65536,
        }
    }
}

/// Spawn the gossip background task.
/// Runs indefinitely until the process exits.
/// Network failures do NOT crash the process — they are logged and skipped.
pub async fn run_gossip_worker(store: Arc<RwLock<PCCMStore>>, config: GossipConfig) {
    info!(
        "Gossip worker started: {} peers, {}ms interval",
        config.peer_addresses.len(),
        config.sync_interval_ms
    );

    if config.peer_addresses.is_empty() {
        info!("No gossip peers configured — gossip worker idle");
        return;
    }

    loop {
        sleep(Duration::from_millis(config.sync_interval_ms)).await;

        // Build delta under read lock
        let mut delta = {
            let store = store.read();
            store.sync_delta()
        };

        // Truncate if too large
        if delta.estimate_bytes() > config.max_delta_bytes {
            delta.truncate_to(config.max_delta_bytes);
        }

        // Serialize
        let bytes = match bincode::serde::encode_to_vec(&delta, bincode::config::standard()) {
            Ok(b) => b,
            Err(e) => {
                warn!("Gossip: failed to serialize delta: {e}");
                continue;
            }
        };

        debug!("Gossip: sending {} bytes to {} peers", bytes.len(), config.peer_addresses.len());

        // Send to each peer
        for peer_addr in &config.peer_addresses {
            let store_clone = Arc::clone(&store);
            let bytes_clone = bytes.clone();
            let peer = peer_addr.clone();

            tokio::spawn(async move {
                if let Err(e) = gossip_to_peer(&peer, bytes_clone, store_clone).await {
                    warn!("Gossip: peer {peer} failed: {e}");
                }
            });
        }
    }
}

async fn gossip_to_peer(
    peer_addr: &str,
    bytes: Vec<u8>,
    store: Arc<RwLock<PCCMStore>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (mut ws_stream, _) = connect_async(peer_addr).await?;

    // Send our delta
    ws_stream.send(Message::Binary(bytes)).await?;

    // Receive peer's delta (if any comes back within timeout)
    let timeout = tokio::time::timeout(
        Duration::from_millis(200),
        ws_stream.next(),
    ).await;

    if let Ok(Some(Ok(Message::Binary(incoming)))) = timeout {
        match bincode::serde::decode_from_slice::<DeltaState, _>(
            &incoming,
            bincode::config::standard(),
        ) {
            Ok((peer_delta, _)) => {
                let mut store = store.write();
                if let Err(e) = store.merge_delta(peer_delta) {
                    warn!("Gossip: merge failed: {e}");
                }
            }
            Err(e) => {
                warn!("Gossip: failed to deserialize peer delta: {e}");
            }
        }
    }

    let _ = ws_stream.close(None).await;
    Ok(())
}
