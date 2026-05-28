// core/src/lib.rs
// Public API surface for the PCCM core library.

pub mod graph;
pub mod activation;
pub mod sync;
pub mod embed;

// Re-export key types for convenience
pub use graph::node::{MemoryNode, NodeType, ActivationState};
pub use graph::edge::{CausalEdge, EdgeType};
pub use graph::store::{PCCMStore, StoreError};
pub use activation::base_level::{compute_activation, classify_state, DEFAULT_DECAY};
pub use activation::spreading::{SpreadingActivationConfig, ActivatedNode, run as run_spreading};
pub use sync::vector_clock::VectorClock;
pub use sync::delta::DeltaState;

// Generated gRPC code
pub mod proto {
    tonic::include_proto!("pccm");
}
