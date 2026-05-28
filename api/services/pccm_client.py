"""
gRPC client wrapper for the PCCM core daemon.
Connects to PCCM_DAEMON_GRPC (default: localhost:50051).
All proto-generated stubs are wrapped here for use by routers.
"""

import logging
import os
from typing import Optional

import grpc

# These are generated from proto/pccm.proto by grpcio-tools
# For development, we import a stub-compatible module
try:
    from . import pccm_pb2, pccm_pb2_grpc
except ImportError:
    # Generated stubs not yet available; use a mock for dev
    pccm_pb2 = None
    pccm_pb2_grpc = None

logger = logging.getLogger(__name__)

GRPC_ADDRESS = os.getenv("PCCM_DAEMON_GRPC", "localhost:50051")


def _get_channel() -> grpc.aio.Channel:
    """Get or create a gRPC channel to the core daemon."""
    return grpc.aio.insecure_channel(GRPC_ADDRESS)


class PCCMClient:
    """Async gRPC client for the PCCM core daemon."""

    def __init__(self):
        self._channel: Optional[grpc.aio.Channel] = None
        self._stub = None

    async def _ensure_connected(self):
        if self._channel is None:
            self._channel = grpc.aio.insecure_channel(GRPC_ADDRESS)
            if pccm_pb2_grpc is not None:
                self._stub = pccm_pb2_grpc.PCCMCoreStub(self._channel)

    async def insert_node(
        self,
        agent_id: str,
        session_id: Optional[str],
        content: str,
        node_type: str,
        embedding: list[float],
        causal_parent_ids: list[str],
        edge_type_to_parents: str,
        metadata: dict[str, str],
    ) -> dict:
        await self._ensure_connected()
        try:
            if self._stub is None:
                raise RuntimeError("gRPC stubs not generated yet")
            req = pccm_pb2.InsertNodeRequest(
                agent_id=agent_id,
                session_id=session_id or "",
                content=content,
                node_type=node_type,
                embedding=embedding,
                causal_parent_ids=causal_parent_ids,
                edge_type_to_parents=edge_type_to_parents,
                metadata=metadata,
            )
            resp = await self._stub.InsertNode(req)
            return {"node_id": resp.node_id, "activation_score": resp.activation_score}
        except grpc.RpcError as e:
            logger.error(f"gRPC InsertNode failed: {e.code()} — {e.details()}")
            raise

    async def query(
        self,
        query_embedding: list[float],
        agent_id: str,
        semantic_threshold: float,
        max_nodes: int,
        time_window_days: int,
        query_time_center_ms: int,
        include_lateral_inhibition: bool,
    ) -> dict:
        await self._ensure_connected()
        try:
            if self._stub is None:
                raise RuntimeError("gRPC stubs not generated yet")
            req = pccm_pb2.QueryRequest(
                query_embedding=query_embedding,
                agent_id=agent_id,
                semantic_threshold=semantic_threshold,
                max_nodes=max_nodes,
                time_window_days=time_window_days,
                query_time_center_ms=query_time_center_ms,
                include_lateral_inhibition=include_lateral_inhibition,
            )
            resp = await self._stub.Query(req)
            return {
                "activated_nodes": [
                    {
                        "node_id": n.node_id,
                        "content": n.content,
                        "node_type": n.node_type,
                        "activation_score": n.activation_score,
                        "temporal_score": n.temporal_score,
                        "propagation_path": list(n.propagation_path),
                        "was_inhibited": n.was_inhibited,
                    }
                    for n in resp.activated_nodes
                ],
                "context_tokens_used": resp.context_tokens_used,
                "full_context_tokens_avoided": resp.full_context_tokens_avoided,
                "latency_ms": resp.latency_ms,
                "prefetch_cache_hits": resp.prefetch_cache_hits,
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC Query failed: {e.code()} — {e.details()}")
            raise

    async def get_node(self, node_id: str) -> Optional[dict]:
        await self._ensure_connected()
        try:
            if self._stub is None:
                raise RuntimeError("gRPC stubs not generated yet")
            req = pccm_pb2.GetNodeRequest(node_id=node_id)
            resp = await self._stub.GetNode(req)
            if not resp.found:
                return None
            n = resp.node
            return {
                "node_id": n.id,
                "content": n.content,
                "node_type": n.node_type,
                "activation_score": n.activation_score,
                "activation_state": n.activation_state,
                "agent_id": n.agent_id,
                "session_id": n.session_id or None,
                "created_at_ms": n.created_at_ms,
                "last_accessed_ms": n.last_accessed_ms,
                "access_timestamps": list(n.access_timestamps)[-20:],
                "metadata": dict(n.metadata),
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC GetNode failed: {e.code()} — {e.details()}")
            raise

    async def get_context_chain(self, node_id: str) -> dict:
        await self._ensure_connected()
        try:
            if self._stub is None:
                raise RuntimeError("gRPC stubs not generated yet")
            req = pccm_pb2.GetContextChainRequest(node_id=node_id, max_depth=10)
            resp = await self._stub.GetContextChain(req)
            return {
                "root_node_id": resp.root_node_id,
                "chain": [
                    {
                        "node_id": n.node_id,
                        "content": n.content,
                        "node_type": n.node_type,
                        "activation_score": n.activation_score,
                        "temporal_score": n.temporal_score,
                        "propagation_path": list(n.propagation_path),
                        "was_inhibited": n.was_inhibited,
                    }
                    for n in resp.chain
                ],
                "total_nodes": resp.total_nodes,
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC GetContextChain failed: {e.code()} — {e.details()}")
            raise

    async def get_sync_status(self, swarm_id: str) -> dict:
        await self._ensure_connected()
        try:
            if self._stub is None:
                raise RuntimeError("gRPC stubs not generated yet")
            req = pccm_pb2.GetSyncStatusRequest(swarm_id=swarm_id)
            resp = await self._stub.GetSyncStatus(req)
            return {
                "swarm_id": resp.swarm_id,
                "agent_count": resp.agent_count,
                "total_nodes": resp.total_nodes,
                "hot_nodes": resp.hot_nodes,
                "dormant_nodes": resp.dormant_nodes,
                "last_gossip_ms": resp.last_gossip_ms,
                "vector_clock": dict(resp.vector_clock),
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC GetSyncStatus failed: {e.code()} — {e.details()}")
            raise

    async def close(self):
        if self._channel:
            await self._channel.close()


# Singleton client instance
_client: Optional[PCCMClient] = None


def get_client() -> PCCMClient:
    global _client
    if _client is None:
        _client = PCCMClient()
    return _client
