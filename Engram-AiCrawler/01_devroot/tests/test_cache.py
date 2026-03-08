"""Tests for app.services.cache module."""

import json
import pytest
from unittest.mock import AsyncMock, patch

from app.services.cache import (
    _make_key,
    cache_get,
    cache_set,
    cache_delete,
    get_crawl_result,
    set_crawl_result,
    get_lm_response,
    set_lm_response,
    close_cache,
    CRAWL_RESULT_PREFIX,
    LM_RESPONSE_PREFIX,
    DEFAULT_TTL,
)


class TestMakeKey:
    """Tests for _make_key helper."""

    def test_returns_prefixed_hash(self):
        key = _make_key("prefix:", "identifier")
        assert key.startswith("prefix:")
        assert len(key) == len("prefix:") + 32

    def test_same_input_same_key(self):
        k1 = _make_key("p:", "test")
        k2 = _make_key("p:", "test")
        assert k1 == k2

    def test_different_input_different_key(self):
        k1 = _make_key("p:", "test1")
        k2 = _make_key("p:", "test2")
        assert k1 != k2

    def test_different_prefix_different_key(self):
        k1 = _make_key("a:", "test")
        k2 = _make_key("b:", "test")
        assert k1 != k2


class TestCacheGet:
    """Tests for cache_get."""

    @pytest.mark.asyncio
    async def test_cache_hit_returns_parsed_json(self):
        mock_client = AsyncMock()
        mock_client.get.return_value = json.dumps({"url": "https://example.com"})

        with patch("app.services.cache.get_cache_client", return_value=mock_client):
            result = await cache_get("prefix:", "id1")

        assert result == {"url": "https://example.com"}
        mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self):
        mock_client = AsyncMock()
        mock_client.get.return_value = None

        with patch("app.services.cache.get_cache_client", return_value=mock_client):
            result = await cache_get("prefix:", "id1")

        assert result is None

    @pytest.mark.asyncio
    async def test_cache_error_fails_open(self):
        """Cache errors should return None (fail-open), not raise."""
        with patch(
            "app.services.cache.get_cache_client",
            side_effect=ConnectionError("Redis down"),
        ):
            result = await cache_get("prefix:", "id1")

        assert result is None


class TestCacheSet:
    """Tests for cache_set."""

    @pytest.mark.asyncio
    async def test_set_calls_setex_with_ttl(self):
        mock_client = AsyncMock()

        with patch("app.services.cache.get_cache_client", return_value=mock_client):
            ok = await cache_set("prefix:", "id1", {"data": "value"}, ttl=600)

        assert ok is True
        mock_client.setex.assert_called_once()
        args = mock_client.setex.call_args
        assert args[0][1] == 600  # TTL

    @pytest.mark.asyncio
    async def test_set_uses_default_ttl(self):
        mock_client = AsyncMock()

        with patch("app.services.cache.get_cache_client", return_value=mock_client):
            await cache_set("prefix:", "id1", {"data": "value"})

        args = mock_client.setex.call_args
        assert args[0][1] == DEFAULT_TTL

    @pytest.mark.asyncio
    async def test_set_error_fails_open(self):
        with patch(
            "app.services.cache.get_cache_client",
            side_effect=ConnectionError("Redis down"),
        ):
            ok = await cache_set("prefix:", "id1", {"data": "value"})

        assert ok is False


class TestCacheDelete:
    """Tests for cache_delete."""

    @pytest.mark.asyncio
    async def test_delete_calls_redis_delete(self):
        mock_client = AsyncMock()

        with patch("app.services.cache.get_cache_client", return_value=mock_client):
            ok = await cache_delete("prefix:", "id1")

        assert ok is True
        mock_client.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_error_fails_open(self):
        with patch(
            "app.services.cache.get_cache_client",
            side_effect=ConnectionError("Redis down"),
        ):
            ok = await cache_delete("prefix:", "id1")

        assert ok is False


class TestCrawlResultHelpers:
    """Tests for get_crawl_result / set_crawl_result."""

    @pytest.mark.asyncio
    async def test_get_crawl_result_uses_correct_prefix(self):
        with patch("app.services.cache.cache_get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"markdown": "# Hello"}
            result = await get_crawl_result("https://example.com")

        mock_get.assert_called_once_with(CRAWL_RESULT_PREFIX, "https://example.com")
        assert result == {"markdown": "# Hello"}

    @pytest.mark.asyncio
    async def test_set_crawl_result_uses_correct_prefix(self):
        with patch("app.services.cache.cache_set", new_callable=AsyncMock) as mock_set:
            mock_set.return_value = True
            ok = await set_crawl_result("https://example.com", {"markdown": "# Hi"})

        mock_set.assert_called_once_with(
            CRAWL_RESULT_PREFIX, "https://example.com", {"markdown": "# Hi"}, DEFAULT_TTL
        )
        assert ok is True


class TestLMResponseHelpers:
    """Tests for get_lm_response / set_lm_response."""

    @pytest.mark.asyncio
    async def test_get_lm_response_uses_correct_prefix(self):
        with patch("app.services.cache.cache_get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"choices": []}
            result = await get_lm_response("abc123hash")

        mock_get.assert_called_once_with(LM_RESPONSE_PREFIX, "abc123hash")
        assert result == {"choices": []}

    @pytest.mark.asyncio
    async def test_set_lm_response_uses_30min_ttl(self):
        with patch("app.services.cache.cache_set", new_callable=AsyncMock) as mock_set:
            mock_set.return_value = True
            ok = await set_lm_response("abc123hash", {"choices": []})

        mock_set.assert_called_once_with(LM_RESPONSE_PREFIX, "abc123hash", {"choices": []}, 1800)
        assert ok is True


class TestCloseCache:
    """Tests for close_cache."""

    @pytest.mark.asyncio
    async def test_close_cleans_up_client_and_pool(self):
        import app.services.cache as cache_module

        mock_client = AsyncMock()
        mock_pool = AsyncMock()

        cache_module._cache_client = mock_client
        cache_module._cache_pool = mock_pool

        await close_cache()

        mock_client.close.assert_called_once()
        mock_pool.disconnect.assert_called_once()
        assert cache_module._cache_client is None
        assert cache_module._cache_pool is None

    @pytest.mark.asyncio
    async def test_close_handles_none_gracefully(self):
        import app.services.cache as cache_module

        cache_module._cache_client = None
        cache_module._cache_pool = None

        # Should not raise
        await close_cache()
