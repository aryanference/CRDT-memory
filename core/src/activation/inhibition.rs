// core/src/activation/inhibition.rs
// Lateral inhibition: dominant nodes suppress similar nodes in the result set.
// Formula: I(i→j) = λ · max(0, A_i(t) - θ_inhibit) · Sim(i, j)

use crate::activation::spreading::ActivatedNode;

/// Inhibition coefficient (λ)
pub const INHIBITION_COEFFICIENT: f64 = 0.8;
/// A node is dominant and inhibits others if its score exceeds this threshold (θ_inhibit)
pub const INHIBIT_THRESHOLD: f64 = 0.6;
/// Nodes whose score falls below this after inhibition are pruned
pub const PRUNE_THRESHOLD: f64 = 0.05;

/// Compute cosine similarity between two f32 embedding vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    ((dot / (norm_a * norm_b)).clamp(-1.0, 1.0)) as f64
}

/// Apply lateral inhibition to a set of activated nodes.
///
/// Algorithm:
///   For each dominant node i (score >= INHIBIT_THRESHOLD):
///     For each other node j:
///       sim = cosine_similarity(i.embedding, j.embedding)
///       inhibition = λ * max(0, score_i - θ_inhibit) * sim
///       score_j -= inhibition
///       if score_j was reduced, mark j.was_inhibited = true
///   Remove all nodes where final score < PRUNE_THRESHOLD
///   Sort remaining nodes by score descending
pub fn apply_lateral_inhibition(mut nodes: Vec<ActivatedNode>) -> Vec<ActivatedNode> {
    if nodes.len() < 2 {
        return nodes;
    }

    // Extract scores for mutation
    let n = nodes.len();
    let scores_orig: Vec<f64> = nodes.iter().map(|n| n.score).collect();
    let mut scores: Vec<f64> = scores_orig.clone();
    let mut inhibited: Vec<bool> = vec![false; n];

    // Identify dominant nodes
    for i in 0..n {
        if scores_orig[i] < INHIBIT_THRESHOLD {
            continue;
        }
        let embedding_i = nodes[i].node.embedding.clone();
        let score_i = scores_orig[i];

        for j in 0..n {
            if i == j { continue; }
            let embedding_j = &nodes[j].node.embedding;
            let sim = cosine_similarity(&embedding_i, embedding_j);
            let inhibition = INHIBITION_COEFFICIENT
                * (score_i - INHIBIT_THRESHOLD).max(0.0)
                * sim;
            if inhibition > 0.0 {
                scores[j] -= inhibition;
                inhibited[j] = true;
            }
        }
    }

    // Apply new scores, mark inhibited, filter and sort
    let mut result: Vec<ActivatedNode> = nodes.drain(..)
        .enumerate()
        .filter_map(|(i, mut node)| {
            node.score = scores[i];
            node.was_inhibited = inhibited[i];
            if node.score >= PRUNE_THRESHOLD {
                Some(node)
            } else {
                None
            }
        })
        .collect();

    result.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    result
}
