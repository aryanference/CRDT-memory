// core/src/sync/vector_clock.rs
// Logical vector clock for causal ordering across agents.
// Each agent has its own position in the clock.
// Merge = element-wise max.

use std::collections::HashMap;
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct VectorClock {
    /// Map from agent_id → logical timestamp
    pub clock: HashMap<String, u64>,
}

impl VectorClock {
    pub fn new() -> Self {
        Self::default()
    }

    /// Increment this agent's position.
    pub fn tick(&mut self, agent_id: &str) {
        *self.clock.entry(agent_id.to_string()).or_insert(0) += 1;
    }

    /// Get the current value for an agent (0 if unknown).
    pub fn get(&self, agent_id: &str) -> u64 {
        *self.clock.get(agent_id).unwrap_or(&0)
    }

    /// Merge by taking element-wise maximum.
    pub fn merge(&mut self, other: &Self) {
        for (agent, &ts) in &other.clock {
            let e = self.clock.entry(agent.clone()).or_insert(0);
            *e = (*e).max(ts);
        }
    }

    /// Returns the maximum timestamp across all agents (used as a cutoff for deltas).
    pub fn max_ts(&self) -> u64 {
        self.clock.values().copied().max().unwrap_or(0)
    }

    /// Compare: returns true if self is causally after or concurrent with other.
    /// Returns false if other is strictly after self (self is behind).
    pub fn happens_before(&self, other: &Self) -> bool {
        // self ≤ other for all known positions
        self.clock.iter().all(|(agent, &ts)| ts <= other.get(agent))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vector_clock_merge() {
        let mut a = VectorClock::new();
        let mut b = VectorClock::new();
        a.tick("agent-1");
        a.tick("agent-1");
        b.tick("agent-2");
        a.merge(&b);
        assert_eq!(a.get("agent-1"), 2);
        assert_eq!(a.get("agent-2"), 1);
    }

    #[test]
    fn happens_before() {
        let mut a = VectorClock::new();
        let mut b = VectorClock::new();
        a.tick("agent-1");
        b.tick("agent-1");
        b.tick("agent-1");
        assert!(a.happens_before(&b));
        assert!(!b.happens_before(&a));
    }
}
