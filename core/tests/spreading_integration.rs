// core/tests/spreading_integration.rs
// Test 5: Spreading activation traverses causal chains, not disconnected nodes.

use pccm_core::graph::node::{MemoryNode, NodeType};
use pccm_core::graph::edge::{CausalEdge, EdgeType};
use pccm_core::graph::store::PCCMStore;
use pccm_core::activation::spreading::{run as run_spreading, SpreadingActivationConfig};
use std::collections::HashMap;
use uuid::Uuid;

fn make_store() -> PCCMStore {
    PCCMStore::new("agent-test".to_string(), ":memory:", 0.5)
        .expect("store creation failed")
}

fn make_node_with_embedding(id: &str, content: &str, embedding: Vec<f32>) -> MemoryNode {
    let mut node = MemoryNode::new(
        id.to_string(),
        content.to_string(),
        embedding,
        NodeType::Episodic,
        "agent-test".to_string(),
        None,
        HashMap::new(),
    );
    // Give it a recent access so activation score is non-trivial
    let now = pccm_core::graph::node::now_ms();
    node.access_timestamps = vec![now - 60_000, now - 3_600_000];
    node
}

/// Test 5: Spreading activation traverses n1→n2→n3 chain but skips disconnected n6–n10.
#[test]
fn test5_causal_chain_traversal() {
    let mut store = make_store();

    // Create a query embedding (unit vector in dimension 0)
    let mut query_emb = vec![0.0f32; 384];
    query_emb[0] = 1.0;

    // Create chain nodes: n1, n2, n3, n4, n5
    // n1 has embedding aligned with query (high similarity)
    let mut n1_emb = vec![0.0f32; 384];
    n1_emb[0] = 0.99; // very similar to query

    let mut chain_embeddings: Vec<Vec<f32>> = vec![];
    chain_embeddings.push(n1_emb);
    for i in 1..5 {
        let mut emb = vec![0.0f32; 384];
        emb[0] = 0.9 - (i as f32 * 0.05); // decreasing similarity
        chain_embeddings.push(emb);
    }

    let chain_ids: Vec<String> = (1..=5).map(|i| format!("n{i}")).collect();
    let disconnected_ids: Vec<String> = (6..=10).map(|i| format!("n{i}")).collect();

    // Insert chain nodes
    for (i, id) in chain_ids.iter().enumerate() {
        let node = make_node_with_embedding(
            id,
            &format!("Chain node {}", i + 1),
            chain_embeddings[i].clone(),
        );
        store.insert_node(node).expect("insert failed");
    }

    // Insert disconnected nodes with orthogonal embeddings
    for id in &disconnected_ids {
        let mut emb = vec![0.0f32; 384];
        emb[1] = 1.0; // orthogonal to query (dimension 1, not 0)
        let node = make_node_with_embedding(id, &format!("Disconnected {id}"), emb);
        store.insert_node(node).expect("insert failed");
    }

    // Create causal chain: n1→n2→n3→n4→n5
    for i in 0..4 {
        let edge = CausalEdge {
            id: Uuid::new_v4().to_string(),
            source_id: chain_ids[i].clone(),
            target_id: chain_ids[i + 1].clone(),
            edge_type: EdgeType::Causes,
            weight: 1.0,
            created_at_ms: pccm_core::graph::node::now_ms(),
            agent_id: "agent-test".to_string(),
        };
        store.insert_edge(edge).expect("insert edge failed");
    }

    // Run spreading activation with the query embedding
    let config = SpreadingActivationConfig {
        semantic_threshold: 0.5, // lower threshold to ensure n1 is found
        max_nodes: 50,
        batch_size: 20,
        hop_decay: 0.5,
        time_window_days: 7,
        query_time_center_ms: 0,
    };

    let results = run_spreading(&store, &query_emb, &config);

    let result_ids: std::collections::HashSet<String> = results.iter()
        .map(|n| n.node.id.clone())
        .collect();

    // Assert chain nodes n1, n2, n3 are present
    assert!(result_ids.contains("n1"), "n1 (query match) must be activated");
    assert!(result_ids.contains("n2"), "n2 (causal child of n1) must be activated");
    assert!(result_ids.contains("n3"), "n3 (causal grandchild) must be activated");

    // Assert disconnected nodes n6–n10 are NOT present
    for id in &disconnected_ids {
        assert!(!result_ids.contains(id),
            "Disconnected node {id} must NOT appear in results");
    }

    // Assert hop decay: n4 and n5 should have lower scores than n1 and n2
    let get_score = |id: &str| {
        results.iter().find(|n| n.node.id == id).map(|n| n.score)
    };

    if let (Some(s1), Some(s4)) = (get_score("n1"), get_score("n4")) {
        assert!(s1 >= s4,
            "n1 score ({s1:.4}) should be >= n4 score ({s4:.4}) due to hop decay");
    }
    if let (Some(s2), Some(s5)) = (get_score("n2"), get_score("n5")) {
        assert!(s2 >= s5,
            "n2 score ({s2:.4}) should be >= n5 score ({s5:.4}) due to hop decay");
    }
}
