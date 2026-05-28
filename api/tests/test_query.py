"""
Query endpoint tests.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch


@pytest.fixture
def mock_all():
    with patch("routers.query.get_client") as mock_client, \
         patch("routers.query.embed") as mock_embed:
        mock_embed.return_value = ([0.1] * 384, 3.0)
        mock_client.return_value.query = AsyncMock(return_value={
            "activated_nodes": [
                {
                    "node_id": "abc123",
                    "content": "Q4 revenue grew 23%",
                    "node_type": "semantic",
                    "activation_score": 1.5,
                    "temporal_score": 0.8,
                    "propagation_path": ["abc123"],
                    "was_inhibited": False,
                }
            ],
            "context_tokens_used": 8,
            "full_context_tokens_avoided": 400,
            "latency_ms": 9.2,
            "prefetch_cache_hits": 0,
        })
        yield


@pytest.mark.asyncio
async def test_query_basic(mock_all):
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/query", json={
            "query_text": "revenue data",
            "agent_id": "test-agent",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["activated_nodes"][0]["content"] == "Q4 revenue grew 23%"
    assert data["context_tokens_used"] == 8


@pytest.mark.asyncio
async def test_query_validation():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/query", json={
            "query_text": "test",
            "agent_id": "agent",
            "semantic_threshold": 2.0,  # Invalid: must be <= 1.0
        })
    assert resp.status_code == 422
