"""
GET /api/nodes/{node_id}
GET /api/nodes/{node_id}/context-chain
"""

import logging

from fastapi import APIRouter, HTTPException, Path

from models.response import NodeDetailResponse, ContextChainResponse, ActivatedNodeResponse
from services.pccm_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/nodes/{node_id}", response_model=NodeDetailResponse)
async def get_node(node_id: str = Path(..., description="Node UUID")):
    """Return full MemoryNode details including last 20 access timestamps."""
    try:
        client = get_client()
        node = await client.get_node(node_id)
    except Exception as e:
        logger.error(f"gRPC GetNode failed: {e}")
        raise HTTPException(status_code=503, detail=f"Core daemon unavailable: {e}")

    if node is None:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")

    return NodeDetailResponse(**node)


@router.get("/nodes/{node_id}/context-chain", response_model=ContextChainResponse)
async def get_context_chain(node_id: str = Path(..., description="Root node UUID")):
    """
    Traverse the causal graph from a given node and return the ordered chain.
    Traverses causes/caused_by/enables edges up to depth 10.
    """
    try:
        client = get_client()
        result = await client.get_context_chain(node_id)
    except Exception as e:
        logger.error(f"gRPC GetContextChain failed: {e}")
        raise HTTPException(status_code=503, detail=f"Core daemon unavailable: {e}")

    chain = [
        ActivatedNodeResponse(
            node_id=n["node_id"],
            content=n["content"],
            node_type=n["node_type"],
            activation_score=n["activation_score"],
            temporal_score=n["temporal_score"],
            propagation_path=n["propagation_path"],
            was_inhibited=n["was_inhibited"],
        )
        for n in result["chain"]
    ]

    return ContextChainResponse(
        root_node_id=result["root_node_id"],
        chain=chain,
        total_nodes=result["total_nodes"],
    )
