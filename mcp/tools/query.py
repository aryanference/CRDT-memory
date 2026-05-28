"""Tool: pccm_query — retrieve memories using spreading activation."""

import httpx
from typing import Any


async def pccm_query(client: httpx.AsyncClient, args: dict[str, Any]) -> dict:
    payload = {
        "query_text": args["query_text"],
        "agent_id": args["agent_id"],
        "time_window_days": args.get("time_window_days", 7),
        "semantic_threshold": args.get("semantic_threshold", 0.75),
        "max_nodes": args.get("max_nodes", 50),
    }
    resp = await client.post("/query", json=payload)
    resp.raise_for_status()
    data = resp.json()
    # Return a condensed view for the LLM
    return {
        "activated_nodes": [
            {
                "node_id": n["node_id"],
                "content": n["content"],
                "activation_score": n["activation_score"],
                "node_type": n["node_type"],
                "propagation_path": n["propagation_path"],
                "was_inhibited": n["was_inhibited"],
            }
            for n in data.get("activated_nodes", [])
        ],
        "context_tokens_used": data.get("context_tokens_used", 0),
        "latency_ms": data.get("latency_ms", 0),
    }
