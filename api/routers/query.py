"""
POST /api/query
Retrieve relevant memories using temporal spreading activation.
"""

import logging
import time

from fastapi import APIRouter, HTTPException

from models.request import QueryRequest
from models.response import QueryResponse, ActivatedNodeResponse
from services.embedding import embed
from services.pccm_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query_memory(body: QueryRequest):
    """
    Query the PCCM memory system:
    1. Embed query_text
    2. Run temporal spreading activation via gRPC
    3. Return activated nodes with scores
    """
    start = time.monotonic()

    # Step 1: Embed query
    try:
        vector, _ = await embed(body.query_text)
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")

    # Step 2: Query core daemon
    try:
        client = get_client()
        result = await client.query(
            query_embedding=vector,
            agent_id=body.agent_id,
            semantic_threshold=body.semantic_threshold,
            max_nodes=body.max_nodes,
            time_window_days=body.time_window_days,
            query_time_center_ms=body.query_time_center_ms or 0,
            include_lateral_inhibition=body.include_lateral_inhibition,
        )
    except Exception as e:
        logger.error(f"gRPC Query failed: {e}")
        raise HTTPException(status_code=503, detail=f"Core daemon unavailable: {e}")

    latency_ms = (time.monotonic() - start) * 1000.0

    activated_nodes = [
        ActivatedNodeResponse(
            node_id=n["node_id"],
            content=n["content"],
            node_type=n["node_type"],
            activation_score=n["activation_score"],
            temporal_score=n["temporal_score"],
            propagation_path=n["propagation_path"],
            was_inhibited=n["was_inhibited"],
        )
        for n in result["activated_nodes"]
    ]

    return QueryResponse(
        activated_nodes=activated_nodes,
        context_tokens_used=result["context_tokens_used"],
        full_context_tokens_avoided=result["full_context_tokens_avoided"],
        latency_ms=latency_ms,
        prefetch_cache_hits=0,
    )
