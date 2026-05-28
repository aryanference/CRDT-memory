"""
GET /api/swarm/{swarm_id}/sync-status
Returns CRDT sync status for a swarm.
"""

import logging

from fastapi import APIRouter, HTTPException, Path

from models.response import SyncStatusResponse
from services.pccm_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/swarm/{swarm_id}/sync-status", response_model=SyncStatusResponse)
async def get_sync_status(swarm_id: str = Path(..., description="Swarm identifier")):
    """
    Return the CRDT synchronization status for a swarm:
    - total_nodes, hot_nodes, dormant_nodes
    - last_gossip_ms
    - vector_clock per agent
    """
    try:
        client = get_client()
        status = await client.get_sync_status(swarm_id)
    except Exception as e:
        logger.error(f"gRPC GetSyncStatus failed: {e}")
        raise HTTPException(status_code=503, detail=f"Core daemon unavailable: {e}")

    return SyncStatusResponse(**status)
