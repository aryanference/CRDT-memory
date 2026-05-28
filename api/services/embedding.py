"""
Embedding service for the PCCM API.
Primary: OpenAI text-embedding-3-small (1536 dims)
Fallback: sentence-transformers all-MiniLM-L6-v2 (384 dims)
Cache: LRU with SHA-256 key (maxsize=10_000)
"""

import hashlib
import logging
import os
import time
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# Cache storage (simple dict-based LRU at module level)
_cache: dict[str, list[float]] = {}
_CACHE_MAXSIZE = 10_000

# Lazy-loaded local model
_local_model = None

EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _evict_if_needed() -> None:
    if len(_cache) >= _CACHE_MAXSIZE:
        # Remove oldest 10% of entries
        to_remove = list(_cache.keys())[:_CACHE_MAXSIZE // 10]
        for k in to_remove:
            del _cache[k]


async def embed(text: str) -> tuple[list[float], float]:
    """
    Embed text and return (embedding_vector, latency_ms).
    Uses OpenAI if OPENAI_API_KEY is set, otherwise falls back to local model.
    Results are cached by SHA-256(text)[:16].
    """
    key = _cache_key(text)
    if key in _cache:
        logger.debug(f"Embedding cache hit for key {key}")
        return _cache[key], 0.0

    start = time.monotonic()

    if EMBEDDING_PROVIDER == "openai" and OPENAI_API_KEY:
        vector = await _embed_openai(text)
    else:
        vector = await _embed_local(text)

    latency_ms = (time.monotonic() - start) * 1000.0

    # Cache the result
    _evict_if_needed()
    _cache[key] = vector

    logger.info(
        f"Embedded text ({len(text)} chars) via "
        f"{'openai' if EMBEDDING_PROVIDER == 'openai' and OPENAI_API_KEY else 'local'} "
        f"→ {len(vector)} dims in {latency_ms:.1f}ms"
    )
    return vector, latency_ms


async def _embed_openai(text: str) -> list[float]:
    """Embed using OpenAI text-embedding-3-small with 3x retry on rate limit."""
    import openai
    import asyncio

    client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
    last_error: Optional[Exception] = None

    for attempt in range(3):
        try:
            response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
            )
            return response.data[0].embedding
        except openai.RateLimitError as e:
            last_error = e
            wait = 2 ** attempt
            logger.warning(f"OpenAI rate limit (attempt {attempt + 1}), retrying in {wait}s")
            await asyncio.sleep(wait)
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}")
            # Fall through to local model
            break

    logger.warning("OpenAI embedding failed after retries, falling back to local model")
    return await _embed_local(text)


async def _embed_local(text: str) -> list[float]:
    """
    Embed using sentence-transformers all-MiniLM-L6-v2 (384 dims).
    Loaded once on first call; reused thereafter.
    Falls back to zero vector if model load fails.
    """
    global _local_model
    import asyncio

    try:
        if _local_model is None:
            logger.info("Loading local sentence-transformers model (all-MiniLM-L6-v2)...")
            from sentence_transformers import SentenceTransformer
            # Load in executor to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            _local_model = await loop.run_in_executor(
                None, lambda: SentenceTransformer("all-MiniLM-L6-v2")
            )
            logger.info("Local embedding model loaded (384 dims)")

        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None, lambda: _local_model.encode(text).tolist()
        )
        return embedding

    except Exception as e:
        logger.error(
            f"Local embedding failed: {e}. Storing node with zero embedding. "
            "Node will be excluded from vector search."
        )
        # Return zero vector — node will be flagged embedding_failed=True by caller
        return [0.0] * 384
