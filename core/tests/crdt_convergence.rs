// core/tests/crdt_convergence.rs
// Tests 1 & 2: CRDT convergence and LWW semantics.

use pccm_core::graph::node::{MemoryNode, NodeType};
use pccm_core::graph::store::PCCMStore;
use pccm_core::graph::edge::{CausalEdge, EdgeType};
use std::collections::HashMap;
use uuid::Uuid;

fn make_store(agent: &str) -> PCCMStore {
    let path = format!(":memory:"); // SQLite in-memory for tests
    PCCMStore::new(agent.to_string(), &path, 0.5).expect("store creation failed")
}

fn make_node(content: &str, agent: &str) -> MemoryNode {
    MemoryNode::new(
        Uuid::new_v4().to_string(),
        content.to_string(),
        vec![0.1f32; 384],
        NodeType::Episodic,
        agent.to_string(),
        None,
        HashMap::new(),
    )
}

/// Test 1: Two stores converge to contain all 100 nodes.
#[test]
fn test1_full_convergence() {
    let mut store_a = make_store("agent-a");
    let mut store_b = make_store("agent-b");

    // Insert 50 nodes in A
    for i in 0..50 {
        let node = make_node(&format!("memory from A #{i}"), "agent-a");
        store_a.insert_node(node).expect("insert failed");
    }

    // Insert 50 different nodes in B
    for i in 0..50 {
        let node = make_node(&format!("memory from B #{i}"), "agent-b");
        store_b.insert_node(node).expect("insert failed");
    }

    // Gossip: A ← B, then B ← A
    let delta_b = store_b.sync_delta();
    let delta_a = store_a.sync_delta();
    store_a.merge_delta(delta_b).expect("merge failed");
    store_b.merge_delta(delta_a).expect("merge failed");

    assert_eq!(store_a.node_count(), 100, "Store A should have 100 nodes");
    assert_eq!(store_b.node_count(), 100, "Store B should have 100 nodes");

    // Full convergence: every node in A must exist in B
    let ids_a: std::collections::HashSet<_> = {
        let all = store_a.all_node_ids();
        all.into_iter().collect()
    };
    let ids_b: std::collections::HashSet<_> = {
        let all = store_b.all_node_ids();
        all.into_iter().collect()
    };
    assert_eq!(ids_a, ids_b, "All node IDs must match between A and B");
}

/// Test 2: Same node ID inserted in both stores; after merge, higher timestamp wins.
#[test]
fn test2_lww_higher_timestamp_wins() {
    let mut store_a = make_store("agent-a");
    let mut store_b = make_store("agent-b");

    let shared_id = Uuid::new_v4().to_string();

    // Insert same ID in A with an older timestamp
    let mut node_a = MemoryNode::new(
        shared_id.clone(),
        "content from A (old)".to_string(),
        vec![0.1f32; 384],
        NodeType::Episodic,
        "agent-a".to_string(),
        None,
        HashMap::new(),
    );
    // Manually set an older created_at timestamp
    node_a.created_at_ms = 1_000_000;
    store_a.insert_node(node_a).expect("insert failed");

    // Insert same ID in B with a newer timestamp
    let mut node_b = MemoryNode::new(
        shared_id.clone(),
        "content from B (new)".to_string(),
        vec![0.2f32; 384],
        NodeType::Semantic,
        "agent-b".to_string(),
        None,
        HashMap::new(),
    );
    node_b.created_at_ms = 2_000_000;
    store_b.insert_node(node_b).expect("insert failed");

    // Merge B into A
    let delta_b = store_b.sync_delta();
    store_a.merge_delta(delta_b).expect("merge failed");

    // A should now hold the B version (newer content)
    let node = store_a.get_node(&shared_id).expect("node must exist");
    assert_eq!(node.content, "content from B (new)",
        "LWW: higher timestamp should win. Got: {}", node.content);
}
