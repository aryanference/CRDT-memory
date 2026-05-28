// core/src/activation/spreading.rs
// 5-step temporal spreading activation algorithm.
// Starts from semantic entry points and BFS-traverses the causal graph.

use std::collections::{BinaryHeap, HashSet};
use std::cmp::Ordering;

use crate::graph::node::MemoryNode;
use crate::graph::edge::EdgeType;
use crate::graph::store::PCCMStore;
use crate::activation::inhibition::apply_lateral_inhibition;

/// Configuration for the spreading activation run.
pub struct SpreadingActivationConfig {
    /// Cosine similarity cutoff for seed selection (default 0.75)
    pub semantic_threshold: f32,
    /// Hard node budget (default 100)
    pub max_nodes: usize,
    /// Frontier batch size (default 20)
    pub batch_size: usize,
    /// Energy decay per hop (default 0.5)
    pub hop_decay: f64,
    /// Time window in days (for temporal scoring)
    pub time_window_days: u32,
    /// Midpoint of the query time window (Unix ms; 0 = use now)
    pub query_time_center_ms: u64,
}

impl Default for SpreadingActivationConfig {
    fn default() -> Self {
        Self {
            semantic_threshold: 0.75,
            max_nodes: 100,
            batch_size: 20,
            hop_decay: 0.5,
            time_window_days: 7,
            query_time_center_ms: 0,
        }
    }
}

/// A node that has been activated during spreading activation.
#[derive(Clone, Debug)]
pub struct ActivatedNode {
    pub node: MemoryNode,
    pub score: f64,
    pub propagation_hops: u32,
    pub propagation_path: Vec<String>,
    pub was_inhibited: bool,
}

/// Wrapper for the priority queue (max-heap by score).
#[derive(Clone)]
struct QueueItem {
    score: f64,
    node_id: String,
    hops: u32,
    path: Vec<String>,
}

impl PartialEq for QueueItem {
    fn eq(&self, other: &Self) -> bool { self.score == other.score }
}
impl Eq for QueueItem {}
impl PartialOrd for QueueItem {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> { Some(self.cmp(other)) }
}
impl Ord for QueueItem {
    fn cmp(&self, other: &Self) -> Ordering {
        self.score.partial_cmp(&other.score)
            .unwrap_or(Ordering::Equal)
    }
}

/// Run the 5-step temporal spreading activation algorithm.
///
/// Steps:
///   1. Semantic entry points — vector search, filter by semantic_threshold
///   2. Temporal proximity scoring — bias toward temporally relevant nodes
///   3. BFS with priority queue — traverse causal graph with energy propagation
///   4. Propagated energy decay — causal_boost() × hop_decay per hop
///   5. Batched traversal guardrails — stop at max_nodes or empty heap
///
/// Post-processing: lateral inhibition to suppress redundant nodes.
pub fn run(
    store: &PCCMStore,
    query_embedding: &[f32],
    config: &SpreadingActivationConfig,
) -> Vec<ActivatedNode> {
    // ── STEP 1: Semantic entry points ──────────────────────────────────
    let candidates = store.vector_search(query_embedding, 50);
    let seeds: Vec<_> = candidates.into_iter()
        .filter(|c| c.similarity >= config.semantic_threshold)
        .collect();

    if seeds.is_empty() {
        return vec![];
    }

    let now_ms = crate::graph::node::now_ms();
    let time_center_ms = if config.query_time_center_ms == 0 {
        now_ms
    } else {
        config.query_time_center_ms
    };

    // ── STEP 2: Temporal proximity scoring ─────────────────────────────
    let window_seconds = config.time_window_days as f64 * 86_400.0;

    let mut heap: BinaryHeap<QueueItem> = BinaryHeap::new();
    for seed in &seeds {
        let Some(node) = store.get_node(&seed.node_id) else { continue; };

        let days_from_mid = {
            let node_s = node.created_at_ms as f64 / 1000.0;
            let center_s = time_center_ms as f64 / 1000.0;
            (node_s - center_s).abs()
        };
        let temporal_score = (1.0 - days_from_mid / window_seconds).max(0.0);
        let initial_score = node.activation_score + temporal_score;

        heap.push(QueueItem {
            score: initial_score,
            node_id: seed.node_id.clone(),
            hops: 0,
            path: vec![seed.node_id.clone()],
        });
    }

    // ── STEPS 3–5: BFS with priority queue + decay ─────────────────────
    let mut visited: HashSet<String> = HashSet::new();
    let mut activated: Vec<ActivatedNode> = Vec::new();

    'outer: while let Some(item) = heap.pop() {
        if visited.contains(&item.node_id) {
            continue;
        }
        visited.insert(item.node_id.clone());

        let Some(node) = store.get_node(&item.node_id) else { continue; };

        // Skip dormant nodes (they don't participate in traversal)
        if matches!(node.activation_state, crate::graph::node::ActivationState::Dormant) {
            continue;
        }

        activated.push(ActivatedNode {
            node: node.clone(),
            score: item.score,
            propagation_hops: item.hops,
            propagation_path: item.path.clone(),
            was_inhibited: false,
        });

        if activated.len() >= config.max_nodes {
            break 'outer;
        }

        // ── STEP 4: Propagate to neighbours ──────────────────────────
        let neighbors = store.get_neighbors(&item.node_id, EdgeType::all());
        for (neighbor, edge_type) in neighbors {
            if visited.contains(&neighbor.id) {
                continue;
            }
            let propagated = item.score * edge_type.causal_boost() * config.hop_decay;
            if propagated > 0.001 {
                let mut new_path = item.path.clone();
                new_path.push(neighbor.id.clone());
                heap.push(QueueItem {
                    score: propagated,
                    node_id: neighbor.id.clone(),
                    hops: item.hops + 1,
                    path: new_path,
                });
            }
        }
    }

    // ── POST-PROCESS: Lateral inhibition ─────────────────────────────
    apply_lateral_inhibition(activated)
}
