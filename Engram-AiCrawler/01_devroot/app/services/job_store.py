"""Persistent job store backed by Redis with in-memory fallback.

Replaces the five module-level ``Dict`` stores:
- ``crawl_jobs``       in app/api/crawl.py
- ``chat_sessions``    in app/api/chat.py
- ``_scan_results``    in app/api/osint.py
- ``_deep_crawl_jobs`` in app/api/osint.py
- ``_jobs``            in app/services/rag_service.py

Usage
-----
    from app.services.job_store import get_job_store

    store = get_job_store("crawl_jobs")      # one store per namespace
    await store.set(job_id, data)            # serialises to JSON in Redis
    data = await store.get(job_id)           # deserialises; None if missing
    await store.delete(job_id)
    all_items = await store.values()         # list of all dicts in namespace
    exists = await store.contains(job_id)

Design
------
- Redis key format: ``{namespace}:{job_id}``
- Index key: ``{namespace}:_index`` — a Redis Set of all job IDs in the ns.
- TTL: configurable per namespace (default 24 h).  Expired keys are auto-evicted
  by Redis; the index is cleaned lazily on ``values()``.
- Fail-open: if Redis is unreachable, falls back to an in-process dict so the
  API never crashes.  Logs a WARNING on every fallback.
- Thread/async safe: all Redis ops are awaited; the fallback dict is protected
  by an asyncio.Lock.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TTL defaults (seconds)
# ---------------------------------------------------------------------------
_DEFAULT_TTL: dict[str, int] = {
    "crawl_jobs": 86_400,  # 24 h
    "chat_sessions": 43_200,  # 12 h
    "scan_results": 86_400,  # 24 h
    "deep_crawl_jobs": 86_400,  # 24 h
    "rag_jobs": 3_600,  # 1 h
}
_FALLBACK_TTL = 86_400


# ---------------------------------------------------------------------------
# Internal Redis helper
# ---------------------------------------------------------------------------


def _redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


async def _get_redis():
    """Return a connected redis.asyncio.Redis instance, or None on error."""
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415

        client = aioredis.from_url(_redis_url(), decode_responses=True)
        await client.ping()
        return client
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis unavailable (%s) — using in-memory fallback", exc)
        return None


# ---------------------------------------------------------------------------
# JobStore
# ---------------------------------------------------------------------------


class JobStore:
    """Async key-value store for job/session dicts.

    Parameters
    ----------
    namespace:
        Short name used as Redis key prefix (e.g. ``"crawl_jobs"``).
    ttl:
        Seconds before a job entry expires.  ``None`` means no expiry.
    """

    def __init__(self, namespace: str, ttl: int | None = None) -> None:
        self.namespace = namespace
        self.ttl = ttl if ttl is not None else _DEFAULT_TTL.get(namespace, _FALLBACK_TTL)
        self._fallback: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _key(self, job_id: str) -> str:
        return f"{self.namespace}:{job_id}"

    def _index_key(self) -> str:
        return f"{self.namespace}:_index"

    def _encode(self, data: Any) -> str:
        return json.dumps(data, default=str)

    def _decode(self, raw: str) -> Any:
        return json.loads(raw)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def set(self, job_id: str, data: Any) -> None:
        """Persist *data* under *job_id*."""
        client = await _get_redis()
        if client is not None:
            try:
                pipe = client.pipeline()
                pipe.set(self._key(job_id), self._encode(data), ex=self.ttl)
                pipe.sadd(self._index_key(), job_id)
                if self.ttl:
                    pipe.expire(self._index_key(), self.ttl * 2)
                await pipe.execute()
                await client.aclose()
                return
            except Exception as exc:
                logger.warning("Redis set failed (%s) — using fallback", exc)
            finally:
                try:
                    await client.aclose()
                except Exception as exc:
                    logger.debug("Error closing Redis client after set: %s", exc)

        async with self._lock:
            self._fallback[job_id] = data

    async def get(self, job_id: str) -> Any | None:
        """Return the stored dict for *job_id*, or ``None`` if not found."""
        client = await _get_redis()
        if client is not None:
            try:
                raw = await client.get(self._key(job_id))
                await client.aclose()
                if raw is None:
                    return None
                return self._decode(raw)
            except Exception as exc:
                logger.warning("Redis get failed (%s) — using fallback", exc)
            finally:
                try:
                    await client.aclose()
                except Exception as exc:
                    logger.debug("Error closing Redis client after get: %s", exc)

        async with self._lock:
            return self._fallback.get(job_id)

    async def update(self, job_id: str, patch: dict[str, Any]) -> Any | None:
        """Merge *patch* into the existing dict and re-persist it.

        Returns the updated dict, or ``None`` if *job_id* was not found.
        """
        data = await self.get(job_id)
        if data is None:
            return None
        if isinstance(data, dict):
            data.update(patch)
        await self.set(job_id, data)
        return data

    async def delete(self, job_id: str) -> None:
        """Remove *job_id* from the store."""
        client = await _get_redis()
        if client is not None:
            try:
                pipe = client.pipeline()
                pipe.delete(self._key(job_id))
                pipe.srem(self._index_key(), job_id)
                await pipe.execute()
                await client.aclose()
                return
            except Exception as exc:
                logger.warning("Redis delete failed (%s) — using fallback", exc)
            finally:
                try:
                    await client.aclose()
                except Exception as exc:
                    logger.debug("Error closing Redis client after delete: %s", exc)

        async with self._lock:
            self._fallback.pop(job_id, None)

    async def contains(self, job_id: str) -> bool:
        """Return ``True`` if *job_id* exists in the store."""
        return await self.get(job_id) is not None

    async def _process_raw_values(self, ids: list, raws: list) -> tuple[list[Any], list[str]]:
        results = []
        stale_ids = []
        for job_id, raw in zip(ids, raws):
            if raw is None:
                stale_ids.append(job_id)
            else:
                try:
                    results.append(self._decode(raw))
                except Exception as exc:
                    logger.debug("Skipping stale raw value: %s", exc)
                    stale_ids.append(job_id)
        return results, stale_ids

    async def _cleanup_stale_ids(self, stale_ids: list[str]) -> None:
        if not stale_ids:
            return
        try:
            clean_client = await _get_redis()
            if clean_client:
                await clean_client.srem(self._index_key(), *stale_ids)
                await clean_client.aclose()
        except Exception as exc:
            logger.debug("Failed to clean stale IDs from Redis: %s", exc)

    async def values(self) -> list[Any]:
        """Return all stored dicts in this namespace."""
        client = await _get_redis()
        if client is not None:
            try:
                ids = await client.smembers(self._index_key())
                if not ids:
                    await client.aclose()
                    return []
                pipe = client.pipeline()
                for job_id in ids:
                    pipe.get(self._key(job_id))
                raws = await pipe.execute()
                await client.aclose()
                results, stale_ids = await self._process_raw_values(ids, raws)
                await self._cleanup_stale_ids(stale_ids)
                return results
            except Exception as exc:
                logger.warning("Redis values failed (%s) — using fallback", exc)
            finally:
                try:
                    await client.aclose()
                except Exception as exc:
                    logger.debug("Error closing Redis client after values: %s", exc)

        async with self._lock:
            return list(self._fallback.values())

    async def clear(self) -> int:
        """Delete all entries in this namespace.  Returns the count removed."""
        client = await _get_redis()
        if client is not None:
            try:
                ids = await client.smembers(self._index_key())
                count = len(ids)
                if ids:
                    pipe = client.pipeline()
                    for job_id in ids:
                        pipe.delete(self._key(job_id))
                    pipe.delete(self._index_key())
                    await pipe.execute()
                await client.aclose()
                return count
            except Exception as exc:
                logger.warning("Redis clear failed (%s) — using fallback", exc)
            finally:
                try:
                    await client.aclose()
                except Exception as exc:
                    logger.debug("Error closing Redis client after clear: %s", exc)

        async with self._lock:
            count = len(self._fallback)
            self._fallback.clear()
            return count


# ---------------------------------------------------------------------------
# Singleton registry
# ---------------------------------------------------------------------------

_stores: dict[str, JobStore] = {}


def get_job_store(namespace: str, ttl: int | None = None) -> JobStore:
    """Return the singleton ``JobStore`` for *namespace*.

    The same instance is returned on every call with the same *namespace*,
    so in-memory fallback state is preserved across requests.
    """
    if namespace not in _stores:
        _stores[namespace] = JobStore(namespace, ttl=ttl)
    return _stores[namespace]
