// core/src/graph/crdt.rs
// Three CRDT implementations for distributed merge semantics:
//   - LWWElementSet: Last-Write-Wins element set (graph topology)
//   - PNCounter:     Positive-Negative counter (access counts)
//   - ORSet:         Observed-Remove set (soft deletions)

use std::collections::HashMap;
use serde::{Serialize, Deserialize, de::DeserializeOwned};
use crate::sync::vector_clock::VectorClock;

// ═══════════════════════════════════════════════════════════
// LWW Element Set
// Each element carries a (timestamp_ms, value). On conflict
// (same key in both sets), the entry with the higher timestamp wins.
// ═══════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LWWEntry<T> {
    pub value: T,
    pub timestamp_ms: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LWWElementSet<T>
where
    T: Clone + Serialize,
{
    pub entries: HashMap<String, LWWEntry<T>>,
}

impl<T> LWWElementSet<T>
where
    T: Clone + Serialize + DeserializeOwned,
{
    pub fn new() -> Self {
        Self { entries: HashMap::new() }
    }

    /// Insert or update an element. Higher timestamp wins.
    pub fn insert(&mut self, key: String, value: T, timestamp_ms: u64) {
        let update = match self.entries.get(&key) {
            Some(existing) => timestamp_ms > existing.timestamp_ms,
            None => true,
        };
        if update {
            self.entries.insert(key, LWWEntry { value, timestamp_ms });
        }
    }

    pub fn get(&self, key: &str) -> Option<&T> {
        self.entries.get(key).map(|e| &e.value)
    }

    pub fn get_mut(&mut self, key: &str) -> Option<&mut T> {
        self.entries.get_mut(key).map(|e| &mut e.value)
    }

    pub fn contains(&self, key: &str) -> bool {
        self.entries.contains_key(key)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn values(&self) -> impl Iterator<Item = &T> {
        self.entries.values().map(|e| &e.value)
    }

    pub fn values_mut(&mut self) -> impl Iterator<Item = &mut T> {
        self.entries.values_mut().map(|e| &mut e.value)
    }

    pub fn keys(&self) -> impl Iterator<Item = &String> {
        self.entries.keys()
    }

    /// Merge another LWW set. For each key, keep whichever has the higher timestamp.
    pub fn merge(&mut self, other: &Self) {
        for (key, other_entry) in &other.entries {
            self.insert(key.clone(), other_entry.value.clone(), other_entry.timestamp_ms);
        }
    }

    /// Produce a delta containing only entries newer than the given clock.
    /// For LWW we use the max observed timestamp in the clock as our cutoff.
    pub fn to_delta(&self, since_timestamp_ms: u64) -> Self {
        let entries = self.entries.iter()
            .filter(|(_, e)| e.timestamp_ms > since_timestamp_ms)
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        Self { entries }
    }

    /// Apply a delta (same as merge).
    pub fn apply_delta(&mut self, delta: &Self) {
        self.merge(delta);
    }
}

impl<T> Default for LWWElementSet<T>
where
    T: Clone + Serialize + DeserializeOwned,
{
    fn default() -> Self {
        Self::new()
    }
}

// ═══════════════════════════════════════════════════════════
// PN Counter
// Positive-Negative counter with per-agent vectors.
// merge() takes element-wise max of both P and N vectors.
// value() = sum(P) - sum(N)
// ═══════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct PNCounter {
    /// Map from agent_id → increment count
    pub positive: HashMap<String, u64>,
    /// Map from agent_id → decrement count
    pub negative: HashMap<String, u64>,
}

impl PNCounter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn increment(&mut self, agent_id: &str) {
        *self.positive.entry(agent_id.to_string()).or_insert(0) += 1;
    }

    pub fn decrement(&mut self, agent_id: &str) {
        *self.negative.entry(agent_id.to_string()).or_insert(0) += 1;
    }

    pub fn value(&self) -> i64 {
        let pos: u64 = self.positive.values().sum();
        let neg: u64 = self.negative.values().sum();
        pos as i64 - neg as i64
    }

    /// Merge by taking element-wise max of P and N vectors.
    pub fn merge(&mut self, other: &Self) {
        for (agent, &count) in &other.positive {
            let e = self.positive.entry(agent.clone()).or_insert(0);
            *e = (*e).max(count);
        }
        for (agent, &count) in &other.negative {
            let e = self.negative.entry(agent.clone()).or_insert(0);
            *e = (*e).max(count);
        }
    }

    /// Delta is just the full counter (simple approach; deltas are small).
    pub fn to_delta(&self, _since: &VectorClock) -> Self {
        self.clone()
    }

    pub fn apply_delta(&mut self, delta: &Self) {
        self.merge(delta);
    }
}

// ═══════════════════════════════════════════════════════════
// OR-Set (Observed-Remove Set)
// Each add assigns a unique tag. Remove targets specific tags.
// merge = union(add_sets) INTERSECT complement(remove_sets).
// Used to track soft-deletion intent for node IDs.
// ═══════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct ORSet<T>
where
    T: Clone + Serialize + Eq + std::hash::Hash,
{
    /// (element, unique_tag) pairs that have been added
    pub add_set: HashMap<String, T>,   // tag → element
    /// tags that have been removed
    pub remove_set: std::collections::HashSet<String>,
}

impl<T> ORSet<T>
where
    T: Clone + Serialize + DeserializeOwned + Eq + std::hash::Hash + std::fmt::Debug,
{
    pub fn new() -> Self {
        Self::default()
    }

    /// Add an element with a freshly generated unique tag.
    pub fn add(&mut self, element: T, tag: String) {
        self.add_set.insert(tag, element);
    }

    /// Remove an element by targeting all its current tags.
    /// This only removes tags that are currently in add_set.
    pub fn remove_by_tags(&mut self, tags: &[String]) {
        for tag in tags {
            self.remove_set.insert(tag.clone());
        }
    }

    /// Find all tags associated with a given element value.
    pub fn tags_for(&self, element: &T) -> Vec<String>
    where
        T: PartialEq,
    {
        self.add_set.iter()
            .filter(|(_, v)| *v == element)
            .map(|(k, _)| k.clone())
            .collect()
    }

    /// Returns true if the element is present (added but not fully removed).
    pub fn contains(&self, element: &T) -> bool
    where
        T: PartialEq,
    {
        self.add_set.iter().any(|(tag, v)| {
            v == element && !self.remove_set.contains(tag)
        })
    }

    /// All live elements.
    pub fn elements(&self) -> Vec<&T> {
        self.add_set.iter()
            .filter(|(tag, _)| !self.remove_set.contains(*tag))
            .map(|(_, v)| v)
            .collect()
    }

    /// Merge: union of add-sets, union of remove-sets.
    pub fn merge(&mut self, other: &Self) {
        for (tag, elem) in &other.add_set {
            self.add_set.entry(tag.clone()).or_insert_with(|| elem.clone());
        }
        for tag in &other.remove_set {
            self.remove_set.insert(tag.clone());
        }
    }

    pub fn to_delta(&self, _since: &VectorClock) -> Self {
        self.clone()
    }

    pub fn apply_delta(&mut self, delta: &Self) {
        self.merge(delta);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lww_higher_timestamp_wins() {
        let mut set: LWWElementSet<String> = LWWElementSet::new();
        set.insert("k1".to_string(), "old".to_string(), 100);
        set.insert("k1".to_string(), "new".to_string(), 200);
        assert_eq!(set.get("k1"), Some(&"new".to_string()));

        // Lower timestamp does NOT overwrite
        set.insert("k1".to_string(), "old".to_string(), 50);
        assert_eq!(set.get("k1"), Some(&"new".to_string()));
    }

    #[test]
    fn lww_merge_convergence() {
        let mut a: LWWElementSet<String> = LWWElementSet::new();
        let mut b: LWWElementSet<String> = LWWElementSet::new();
        a.insert("k1".to_string(), "from_a".to_string(), 100);
        b.insert("k2".to_string(), "from_b".to_string(), 200);
        a.merge(&b);
        b.merge(&a);
        assert_eq!(a.len(), 2);
        assert_eq!(b.len(), 2);
    }

    #[test]
    fn pn_counter_basic() {
        let mut c = PNCounter::new();
        c.increment("agent-1");
        c.increment("agent-1");
        c.decrement("agent-1");
        assert_eq!(c.value(), 1);
    }

    #[test]
    fn pn_counter_merge() {
        let mut a = PNCounter::new();
        let mut b = PNCounter::new();
        a.increment("agent-1");
        b.increment("agent-2");
        a.merge(&b);
        assert_eq!(a.value(), 2);
    }

    #[test]
    fn orset_add_remove() {
        let mut s: ORSet<String> = ORSet::new();
        s.add("node-1".to_string(), "tag-001".to_string());
        assert!(s.contains(&"node-1".to_string()));
        let tags = s.tags_for(&"node-1".to_string());
        s.remove_by_tags(&tags);
        assert!(!s.contains(&"node-1".to_string()));
    }
}
