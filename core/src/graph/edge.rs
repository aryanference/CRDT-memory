// core/src/graph/edge.rs
// Causal edge types for the PCCM graph.

use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EdgeType {
    Causes,
    CausedBy,
    Enables,
    Prevents,
    TemporalCoOccurrence,
}

impl EdgeType {
    /// Causal boost multiplier used in spreading activation propagation.
    /// Direct causal relationships get 2x energy; temporal/preventive get 1x.
    pub fn causal_boost(&self) -> f64 {
        match self {
            EdgeType::Causes | EdgeType::CausedBy | EdgeType::Enables => 2.0,
            EdgeType::Prevents | EdgeType::TemporalCoOccurrence => 1.0,
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().replace('-', "_").as_str() {
            "caused_by" => EdgeType::CausedBy,
            "enables" => EdgeType::Enables,
            "prevents" => EdgeType::Prevents,
            "temporal_co_occurrence" | "temporal" => EdgeType::TemporalCoOccurrence,
            _ => EdgeType::Causes,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            EdgeType::Causes => "causes",
            EdgeType::CausedBy => "caused_by",
            EdgeType::Enables => "enables",
            EdgeType::Prevents => "prevents",
            EdgeType::TemporalCoOccurrence => "temporal_co_occurrence",
        }
    }

    pub fn all() -> &'static [EdgeType] {
        &[
            EdgeType::Causes,
            EdgeType::CausedBy,
            EdgeType::Enables,
            EdgeType::Prevents,
            EdgeType::TemporalCoOccurrence,
        ]
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CausalEdge {
    /// UUID v4
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub edge_type: EdgeType,
    /// 0.0–1.0 confidence of the causal relationship
    pub weight: f64,
    pub created_at_ms: u64,
    pub agent_id: String,
}
