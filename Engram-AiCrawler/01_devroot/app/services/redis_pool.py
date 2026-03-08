"""Shared Redis connection pool — single pool for the entire application."""
from __future__ import annotations
import os
import logging
import redis.asyncio as aioredis
from redis.asyncio.connection import ConnectionPool

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None
_client: aioredis.Redis | None = None


def get_redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


async def get_redis_pool() -> aioredis.Redis:
    """Get or create the shared Redis client (lazy init)."""

    global _pool, _client
    if _client is None:
        _pool = ConnectionPool.from_url(
            get_redis_url(),
            decode_responses=True,
            max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "20")),
            socket_timeout=int(os.getenv("REDIS_SOCKET_TIMEOUT", "5")),
            socket_connect_timeout=int(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "5")),
        )
        _client = aioredis.Redis(connection_pool=_pool)
        logger.info("Shared Redis pool initialized: %s", get_redis_url())
    return _client


async def close_redis_pool() -> None:
    """Close the shared Redis pool (call on app shutdown)."""
    global _pool, _client
    if _client:
        await _client.close()
        _client = None
    if _pool:
        await _pool.disconnect()
        _pool = None
    logger.info("Shared Redis pool closed")
