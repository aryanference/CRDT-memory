"""Tool: pccm_store_memory — store a new memory into the PCCM causal graph."""

import httpx
from typing import Any


async def pccm_store_memory(client: httpx.AsyncClient, args: dict[str, Any]) -> dict:
    agent_id = args["agent_id"]
    payload = {
        "agent_id": agent_id,
        "content": args["content"],
        "session_id": args.get("session_id"),
        "causal_parent_ids": args.get("causal_parent_ids", []),
        "edge_type_to_parents": args.get("edge_type", "causes"),
        "event_type": args.get("event_type", "observation"),
        "metadata": {},
    }
    resp = await client.post(f"/agents/{agent_id}/events", json=payload)
    resp.raise_for_status()
    return resp.json()
