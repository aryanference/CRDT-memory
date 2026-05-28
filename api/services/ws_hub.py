"""
WebSocket hub for broadcasting events to connected clients.
Supports named channels: "graph" and "activation".
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketHub:
    """Channel-based WebSocket broadcast manager."""

    def __init__(self):
        # channel_name → set of connected WebSockets
        self._channels: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        await websocket.accept()
        async with self._lock:
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(websocket)
        logger.info(f"WebSocket connected to channel '{channel}'")

    def disconnect(self, websocket: WebSocket, channel: str) -> None:
        if channel in self._channels:
            self._channels[channel].discard(websocket)
        logger.info(f"WebSocket disconnected from channel '{channel}'")

    async def broadcast(self, channel: str, data: Any) -> None:
        """Broadcast a JSON-serializable payload to all clients on a channel."""
        if channel not in self._channels:
            return

        message = json.dumps(data)
        dead: list[WebSocket] = []

        for ws in list(self._channels.get(channel, [])):
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.warning(f"WS send failed on channel '{channel}': {e}")
                dead.append(ws)

        # Clean up dead connections
        for ws in dead:
            self._channels[channel].discard(ws)

    async def broadcast_all(self, data: Any) -> None:
        """Broadcast to all channels."""
        for channel in list(self._channels.keys()):
            await self.broadcast(channel, data)
