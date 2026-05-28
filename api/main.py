"""
PCCM API — FastAPI application entry point.
Provides REST + WebSocket endpoints for the PCCM memory system.
"""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from routers import events, query, nodes, swarm
from services.stream_processor import start_stream_processor
from services.ws_hub import WebSocketHub


# Global WebSocket hub
hub = WebSocketHub()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start background tasks on startup."""
    # Start Redis stream consumer
    asyncio.create_task(start_stream_processor(hub))
    yield
    # Cleanup (if needed)


app = FastAPI(
    title="PCCM API",
    version="1.0.0",
    description="Predictive CRDT-Distributed Causal Memory — REST + WebSocket API",
    lifespan=lifespan,
)

# CORS — allow all origins for demo purposes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────
app.include_router(events.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(nodes.router, prefix="/api")
app.include_router(swarm.router, prefix="/api")


# ── Health endpoint ───────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "pccm-api"}


# ── WebSocket: Graph updates ──────────────────────────────────────────
@app.websocket("/ws/graph-updates")
async def ws_graph_updates(websocket: WebSocket):
    """Broadcasts GraphEvent on every node/edge insert."""
    await hub.connect(websocket, channel="graph")
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        hub.disconnect(websocket, channel="graph")


# ── WebSocket: Activation events ──────────────────────────────────────
@app.websocket("/ws/activation-events")
async def ws_activation_events(websocket: WebSocket):
    """Broadcasts ActivationEvent when a node's score changes."""
    await hub.connect(websocket, channel="activation")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(websocket, channel="activation")
