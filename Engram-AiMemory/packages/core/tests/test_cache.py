"""
Unit tests for memory_system.cache — RedisCache.

Mocks redis.asyncio so no live Redis is needed.
"""

from __future__ import annotations

import json
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from memory_system.cache import RedisCache
from memory_system.memory import MemoryQuery, MemoryTier


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings() -> MagicMock:
    s = MagicMock()
    s.redis_url = "redis://localhost:6379/0"
    s.redis_password = None
    return s


def _make_cache_with_client() -> tuple[RedisCache, AsyncMock]:
    """Return a RedisCache with a pre-wired AsyncMock _client."""
    cache = RedisCache(settings=_make_settings())
    mock_client = AsyncMock()
    cache._client = mock_client
    return cache, mock_client


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------


class TestRedisCacheInit:
    def test_default_settings(self) -> None:
        with patch("memory_system.cache.get_settings", return_value=_make_settings()):
            cache = RedisCache()
            assert cache._client is None

    def test_custom_settings(self) -> None:
        s = _make_settings()
        cache = RedisCache(settings=s)
        assert cache.settings is s

    def test_class_constants(self) -> None:
        assert RedisCache.EMBEDDING_PREFIX == "emb:"
        assert RedisCache.SEARCH_PREFIX == "search:"
        assert RedisCache.MEMORY_PREFIX == "mem:"
        assert RedisCache.SESSION_PREFIX == "sess:"
        assert RedisCache.STATS_PREFIX == "stats:"
        assert isinstance(RedisCache.EMBEDDING_TTL, timedelta)
        assert isinstance(RedisCache.SEARCH_TTL, timedelta)


# ---------------------------------------------------------------------------
# connect / close
# ---------------------------------------------------------------------------


class TestConnect:
    @pytest.mark.asyncio
    async def test_connect_creates_client_and_pings(self) -> None:
        mock_redis_instance = AsyncMock()
        mock_redis_instance.ping = AsyncMock()

        with patch("memory_system.cache.redis.from_url", return_value=mock_redis_instance):
            cache = RedisCache(settings=_make_settings())
            await cache.connect()

            assert cache._client is mock_redis_instance
            mock_redis_instance.ping.assert_awaited_once()


class TestClose:
    @pytest.mark.asyncio
    async def test_close_calls_client_close(self) -> None:
        cache, mock_client = _make_cache_with_client()
        await cache.close()
        mock_client.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_close_noop_when_no_client(self) -> None:
        cache = RedisCache(settings=_make_settings())
        cache._client = None
        await cache.close()  # should not raise


# ---------------------------------------------------------------------------
# is_connected property
# ---------------------------------------------------------------------------


class TestIsConnected:
    def test_connected_when_client_exists(self) -> None:
        cache, _ = _make_cache_with_client()
        assert cache.is_connected is True

    def test_not_connected_when_none(self) -> None:
        cache = RedisCache(settings=_make_settings())
        assert cache.is_connected is False


# ---------------------------------------------------------------------------
# Embedding cache
# ---------------------------------------------------------------------------


class TestEmbeddingCache:
    @pytest.mark.asyncio
    async def test_get_embedding_hit(self) -> None:
        cache, mock_client = _make_cache_with_client()
        vector = [0.1, 0.2, 0.3]
        mock_client.get = AsyncMock(return_value=json.dumps(vector))

        result = await cache.get_embedding("abc123")
        assert result == vector
        mock_client.get.assert_awaited_once_with("emb:abc123")

    @pytest.mark.asyncio
    async def test_get_embedding_miss(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.get = AsyncMock(return_value=None)

        result = await cache.get_embedding("missing")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_embedding(self) -> None:
        cache, mock_client = _make_cache_with_client()
        vector = [0.4, 0.5, 0.6]
        mock_client.setex = AsyncMock()

        await cache.set_embedding("hash1", vector)
        mock_client.setex.assert_awaited_once()
        call_args = mock_client.setex.call_args
        assert call_args[0][0] == "emb:hash1"
        assert call_args[0][1] == RedisCache.EMBEDDING_TTL
        assert json.loads(call_args[0][2]) == vector


# ---------------------------------------------------------------------------
# Search cache
# ---------------------------------------------------------------------------


class TestSearchCache:
    def _make_query(self) -> MemoryQuery:
        return MemoryQuery(
            query="test query",
            tier=MemoryTier.PROJECT,
            project_id="proj-1",
            user_id="user-1",
            limit=10,
        )

    @pytest.mark.asyncio
    async def test_get_search_results_hit(self) -> None:
        cache, mock_client = _make_cache_with_client()
        data = [{"memory": "data"}]
        mock_client.get = AsyncMock(return_value=json.dumps(data))

        result = await cache.get_search_results(self._make_query())
        assert result == data

    @pytest.mark.asyncio
    async def test_get_search_results_miss(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.get = AsyncMock(return_value=None)

        result = await cache.get_search_results(self._make_query())
        assert result is None

    @pytest.mark.asyncio
    async def test_set_search_results(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.setex = AsyncMock()
        data = [{"memory": "result"}]
        query_without_project = MemoryQuery(
            query="test query",
            tier=MemoryTier.PROJECT,
            project_id=None,  # No project_id to avoid double setex call
            user_id="user-1",
            limit=10,
        )

        await cache.set_search_results(query_without_project, data)
        mock_client.setex.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_invalidate_search_cache_with_keys(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.keys = AsyncMock(return_value=["search:1", "search:2"])
        mock_client.delete = AsyncMock()

        await cache.invalidate_search_cache()
        mock_client.keys.assert_awaited_once_with("search:*")
        mock_client.delete.assert_awaited_once_with("search:1", "search:2")

    @pytest.mark.asyncio
    async def test_invalidate_search_cache_no_keys(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.keys = AsyncMock(return_value=[])
        mock_client.delete = AsyncMock()

        await cache.invalidate_search_cache()
        mock_client.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_invalidate_search_cache_with_project_id(self) -> None:
        """project_id param is accepted (currently no-op filter)."""
        cache, mock_client = _make_cache_with_client()
        mock_client.keys = AsyncMock(return_value=[])
        mock_client.delete = AsyncMock()

        await cache.invalidate_search_cache(project_id="proj-1")
        mock_client.keys.assert_awaited_once()


# ---------------------------------------------------------------------------
# Memory cache
# ---------------------------------------------------------------------------


class TestMemoryCache:
    @pytest.mark.asyncio
    async def test_get_memory_hit(self) -> None:
        cache, mock_client = _make_cache_with_client()
        data = {"content": "hello"}
        mock_client.get = AsyncMock(return_value=json.dumps(data))

        result = await cache.get_memory("mem-123", 1)
        assert result == data
        mock_client.get.assert_awaited_once_with("mem:1:mem-123")

    @pytest.mark.asyncio
    async def test_get_memory_miss(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.get = AsyncMock(return_value=None)

        result = await cache.get_memory("mem-missing", 2)
        assert result is None

    @pytest.mark.asyncio
    async def test_set_memory(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.setex = AsyncMock()
        data = {"content": "stored"}

        await cache.set_memory("mem-1", 1, data)
        mock_client.setex.assert_awaited_once()
        args = mock_client.setex.call_args[0]
        assert args[0] == "mem:1:mem-1"
        assert args[1] == RedisCache.MEMORY_TTL

    @pytest.mark.asyncio
    async def test_delete_memory(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.delete = AsyncMock()

        await cache.delete_memory("mem-1", 1)
        mock_client.delete.assert_awaited_once_with("mem:1:mem-1")


# ---------------------------------------------------------------------------
# Session cache
# ---------------------------------------------------------------------------


class TestSessionCache:
    @pytest.mark.asyncio
    async def test_get_session_memories_hit(self) -> None:
        cache, mock_client = _make_cache_with_client()
        data = ["mem-1", "mem-2"]
        mock_client.get = AsyncMock(return_value=json.dumps(data))

        result = await cache.get_session_memories("sess-abc")
        assert result == data
        mock_client.get.assert_awaited_once_with("sess:sess-abc")

    @pytest.mark.asyncio
    async def test_get_session_memories_miss(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.get = AsyncMock(return_value=None)

        result = await cache.get_session_memories("sess-missing")
        assert result is None

    @pytest.mark.asyncio
    async def test_add_session_memory_appends(self) -> None:
        cache, mock_client = _make_cache_with_client()
        # Simulate existing session with one memory
        mock_client.get = AsyncMock(return_value=json.dumps(["mem-1"]))
        mock_client.setex = AsyncMock()

        await cache.add_session_memory("sess-1", "mem-2")
        mock_client.setex.assert_awaited_once()
        stored = json.loads(mock_client.setex.call_args[0][2])
        assert stored == ["mem-1", "mem-2"]

    @pytest.mark.asyncio
    async def test_add_session_memory_creates_new(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.get = AsyncMock(return_value=None)
        mock_client.setex = AsyncMock()

        await cache.add_session_memory("sess-new", "mem-1")
        stored = json.loads(mock_client.setex.call_args[0][2])
        assert stored == ["mem-1"]


# ---------------------------------------------------------------------------
# Stats cache
# ---------------------------------------------------------------------------


class TestStatsCache:
    @pytest.mark.asyncio
    async def test_get_stats_hit(self) -> None:
        cache, mock_client = _make_cache_with_client()
        data = {"total": 100}
        mock_client.get = AsyncMock(return_value=json.dumps(data))

        result = await cache.get_stats("tenant-a")
        assert result == data
        mock_client.get.assert_awaited_once_with("stats:tenant-a")

    @pytest.mark.asyncio
    async def test_get_stats_miss(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.get = AsyncMock(return_value=None)

        result = await cache.get_stats("tenant-missing")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_stats(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.setex = AsyncMock()
        data = {"total": 200}

        await cache.set_stats("tenant-a", data)
        mock_client.setex.assert_awaited_once()
        args = mock_client.setex.call_args[0]
        assert args[0] == "stats:tenant-a"
        assert args[1] == RedisCache.STATS_TTL

    @pytest.mark.asyncio
    async def test_invalidate_stats(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.delete = AsyncMock()

        await cache.invalidate_stats("tenant-a")
        mock_client.delete.assert_awaited_once_with("stats:tenant-a")


# ---------------------------------------------------------------------------
# Utility methods
# ---------------------------------------------------------------------------


class TestUtilityMethods:
    @pytest.mark.asyncio
    async def test_flush_all(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.flushdb = AsyncMock()

        await cache.flush_all()
        mock_client.flushdb.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_cache_info(self) -> None:
        cache, mock_client = _make_cache_with_client()
        mock_client.info = AsyncMock(
            return_value={
                "used_memory_human": "1.5M",
                "used_memory_peak_human": "2.0M",
            }
        )
        mock_client.dbsize = AsyncMock(return_value=42)

        info = await cache.get_cache_info()
        assert info["keys"] == 42
        assert info["used_memory"] == "1.5M"
        assert info["peak_memory"] == "2.0M"


# ---------------------------------------------------------------------------
# Key generation helpers
# ---------------------------------------------------------------------------


class TestKeyGeneration:
    def test_embedding_key(self) -> None:
        cache = RedisCache(settings=_make_settings())
        assert cache._embedding_key("abc") == "emb:abc"

    def test_search_key_deterministic(self) -> None:
        cache = RedisCache(settings=_make_settings())
        q = MemoryQuery(query="hello", tier=MemoryTier.PROJECT, limit=5)
        key1 = cache._search_key(q)
        key2 = cache._search_key(q)
        assert key1 == key2
        assert key1.startswith("search:")

    def test_memory_key(self) -> None:
        cache = RedisCache(settings=_make_settings())
        assert cache._memory_key("id-1", 1) == "mem:1:id-1"

    def test_session_key(self) -> None:
        cache = RedisCache(settings=_make_settings())
        assert cache._session_key("s-1") == "sess:s-1"
