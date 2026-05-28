// core/src/main.rs
// gRPC daemon entry point for the PCCM core engine.

use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use parking_lot::RwLock;
use tonic::transport::Server;
use tonic::{Request, Response, Status, Streaming};
use tokio_stream::wrappers::ReceiverStream;
use tracing::{info, warn, error};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

use pccm_core::proto::pccm_core_server::{PccmCore, PccmCoreServer};
use pccm_core::proto::*;
use pccm_core::{
    PCCMStore, StoreError,
    graph::node::{MemoryNode, NodeType, now_ms},
    graph::edge::{CausalEdge, EdgeType},
    activation::{
        base_level::{compute_activation, classify_state},
        spreading::{run as run_spreading, SpreadingActivationConfig},
        decay_worker::run_decay_worker,
    },
    sync::gossip::{run_gossip_worker, GossipConfig},
};

type SharedStore = Arc<RwLock<PCCMStore>>;

struct PCCMCoreService {
    store: SharedStore,
    graph_tx: tokio::sync::broadcast::Sender<GraphEvent>,
}

#[tonic::async_trait]
impl PccmCore for PCCMCoreService {
    type StreamGraphUpdatesStream = ReceiverStream<Result<GraphEvent, Status>>;

    async fn insert_node(
        &self,
        req: Request<InsertNodeRequest>,
    ) -> Result<Response<InsertNodeResponse>, Status> {
        let r = req.into_inner();
        let node_type = NodeType::from_str(&r.node_type);
        let embedding: Vec<f32> = r.embedding;
        let (embedding, embedding_failed) = if embedding.is_empty() {
            (vec![0.0f32; 1536], true)
        } else {
            (embedding, false)
        };

        let mut node = MemoryNode::new(
            Uuid::new_v4().to_string(),
            r.content,
            embedding,
            node_type,
            r.agent_id.clone(),
            if r.session_id.is_empty() { None } else { Some(r.session_id) },
            r.metadata,
        );
        node.embedding_failed = embedding_failed;

        let mut store = self.store.write();
        let node_id = store.insert_node(node.clone()).map_err(|e| {
            error!("InsertNode failed: {e}");
            Status::internal(e.to_string())
        })?;

        // Create causal edges to parents
        let edge_type = EdgeType::from_str(&r.edge_type_to_parents);
        for parent_id in &r.causal_parent_ids {
            let edge = CausalEdge {
                id: Uuid::new_v4().to_string(),
                source_id: parent_id.clone(),
                target_id: node_id.clone(),
                edge_type: edge_type.clone(),
                weight: 1.0,
                created_at_ms: now_ms(),
                agent_id: r.agent_id.clone(),
            };
            if let Err(e) = store.insert_edge(edge) {
                warn!("Failed to create causal edge: {e}");
            }
        }

        let activation_score = store.get_node(&node_id)
            .map(|n| n.activation_score)
            .unwrap_or(0.0);

        let _ = self.graph_tx.send(GraphEvent {
            event_type: "node_added".to_string(),
            node_id: node_id.clone(),
            edge_id: String::new(),
            agent_id: r.agent_id,
            activation_score,
            timestamp_ms: now_ms() as i64,
            delta_size_bytes: 0,
        });

        Ok(Response::new(InsertNodeResponse {
            node_id,
            activation_score,
            success: true,
            error: String::new(),
        }))
    }

    async fn insert_edge(
        &self,
        req: Request<InsertEdgeRequest>,
    ) -> Result<Response<InsertEdgeResponse>, Status> {
        let r = req.into_inner();
        let edge = CausalEdge {
            id: Uuid::new_v4().to_string(),
            source_id: r.source_id,
            target_id: r.target_id,
            edge_type: EdgeType::from_str(&r.edge_type),
            weight: r.weight,
            created_at_ms: now_ms(),
            agent_id: r.agent_id,
        };

        let mut store = self.store.write();
        let edge_id = store.insert_edge(edge).map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(InsertEdgeResponse {
            edge_id,
            success: true,
            error: String::new(),
        }))
    }

    async fn query(
        &self,
        req: Request<QueryRequest>,
    ) -> Result<Response<QueryResponse>, Status> {
        let r = req.into_inner();
        let start_ms = now_ms();

        let query_embedding: Vec<f32> = if r.query_embedding.is_empty() {
            vec![0.0f32; 1536]
        } else {
            r.query_embedding
        };

        let config = SpreadingActivationConfig {
            semantic_threshold: if r.semantic_threshold == 0.0 { 0.75 } else { r.semantic_threshold },
            max_nodes: if r.max_nodes == 0 { 100 } else { r.max_nodes as usize },
            batch_size: 20,
            hop_decay: 0.5,
            time_window_days: if r.time_window_days == 0 { 7 } else { r.time_window_days as u32 },
            query_time_center_ms: if r.query_time_center_ms == 0 {
                now_ms()
            } else {
                r.query_time_center_ms as u64
            },
        };

        let activated = {
            let store = self.store.read();
            run_spreading(&store, &query_embedding, &config)
        };

        let latency_ms = (now_ms() - start_ms) as f64;

        // Estimate token counts (word count × 1.3)
        let context_tokens: i32 = activated.iter()
            .map(|n| (n.node.content.split_whitespace().count() as f32 * 1.3) as i32)
            .sum();

        let full_context_estimate = {
            let store = self.store.read();
            (store.node_count() as f32 * 50.0 * 1.3) as i32
        };

        let activated_nodes: Vec<ActivatedNodeProto> = activated.into_iter()
            .map(|an| ActivatedNodeProto {
                node_id: an.node.id,
                content: an.node.content,
                activation_score: an.score,
                temporal_score: 0.0, // included in score
                propagation_path: an.propagation_path,
                was_inhibited: an.was_inhibited,
                node_type: an.node.node_type.as_str().to_string(),
            })
            .collect();

        Ok(Response::new(QueryResponse {
            activated_nodes,
            context_tokens_used: context_tokens,
            full_context_tokens_avoided: (full_context_estimate - context_tokens).max(0),
            latency_ms,
            prefetch_cache_hits: 0,
        }))
    }

    async fn get_node(
        &self,
        req: Request<GetNodeRequest>,
    ) -> Result<Response<GetNodeResponse>, Status> {
        let node_id = req.into_inner().node_id;
        let store = self.store.read();

        match store.get_node(&node_id) {
            Some(node) => {
                let proto = MemoryNodeProto {
                    id: node.id.clone(),
                    content: node.content.clone(),
                    embedding: node.embedding.clone(),
                    node_type: node.node_type.as_str().to_string(),
                    created_at_ms: node.created_at_ms,
                    last_accessed_ms: node.last_accessed_ms,
                    access_timestamps: node.access_timestamps.clone(),
                    activation_score: node.activation_score,
                    activation_state: node.activation_state.as_str().to_string(),
                    agent_id: node.agent_id.clone(),
                    session_id: node.session_id.clone().unwrap_or_default(),
                    metadata: node.metadata.clone(),
                };
                Ok(Response::new(GetNodeResponse { node: Some(proto), found: true }))
            }
            None => Ok(Response::new(GetNodeResponse { node: None, found: false })),
        }
    }

    async fn get_context_chain(
        &self,
        req: Request<GetContextChainRequest>,
    ) -> Result<Response<GetContextChainResponse>, Status> {
        let r = req.into_inner();
        let node_id = r.node_id;
        let max_depth = if r.max_depth == 0 { 10 } else { r.max_depth as usize };

        let store = self.store.read();
        let mut chain: Vec<ActivatedNodeProto> = Vec::new();
        let mut visited = std::collections::HashSet::new();
        let mut frontier = vec![node_id.clone()];
        let mut depth = 0;

        while !frontier.is_empty() && depth < max_depth {
            let mut next_frontier = Vec::new();
            for id in &frontier {
                if visited.contains(id) { continue; }
                visited.insert(id.clone());

                if let Some(node) = store.get_node(id) {
                    chain.push(ActivatedNodeProto {
                        node_id: node.id.clone(),
                        content: node.content.clone(),
                        activation_score: node.activation_score,
                        temporal_score: 0.0,
                        propagation_path: vec![],
                        was_inhibited: false,
                        node_type: node.node_type.as_str().to_string(),
                    });

                    let causal_types = [EdgeType::Causes, EdgeType::CausedBy, EdgeType::Enables];
                    for (neighbor, _) in store.get_neighbors(id, &causal_types) {
                        if !visited.contains(&neighbor.id) {
                            next_frontier.push(neighbor.id.clone());
                        }
                    }
                }
            }
            frontier = next_frontier;
            depth += 1;
        }

        let total = chain.len() as i32;
        Ok(Response::new(GetContextChainResponse {
            root_node_id: node_id,
            chain,
            total_nodes: total,
        }))
    }

    async fn get_sync_status(
        &self,
        req: Request<GetSyncStatusRequest>,
    ) -> Result<Response<GetSyncStatusResponse>, Status> {
        let swarm_id = req.into_inner().swarm_id;
        let store = self.store.read();

        let clock_map: std::collections::HashMap<String, i64> = store
            .vector_clock()
            .clock
            .iter()
            .map(|(k, v)| (k.clone(), *v as i64))
            .collect();

        Ok(Response::new(GetSyncStatusResponse {
            swarm_id,
            agent_count: 1, // single node; swarm aggregation is API-layer concern
            total_nodes: store.node_count() as i32,
            hot_nodes: store.hot_node_count() as i32,
            dormant_nodes: store.dormant_node_count() as i32,
            last_gossip_ms: store.last_gossip_ms() as i64,
            vector_clock: clock_map,
        }))
    }

    async fn stream_graph_updates(
        &self,
        _req: Request<StreamRequest>,
    ) -> Result<Response<Self::StreamGraphUpdatesStream>, Status> {
        let mut rx = self.graph_tx.subscribe();
        let (tx, rx_out) = tokio::sync::mpsc::channel(128);

        tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                if tx.send(Ok(event)).await.is_err() {
                    break;
                }
            }
        });

        Ok(Response::new(ReceiverStream::new(rx_out)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env()
            .add_directive("pccm_core=info".parse()?)
            .add_directive("tonic=warn".parse()?))
        .init();

    // Load config from environment
    let agent_id = env::var("PCCM_AGENT_ID").unwrap_or_else(|_| "agent-001".to_string());
    let grpc_port: u16 = env::var("PCCM_GRPC_PORT")
        .unwrap_or_else(|_| "50051".to_string())
        .parse()
        .unwrap_or(50051);
    let sqlite_path = env::var("SQLITE_PATH").unwrap_or_else(|_| "./data/pccm.db".to_string());
    let decay: f64 = env::var("ACTIVATION_DECAY")
        .unwrap_or_else(|_| "0.5".to_string())
        .parse()
        .unwrap_or(0.5);
    let sync_interval_ms: u64 = env::var("CRDT_SYNC_INTERVAL_MS")
        .unwrap_or_else(|_| "50".to_string())
        .parse()
        .unwrap_or(50);
    let gossip_peers: Vec<String> = env::var("GOSSIP_PEERS")
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();

    // Ensure data directory exists
    if let Some(parent) = std::path::Path::new(&sqlite_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    info!("Starting PCCM Core daemon (agent={agent_id}, grpc_port={grpc_port})");

    // Build shared store
    let store = Arc::new(RwLock::new(PCCMStore::new(agent_id.clone(), &sqlite_path, decay)?));

    // Graph event broadcast channel
    let (graph_tx, _) = tokio::sync::broadcast::channel::<GraphEvent>(1024);

    // Spawn background workers
    let decay_store = Arc::clone(&store);
    tokio::spawn(async move {
        run_decay_worker(decay_store, decay).await;
    });

    let gossip_store = Arc::clone(&store);
    let gossip_config = GossipConfig {
        sync_interval_ms,
        peer_addresses: gossip_peers,
        max_delta_bytes: 65536,
    };
    tokio::spawn(async move {
        run_gossip_worker(gossip_store, gossip_config).await;
    });

    // Start gRPC server
    let addr: SocketAddr = format!("0.0.0.0:{grpc_port}").parse()?;
    let service = PCCMCoreService { store, graph_tx };

    info!("gRPC server listening on {addr}");
    Server::builder()
        .add_service(PccmCoreServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}
