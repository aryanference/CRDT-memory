// core/src/sync/delta.rs
// Delta-state serialization for CRDT gossip.
// A DeltaState carries the subset of changes since a given vector clock position.

use serde::{Serialize, Deserialize};
use crate::graph::crdt::{LWWElementSet, ORSet};
use crate::graph::node::MemoryNode;
use crate::graph::edge::CausalEdge;
use crate::sync::vector_clock::VectorClock;

/// The serializable delta payload sent between peers.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeltaState {
    /// Sender's agent ID
    pub sender_agent_id: String,
    /// Sender's current vector clock at time of delta creation
    pub sender_clock: VectorClock,
    /// Node changes since the cutoff timestamp
    pub node_delta: LWWElementSet<MemoryNode>,
    /// Edge changes since the cutoff timestamp
    pub edge_delta: LWWElementSet<CausalEdge>,
    /// Deletion intent changes
    pub deletion_delta: ORSet<String>,
    /// Unix ms when this delta was created
    pub created_at_ms: u64,
}

impl DeltaState {
    /// Estimate serialized size for truncation decisions.
    /// Uses bincode serialization.
    pub fn estimate_bytes(&self) -> usize {
        // Quick estimate: node_delta entries × avg node size
        self.node_delta.len() * 512 + self.edge_delta.len() * 64 + 64
    }

    /// Truncate to the most recent `max_entries` nodes (by timestamp).
    /// Preserves all edge deltas (they are smaller).
    pub fn truncate_to(&mut self, max_bytes: usize) {
        let per_node = 512usize;
        let max_nodes = (max_bytes / per_node).max(1);
        if self.node_delta.len() > max_nodes {
            // Keep the most recent entries (highest timestamp)
            let mut entries: Vec<_> = self.node_delta.entries.drain().collect();
            entries.sort_by(|a, b| b.1.timestamp_ms.cmp(&a.1.timestamp_ms));
            entries.truncate(max_nodes);
            self.node_delta.entries = entries.into_iter().collect();
        }
    }
}
