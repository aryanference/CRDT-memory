// core/tests/activation_math.rs
// Tests 3 & 4: ACT-R base-level activation formula.

use pccm_core::activation::base_level::{compute_activation, DEFAULT_DECAY};
use pccm_core::graph::node::{MemoryNode, NodeType};
use std::collections::HashMap;

fn make_node_with_accesses(access_offsets_s: &[u64], now_ms: u64) -> MemoryNode {
    let timestamps: Vec<u64> = access_offsets_s.iter()
        .map(|&offset| now_ms - offset * 1000)
        .collect();
    let created = timestamps.iter().copied().min().unwrap_or(now_ms);
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
    node
}

/// Test 3: B_i with accesses at 1h, 2h, 24h ago should be ≈ -3.447
///
/// Manual computation:
///   t1 = 3600s → 3600^{-0.5} = 0.016667
///   t2 = 7200s → 7200^{-0.5} = 0.011785
///   t3 = 86400s → 86400^{-0.5} = 0.003401
///   sum = 0.031853
///   ln(0.031853) ≈ -3.447
#[test]
fn test3_activation_exact_formula() {
    let now_ms = 1_700_000_000_000u64;
    let node = make_node_with_accesses(&[3600, 7200, 86400], now_ms);
    let result = compute_activation(&node, now_ms, DEFAULT_DECAY);
    let expected = -3.447f64;
    let c1 = 3600f64.powf(-DEFAULT_DECAY);
    let c2 = 7200f64.powf(-DEFAULT_DECAY);
    let c3 = 86400f64.powf(-DEFAULT_DECAY);
    assert!(
        (result - expected).abs() < 0.001,
        "Expected B_i ≈ {:.3}, got {:.6}. Components: 3600^-0.5={:.6}, 7200^-0.5={:.6}, 86400^-0.5={:.6}",
        expected, result, c1, c2, c3,
    );
}

/// Test 4: Adding a fresh access (60s ago) must increase the activation score.
#[test]
fn test4_fresh_access_increases_activation() {
    let now_ms = 1_700_000_000_000u64;
    let node_old = make_node_with_accesses(&[3600, 7200, 86400], now_ms);
    let mut node_new = node_old.clone();
    // Add a fresh access 60 seconds ago
    node_new.access_timestamps.push(now_ms - 60_000);

    let old_score = compute_activation(&node_old, now_ms, DEFAULT_DECAY);
    let new_score = compute_activation(&node_new, now_ms, DEFAULT_DECAY);

    assert!(
        new_score > old_score,
        "Fresh access must increase activation: {:.6} > {:.6}",
        new_score, old_score
    );
}
