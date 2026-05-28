"""Tool: pccm_sync_swarm — trigger explicit CRDT gossip sync."""

import httpx
from typing import Any


async def pccm_sync_swarm(client: httpx.AsyncClient, args: dict[str, Any]) -> dict:
    swarm_id = args["swarm_id"]
    resp = await client.get(f"/swarm/{swarm_id}/sync-status")
    resp.raise_for_status()
    return resp.json()
