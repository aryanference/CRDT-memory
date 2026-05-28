// core/src/graph/node.rs
// Memory node types for the PCCM causal graph.

use std::collections::HashMap;
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum NodeType {
    /// Observed events, tool calls, LLM outputs
    Episodic,
    /// Inferred rules, consolidated user preferences
    Semantic,
    /// Action templates, runbooks, known workflows
    Procedural,
}

impl NodeType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "semantic" => NodeType::Semantic,
            "procedural" => NodeType::Procedural,
            _ => NodeType::Episodic,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            NodeType::Episodic => "episodic",
            NodeType::Semantic => "semantic",
            NodeType::Procedural => "procedural",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum ActivationState {
    /// activation_score > 1.0 — eligible for KV prefetch
    Hot,
    /// activation_score > -1.0 — included in traversal
    Active,
    /// activation_score <= -3.5 — excluded from traversal
    Dormant,
}

impl ActivationState {
    pub fn as_str(&self) -> &'static str {
        match self {
            ActivationState::Hot => "hot",
            ActivationState::Active => "active",
            ActivationState::Dormant => "dormant",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryNode {
    /// UUID v4
    pub id: String,
    /// Raw text of the memory
    pub content: String,
    /// 1536-dim (OpenAI) or 384-dim (local sentence-transformers)
    pub embedding: Vec<f32>,
    pub node_type: NodeType,
    /// Unix milliseconds
    pub created_at_ms: u64,
    /// Unix milliseconds
    pub last_accessed_ms: u64,
    /// All past access times (Unix ms)
    pub access_timestamps: Vec<u64>,
    /// Recomputed by ACT-R engine
    pub activation_score: f64,
    /// HOT | ACTIVE | DORMANT
    pub activation_state: ActivationState,
    pub agent_id: String,
    pub session_id: Option<String>,
    pub metadata: HashMap<String, String>,
    /// Set to true if embedding generation failed; excludes from vector search
    pub embedding_failed: bool,
}

impl MemoryNode {
    pub fn new(
        id: String,
        content: String,
        embedding: Vec<f32>,
        node_type: NodeType,
        agent_id: String,
        session_id: Option<String>,
        metadata: HashMap<String, String>,
    ) -> Self {
        let now_ms = now_ms();
        Self {
            id,
            content,
            embedding,
            node_type,
            created_at_ms: now_ms,
            last_accessed_ms: now_ms,
            access_timestamps: vec![now_ms],
            activation_score: 0.0,
            activation_state: ActivationState::Active,
            agent_id,
            session_id,
            metadata,
            embedding_failed: false,
        }
    }

    /// Record an access, updating last_accessed_ms and access_timestamps.
    pub fn record_access(&mut self) {
        let t = now_ms();
        self.last_accessed_ms = t;
        self.access_timestamps.push(t);
    }
}

/// Returns the current Unix time in milliseconds.
pub fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis() as u64
}
