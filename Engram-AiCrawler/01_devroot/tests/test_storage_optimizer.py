"""Tests for app/services/storage_optimizer.py — tiered storage and OSINT cache."""

import gzip
import json
from app._compat import UTC
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services.storage_optimizer import (
    ArtifactType,
    OsintCache,
    OsintCacheKeys,
    OsintCacheTTL,
    StorageOptimizer,
    StorageTier,
    _NullRedis,
    get_osint_cache,
    get_storage_optimizer,
)


# ---------------------------------------------------------------------------
# StorageTier / ArtifactType enums
# ---------------------------------------------------------------------------


class TestStorageTier:
    def test_tier_values(self):
        assert StorageTier.HOT == "hot"
        assert StorageTier.WARM == "warm"
        assert StorageTier.COLD == "cold"
        assert StorageTier.ARCHIVE == "archive"


class TestArtifactType:
    def test_artifact_type_values(self):
        assert ArtifactType.SCAN_RESULT == "scan_result"
        assert ArtifactType.ENTITY_PROFILE == "entity_profile"
        assert ArtifactType.IMAGE == "image"
        assert ArtifactType.CASE_EXPORT == "case_export"
        assert ArtifactType.FRAUD_GRAPH == "fraud_graph"


# ---------------------------------------------------------------------------
# StorageOptimizer — setup
# ---------------------------------------------------------------------------


@pytest.fixture
def storage(tmp_path):
    """Create a StorageOptimizer using tmp_path for all tiers."""
    tier_paths = {
        StorageTier.HOT: tmp_path / "hot",
        StorageTier.WARM: tmp_path / "warm",
        StorageTier.COLD: tmp_path / "cold",
        StorageTier.ARCHIVE: tmp_path / "archive",
    }
    return StorageOptimizer(tier_paths=tier_paths)


# ---------------------------------------------------------------------------
# Index helpers
# ---------------------------------------------------------------------------


class TestIndexHelpers:
    def test_load_index_empty_when_no_file(self, storage):
        index = storage._load_index(StorageTier.HOT)
        assert index == {}

    def test_save_and_load_index(self, storage):
        data = {"artifact1": {"artifact_id": "artifact1", "filename": "test.json"}}
        storage._save_index(StorageTier.HOT, data)
        loaded = storage._load_index(StorageTier.HOT)
        assert loaded == data

    def test_register_adds_entry(self, storage):
        storage._register(StorageTier.HOT, "art1", ArtifactType.SCAN_RESULT, "scan_art1.json")
        index = storage._load_index(StorageTier.HOT)
        assert "art1" in index
        assert index["art1"]["artifact_type"] == "scan_result"
        assert index["art1"]["tier"] == "hot"
        assert "created_at" in index["art1"]

    def test_unregister_removes_entry(self, storage):
        storage._register(StorageTier.HOT, "art1", ArtifactType.SCAN_RESULT, "scan_art1.json")
        storage._unregister(StorageTier.HOT, "art1")
        index = storage._load_index(StorageTier.HOT)
        assert "art1" not in index

    def test_unregister_nonexistent_is_noop(self, storage):
        # Should not raise
        storage._unregister(StorageTier.HOT, "nonexistent")


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------


class TestWriteHelpers:
    def test_write_json_creates_file(self, storage):
        path = storage.write_json("id1", ArtifactType.SCAN_RESULT, {"key": "value"})
        assert path.exists()
        data = json.loads(path.read_text())
        assert data == {"key": "value"}

    def test_write_json_registers_in_index(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"key": "value"})
        index = storage._load_index(StorageTier.HOT)
        assert "id1" in index

    def test_write_json_to_specific_tier(self, storage):
        path = storage.write_json(
            "id1", ArtifactType.ENTITY_PROFILE, {"data": 1}, tier=StorageTier.WARM
        )
        assert "warm" in str(path)
        index = storage._load_index(StorageTier.WARM)
        assert "id1" in index

    def test_write_bytes_creates_file(self, storage):
        data = b"binary content here"
        path = storage.write_bytes("img1", ArtifactType.IMAGE, data, ext="jpg")
        assert path.exists()
        assert path.read_bytes() == data

    def test_artifact_filename_format(self, storage):
        filename = storage._artifact_filename("abc123", ArtifactType.SCAN_RESULT, "json")
        assert filename == "scan_result_abc123.json"


# ---------------------------------------------------------------------------
# Domain-specific write helpers
# ---------------------------------------------------------------------------


class TestDomainWriteHelpers:
    def test_store_scan_result(self, storage):
        path = storage.store_scan_result("scan1", {"result": "data"}, entity_name="John")
        assert path.exists()
        index = storage._load_index(StorageTier.HOT)
        assert "scan1" in index
        assert index["scan1"]["entity_name"] == "John"

    def test_store_entity_profile(self, storage):
        path = storage.store_entity_profile("entity1", {"name": "Alice"})
        assert path.exists()
        index = storage._load_index(StorageTier.HOT)
        assert "entity1" in index

    def test_store_image(self, storage):
        img_bytes = b"\xff\xd8\xff" + b"\x00" * 100
        path = storage.store_image("img1", img_bytes, ext="jpg")
        assert path.exists()
        assert path.read_bytes() == img_bytes

    def test_store_case_export_goes_to_warm(self, storage):
        path = storage.store_case_export("case1", b'{"data": 1}', fmt="json")
        assert "warm" in str(path)

    def test_store_fraud_graph(self, storage):
        path = storage.store_fraud_graph("graph1", {"nodes": [], "edges": []})
        assert path.exists()
        index = storage._load_index(StorageTier.HOT)
        assert "graph1" in index


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------


class TestReadHelpers:
    def test_read_json_from_hot_tier(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"value": 42})
        result = storage.read_json("id1")
        assert result == {"value": 42}

    def test_read_json_from_warm_tier(self, storage):
        storage.write_json("id1", ArtifactType.ENTITY_PROFILE, {"value": 99}, tier=StorageTier.WARM)
        result = storage.read_json("id1")
        assert result == {"value": 99}

    def test_read_json_nonexistent_returns_none(self, storage):
        result = storage.read_json("nonexistent")
        assert result is None

    def test_read_json_from_gzipped_archive(self, storage, tmp_path):
        # The source reads: path = tier_path / entry["filename"]
        # then gz_path = path.with_suffix(path.suffix + ".gz")
        # So register the BASE filename (no .gz), and create the .gz file at base + .gz
        artifact_id = "archived1"
        base_filename = f"scan_result_{artifact_id}.json"
        gz_path = storage.paths[StorageTier.ARCHIVE] / (base_filename + ".gz")

        # Write gzipped content at the derived .gz path
        content = json.dumps({"archived": True})
        with gzip.open(gz_path, "wt", encoding="utf-8") as f:
            f.write(content)

        # Register using the BASE filename (not .gz) so code derives gz_path correctly
        storage._register(StorageTier.ARCHIVE, artifact_id, ArtifactType.SCAN_RESULT, base_filename)

        result = storage.read_json(artifact_id)
        assert result == {"archived": True}

    def test_locate_returns_tier_and_entry(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"x": 1})
        result = storage.locate("id1")
        assert result is not None
        tier, entry = result
        assert tier == StorageTier.HOT
        assert entry["artifact_id"] == "id1"

    def test_locate_nonexistent_returns_none(self, storage):
        result = storage.locate("nonexistent")
        assert result is None


# ---------------------------------------------------------------------------
# Tier migration (promote)
# ---------------------------------------------------------------------------


class TestPromote:
    def test_promote_moves_file_to_target_tier(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        result = storage.promote("id1", StorageTier.WARM)
        assert result is True
        # File should exist in WARM
        warm_index = storage._load_index(StorageTier.WARM)
        assert "id1" in warm_index
        # File should not exist in HOT
        hot_index = storage._load_index(StorageTier.HOT)
        assert "id1" not in hot_index

    def test_promote_same_tier_is_noop(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        result = storage.promote("id1", StorageTier.HOT)
        assert result is True

    def test_promote_nonexistent_returns_false(self, storage):
        result = storage.promote("nonexistent", StorageTier.WARM)
        assert result is False

    def test_promote_updates_tier_in_index(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.promote("id1", StorageTier.COLD)
        cold_index = storage._load_index(StorageTier.COLD)
        assert cold_index["id1"]["tier"] == "cold"


# ---------------------------------------------------------------------------
# run_lifecycle_cycle
# ---------------------------------------------------------------------------


class TestLifecycleCycle:
    def test_lifecycle_cycle_returns_counts(self, storage):
        counts = storage.run_lifecycle_cycle()
        assert "hot→warm" in counts
        assert "warm→cold" in counts
        assert "cold→archive" in counts
        assert "archived" in counts

    def test_old_artifact_migrates_from_hot_to_warm(self, storage):
        # Write artifact with old created_at
        artifact_id = "old_artifact"
        storage.write_json(artifact_id, ArtifactType.SCAN_RESULT, {"old": True})

        # Manually set created_at to 2 days ago (HOT max age = 24h)
        hot_index = storage._load_index(StorageTier.HOT)
        old_time = (datetime.now(UTC) - timedelta(days=2)).isoformat()
        hot_index[artifact_id]["created_at"] = old_time
        storage._save_index(StorageTier.HOT, hot_index)

        counts = storage.run_lifecycle_cycle()
        assert counts["hot→warm"] >= 1
        warm_index = storage._load_index(StorageTier.WARM)
        assert artifact_id in warm_index

    def test_archive_compresses_json_files(self, storage):
        # Write artifact directly to archive tier
        artifact_id = "to_compress"
        storage.write_json(
            artifact_id, ArtifactType.SCAN_RESULT, {"compress": True}, tier=StorageTier.ARCHIVE
        )

        counts = storage.run_lifecycle_cycle()
        assert counts["archived"] >= 1

        # Check that .gz file now exists
        archive_index = storage._load_index(StorageTier.ARCHIVE)
        assert artifact_id in archive_index
        filename = archive_index[artifact_id]["filename"]
        assert filename.endswith(".gz")


# ---------------------------------------------------------------------------
# Orphan cleanup
# ---------------------------------------------------------------------------


class TestOrphanCleanup:
    def test_find_orphans_returns_inactive_artifacts(self, storage):
        storage.write_json("active1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("orphan1", ArtifactType.SCAN_RESULT, {"data": 2})
        storage.write_json("orphan2", ArtifactType.ENTITY_PROFILE, {"data": 3})

        orphans = storage.find_orphans(active_ids={"active1"})
        assert "orphan1" in orphans
        assert "orphan2" in orphans
        assert "active1" not in orphans

    def test_find_orphans_empty_when_all_active(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("id2", ArtifactType.SCAN_RESULT, {"data": 2})
        orphans = storage.find_orphans(active_ids={"id1", "id2"})
        assert orphans == []

    def test_delete_artifact_removes_file_and_index(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        result = storage.delete_artifact("id1")
        assert result is True
        assert storage.locate("id1") is None

    def test_delete_artifact_nonexistent_returns_false(self, storage):
        result = storage.delete_artifact("nonexistent")
        assert result is False


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


class TestTierStats:
    def test_tier_stats_returns_all_tiers(self, storage):
        stats = storage.tier_stats()
        assert "hot" in stats
        assert "warm" in stats
        assert "cold" in stats
        assert "archive" in stats
        assert "total" in stats

    def test_tier_stats_counts_artifacts(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("id2", ArtifactType.ENTITY_PROFILE, {"data": 2})
        stats = storage.tier_stats()
        assert stats["hot"]["artifact_count"] == 2

    def test_tier_stats_total_aggregates_tiers(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("id2", ArtifactType.ENTITY_PROFILE, {"data": 2}, tier=StorageTier.WARM)
        stats = storage.tier_stats()
        assert stats["total"]["artifact_count"] == 2

    def test_tier_stats_type_distribution(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("id2", ArtifactType.SCAN_RESULT, {"data": 2})
        storage.write_json("id3", ArtifactType.ENTITY_PROFILE, {"data": 3})
        stats = storage.tier_stats()
        type_dist = stats["hot"]["type_distribution"]
        assert type_dist.get("scan_result", 0) == 2
        assert type_dist.get("entity_profile", 0) == 1


# ---------------------------------------------------------------------------
# list_artifacts
# ---------------------------------------------------------------------------


class TestListArtifacts:
    def test_list_all_artifacts(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("id2", ArtifactType.ENTITY_PROFILE, {"data": 2})
        results = storage.list_artifacts()
        ids = [r["artifact_id"] for r in results]
        assert "id1" in ids
        assert "id2" in ids

    def test_list_artifacts_filter_by_tier(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("id2", ArtifactType.ENTITY_PROFILE, {"data": 2}, tier=StorageTier.WARM)
        results = storage.list_artifacts(tier=StorageTier.HOT)
        ids = [r["artifact_id"] for r in results]
        assert "id1" in ids
        assert "id2" not in ids

    def test_list_artifacts_filter_by_type(self, storage):
        storage.write_json("id1", ArtifactType.SCAN_RESULT, {"data": 1})
        storage.write_json("id2", ArtifactType.ENTITY_PROFILE, {"data": 2})
        results = storage.list_artifacts(artifact_type=ArtifactType.SCAN_RESULT)
        ids = [r["artifact_id"] for r in results]
        assert "id1" in ids
        assert "id2" not in ids

    def test_list_artifacts_limit_and_offset(self, storage):
        for i in range(5):
            storage.write_json(f"id{i}", ArtifactType.SCAN_RESULT, {"data": i})
        results = storage.list_artifacts(limit=2, offset=0)
        assert len(results) == 2
        results_page2 = storage.list_artifacts(limit=2, offset=2)
        assert len(results_page2) == 2


# ---------------------------------------------------------------------------
# OsintCacheKeys
# ---------------------------------------------------------------------------


class TestOsintCacheKeys:
    def test_scan_result_key_format(self):
        key = OsintCacheKeys.scan_result("fingerprint123")
        assert key.startswith("osint:scan:")
        assert len(key) > len("osint:scan:")

    def test_entity_profile_key_format(self):
        key = OsintCacheKeys.entity_profile("entity123")
        assert key == "osint:entity:entity123"

    def test_platform_crawl_key_format(self):
        key = OsintCacheKeys.platform_crawl("twitter", "john_doe")
        assert key.startswith("osint:platform:twitter:")

    def test_fraud_score_key_format(self):
        key = OsintCacheKeys.fraud_score("entity123")
        assert key == "osint:fraud_score:entity123"

    def test_image_hash_key_format(self):
        key = OsintCacheKeys.image_hash("img123")
        assert key == "osint:image_hash:img123"

    def test_alias_set_key_format(self):
        key = OsintCacheKeys.alias_set("johndoe")
        assert key.startswith("osint:aliases:")

    def test_dedup_check_key_format(self):
        key = OsintCacheKeys.dedup_check("fingerprint")
        assert key.startswith("osint:dedup:")

    def test_same_input_same_key(self):
        key1 = OsintCacheKeys.scan_result("same_fingerprint")
        key2 = OsintCacheKeys.scan_result("same_fingerprint")
        assert key1 == key2

    def test_different_inputs_different_keys(self):
        key1 = OsintCacheKeys.scan_result("fp1")
        key2 = OsintCacheKeys.scan_result("fp2")
        assert key1 != key2


# ---------------------------------------------------------------------------
# OsintCacheTTL
# ---------------------------------------------------------------------------


class TestOsintCacheTTL:
    def test_ttl_values_are_positive(self):
        assert OsintCacheTTL.SCAN_RESULT > 0
        assert OsintCacheTTL.ENTITY_PROFILE > 0
        assert OsintCacheTTL.PLATFORM_CRAWL > 0
        assert OsintCacheTTL.FRAUD_SCORE > 0
        assert OsintCacheTTL.IMAGE_HASH > 0
        assert OsintCacheTTL.ALIAS_SET > 0
        assert OsintCacheTTL.DEDUP_CHECK > 0

    def test_scan_result_ttl_is_6_hours(self):
        assert OsintCacheTTL.SCAN_RESULT == 3600 * 6

    def test_image_hash_ttl_is_24_hours(self):
        assert OsintCacheTTL.IMAGE_HASH == 3600 * 24


# ---------------------------------------------------------------------------
# _NullRedis
# ---------------------------------------------------------------------------


class TestNullRedis:
    @pytest.mark.asyncio
    async def test_get_returns_none(self):
        null = _NullRedis()
        result = await null.get("any_key")
        assert result is None

    @pytest.mark.asyncio
    async def test_setex_does_nothing(self):
        null = _NullRedis()
        # Should not raise
        await null.setex("key", 3600, "value")

    @pytest.mark.asyncio
    async def test_delete_does_nothing(self):
        null = _NullRedis()
        await null.delete("key")

    @pytest.mark.asyncio
    async def test_keys_returns_empty_list(self):
        null = _NullRedis()
        result = await null.keys("pattern:*")
        assert result == []

    @pytest.mark.asyncio
    async def test_info_returns_empty_dict(self):
        null = _NullRedis()
        result = await null.info("memory")
        assert result == {}


# ---------------------------------------------------------------------------
# OsintCache
# ---------------------------------------------------------------------------


def _make_mock_redis():
    """Create a mock Redis client for OsintCache tests."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock(return_value=True)
    mock_redis.delete = AsyncMock(return_value=True)
    mock_redis.keys = AsyncMock(return_value=[])
    mock_redis.info = AsyncMock(return_value={"used_memory_human": "1M", "maxmemory_human": "100M"})
    return mock_redis


class TestOsintCache:
    @pytest.mark.asyncio
    async def test_get_returns_none_on_cache_miss(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = None
        cache._client = mock_redis

        result = await cache.get("some:key")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_returns_deserialized_value_on_hit(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = json.dumps({"result": "data"})
        cache._client = mock_redis

        result = await cache.get("some:key")
        assert result == {"result": "data"}

    @pytest.mark.asyncio
    async def test_set_serializes_and_stores(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        result = await cache.set("some:key", {"value": 42}, ttl=3600)
        assert result is True
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == "some:key"
        assert call_args[0][1] == 3600

    @pytest.mark.asyncio
    async def test_delete_calls_redis_delete(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        result = await cache.delete("some:key")
        assert result is True
        mock_redis.delete.assert_called_once_with("some:key")

    @pytest.mark.asyncio
    async def test_get_or_compute_returns_cached_value(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = json.dumps({"cached": True})
        cache._client = mock_redis

        compute_called = False

        def compute():
            nonlocal compute_called
            compute_called = True
            return {"computed": True}

        result = await cache.get_or_compute("key", compute, ttl=3600)
        assert result == {"cached": True}
        assert not compute_called

    @pytest.mark.asyncio
    async def test_get_or_compute_calls_compute_on_miss(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = None
        cache._client = mock_redis

        def compute():
            return {"computed": True}

        result = await cache.get_or_compute("key", compute, ttl=3600)
        assert result == {"computed": True}
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_or_compute_with_async_compute_fn(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = None
        cache._client = mock_redis

        async def async_compute():
            return {"async": True}

        result = await cache.get_or_compute("key", async_compute, ttl=3600)
        assert result == {"async": True}

    @pytest.mark.asyncio
    async def test_get_or_compute_does_not_cache_none_result(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = None
        cache._client = mock_redis

        def compute():
            return None

        result = await cache.get_or_compute("key", compute, ttl=3600)
        assert result is None
        mock_redis.setex.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_scan_result(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = json.dumps({"scan": "result"})
        cache._client = mock_redis

        result = await cache.get_scan_result("fingerprint123")
        assert result == {"scan": "result"}

    @pytest.mark.asyncio
    async def test_set_scan_result(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        result = await cache.set_scan_result("fingerprint123", {"scan": "result"})
        assert result is True
        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == OsintCacheTTL.SCAN_RESULT

    @pytest.mark.asyncio
    async def test_get_entity_profile(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.get.return_value = json.dumps({"entity": "data"})
        cache._client = mock_redis

        result = await cache.get_entity_profile("entity123")
        assert result == {"entity": "data"}

    @pytest.mark.asyncio
    async def test_set_entity_profile(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        result = await cache.set_entity_profile("entity123", {"entity": "data"})
        assert result is True
        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == OsintCacheTTL.ENTITY_PROFILE

    @pytest.mark.asyncio
    async def test_set_platform_crawl(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        result = await cache.set_platform_crawl("twitter", "john_doe", {"crawl": "data"})
        assert result is True
        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == OsintCacheTTL.PLATFORM_CRAWL

    @pytest.mark.asyncio
    async def test_set_fraud_score(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        result = await cache.set_fraud_score("entity123", {"score": 0.9})
        assert result is True
        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == OsintCacheTTL.FRAUD_SCORE

    @pytest.mark.asyncio
    async def test_set_alias_set(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        result = await cache.set_alias_set("johndoe", ["johndoe_twitter", "johndoe_github"])
        assert result is True

    @pytest.mark.asyncio
    async def test_invalidate_entity_deletes_keys(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        cache._client = mock_redis

        await cache.invalidate_entity("entity123")
        # Should delete entity_profile and fraud_score keys
        assert mock_redis.delete.call_count == 2

    @pytest.mark.asyncio
    async def test_cache_stats_returns_dict(self):
        cache = OsintCache()
        mock_redis = _make_mock_redis()
        mock_redis.keys.return_value = ["osint:scan:abc", "osint:entity:def"]
        cache._client = mock_redis

        result = await cache.cache_stats()
        assert "total_osint_keys" in result
        assert result["total_osint_keys"] == 2

    @pytest.mark.asyncio
    async def test_get_falls_back_to_null_redis_on_error(self):
        cache = OsintCache()
        # _get_client does a local import of get_cache_client; use patch on the source module
        with patch(
            "app.services.cache.get_cache_client", side_effect=Exception("Redis down"), create=True
        ):
            # Reset client to force lazy init
            cache._client = None
            result = await cache.get("some:key")
        # Fails gracefully — returns None (via _NullRedis or exception handler)
        assert result is None

    @pytest.mark.asyncio
    async def test_set_returns_false_on_redis_error(self):
        cache = OsintCache()
        mock_redis = AsyncMock()
        mock_redis.setex.side_effect = Exception("connection error")
        cache._client = mock_redis

        result = await cache.set("key", {"data": 1}, ttl=3600)
        assert result is False


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------


class TestSingletons:
    def test_get_storage_optimizer_returns_instance(self):
        import app.services.storage_optimizer as mod

        mod._optimizer_instance = None
        # Patch _TIER_PATHS to use /tmp to avoid creating real dirs
        with patch(
            "app.services.storage_optimizer._TIER_PATHS",
            {
                StorageTier.HOT: Path("/tmp/test_hot"),
                StorageTier.WARM: Path("/tmp/test_warm"),
                StorageTier.COLD: Path("/tmp/test_cold"),
                StorageTier.ARCHIVE: Path("/tmp/test_archive"),
            },
        ):
            optimizer = get_storage_optimizer()
        assert isinstance(optimizer, StorageOptimizer)

    def test_get_osint_cache_returns_instance(self):
        import app.services.storage_optimizer as mod

        mod._osint_cache_instance = None
        cache = get_osint_cache()
        assert isinstance(cache, OsintCache)

    def test_get_osint_cache_returns_same_instance(self):
        import app.services.storage_optimizer as mod

        mod._osint_cache_instance = None
        c1 = get_osint_cache()
        c2 = get_osint_cache()
        assert c1 is c2
