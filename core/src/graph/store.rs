// core/src/graph/store.rs
// PCCMStore: central in-memory + SQLite store for the PCCM graph.
// Uses CRDT primitives for distributed merge semantics.

use std::collections::HashMap;
use thiserror::Error;
use tracing::{debug, warn};
use uuid::Uuid;

use crate::graph::crdt::{LWWElementSet, ORSet};
use crate::graph::edge::{CausalEdge, EdgeType};
use crate::graph::node::{ActivationState, MemoryNode, NodeType, now_ms};
use crate::embed::hnsw::HNSWIndex;
use crate::embed::hnsw::ScoredNode;
use crate::sync::delta::DeltaState;
use crate::sync::vector_clock::VectorClock;
use crate::activation::base_level::{compute_activation, classify_state, DEFAULT_DECAY};

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Node not found: {0}")]
    NotFound(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
    #[error("Already deleted: {0}")]
    AlreadyDeleted(String),
}

pub struct PCCMStore {
    nodes: LWWElementSet<MemoryNode>,
    edges: LWWElementSet<CausalEdge>,
    deletions: ORSet<String>,
    hnsw_index: HNSWIndex,
    /// Adjacency list: node_id → list of outgoing edge IDs
    adjacency: HashMap<String, Vec<String>>,
    sqlite: rusqlite::Connection,
    vector_clock: VectorClock,
    pub agent_id: String,
    decay: f64,
}

impl PCCMStore {
    pub fn new(agent_id: String, sqlite_path: &str, decay: f64) -> Result<Self, StoreError> {
        let sqlite = rusqlite::Connection::open(sqlite_path)?;
        Self::init_schema(&sqlite)?;
        Ok(Self {
            nodes: LWWElementSet::new(),
            edges: LWWElementSet::new(),
            deletions: ORSet::new(),
            hnsw_index: HNSWIndex::new(),
            adjacency: HashMap::new(),
            sqlite,
            vector_clock: VectorClock::new(),
            agent_id,
            decay,
        })
    }

    fn init_schema(conn: &rusqlite::Connection) -> Result<(), StoreError> {
        conn.execute_batch(r#"
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                content TEXT NOT NULL,
                node_type TEXT NOT NULL,
                activation_score REAL NOT NULL DEFAULT 0.0,
                activation_state TEXT NOT NULL DEFAULT 'active',
                created_at_ms INTEGER NOT NULL,
                last_accessed_ms INTEGER NOT NULL,
                embedding BLOB,
                metadata TEXT NOT NULL DEFAULT '{}',
                session_id TEXT,
                embedding_failed INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS edges (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                edge_type TEXT NOT NULL,
                weight REAL NOT NULL DEFAULT 1.0,
                agent_id TEXT NOT NULL,
                created_at_ms INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS access_timestamps (
                node_id TEXT NOT NULL,
                ts_ms INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_access_node ON access_timestamps(node_id);
            CREATE INDEX IF NOT EXISTS idx_nodes_agent ON nodes(agent_id);
            CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
            CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
        "#)?;
        Ok(())
    }

    // ── Node Operations ──────────────────────────────────────────────

    pub fn insert_node(&mut self, mut node: MemoryNode) -> Result<String, StoreError> {
        let now = now_ms();
        if node.id.is_empty() {
            node.id = Uuid::new_v4().to_string();
        }
        // Compute initial activation
        let score = compute_activation(&node, now, self.decay);
        node.activation_score = score;
        node.activation_state = classify_state(score);

        let id = node.id.clone();
        let embedding = node.embedding.clone();

        self.nodes.insert(id.clone(), node, now);
        self.vector_clock.tick(&self.agent_id.clone());

        // Add to HNSW index if embedding is not empty and not failed
        if !embedding.is_empty() {
            self.hnsw_index.add(id.clone(), embedding);
        }

        debug!("Inserted node {id}");
        Ok(id)
    }

    pub fn insert_edge(&mut self, mut edge: CausalEdge) -> Result<String, StoreError> {
        let now = now_ms();
        if edge.id.is_empty() {
            edge.id = Uuid::new_v4().to_string();
        }
        let id = edge.id.clone();
        let source = edge.source_id.clone();

        self.adjacency
            .entry(source)
            .or_default()
            .push(id.clone());

        self.edges.insert(id.clone(), edge, now);
        self.vector_clock.tick(&self.agent_id.clone());
        Ok(id)
    }

    pub fn soft_delete_node(&mut self, node_id: &str) -> Result<(), StoreError> {
        if self.get_node(node_id).is_none() {
            return Err(StoreError::NotFound(node_id.to_string()));
        }
        let tag = Uuid::new_v4().to_string();
        self.deletions.add(node_id.to_string(), tag);
        self.hnsw_index.remove(node_id);
        Ok(())
    }

    pub fn get_node(&self, node_id: &str) -> Option<&MemoryNode> {
        // Return None if the node has been soft-deleted
        if self.deletions.contains(&node_id.to_string()) {
            return None;
        }
        self.nodes.get(node_id)
    }

    pub fn get_node_mut(&mut self, node_id: &str) -> Option<&mut MemoryNode> {
        if self.deletions.contains(&node_id.to_string()) {
            return None;
        }
        self.nodes.get_mut(node_id)
    }

    pub fn all_node_ids(&self) -> Vec<String> {
        self.nodes.keys()
            .filter(|id| !self.deletions.contains(*id))
            .cloned()
            .collect()
    }

    pub fn all_active_nodes(&self) -> Vec<&MemoryNode> {
        self.nodes.values()
            .filter(|n| {
                !self.deletions.contains(&n.id)
                    && !matches!(n.activation_state, ActivationState::Dormant)
            })
            .collect()
    }

    /// Get all neighbouring nodes connected by the given edge types.
    pub fn get_neighbors<'a>(
        &'a self,
        node_id: &str,
        edge_types: &[EdgeType],
    ) -> Vec<(&'a MemoryNode, &'a EdgeType)> {
        let edge_ids = self.adjacency.get(node_id).cloned().unwrap_or_default();
        let mut result = Vec::new();
        for eid in &edge_ids {
            let Some(edge) = self.edges.get(eid) else { continue };
            if edge_types.contains(&edge.edge_type) {
                let Some(target) = self.get_node(&edge.target_id) else { continue };
                // Return a reference to the edge_type from within the stored edge
                if let Some(stored_edge) = self.edges.get(eid) {
                    result.push((target, &stored_edge.edge_type));
                }
            }
        }
        result
    }

    pub fn vector_search(&self, query_vec: &[f32], top_k: usize) -> Vec<ScoredNode> {
        // We need mutable access to the index for rebuilding; use interior mutability trick
        // by cloning — acceptable at demo scale
        // TODO: in production, use a dedicated mutable index or RwLock around the index
        let mut index_clone = HNSWIndex::new();
        for id in self.nodes.keys() {
            if let Some(node) = self.get_node(id) {
                if !node.embedding.is_empty() && !node.embedding_failed {
                    index_clone.add(id.clone(), node.embedding.clone());
                }
            }
        }
        index_clone.search(query_vec, top_k)
    }

    pub fn node_count(&self) -> usize {
        self.nodes.keys()
            .filter(|id| !self.deletions.contains(*id))
            .count()
    }

    pub fn hot_node_count(&self) -> usize {
        self.nodes.values()
            .filter(|n| {
                !self.deletions.contains(&n.id)
                    && matches!(n.activation_state, ActivationState::Hot)
            })
            .count()
    }

    pub fn dormant_node_count(&self) -> usize {
        self.nodes.values()
            .filter(|n| {
                !self.deletions.contains(&n.id)
                    && matches!(n.activation_state, ActivationState::Dormant)
            })
            .count()
    }

    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }

    // ── CRDT Sync ────────────────────────────────────────────────────

    pub fn sync_delta(&self) -> DeltaState {
        let cutoff = self.vector_clock.max_ts().saturating_sub(1);
        DeltaState {
            sender_agent_id: self.agent_id.clone(),
            sender_clock: self.vector_clock.clone(),
            node_delta: self.nodes.to_delta(cutoff),
            edge_delta: self.edges.to_delta(cutoff),
            deletion_delta: self.deletions.to_delta(&self.vector_clock),
            created_at_ms: now_ms(),
        }
    }

    pub fn merge_delta(&mut self, delta: DeltaState) -> Result<(), StoreError> {
        // Merge node deltas into HNSW index
        for (id, entry) in &delta.node_delta.entries {
            if !self.hnsw_index.is_empty() || !entry.value.embedding.is_empty() {
                if !entry.value.embedding.is_empty() && !entry.value.embedding_failed {
                    // Only add if not already indexed
                    if self.get_node(id).is_none() {
                        self.hnsw_index.add(id.clone(), entry.value.embedding.clone());
                    }
                }
            }
        }

        self.nodes.merge(&delta.node_delta);
        self.edges.merge(&delta.edge_delta);
        self.deletions.merge(&delta.deletion_delta);
        self.vector_clock.merge(&delta.sender_clock);

        // Rebuild adjacency for new edges
        for (_, entry) in &delta.edge_delta.entries {
            let edge = &entry.value;
            self.adjacency
                .entry(edge.source_id.clone())
                .or_default()
                .push(edge.id.clone());
        }

        Ok(())
    }

    // ── SQLite Persistence ───────────────────────────────────────────

    pub fn persist_snapshot(&self) -> Result<(), StoreError> {
        let tx = self.sqlite.unchecked_transaction()?;

        for node in self.nodes.values() {
            let embedding_blob: Option<Vec<u8>> = if !node.embedding.is_empty() {
                let bytes: Vec<u8> = node.embedding.iter()
                    .flat_map(|f| f.to_le_bytes())
                    .collect();
                Some(bytes)
            } else {
                None
            };
            let metadata_json = serde_json::to_string(&node.metadata)
                .unwrap_or_else(|_| "{}".to_string());

            tx.execute(
                r#"INSERT OR REPLACE INTO nodes
                   (id, agent_id, content, node_type, activation_score,
                    activation_state, created_at_ms, last_accessed_ms,
                    embedding, metadata, session_id, embedding_failed)
                   VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"#,
                rusqlite::params![
                    node.id, node.agent_id, node.content,
                    node.node_type.as_str(), node.activation_score,
                    node.activation_state.as_str(),
                    node.created_at_ms as i64, node.last_accessed_ms as i64,
                    embedding_blob, metadata_json,
                    node.session_id.as_deref().unwrap_or(""),
                    node.embedding_failed as i64,
                ],
            )?;
        }

        for edge in self.edges.values() {
            tx.execute(
                r#"INSERT OR REPLACE INTO edges
                   (id, source_id, target_id, edge_type, weight, agent_id, created_at_ms)
                   VALUES (?1,?2,?3,?4,?5,?6,?7)"#,
                rusqlite::params![
                    edge.id, edge.source_id, edge.target_id,
                    edge.edge_type.as_str(), edge.weight,
                    edge.agent_id, edge.created_at_ms as i64,
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn vector_clock(&self) -> &VectorClock {
        &self.vector_clock
    }

    pub fn last_gossip_ms(&self) -> u64 {
        now_ms() // placeholder; real impl tracks last gossip time
    }
}
