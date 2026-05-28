"""
PCCM MCP Server
================
Exposes 6 tools for AI agents to interact with the PCCM memory system.
Transport: stdio (compatible with Claude Desktop, Cursor, Windsurf, etc.)

Usage in claude_desktop_config.json:
{
  "mcpServers": {
    "pccm": {
      "command": "python",
      "args": ["path/to/pccm/mcp/server.py"],
      "env": {
        "PCCM_API_URL": "http://localhost:8000/api"
      }
    }
  }
}
"""

import asyncio
import json
import os
import sys
import logging
from typing import Any

import httpx

# MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp import types
except ImportError:
    print("ERROR: 'mcp' package not installed. Run: pip install mcp>=1.0.0", file=sys.stderr)
    sys.exit(1)

# Import tool implementations
from tools.store import pccm_store_memory
from tools.query import pccm_query
from tools.chain import pccm_get_context_chain, pccm_list_hot_nodes, pccm_get_agent_graph
from tools.swarm import pccm_sync_swarm

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger("pccm-mcp")

PCCM_API = os.getenv("PCCM_API_URL", "http://localhost:8000/api")

# ── Server definition ────────────────────────────────────────────────
app = Server("pccm-memory")


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="pccm_store_memory",
            description=(
                "Store a new memory into the PCCM causal graph. Use after every "
                "significant agent observation, tool call result, or decision."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Text of the memory"},
                    "agent_id": {"type": "string", "description": "Identifier of the calling agent"},
                    "session_id": {"type": "string", "description": "Optional session identifier"},
                    "causal_parent_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "IDs of memories that causally preceded this one",
                    },
                    "edge_type": {
                        "type": "string",
                        "default": "causes",
                        "description": "Causal edge type to parents",
                    },
                    "event_type": {
                        "type": "string",
                        "default": "observation",
                        "description": "Event type: observation | tool_call | llm_response | error",
                    },
                },
                "required": ["content", "agent_id"],
            },
        ),
        types.Tool(
            name="pccm_query",
            description=(
                "Retrieve relevant memories using temporal spreading activation. "
                "Use before any LLM call that requires historical context."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query_text": {"type": "string", "description": "Natural language query"},
                    "agent_id": {"type": "string", "description": "Agent identifier"},
                    "time_window_days": {"type": "integer", "default": 7},
                    "semantic_threshold": {"type": "number", "default": 0.75},
                    "max_nodes": {"type": "integer", "default": 50},
                },
                "required": ["query_text", "agent_id"],
            },
        ),
        types.Tool(
            name="pccm_get_context_chain",
            description=(
                "Retrieve the full causal chain leading to or from a specific memory node. "
                "Use to understand WHY something happened."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "node_id": {"type": "string", "description": "Memory node UUID"},
                },
                "required": ["node_id"],
            },
        ),
        types.Tool(
            name="pccm_list_hot_nodes",
            description=(
                "List the most activation-hot memory nodes for an agent. "
                "These are the memories most likely to be relevant to the next query."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string", "description": "Agent identifier"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["agent_id"],
            },
        ),
        types.Tool(
            name="pccm_get_agent_graph",
            description=(
                "Get a summary of the agent's memory graph including total node counts, "
                "hot/dormant breakdown, and edge statistics."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string", "description": "Agent identifier"},
                },
                "required": ["agent_id"],
            },
        ),
        types.Tool(
            name="pccm_sync_swarm",
            description=(
                "Trigger an explicit CRDT gossip sync across all agents in a swarm. "
                "Use when you need guaranteed up-to-date state."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "swarm_id": {"type": "string", "description": "Swarm identifier"},
                },
                "required": ["swarm_id"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    """Dispatch tool calls to their implementations."""
    async with httpx.AsyncClient(base_url=PCCM_API, timeout=30.0) as client:
        try:
            match name:
                case "pccm_store_memory":
                    result = await pccm_store_memory(client, arguments)
                case "pccm_query":
                    result = await pccm_query(client, arguments)
                case "pccm_get_context_chain":
                    result = await pccm_get_context_chain(client, arguments)
                case "pccm_list_hot_nodes":
                    result = await pccm_list_hot_nodes(client, arguments)
                case "pccm_get_agent_graph":
                    result = await pccm_get_agent_graph(client, arguments)
                case "pccm_sync_swarm":
                    result = await pccm_sync_swarm(client, arguments)
                case _:
                    result = {"error": f"Unknown tool: {name}"}
        except httpx.ConnectError:
            result = {
                "error": f"Cannot connect to PCCM API at {PCCM_API}. "
                         "Is the server running? Check PCCM_API_URL env var."
            }
        except Exception as e:
            logger.error(f"Tool {name} failed: {e}")
            result = {"error": str(e)}

    return [types.TextContent(type="text", text=json.dumps(result, indent=2))]


# ── Entry point ──────────────────────────────────────────────────────
async def main():
    logger.info(f"PCCM MCP Server starting (API={PCCM_API})")
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
