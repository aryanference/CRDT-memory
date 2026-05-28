"""Pydantic v2 response schemas for the PCCM API."""

from pydantic import BaseModel


class ActivatedNodeResponse(BaseModel):
    node_id: str
    content: str
    node_type: str
    activation_score: float
    temporal_score: float
    propagation_path: list[str]
    was_inhibited: bool


class QueryResponse(BaseModel):
    activated_nodes: list[ActivatedNodeResponse]
    context_tokens_used: int
    full_context_tokens_avoided: int
    latency_ms: float
    prefetch_cache_hits: int  # always 0 until Tier 3


class IngestEventResponse(BaseModel):
    node_id: str
    activation_score: float
    embedding_ms: float  # time taken to embed content


class ContextChainResponse(BaseModel):
    root_node_id: str
    chain: list[ActivatedNodeResponse]  # ordered from root to leaves
    total_nodes: int


class SyncStatusResponse(BaseModel):
    swarm_id: str
    agent_count: int
    total_nodes: int
    hot_nodes: int
    dormant_nodes: int
    last_gossip_ms: int
    vector_clock: dict[str, int]


class NodeDetailResponse(BaseModel):
    node_id: str
    content: str
    node_type: str
    activation_score: float
    activation_state: str
    agent_id: str
    session_id: str | None
    created_at_ms: int
    last_accessed_ms: int
    access_timestamps: list[int]  # last 20 only
    metadata: dict[str, str]
