"""
Tools:
  pccm_get_context_chain — retrieve the causal chain for a node
  pccm_list_hot_nodes    — list HOT nodes for an agent
  pccm_get_agent_graph   — get agent graph summary
"""

import httpx
from typing import Any


async def pccm_get_context_chain(client: httpx.AsyncClient, args: dict[str, Any]) -> dict:
    node_id = args["node_id"]
    resp = await client.get(f"/nodes/{node_id}/context-chain")
    resp.raise_for_status()
    return resp.json()


async def pccm_list_hot_nodes(client: httpx.AsyncClient, args: dict[str, Any]) -> dict:
    """List HOT nodes for an agent (high activation score > 1.0)."""
    agent_id = args["agent_id"]
    limit = args.get("limit", 10)

    # Use the query endpoint with a broad semantic threshold
    payload = {
        "query_text": "recent important events",
        "agent_id": agent_id,
        "semantic_threshold": 0.0,
        "max_nodes": limit * 3,
    }
    resp = await client.post("/query", json=payload)
    resp.raise_for_status()
    data = resp.json()

    # Filter and sort by activation score
    nodes = sorted(
        data.get("activated_nodes", []),
        key=lambda n: n.get("activation_score", 0),
        reverse=True,
    )[:limit]

    return {
        "hot_nodes": [
            {
                "node_id": n["node_id"],
                "content": n["content"],
                "activation_score": n["activation_score"],
                "node_type": n["node_type"],
            }
            for n in nodes
        ]
    }


async def pccm_get_agent_graph(client: httpx.AsyncClient, args: dict[str, Any]) -> dict:
    """Get a summary of the agent's memory graph."""
    agent_id = args["agent_id"]
    # Use the swarm status endpoint as a proxy for graph summary
    resp = await client.get(f"/swarm/{agent_id}/sync-status")
    resp.raise_for_status()
    data = resp.json()
    return {
        "total_nodes": data.get("total_nodes", 0),
        "hot_nodes": data.get("hot_nodes", 0),
        "active_nodes": data.get("total_nodes", 0) - data.get("hot_nodes", 0) - data.get("dormant_nodes", 0),
        "dormant_nodes": data.get("dormant_nodes", 0),
        "total_edges": 0,  # not exposed in current API; future work
        "last_updated_ms": data.get("last_gossip_ms", 0),
    }
