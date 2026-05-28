// core/src/activation/decay_worker.rs
// Background tokio task that periodically recomputes activation scores.
// Runs every 60 seconds. Only updates nodes accessed in the last 24 hours.

use std::sync::Arc;
use parking_lot::RwLock;
use tokio::time::{sleep, Duration};
use tracing::{info, warn};

use crate::graph::store::PCCMStore;
use crate::activation::base_level::{compute_activation, classify_state, DEFAULT_DECAY};
use crate::graph::node::now_ms;

/// Spawn the decay background task.
/// Runs indefinitely until the process exits.
pub async fn run_decay_worker(store: Arc<RwLock<PCCMStore>>, decay: f64) {
    info!("Decay worker started (interval=60s, decay={decay})");
    loop {
        sleep(Duration::from_secs(60)).await;

        let now = now_ms();
        let cutoff_ms = now.saturating_sub(24 * 60 * 60 * 1_000); // 24 hours ago

        let mut hot_count = 0usize;
        let mut dormant_count = 0usize;
        let mut updated = 0usize;

        {
            let mut store = store.write();
            // Collect IDs of recently accessed nodes
            let ids_to_update: Vec<String> = store
                .all_node_ids()
                .into_iter()
                .filter(|id| {
                    store.get_node(id)
                        .map(|n| n.last_accessed_ms >= cutoff_ms)
                        .unwrap_or(false)
                })
                .collect();

            for id in &ids_to_update {
                if let Some(node) = store.get_node_mut(id) {
                    let score = compute_activation(node, now, decay);
                    let state = classify_state(score);
                    node.activation_score = score;
                    node.activation_state = state.clone();
                    updated += 1;
                    match state {
                        crate::graph::node::ActivationState::Hot => hot_count += 1,
                        crate::graph::node::ActivationState::Dormant => dormant_count += 1,
                        _ => {}
                    }
                }
            }

            // Persist to SQLite
            if let Err(e) = store.persist_snapshot() {
                warn!("Decay worker: SQLite persist failed: {e}");
            }
        }

        info!("Decay pass complete: {updated} nodes updated, {hot_count} HOT, {dormant_count} DORMANT");
    }
}
