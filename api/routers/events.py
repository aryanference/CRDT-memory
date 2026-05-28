"""
POST /api/agents/{agent_id}/events
Ingest a new memory event: embed → insert node → broadcast.
"""

import json
import logging
import time

import redis.asyncio as redis_async
from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import JSONResponse

from models.request import IngestEventRequest
from models.response import IngestEventResponse
from services.embedding import embed
from services.pccm_client import get_client
from services.ws_hub import WebSocketHub

import os

logger = logging.getLogger(__name__)
router = APIRouter()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
_redis: redis_async.Redis | None = None


def _get_redis():
    global _redis
    if _redis is None:
        _redis = redis_async.from_url(REDIS_URL, decode_responses=True)
    return _redis


@router.post("/agents/{agent_id}/events", response_model=IngestEventResponse)
async def ingest_event(
    agent_id: str = Path(..., description="Agent identifier"),
    body: IngestEventRequest = ...,
):
    """
    Ingest a memory event:
    1. Generate embedding for the content
    2. Insert node via gRPC into the core daemon
    3. Publish to Redis Stream for async processing
    4. Broadcast GraphEvent via WebSocket hub
    """
    start = time.monotonic()

    # Step 1: Embed content
    try:
        vector, embedding_ms = await embed(body.content)
        embedding_failed = all(v == 0.0 for v in vector)
    except Exception as e:
        logger.error(f"Embedding failed for agent {agent_id}: {e}")
        vector = [0.0] * 384
        embedding_ms = 0.0
        embedding_failed = True

    # Step 2: Insert node via gRPC
    try:
        client = get_client()
        result = await client.insert_node(
            agent_id=agent_id,
            session_id=body.session_id,
            content=body.content,
            node_type=body.event_type if body.event_type in ("episodic", "semantic", "procedural") else "episodic",
            embedding=vector,
            causal_parent_ids=body.causal_parent_ids,
            edge_type_to_parents=body.edge_type_to_parents,
            metadata=body.metadata,
        )
        node_id = result["node_id"]
        activation_score = result["activation_score"]
    except Exception as e:
        logger.error(f"gRPC InsertNode failed: {e}")
        raise HTTPException(status_code=503, detail=f"Core daemon unavailable: {e}")

    # Step 3: Publish to Redis Stream (non-blocking best-effort)
    try:
        r = _get_redis()
        payload = {
            "agent_id": agent_id,
            "node_id": node_id,
            "content": body.content,
            "node_type": "episodic",
            "session_id": body.session_id or "",
            "causal_parent_ids": body.causal_parent_ids,
            "edge_type_to_parents": body.edge_type_to_parents,
            "metadata": body.metadata,
        }
        await r.xadd("pccm:events", {"payload": json.dumps(payload)})
    except Exception as e:
        logger.warning(f"Redis publish failed (non-fatal): {e}")

    return IngestEventResponse(
        node_id=node_id,
        activation_score=activation_score,
        embedding_ms=embedding_ms,
    )
