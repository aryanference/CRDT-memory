// core/src/embed/hnsw.rs
// HNSW approximate nearest-neighbour vector index.
// Wraps `instant-distance` crate for cosine-distance ANN search.

use instant_distance::{Builder, HnswMap, Point, Search};
use serde::{Serialize, Deserialize};

/// A point in the HNSW index backed by a fixed-dimension f32 vector.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingPoint {
    pub dims: Vec<f32>,
}

impl Point for EmbeddingPoint {
    /// Cosine distance: 1 - cosine_similarity.
    /// instant-distance expects a distance (lower = closer).
    fn distance(&self, other: &Self) -> f32 {
        let dot: f32 = self.dims.iter().zip(other.dims.iter()).map(|(a, b)| a * b).sum();
        let norm_a: f32 = self.dims.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = other.dims.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm_a == 0.0 || norm_b == 0.0 {
            return 1.0;
        }
        let cosine_sim = (dot / (norm_a * norm_b)).clamp(-1.0, 1.0);
        1.0 - cosine_sim
    }
}

/// A search result with node_id and similarity (not distance).
#[derive(Clone, Debug)]
pub struct ScoredNode {
    pub node_id: String,
    /// Cosine similarity in [0, 1]
    pub similarity: f32,
}

/// Simple sequential HNSW index wrapping a rebuild-on-insert strategy.
/// For production: switch to an incremental index; this is sufficient for the demo.
pub struct HNSWIndex {
    /// Parallel arrays: embeddings and their corresponding node IDs.
    points: Vec<EmbeddingPoint>,
    ids: Vec<String>,
    /// Built index (rebuilt on each search if dirty).
    map: Option<HnswMap<EmbeddingPoint, String>>,
    dirty: bool,
}

impl HNSWIndex {
    pub fn new() -> Self {
        Self {
            points: Vec::new(),
            ids: Vec::new(),
            map: None,
            dirty: false,
        }
    }

    /// Add a vector to the index. The index will be rebuilt on next search.
    pub fn add(&mut self, node_id: String, embedding: Vec<f32>) {
        self.points.push(EmbeddingPoint { dims: embedding });
        self.ids.push(node_id);
        self.dirty = true;
    }

    /// Remove a node by ID (marks dirty, requires rebuild).
    pub fn remove(&mut self, node_id: &str) {
        if let Some(pos) = self.ids.iter().position(|id| id == node_id) {
            self.points.remove(pos);
            self.ids.remove(pos);
            self.dirty = true;
        }
    }

    fn rebuild(&mut self) {
        if self.points.is_empty() {
            self.map = None;
            self.dirty = false;
            return;
        }
        let pairs: Vec<(EmbeddingPoint, String)> = self.points.iter()
            .zip(self.ids.iter())
            .map(|(p, id)| (p.clone(), id.clone()))
            .collect();
        let map = Builder::default().build(
            pairs.into_iter().map(|(p, v)| (p, v)).collect::<Vec<_>>(),
        );
        self.map = Some(map);
        self.dirty = false;
    }

    /// Search for the top-k nearest neighbours.
    /// Returns a list of (node_id, cosine_similarity) pairs, sorted by similarity descending.
    pub fn search(&mut self, query: &[f32], top_k: usize) -> Vec<ScoredNode> {
        if self.dirty {
            self.rebuild();
        }
        let Some(map) = &self.map else {
            return vec![];
        };
        if map.is_empty() {
            return vec![];
        }

        let query_point = EmbeddingPoint { dims: query.to_vec() };
        let mut search = Search::default();
        let results = map.search(&query_point, &mut search);

        let k = top_k.min(self.ids.len());
        results
            .take(k)
            .map(|item| {
                let similarity = (1.0 - item.distance).clamp(0.0, 1.0);
                ScoredNode {
                    node_id: item.value.clone(),
                    similarity,
                }
            })
            .collect()
    }

    pub fn len(&self) -> usize {
        self.ids.len()
    }

    pub fn is_empty(&self) -> bool {
        self.ids.is_empty()
    }
}

impl Default for HNSWIndex {
    fn default() -> Self {
        Self::new()
    }
}
