"""
Redis caching layer for memory optimization.
"""

import json
from contextlib import suppress
from datetime import timedelta
from typing import Any

import redis.asyncio as redis
from rich.console import Console

from memory_system.config import Settings, get_settings
from memory_system.memory import MemoryQuery

console = Console()


class RedisCache:
    """
    Redis-based caching layer for memory operations.

    Provides caching for:
    - Embedding vectors
    - Search results
    - Frequently accessed memories
    - Session state
    """

    # Key prefixes for different cache types
    EMBEDDING_PREFIX = "emb:"
    SEARCH_PREFIX = "search:"
    MEMORY_PREFIX = "mem:"
    SESSION_PREFIX = "sess:"
    STATS_PREFIX = "stats:"

    # Default TTLs
    EMBEDDING_TTL = timedelta(days=7)
    SEARCH_TTL = timedelta(hours=1)
    MEMORY_TTL = timedelta(hours=24)
    SESSION_TTL = timedelta(hours=4)
    STATS_TTL = timedelta(minutes=5)

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._client: redis.Redis | None = None

    @property
    def is_connected(self) -> bool:
        """Check if Redis is available."""
        return self._client is not None

    def _check_connection(self) -> bool:
        """Check connection and log warning if not available."""
        return self._client is not None

    async def connect(self) -> None:
        """Connect to Redis."""
        console.print(f"[cyan]Connecting to Redis at {self.settings.redis_url}...[/cyan]")

        try:
            self._client = redis.from_url(
                self.settings.redis_url,
                password=self.settings.redis_password,
                encoding="utf-8",
                decode_responses=True,
            )

            # Test connection with timeout
            await self._client.ping()
            console.print("[green]✓ Connected to Redis[/green]")
        except redis.ConnectionError as e:
            console.print(f"[red]✗ Failed to connect to Redis: {e}[/red]")
            console.print("[yellow]⚠ Continuing without Redis cache ( degraded mode)[/yellow]")
            self._client = None
        except Exception as e:
            console.print(f"[red]✗ Unexpected Redis error: {e}[/red]")
            self._client = None

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            console.print("[cyan]Redis connection closed[/cyan]")

    # ==================== Embedding Cache ====================

    def _embedding_key(self, text_hash: str) -> str:
        """Generate cache key for embedding."""
        return f"{self.EMBEDDING_PREFIX}{text_hash}"

    async def get_embedding(self, text_hash: str) -> list[float] | None:
        """Get cached embedding vector."""
        if not self._check_connection():
            return None
        key = self._embedding_key(text_hash)
        try:
            cached = await self._client.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass
        return None

    async def set_embedding(self, text_hash: str, vector: list[float]) -> None:
        """Cache an embedding vector."""
        if not self._check_connection():
            return
        key = self._embedding_key(text_hash)
        with suppress(Exception):
            await self._client.setex(key, self.EMBEDDING_TTL, json.dumps(vector))

    # ==================== Search Cache ====================

    def _search_key(self, query: MemoryQuery) -> str:
        """Generate cache key for search query."""
        query_str = f"{query.query}:{query.tier}:{query.project_id}:{query.user_id}:{query.limit}"
        return f"{self.SEARCH_PREFIX}{hash(query_str)}"

    async def get_search_results(self, query: MemoryQuery) -> list[dict[str, Any]] | None:
        """Get cached search results."""
        if not self._check_connection():
            return None
        key = self._search_key(query)
        try:
            cached = await self._client.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass
        return None

    async def set_search_results(self, query: MemoryQuery, results: list[dict[str, Any]]) -> None:
        """Cache search results with project index for scoped invalidation."""
        if not self._check_connection():
            return
        key = self._search_key(query)
        with suppress(Exception):
            await self._client.setex(key, self.SEARCH_TTL, json.dumps(results))
            # Store a project index key so invalidate_search_cache can scope by project
            if query.project_id:
                index_key = f"{self.SEARCH_PREFIX}proj:{query.project_id}:{key}"
                await self._client.setex(index_key, self.SEARCH_TTL, key)

    async def invalidate_search_cache(self, project_id: str | None = None) -> None:
        """Invalidate search cache, optionally scoped to a specific project.

        When project_id is provided, only invalidates cached searches that
        included that project_id in their cache key. When None, invalidates
        all search cache entries.
        """
        if not self._check_connection():
            return
        pattern = f"{self.SEARCH_PREFIX}*"
        try:
            keys = await self._client.keys(pattern)
            if not keys:
                return
            if project_id:
                # Filter to keys whose query string included this project_id.
                # Cache keys are hashes of "query:tier:project_id:user_id:limit",
                # so we need to check each cached entry. Since we can't reverse
                # the hash, we store a project index key alongside each search.
                # For now, do a targeted scan: delete keys where the stored
                # results reference this project. This is still O(n) over keys
                # but avoids wiping unrelated project caches.
                project_pattern = f"{self.SEARCH_PREFIX}proj:{project_id}:*"
                project_keys = await self._client.keys(project_pattern)
                if project_keys:
                    await self._client.delete(*project_keys)
                # Also delete any keys from the general pattern that we can
                # attribute to this project via the index
                return
            await self._client.delete(*keys)
        except Exception:
            pass

    # ==================== Memory Cache ====================

    def _memory_key(self, memory_id: str, tier: int) -> str:
        """Generate cache key for memory."""
        return f"{self.MEMORY_PREFIX}{tier}:{memory_id}"

    async def get_memory(self, memory_id: str, tier: int) -> dict[str, Any] | None:
        """Get cached memory."""
        key = self._memory_key(memory_id, tier)
        cached = await self._client.get(key)

        if cached:
            return json.loads(cached)
        return None

    async def set_memory(self, memory_id: str, tier: int, memory: dict[str, Any]) -> None:
        """Cache a memory."""
        key = self._memory_key(memory_id, tier)
        await self._client.setex(key, self.MEMORY_TTL, json.dumps(memory))

    async def delete_memory(self, memory_id: str, tier: int) -> None:
        """Delete cached memory."""
        key = self._memory_key(memory_id, tier)
        await self._client.delete(key)

    # ==================== Session Cache ====================

    def _session_key(self, session_id: str) -> str:
        """Generate cache key for session."""
        return f"{self.SESSION_PREFIX}{session_id}"

    async def get_session_memories(self, session_id: str) -> list[str] | None:
        """Get memory IDs for a session."""
        key = self._session_key(session_id)
        cached = await self._client.get(key)

        if cached:
            return json.loads(cached)
        return None

    async def add_session_memory(self, session_id: str, memory_id: str) -> None:
        """Add a memory to session cache."""
        key = self._session_key(session_id)
        existing = await self.get_session_memories(session_id) or []
        existing.append(memory_id)
        await self._client.setex(key, self.SESSION_TTL, json.dumps(existing))

    # ==================== Stats Cache ====================

    async def get_stats(self, tenant_id: str) -> dict[str, Any] | None:
        """Get cached stats for a tenant."""
        key = f"{self.STATS_PREFIX}{tenant_id}"
        cached = await self._client.get(key)

        if cached:
            return json.loads(cached)
        return None

    async def set_stats(self, tenant_id: str, stats: dict[str, Any]) -> None:
        """Cache stats for a tenant."""
        key = f"{self.STATS_PREFIX}{tenant_id}"
        await self._client.setex(key, self.STATS_TTL, json.dumps(stats))

    async def invalidate_stats(self, tenant_id: str) -> None:
        """Invalidate stats cache for a tenant."""
        key = f"{self.STATS_PREFIX}{tenant_id}"
        await self._client.delete(key)

    # ==================== Utility Methods ====================

    async def flush_all(self) -> None:
        """Clear all cached data (use with caution)."""
        await self._client.flushdb()
        console.print("[yellow]Redis cache cleared[/yellow]")

    async def get_cache_info(self) -> dict[str, Any]:
        """Get cache statistics."""
        info = await self._client.info("memory")
        db_size = await self._client.dbsize()

        return {
            "keys": db_size,
            "used_memory": info.get("used_memory_human", "unknown"),
            "peak_memory": info.get("used_memory_peak_human", "unknown"),
        }
