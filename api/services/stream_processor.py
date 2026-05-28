"""
Redis Streams consumer for the PCCM API.
Consumes from "pccm:events" stream, embeds content, inserts nodes via gRPC.
Uses consumer group "pccm-api-consumers" for fault tolerance.
"""

import asyncio
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_KEY = "pccm:events"
CONSUMER_GROUP = "pccm-api-consumers"
CONSUMER_NAME = "api-worker-1"


async def start_stream_processor(hub) -> None:
    """
    Start the Redis Streams consumer loop.
    Gracefully handles connection failures without crashing.
    """
    try:
        import redis.asyncio as redis_async
    except ImportError:
        logger.warning("redis package not installed — stream processor disabled")
        return

    from services.embedding import embed
    from services.pccm_client import get_client

    logger.info(f"Stream processor starting (stream={STREAM_KEY}, group={CONSUMER_GROUP})")

    r: Optional[redis_async.Redis] = None

    while True:
        try:
            if r is None:
                r = redis_async.from_url(REDIS_URL, decode_responses=True)
                # Create consumer group (idempotent)
                try:
                    await r.xgroup_create(
                        STREAM_KEY, CONSUMER_GROUP, id="$", mkstream=True
                    )
                    logger.info("Consumer group created")
                except Exception as e:
                    if "BUSYGROUP" not in str(e):
                        logger.warning(f"XGROUP CREATE: {e}")

            # Read new messages
            messages = await r.xreadgroup(
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
                streams={STREAM_KEY: ">"},
                count=10,
                block=1000,  # block for 1s
            )

            if not messages:
                continue

            for stream_name, stream_messages in messages:
                for msg_id, fields in stream_messages:
                    try:
                        await _process_message(fields, hub, embed, get_client())
                        await r.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
                    except Exception as e:
                        logger.error(f"Failed to process stream message {msg_id}: {e}")
                        # Do NOT crash — skip to next message

        except Exception as e:
            logger.warning(f"Stream processor error: {e}. Reconnecting in 5s...")
            r = None
            await asyncio.sleep(5)


async def _process_message(fields: dict, hub, embed_fn, client) -> None:
    """Process a single stream message."""
    payload = json.loads(fields.get("payload", "{}"))

    content = payload.get("content", "")
    agent_id = payload.get("agent_id", "unknown")
    node_type = payload.get("node_type", "episodic")
    session_id = payload.get("session_id")
    causal_parent_ids = payload.get("causal_parent_ids", [])
    edge_type = payload.get("edge_type_to_parents", "causes")
    metadata = payload.get("metadata", {})

    if not content:
        return

    # Generate embedding
    vector, _ = await embed_fn(content)

    # Insert node via gRPC
    result = await client.insert_node(
        agent_id=agent_id,
        session_id=session_id,
        content=content,
        node_type=node_type,
        embedding=vector,
        causal_parent_ids=causal_parent_ids,
        edge_type_to_parents=edge_type,
        metadata=metadata,
    )

    # Broadcast to WebSocket clients
    await hub.broadcast("graph", {
        "type": "node_added",
        "node_id": result["node_id"],
        "agent_id": agent_id,
        "activation_score": result["activation_score"],
    })
