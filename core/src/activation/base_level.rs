// core/src/activation/base_level.rs
// ACT-R Base-Level Activation formula.
// Implements: B_i = ln( Σ t_k^{-d} )
// with approximation for nodes with ≥1000 accesses.

use crate::graph::node::{MemoryNode, ActivationState};

/// Default decay constant (d in ACT-R formula).
pub const DEFAULT_DECAY: f64 = 0.5;

/// Nodes above this threshold are HOT (KV-prefetch eligible).
pub const HOT_THRESHOLD: f64 = 1.0;

/// Nodes below this threshold are DORMANT (excluded from traversal).
pub const DORMANT_THRESHOLD: f64 = -3.5;

/// Switch from exact to approximate formula above this access count.
pub const APPROX_THRESHOLD: usize = 1000;

/// Compute the ACT-R base-level activation for a node at a given time.
///
/// Exact formula (< APPROX_THRESHOLD accesses):
///   B_i = ln( Σ_{k=1}^{n} t_k^{-d} )
///   where t_k = (now_ms - access_timestamps[k]) / 1000.0 (elapsed seconds)
///   t_k is clamped to ≥ 0.001 to avoid division by zero.
///
/// Continuous approximation (≥ APPROX_THRESHOLD accesses):
///   B_i ≈ ln( n / (1 - d) * L^{-d} )
///   where L = (now_ms - created_at_ms) / 1000.0 (lifetime in seconds)
///
/// Returns f64::NEG_INFINITY if n == 0 (never accessed).
pub fn compute_activation(node: &MemoryNode, now_ms: u64, decay: f64) -> f64 {
    let n = node.access_timestamps.len();
    if n == 0 {
        return f64::NEG_INFINITY;
    }

    if n < APPROX_THRESHOLD {
        // ── Exact formula ───────────────────────────────────────
        let sum: f64 = node.access_timestamps.iter().map(|&t_access| {
            // Guard against future timestamps (clock skew)
            let elapsed_ms = if now_ms >= t_access { now_ms - t_access } else { 0 };
            let elapsed_s = (elapsed_ms as f64 / 1000.0).max(0.001);
            elapsed_s.powf(-decay)
        }).sum();

        if sum <= 0.0 {
            return f64::NEG_INFINITY;
        }
        sum.ln()
    } else {
        // ── Continuous approximation ────────────────────────────
        let lifetime_s = if now_ms >= node.created_at_ms {
            ((now_ms - node.created_at_ms) as f64 / 1000.0).max(0.001)
        } else {
            0.001
        };
        let approx = (n as f64 / (1.0 - decay)) * lifetime_s.powf(-decay);
        if approx <= 0.0 {
            return f64::NEG_INFINITY;
        }
        approx.ln()
    }
}

/// Classify the activation score into HOT / ACTIVE / DORMANT state.
pub fn classify_state(activation: f64) -> ActivationState {
    if activation > HOT_THRESHOLD {
        ActivationState::Hot
    } else if activation > DORMANT_THRESHOLD {
        ActivationState::Active
    } else {
        ActivationState::Dormant
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::node::{MemoryNode, NodeType};
    use std::collections::HashMap;

    fn make_node(access_offsets_s: &[u64]) -> (MemoryNode, u64) {
        let now = 1_700_000_000_000u64; // fixed reference ms
        let timestamps: Vec<u64> = access_offsets_s.iter()
            .map(|&offset| now - offset * 1000)
            .collect();
        let created = timestamps.iter().copied().min().unwrap_or(now);
        let mut node = MemoryNode::new(
            "test-node".to_string(),
            "test content".to_string(),
            vec![],
            NodeType::Episodic,
            "agent-test".to_string(),
            None,
            HashMap::new(),
        );
        node.created_at_ms = created;
        node.access_timestamps = timestamps;
        (node, now)
    }

    #[test]
    fn test3_activation_formula() {
        // access 1h, 2h, 24h ago
        let (node, now) = make_node(&[3600, 7200, 86400]);
        let result = compute_activation(&node, now, DEFAULT_DECAY);
        let expected = -3.447f64;
        assert!((result - expected).abs() < 0.001,
            "Expected ~{expected}, got {result:.4}");
    }

    #[test]
    fn test4_fresh_access_increases_activation() {
        let (mut node, now) = make_node(&[3600, 7200, 86400]);
        let old_score = compute_activation(&node, now, DEFAULT_DECAY);
        // Add a fresh access (60s ago)
        node.access_timestamps.push(now - 60_000);
        let new_score = compute_activation(&node, now, DEFAULT_DECAY);
        assert!(new_score > old_score,
            "Fresh access should increase activation: {new_score:.4} > {old_score:.4}");
    }

    #[test]
    fn zero_accesses_returns_neg_infinity() {
        let mut node = MemoryNode::new(
            "n".to_string(), "c".to_string(), vec![],
            NodeType::Episodic, "a".to_string(), None, HashMap::new(),
        );
        node.access_timestamps.clear();
        let score = compute_activation(&node, 1_700_000_000_000, DEFAULT_DECAY);
        assert_eq!(score, f64::NEG_INFINITY);
    }

    #[test]
    fn classify_thresholds() {
        assert_eq!(classify_state(2.0), ActivationState::Hot);
        assert_eq!(classify_state(0.0), ActivationState::Active);
        assert_eq!(classify_state(-4.0), ActivationState::Dormant);
    }
}
