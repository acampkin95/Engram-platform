"""Tests for app/services/job_store.py — Redis path and in-memory fallback."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.job_store import JobStore, _redis_url, get_job_store


# ---------------------------------------------------------------------------
# _redis_url
# ---------------------------------------------------------------------------


class TestRedisUrl:
    def test_default_url(self, monkeypatch):
        monkeypatch.delenv("REDIS_URL", raising=False)
        url = _redis_url()
        assert "redis://" in url

    def test_custom_url(self, monkeypatch):
        monkeypatch.setenv("REDIS_URL", "redis://myhost:1234/1")
        url = _redis_url()
        assert url == "redis://myhost:1234/1"


# ---------------------------------------------------------------------------
# get_job_store
# ---------------------------------------------------------------------------


class TestGetJobStore:
    def test_returns_job_store(self):
        store = get_job_store("test_namespace_xyz")
        assert isinstance(store, JobStore)

    def test_same_namespace_returns_same_instance(self):
        s1 = get_job_store("shared_ns_abc")
        s2 = get_job_store("shared_ns_abc")
        assert s1 is s2

    def test_different_namespaces_different_instances(self):
        s1 = get_job_store("ns_aaa_001")
        s2 = get_job_store("ns_bbb_001")
        assert s1 is not s2


# ---------------------------------------------------------------------------
# JobStore — in-memory fallback (no Redis)
# ---------------------------------------------------------------------------


def _make_store_no_redis(namespace: str = "test_fallback") -> JobStore:
    """Create a fresh JobStore with Redis disabled (always falls back to memory)."""
    store = JobStore(namespace=namespace)
    # Override to avoid namespace collision with singleton
    store._fallback = {}
    return store


async def _no_redis():
    """Simulates Redis being unavailable."""
    return None


class TestJobStoreFallback:
    """Test in-memory fallback when Redis is unavailable."""

    @pytest.mark.asyncio
    async def test_set_and_get(self):
        store = _make_store_no_redis("fb_test_1")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            await store.set("job1", {"status": "pending", "url": "https://example.com"})
            result = await store.get("job1")
        assert result is not None
        assert result["status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self):
        store = _make_store_no_redis("fb_test_2")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            result = await store.get("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete(self):
        store = _make_store_no_redis("fb_test_3")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            await store.set("job2", {"x": 1})
            await store.delete("job2")
            result = await store.get("job2")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_no_error(self):
        store = _make_store_no_redis("fb_test_4")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            await store.delete("never_existed")  # Should not raise

    @pytest.mark.asyncio
    async def test_values_returns_all(self):
        store = _make_store_no_redis("fb_test_5")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            await store.set("j1", {"n": 1})
            await store.set("j2", {"n": 2})
            await store.set("j3", {"n": 3})
            vals = await store.values()
        assert len(vals) == 3

    @pytest.mark.asyncio
    async def test_values_empty_store(self):
        store = _make_store_no_redis("fb_test_6")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            vals = await store.values()
        assert vals == []

    @pytest.mark.asyncio
    async def test_contains_existing(self):
        store = _make_store_no_redis("fb_test_7")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            await store.set("job_x", {"data": "value"})
            exists = await store.contains("job_x")
        assert exists is True

    @pytest.mark.asyncio
    async def test_contains_missing(self):
        store = _make_store_no_redis("fb_test_8")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            exists = await store.contains("missing_key")
        assert exists is False

    @pytest.mark.asyncio
    async def test_update_existing(self):
        store = _make_store_no_redis("fb_test_9")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            await store.set("job_upd", {"status": "pending", "url": "https://x.com"})
            updated = await store.update("job_upd", {"status": "completed"})
        assert updated["status"] == "completed"
        assert updated["url"] == "https://x.com"

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_none(self):
        store = _make_store_no_redis("fb_test_10")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            result = await store.update("ghost", {"status": "done"})
        assert result is None

    @pytest.mark.asyncio
    async def test_clear_removes_all(self):
        store = _make_store_no_redis("fb_test_11")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            await store.set("a", {"x": 1})
            await store.set("b", {"y": 2})
            count = await store.clear()
            vals = await store.values()
        assert count == 2
        assert vals == []

    @pytest.mark.asyncio
    async def test_clear_empty_returns_0(self):
        store = _make_store_no_redis("fb_test_12")
        with patch("app.services.job_store._get_redis", new_callable=AsyncMock, return_value=None):
            count = await store.clear()
        assert count == 0


# ---------------------------------------------------------------------------
# JobStore — Redis path (mocked Redis client)
# ---------------------------------------------------------------------------


def _make_mock_redis():
    """Return a mock aioredis client with all expected methods."""
    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.aclose = AsyncMock()

    # Pipeline mock
    mock_pipe = MagicMock()
    mock_pipe.set = MagicMock()
    mock_pipe.sadd = MagicMock()
    mock_pipe.expire = MagicMock()
    mock_pipe.delete = MagicMock()
    mock_pipe.srem = MagicMock()
    mock_pipe.execute = AsyncMock(return_value=[True, True, True])

    mock_redis.pipeline.return_value = mock_pipe
    return mock_redis


class TestJobStoreRedisPath:
    """Test the Redis code path with a mocked Redis client."""

    @pytest.mark.asyncio
    async def test_set_uses_pipeline(self):
        store = _make_store_no_redis("redis_test_1")
        mock_redis = _make_mock_redis()
        mock_redis.get = AsyncMock(return_value='{"status": "ok"}')
        mock_redis.smembers = AsyncMock(return_value=set())

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            await store.set("job1", {"status": "ok"})

        mock_redis.pipeline.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_returns_decoded_data(self):
        store = _make_store_no_redis("redis_test_2")
        mock_redis = _make_mock_redis()
        mock_redis.get = AsyncMock(
            return_value='{"status": "running", "url": "https://example.com"}'
        )

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            result = await store.get("job1")

        assert result is not None
        assert result["status"] == "running"

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self):
        store = _make_store_no_redis("redis_test_3")
        mock_redis = _make_mock_redis()
        mock_redis.get = AsyncMock(return_value=None)

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            result = await store.get("missing")

        assert result is None

    @pytest.mark.asyncio
    async def test_delete_uses_pipeline(self):
        store = _make_store_no_redis("redis_test_4")
        mock_redis = _make_mock_redis()

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            await store.delete("job1")

        mock_redis.pipeline.assert_called()

    @pytest.mark.asyncio
    async def test_values_returns_all_from_index(self):
        store = _make_store_no_redis("redis_test_5")
        mock_redis = _make_mock_redis()
        mock_redis.smembers = AsyncMock(return_value={"j1", "j2"})

        mock_pipe = mock_redis.pipeline.return_value
        mock_pipe.execute = AsyncMock(
            return_value=[
                '{"status": "done", "id": "j1"}',
                '{"status": "failed", "id": "j2"}',
            ]
        )

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            vals = await store.values()

        assert len(vals) == 2

    @pytest.mark.asyncio
    async def test_values_empty_index(self):
        store = _make_store_no_redis("redis_test_6")
        mock_redis = _make_mock_redis()
        mock_redis.smembers = AsyncMock(return_value=set())

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            vals = await store.values()

        assert vals == []

    @pytest.mark.asyncio
    async def test_redis_set_failure_falls_back(self):
        """If Redis pipeline fails, data should still be stored in memory."""
        store = _make_store_no_redis("redis_test_7")
        mock_redis = _make_mock_redis()
        mock_pipe = mock_redis.pipeline.return_value
        mock_pipe.execute = AsyncMock(side_effect=Exception("Redis connection lost"))

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            await store.set("j_fallback", {"data": "important"})

        # Should be in fallback dict after Redis failure
        assert "j_fallback" in store._fallback

    @pytest.mark.asyncio
    async def test_redis_get_failure_falls_back(self):
        """If Redis get fails, fall back to memory store."""
        store = _make_store_no_redis("redis_test_8")
        store._fallback["j_mem"] = {"status": "memory"}
        mock_redis = _make_mock_redis()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis down"))

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            result = await store.get("j_mem")

        assert result is not None
        assert result["status"] == "memory"

    @pytest.mark.asyncio
    async def test_values_stale_index_cleaned(self):
        """Values() should clean up stale index entries."""
        store = _make_store_no_redis("redis_test_9")
        mock_redis = _make_mock_redis()
        mock_redis.smembers = AsyncMock(return_value={"j_stale", "j_good"})

        mock_pipe = mock_redis.pipeline.return_value
        mock_pipe.execute = AsyncMock(
            return_value=[
                None,  # j_stale expired
                '{"status": "ok"}',  # j_good valid
            ]
        )

        # Second call for cleanup
        mock_redis2 = _make_mock_redis()
        mock_redis2.srem = AsyncMock()

        call_count = 0

        async def get_redis_mock():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return mock_redis
            return mock_redis2

        with patch("app.services.job_store._get_redis", get_redis_mock):
            vals = await store.values()

        # Only the valid entry returned
        assert len(vals) == 1

    @pytest.mark.asyncio
    async def test_clear_via_redis(self):
        store = _make_store_no_redis("redis_test_10")
        mock_redis = _make_mock_redis()
        mock_redis.smembers = AsyncMock(return_value={"j1", "j2"})

        mock_pipe = mock_redis.pipeline.return_value
        mock_pipe.execute = AsyncMock(return_value=[True, True, True])

        with patch(
            "app.services.job_store._get_redis", new_callable=AsyncMock, return_value=mock_redis
        ):
            count = await store.clear()

        assert count == 2


# ---------------------------------------------------------------------------
# JobStore — _key and _index_key helpers
# ---------------------------------------------------------------------------


class TestJobStoreHelpers:
    def test_key_format(self):
        store = JobStore("my_ns")
        assert store._key("abc") == "my_ns:abc"

    def test_index_key_format(self):
        store = JobStore("my_ns")
        assert store._index_key() == "my_ns:_index"

    def test_encode_decode_roundtrip(self):
        store = JobStore("enc_test")
        data = {"status": "running", "count": 42, "nested": {"x": [1, 2, 3]}}
        encoded = store._encode(data)
        decoded = store._decode(encoded)
        assert decoded == data

    def test_default_ttl_known_namespace(self):
        store = JobStore("crawl_jobs")
        assert store.ttl == 86_400

    def test_default_ttl_unknown_namespace(self):
        store = JobStore("unknown_ns_xyz")
        assert store.ttl == 86_400  # FALLBACK_TTL

    def test_custom_ttl(self):
        store = JobStore("custom_ns", ttl=3600)
        assert store.ttl == 3600
