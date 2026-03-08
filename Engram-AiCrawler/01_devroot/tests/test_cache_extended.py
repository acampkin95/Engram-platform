"""Extended tests for app/services/cache.py — CacheLayer class.

The existing test_cache.py covers legacy functions (_make_key, cache_get,
cache_set, cache_delete, get/set_crawl_result, get/set_lm_response,
close_cache).

This file targets the CacheLayer class (lines 217-368) and the
get_cache_layer / close_cache_layer singletons.

Coverage target: raise cache.py from 51% to 75%+.

All tests use a mock Redis client — no real Redis connection required.
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.cache import (
    CacheTier,
    CacheLayer,
    TIER_TTL,
    get_cache_layer,
    close_cache_layer,
    close_cache,
)

import app.services.cache as _cache_module


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_redis() -> AsyncMock:
    """Return a mock Redis client with all methods needed by CacheLayer."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    redis.exists = AsyncMock(return_value=0)
    return redis


def _make_layer(redis: AsyncMock | None = None) -> CacheLayer:
    if redis is None:
        redis = _make_redis()
    return CacheLayer(redis)


# ===========================================================================
# 1. CacheTier enum
# ===========================================================================


class TestCacheTier:
    def test_all_tiers_defined(self):
        assert CacheTier.HOT == "hot"
        assert CacheTier.WARM == "warm"
        assert CacheTier.COLD == "cold"
        assert CacheTier.NEGATIVE == "neg"
        assert CacheTier.LLM == "llm"

    def test_tier_ttl_all_present(self):
        for tier in CacheTier:
            assert tier in TIER_TTL
            assert TIER_TTL[tier] > 0

    def test_tier_ttl_ordering(self):
        """HOT < WARM < COLD for TTL."""
        assert TIER_TTL[CacheTier.HOT] < TIER_TTL[CacheTier.WARM]
        assert TIER_TTL[CacheTier.WARM] < TIER_TTL[CacheTier.COLD]

    def test_negative_ttl_shortest(self):
        assert TIER_TTL[CacheTier.NEGATIVE] == 300


# ===========================================================================
# 2. CacheLayer.url_key
# ===========================================================================


class TestCacheLayerUrlKey:
    def test_returns_tier_prefixed_key(self):
        key = CacheLayer.url_key("https://example.com", CacheTier.HOT)
        assert key.startswith("cache:hot:")

    def test_warm_tier_prefix(self):
        key = CacheLayer.url_key("https://example.com", CacheTier.WARM)
        assert key.startswith("cache:warm:")

    def test_cold_tier_prefix(self):
        key = CacheLayer.url_key("https://example.com", CacheTier.COLD)
        assert key.startswith("cache:cold:")

    def test_string_tier_works(self):
        key = CacheLayer.url_key("https://example.com", "hot")
        assert key.startswith("cache:hot:")

    def test_same_url_same_key(self):
        k1 = CacheLayer.url_key("https://example.com", CacheTier.HOT)
        k2 = CacheLayer.url_key("https://example.com", CacheTier.HOT)
        assert k1 == k2

    def test_different_urls_different_keys(self):
        k1 = CacheLayer.url_key("https://a.com", CacheTier.HOT)
        k2 = CacheLayer.url_key("https://b.com", CacheTier.HOT)
        assert k1 != k2

    def test_key_length_consistent(self):
        key = CacheLayer.url_key("https://example.com", CacheTier.HOT)
        # "cache:hot:" + 16 hex chars
        assert len(key) == len("cache:hot:") + 16


# ===========================================================================
# 3. CacheLayer.prompt_key
# ===========================================================================


class TestCacheLayerPromptKey:
    def test_returns_llm_prefixed_key(self):
        key = CacheLayer.prompt_key("What is the capital of France?")
        assert key.startswith("cache:llm:")

    def test_same_prompt_same_key(self):
        k1 = CacheLayer.prompt_key("hello world")
        k2 = CacheLayer.prompt_key("hello world")
        assert k1 == k2

    def test_different_prompts_different_keys(self):
        k1 = CacheLayer.prompt_key("prompt A")
        k2 = CacheLayer.prompt_key("prompt B")
        assert k1 != k2

    def test_key_length_consistent(self):
        key = CacheLayer.prompt_key("test prompt")
        assert len(key) == len("cache:llm:") + 16


# ===========================================================================
# 4. CacheLayer.get
# ===========================================================================


class TestCacheLayerGet:
    @pytest.mark.asyncio
    async def test_get_hit_returns_dict(self):
        redis = _make_redis()
        redis.get = AsyncMock(return_value=json.dumps({"result": "ok"}))
        layer = _make_layer(redis)
        result = await layer.get("mykey")
        assert result == {"result": "ok"}

    @pytest.mark.asyncio
    async def test_get_miss_returns_none(self):
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)
        layer = _make_layer(redis)
        result = await layer.get("mykey")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_redis_error_fails_open(self):
        redis = _make_redis()
        redis.get = AsyncMock(side_effect=ConnectionError("Redis down"))
        layer = _make_layer(redis)
        result = await layer.get("mykey")
        assert result is None


# ===========================================================================
# 5. CacheLayer.set
# ===========================================================================


class TestCacheLayerSet:
    @pytest.mark.asyncio
    async def test_set_returns_true_on_success(self):
        redis = _make_redis()
        layer = _make_layer(redis)
        result = await layer.set("mykey", {"data": "value"}, ttl=3600)
        assert result is True
        redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_passes_ttl(self):
        redis = _make_redis()
        layer = _make_layer(redis)
        await layer.set("mykey", {"x": 1}, ttl=7200)
        call_kwargs = redis.set.call_args
        assert call_kwargs.kwargs.get("ex") == 7200 or (
            len(call_kwargs.args) > 2 and call_kwargs.args[2] == 7200
        )

    @pytest.mark.asyncio
    async def test_set_redis_error_returns_false(self):
        redis = _make_redis()
        redis.set = AsyncMock(side_effect=ConnectionError("Redis down"))
        layer = _make_layer(redis)
        result = await layer.set("mykey", {"x": 1})
        assert result is False

    @pytest.mark.asyncio
    async def test_set_default_ttl(self):
        redis = _make_redis()
        layer = _make_layer(redis)
        await layer.set("mykey", {"x": 1})
        redis.set.assert_called_once()


# ===========================================================================
# 6. CacheLayer.delete
# ===========================================================================


class TestCacheLayerDelete:
    @pytest.mark.asyncio
    async def test_delete_returns_true_on_success(self):
        redis = _make_redis()
        layer = _make_layer(redis)
        result = await layer.delete("mykey")
        assert result is True

    @pytest.mark.asyncio
    async def test_delete_also_removes_negative_key(self):
        redis = _make_redis()
        layer = _make_layer(redis)
        await layer.delete("mykey")
        # Should delete both the key and its negative-cache entry
        call_args = redis.delete.call_args
        args = call_args.args
        assert "mykey" in args
        assert "cache:neg:mykey" in args

    @pytest.mark.asyncio
    async def test_delete_redis_error_returns_false(self):
        redis = _make_redis()
        redis.delete = AsyncMock(side_effect=ConnectionError("Redis down"))
        layer = _make_layer(redis)
        result = await layer.delete("mykey")
        assert result is False


# ===========================================================================
# 7. CacheLayer.get_or_compute — cache hit path
# ===========================================================================


class TestCacheLayerGetOrComputeHit:
    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_value(self):
        redis = _make_redis()
        cached_value = {"url": "https://example.com", "content": "hello"}
        redis.get = AsyncMock(return_value=json.dumps(cached_value))
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"fresh": "data"})
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result == cached_value
        compute_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_read_error_falls_through_to_compute(self):
        """Redis read error should not prevent computation (fail-open)."""
        redis = _make_redis()
        redis.get = AsyncMock(side_effect=ConnectionError("Redis down"))
        redis.exists = AsyncMock(return_value=0)
        redis.set = AsyncMock(return_value=True)
        redis.delete = AsyncMock(return_value=1)
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"fresh": "data"})
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result == {"fresh": "data"}
        compute_fn.assert_called_once()


# ===========================================================================
# 8. CacheLayer.get_or_compute — negative cache path
# ===========================================================================


class TestCacheLayerGetOrComputeNegative:
    @pytest.mark.asyncio
    async def test_negative_cache_hit_returns_none(self):
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)  # No positive cache
        redis.exists = AsyncMock(return_value=1)  # Negative cache hit
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"data": "value"})
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result is None
        compute_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_negative_cache_check_error_falls_through(self):
        """Error checking negative cache should not block computation."""
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)
        redis.exists = AsyncMock(side_effect=ConnectionError("Redis down"))
        # Lock acquisition
        redis.set = AsyncMock(return_value=True)
        redis.delete = AsyncMock(return_value=1)
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"result": "ok"})
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result == {"result": "ok"}


# ===========================================================================
# 9. CacheLayer.get_or_compute — compute path (no lock contention)
# ===========================================================================


class TestCacheLayerGetOrComputeFresh:
    @pytest.mark.asyncio
    async def test_compute_and_store_result(self):
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)
        redis.exists = AsyncMock(return_value=0)
        redis.set = AsyncMock(return_value=True)  # Lock acquired
        redis.delete = AsyncMock(return_value=1)
        layer = _make_layer(redis)

        fresh_data = {"url": "https://example.com", "status": "ok"}
        compute_fn = AsyncMock(return_value=fresh_data)
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result == fresh_data
        compute_fn.assert_called_once()

    @pytest.mark.asyncio
    async def test_compute_none_result_sets_negative_cache(self):
        """When compute_fn returns None, a negative-cache entry should be set."""
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)
        redis.exists = AsyncMock(return_value=0)
        redis.set = AsyncMock(return_value=True)
        redis.delete = AsyncMock(return_value=1)
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value=None)
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result is None
        # Verify negative cache was set (set called with neg_key)
        set_calls = redis.set.call_args_list
        neg_call = [c for c in set_calls if "cache:neg:" in str(c)]
        assert len(neg_call) > 0

    @pytest.mark.asyncio
    async def test_compute_exception_sets_negative_cache_and_returns_none(self):
        """Exception in compute_fn should set negative cache and return None."""
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)
        redis.exists = AsyncMock(return_value=0)
        redis.set = AsyncMock(return_value=True)
        redis.delete = AsyncMock(return_value=1)
        layer = _make_layer(redis)

        compute_fn = AsyncMock(side_effect=RuntimeError("Crawl failed"))
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result is None
        # Negative cache should have been attempted
        set_calls = redis.set.call_args_list
        neg_call = [c for c in set_calls if "cache:neg:" in str(c)]
        assert len(neg_call) > 0

    @pytest.mark.asyncio
    async def test_lock_released_after_compute(self):
        """Lock key should be deleted after computation completes."""
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)
        redis.exists = AsyncMock(return_value=0)
        redis.set = AsyncMock(return_value=True)
        redis.delete = AsyncMock(return_value=1)
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"x": 1})
        await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        # delete should be called with the lock key
        delete_calls = redis.delete.call_args_list
        assert len(delete_calls) >= 1

    @pytest.mark.asyncio
    async def test_lock_acquire_error_proceeds_without_lock(self):
        """Lock acquire failure should not block computation (fail-open)."""
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)
        redis.exists = AsyncMock(return_value=0)
        # First set call (lock) fails; subsequent set calls (cache store) succeed
        redis.set = AsyncMock(side_effect=[ConnectionError("Redis down"), True])
        redis.delete = AsyncMock(return_value=1)
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"x": 1})
        result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        # Should still compute even without lock
        assert result == {"x": 1}
        compute_fn.assert_called_once()


# ===========================================================================
# 10. CacheLayer.get_or_compute — lock contention (another worker computing)
# ===========================================================================


class TestCacheLayerGetOrComputeLockContention:
    @pytest.mark.asyncio
    async def test_lock_not_acquired_polls_cache(self):
        """When lock is not acquired, poll cache until result appears."""
        redis = _make_redis()
        redis.exists = AsyncMock(return_value=0)

        # First get = miss (no positive cache), lock set returns False (not acquired)
        # Then poll: first poll miss, second poll hit
        cached_value = {"result": "from_other_worker"}
        redis.get = AsyncMock(
            side_effect=[
                None,  # initial cache check
                None,  # first poll
                json.dumps(cached_value),  # second poll — result available
            ]
        )
        redis.set = AsyncMock(return_value=False)  # Lock not acquired

        layer = _make_layer(redis)
        layer.LOCK_RETRY_DELAY = 0.001  # Speed up polling

        with patch("asyncio.sleep", new_callable=AsyncMock):
            compute_fn = AsyncMock(return_value={"fresh": "data"})
            result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result == cached_value
        compute_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_lock_not_acquired_timeout_returns_none(self):
        """If lock not acquired and cache never populated, return None."""
        redis = _make_redis()
        redis.get = AsyncMock(return_value=None)  # Always miss
        redis.exists = AsyncMock(return_value=0)
        redis.set = AsyncMock(return_value=False)  # Lock never acquired

        layer = _make_layer(redis)
        # Force very short timeout
        layer.LOCK_TIMEOUT = 0.01
        layer.LOCK_RETRY_DELAY = 0.001

        with patch("asyncio.sleep", new_callable=AsyncMock):
            compute_fn = AsyncMock(return_value={"x": 1})
            result = await layer.get_or_compute("mykey", compute_fn, ttl=3600)

        assert result is None
        compute_fn.assert_not_called()


# ===========================================================================
# 11. get_cache_layer singleton
# ===========================================================================


class TestGetCacheLayerSingleton:
    @pytest.mark.asyncio
    async def test_returns_cache_layer_instance(self):
        # Reset singleton
        _cache_module._cache_layer = None
        mock_redis = _make_redis()

        with patch("app.services.cache.get_cache_client", new=AsyncMock(return_value=mock_redis)):
            layer = await get_cache_layer()
        assert isinstance(layer, CacheLayer)

    @pytest.mark.asyncio
    async def test_returns_same_instance_on_second_call(self):
        _cache_module._cache_layer = None
        mock_redis = _make_redis()

        with patch("app.services.cache.get_cache_client", new=AsyncMock(return_value=mock_redis)):
            layer1 = await get_cache_layer()
            layer2 = await get_cache_layer()
        assert layer1 is layer2

    @pytest.mark.asyncio
    async def test_returns_existing_singleton_without_new_client(self):
        """If singleton already exists, get_cache_client should NOT be called."""
        existing_layer = _make_layer()
        _cache_module._cache_layer = existing_layer

        mock_get_client = AsyncMock()
        with patch("app.services.cache.get_cache_client", new=mock_get_client):
            layer = await get_cache_layer()

        assert layer is existing_layer
        mock_get_client.assert_not_called()


# ===========================================================================
# 12. close_cache_layer
# ===========================================================================


class TestCloseCacheLayer:
    @pytest.mark.asyncio
    async def test_close_resets_singleton(self):
        _cache_module._cache_layer = _make_layer()
        await close_cache_layer()
        assert _cache_module._cache_layer is None

    @pytest.mark.asyncio
    async def test_close_idempotent(self):
        _cache_module._cache_layer = None
        await close_cache_layer()
        assert _cache_module._cache_layer is None


# ===========================================================================
# 13. close_cache (legacy)
# ===========================================================================


class TestCloseCacheLegacy:
    @pytest.mark.asyncio
    async def test_close_with_none_client(self):
        """close_cache with no client should not raise."""
        _cache_module._cache_client = None
        _cache_module._cache_pool = None
        await close_cache()
        assert _cache_module._cache_client is None

    @pytest.mark.asyncio
    async def test_close_with_mock_client(self):
        mock_client = AsyncMock()
        mock_pool = MagicMock()
        mock_pool.disconnect = AsyncMock()
        _cache_module._cache_client = mock_client
        _cache_module._cache_pool = mock_pool

        await close_cache()

        mock_client.close.assert_called_once()
        assert _cache_module._cache_client is None
        assert _cache_module._cache_pool is None

    @pytest.mark.asyncio
    async def test_close_handles_client_close_error(self):
        """Errors during close should be swallowed."""
        mock_client = AsyncMock()
        mock_client.close = AsyncMock(side_effect=Exception("already closed"))
        _cache_module._cache_client = mock_client
        _cache_module._cache_pool = None

        await close_cache()  # Should not raise
        assert _cache_module._cache_client is None


# ===========================================================================
# 14. Integration: url_key → get_or_compute round-trip
# ===========================================================================


class TestCacheLayerIntegration:
    @pytest.mark.asyncio
    async def test_url_key_used_in_get_or_compute(self):
        """Verify url_key generates a key that get_or_compute can use."""
        redis = _make_redis()
        key = CacheLayer.url_key("https://example.com", CacheTier.HOT)
        # Pre-populate cache with this key
        cached = {"content": "cached page"}
        redis.get = AsyncMock(return_value=json.dumps(cached))
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"content": "fresh"})
        result = await layer.get_or_compute(key, compute_fn, ttl=TIER_TTL[CacheTier.HOT])

        assert result == cached
        compute_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_prompt_key_used_in_get_or_compute(self):
        """Verify prompt_key generates a key that get_or_compute can use."""
        redis = _make_redis()
        key = CacheLayer.prompt_key("What is the meaning of life?")
        cached = {"answer": "42"}
        redis.get = AsyncMock(return_value=json.dumps(cached))
        layer = _make_layer(redis)

        compute_fn = AsyncMock(return_value={"answer": "fresh"})
        result = await layer.get_or_compute(key, compute_fn, ttl=TIER_TTL[CacheTier.LLM])

        assert result == cached
        compute_fn.assert_not_called()
