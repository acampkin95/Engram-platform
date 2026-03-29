"""Multi-layer Redis cache with stampede prevention.

Original (v0.2.0): Simple key-value cache with fail-open pattern.
Extended (v0.3.0): Tiered TTLs, mutex-based stampede prevention,
                    negative caching for failed computations.

Architecture Decision: ADR-001 Section 7 — Multi-Layer Cache

Backward Compatibility:
    All original functions (cache_get, cache_set, cache_delete,
    get_crawl_result, set_crawl_result, get_lm_response, set_lm_response,
    close_cache) remain unchanged. New CacheLayer class provides
    enhanced caching via get_or_compute() with stampede prevention.
"""

from __future__ import annotations
import asyncio
import hashlib
import json
import logging

from app._compat import StrEnum

from collections.abc import Awaitable, Callable

import redis.asyncio as aioredis
from redis.asyncio.connection import ConnectionPool  # noqa: F401 – kept for downstream imports

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Original globals (unchanged from v0.2.0)
# ---------------------------------------------------------------------------

_cache_pool: ConnectionPool | None = None
_cache_client: aioredis.Redis | None = None

DEFAULT_TTL = 3600
CRAWL_RESULT_PREFIX = "crawl:result:"
LM_RESPONSE_PREFIX = "lm:response:"

# ---------------------------------------------------------------------------
# Cache tiers (new in v0.3.0)
# ---------------------------------------------------------------------------

class CacheTier(StrEnum):
    """Cache tier with tier-specific TTL values.

    Architecture Decision: ADR-001 Section 7 — Cache Layers
    """

    HOT = "hot"  # Frequently accessed crawl results
    WARM = "warm"  # Recent crawl results
    COLD = "cold"  # Historical results
    NEGATIVE = "neg"  # Failed URLs (negative cache)
    LLM = "llm"  # LM Studio responses

# TTL in seconds per tier
TIER_TTL: dict[CacheTier, int] = {
    CacheTier.HOT: 3600,  # 1 hour
    CacheTier.WARM: 86400,  # 24 hours
    CacheTier.COLD: 604800,  # 7 days
    CacheTier.NEGATIVE: 300,  # 5 minutes
    CacheTier.LLM: 14400,  # 4 hours
}

# ---------------------------------------------------------------------------
# Original functions (unchanged from v0.2.0)
# ---------------------------------------------------------------------------

def _make_key(prefix: str, identifier: str) -> str:
    return f"{prefix}{hashlib.sha256(identifier.encode()).hexdigest()[:32]}"

async def get_cache_client() -> aioredis.Redis:
    global _cache_client
    if _cache_client is None:
        from app.services.redis_pool import get_redis_pool

        _cache_client = await get_redis_pool()
    return _cache_client

async def cache_get(prefix: str, identifier: str) -> dict | None:
    try:
        client = await get_cache_client()
        key = _make_key(prefix, identifier)
        data = await client.get(key)
        if data:
            logger.debug(f"Cache HIT: {key}")
            return json.loads(data)
        logger.debug(f"Cache MISS: {key}")
        return None
    except Exception as e:
        logger.warning(f"Cache read failed (failing open): {e}")
        return None

async def cache_set(prefix: str, identifier: str, value: dict, ttl: int = DEFAULT_TTL) -> bool:
    try:
        client = await get_cache_client()
        key = _make_key(prefix, identifier)
        serialized = json.dumps(value, default=str)
        await client.setex(key, ttl, serialized)
        logger.debug(f"Cache SET: {key} (ttl={ttl}s)")
        return True
    except Exception as e:
        logger.warning(f"Cache write failed: {e}")
        return False

async def cache_delete(prefix: str, identifier: str) -> bool:
    try:
        client = await get_cache_client()
        key = _make_key(prefix, identifier)
        await client.delete(key)
        return True
    except Exception as e:
        logger.warning(f"Cache delete failed: {e}")
        return False

async def get_crawl_result(url: str) -> dict | None:
    return await cache_get(CRAWL_RESULT_PREFIX, url)

async def set_crawl_result(url: str, result: dict, ttl: int = DEFAULT_TTL) -> bool:
    return await cache_set(CRAWL_RESULT_PREFIX, url, result, ttl)

async def get_lm_response(prompt_hash: str) -> dict | None:
    return await cache_get(LM_RESPONSE_PREFIX, prompt_hash)

async def set_lm_response(prompt_hash: str, response: dict, ttl: int = 1800) -> bool:
    return await cache_set(LM_RESPONSE_PREFIX, prompt_hash, response, ttl)

async def close_cache():
    global _cache_client, _cache_pool
    if _cache_client is not None:
        try:
            await _cache_client.close()
        except Exception:
            pass
    if _cache_pool is not None:
        try:
            await _cache_pool.disconnect()
        except Exception:
            pass
    _cache_client = None
    _cache_pool = None

# ---------------------------------------------------------------------------
# CacheLayer: Multi-layer cache with stampede prevention (new in v0.3.0)
# Architecture Decision: ADR-001 Section 7
# ---------------------------------------------------------------------------

class CacheLayer:
    """Multi-layer cache with stampede prevention via mutex locks.

    Provides ``get_or_compute`` which atomically checks cache, acquires a
    mutex lock to prevent thundering-herd, computes the value via a callback,
    and stores the result with a tier-appropriate TTL.

    Uses the same Redis connection pool as the legacy cache functions above
    to avoid creating additional connections.

    Usage::

        layer = await get_cache_layer()
        result = await layer.get_or_compute(
            key=CacheLayer.url_key("https://example.com", CacheTier.HOT),
            compute_fn=lambda: crawl_url("https://example.com"),
            ttl=TIER_TTL[CacheTier.HOT],
        )
    """

    LOCK_TIMEOUT = 30  # seconds — max time to hold compute lock
    LOCK_RETRY_DELAY = 0.1  # seconds — polling interval while waiting

    def __init__(self, client: aioredis.Redis):
        self._redis = client

    async def _try_cache_hit(self, key: str) -> dict | None:
        try:
            cached = await self._redis.get(key)
            if cached is not None:
                logger.debug(f"CacheLayer HIT: {key}")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"CacheLayer read failed (failing open): {e}")
        return None

    async def _try_negative_cache(self, key: str) -> bool:
        neg_key = f"cache:neg:{key}"
        try:
            if await self._redis.exists(neg_key):
                logger.debug(f"CacheLayer NEGATIVE HIT: {key}")
                return True
        except Exception:
            pass
        return False

    async def _try_acquire_lock(self, key: str) -> tuple[bool, str | None]:
        lock_key = f"lock:{key}"
        try:
            lock_acquired = await self._redis.set(
                lock_key, "1", nx=True, ex=self.LOCK_TIMEOUT
            )
            return lock_acquired, lock_key if lock_acquired else None
        except Exception as e:
            logger.warning(f"CacheLayer lock acquire failed: {e}")
            return True, None

    async def _wait_for_lock_result(self, key: str) -> dict | None:
        max_retries = int(self.LOCK_TIMEOUT / self.LOCK_RETRY_DELAY)
        for _ in range(max_retries):
            await asyncio.sleep(self.LOCK_RETRY_DELAY)
            try:
                cached = await self._redis.get(key)
                if cached is not None:
                    return json.loads(cached)
            except Exception:
                pass
        logger.warning(f"CacheLayer timed out waiting for lock: {key}")
        return None

    async def _store_compute_result(
        self, key: str, result: dict | None, ttl: int, neg_key: str
    ) -> None:
        if result is not None:
            serialized = json.dumps(result, default=str)
            await self._redis.set(key, serialized, ex=ttl)
            logger.debug(f"CacheLayer SET: {key} (ttl={ttl}s)")
        else:
            await self._redis.set(neg_key, "1", ex=TIER_TTL[CacheTier.NEGATIVE])
            logger.debug(f"CacheLayer NEG SET: {neg_key}")

    async def _handle_compute_error(self, key: str, exc: Exception, neg_key: str) -> None:
        logger.error(f"CacheLayer compute failed for {key}: {exc}")
        try:
            await self._redis.set(neg_key, "1", ex=TIER_TTL[CacheTier.NEGATIVE])
        except Exception:
            pass

    async def get_or_compute(
        self,
        key: str,
        compute_fn: Callable[[], Awaitable[dict | None]],
        ttl: int = DEFAULT_TTL,
    ) -> dict | None:
        """Fetch from cache or compute with stampede prevention.

        Flow:
            1. Check cache -> return on HIT
            2. Check negative cache -> return None on HIT
            3. Acquire mutex lock (NX)
            4. Compute value via ``compute_fn``
            5. Store result (or negative-cache on failure)
            6. Release lock

        Args:
            key: Full Redis key (use ``url_key`` or ``prompt_key`` helpers).
            compute_fn: Async callable returning the value or None.
            ttl: TTL in seconds for the cached result.

        Returns:
            Cached or freshly computed dict, or None on timeout/failure.
        """
        neg_key = f"cache:neg:{key}"

        hit = await self._try_cache_hit(key)
        if hit is not None:
            return hit

        neg_hit = await self._try_negative_cache(key)
        if neg_hit:
            return None

        lock_acquired, acquired_lock_key = await self._try_acquire_lock(key)
        if not lock_acquired:
            return await self._wait_for_lock_result(key)

        try:
            result = await compute_fn()
            await self._store_compute_result(key, result, ttl, neg_key)
            return result
        except Exception as e:
            await self._handle_compute_error(key, e, neg_key)
            return None
        finally:
            if acquired_lock_key is not None:
                try:
                    await self._redis.delete(acquired_lock_key)
                except Exception:
                    pass

    async def get(self, key: str) -> dict | None:
        """Direct cache read (no compute, no locking)."""
        try:
            data = await self._redis.get(key)
            if data is not None:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"CacheLayer get failed: {e}")
            return None

    async def set(self, key: str, value: dict, ttl: int = DEFAULT_TTL) -> bool:
        """Direct cache write."""
        try:
            serialized = json.dumps(value, default=str)
            await self._redis.set(key, serialized, ex=ttl)
            return True
        except Exception as e:
            logger.warning(f"CacheLayer set failed: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete a cache key and its negative-cache entry."""
        try:
            await self._redis.delete(key, f"cache:neg:{key}")
            return True
        except Exception as e:
            logger.warning(f"CacheLayer delete failed: {e}")
            return False

    @staticmethod
    def url_key(url: str, tier: str | CacheTier = CacheTier.HOT) -> str:
        """Generate a tier-prefixed cache key from a URL.

        Args:
            url: URL to hash.
            tier: Cache tier (determines key prefix).

        Returns:
            Key like ``cache:hot:a1b2c3d4e5f6g7h8``
        """
        tier_str = tier.value if isinstance(tier, CacheTier) else tier
        url_hash = hashlib.sha256(url.encode()).hexdigest()[:16]
        return f"cache:{tier_str}:{url_hash}"

    @staticmethod
    def prompt_key(prompt: str) -> str:
        """Generate a cache key for LLM prompts.

        Returns:
            Key like ``cache:llm:a1b2c3d4e5f6g7h8``
        """
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        return f"cache:llm:{prompt_hash}"

# CacheLayer singleton
_cache_layer: CacheLayer | None = None

async def get_cache_layer() -> CacheLayer:
    """Get the global CacheLayer singleton (reuses existing Redis pool)."""
    global _cache_layer
    if _cache_layer is None:
        client = await get_cache_client()
        _cache_layer = CacheLayer(client)
    return _cache_layer

async def close_cache_layer() -> None:
    """Reset the CacheLayer singleton.

    NOTE: Does NOT close the underlying Redis connection — use
    ``close_cache()`` for that.
    """
    global _cache_layer
    _cache_layer = None
