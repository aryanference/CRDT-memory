"""
API tests — basic smoke tests for events and query endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

# We patch the gRPC client and embedding service so tests run without backends


@pytest.fixture
def mock_grpc():
    """Mock the gRPC client to return canned responses."""
    with patch("routers.events.get_client") as mock_events, \
         patch("routers.query.get_client") as mock_query:

        mock_insert = AsyncMock(return_value={
            "node_id": "test-node-id",
            "activation_score": 0.5,
        })
        mock_events.return_value.insert_node = mock_insert

        mock_qresult = AsyncMock(return_value={
            "activated_nodes": [
                {
                    "node_id": "n1",
                    "content": "test content",
                    "node_type": "episodic",
                    "activation_score": 0.8,
                    "temporal_score": 0.3,
                    "propagation_path": ["n1"],
                    "was_inhibited": False,
                }
            ],
            "context_tokens_used": 12,
            "full_context_tokens_avoided": 500,
            "latency_ms": 8.5,
            "prefetch_cache_hits": 0,
        })
        mock_query.return_value.query = mock_qresult
        yield


@pytest.fixture
def mock_embed():
    """Mock the embedding service."""
    with patch("routers.events.embed") as mock_e, \
         patch("routers.query.embed") as mock_q:
        mock_e.return_value = ([0.1] * 384, 5.0)
        mock_q.return_value = ([0.1] * 384, 5.0)
        yield


@pytest.mark.asyncio
async def test_ingest_event(mock_grpc, mock_embed):
    """POST /api/agents/test/events should return a node_id."""
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/agents/test/events", json={
            "agent_id": "test",
            "content": "Agent called search tool with query: climate change",
            "event_type": "tool_call",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert "node_id" in data
    assert data["node_id"] == "test-node-id"


@pytest.mark.asyncio
async def test_query_returns_activated_nodes(mock_grpc, mock_embed):
    """POST /api/query should return non-empty activated_nodes."""
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/query", json={
            "query_text": "What did the agent search for?",
            "agent_id": "test",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert "activated_nodes" in data
    assert len(data["activated_nodes"]) > 0
    assert data["activated_nodes"][0]["node_id"] == "n1"


@pytest.mark.asyncio
async def test_health():
    """GET /health should return 200."""
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
