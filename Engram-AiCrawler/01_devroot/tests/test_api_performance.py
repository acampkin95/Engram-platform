"""Tests for app/api/performance.py — targeting 70%+ coverage.

All async service methods are patched at their import source.
TestClient handles async transparently — no @pytest.mark.asyncio needed.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock, patch

from app.api.performance import router
from app.middleware import rate_limit as _rl_module

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


# ---------------------------------------------------------------------------
# Helpers — build mock objects
# ---------------------------------------------------------------------------


def make_storage_optimizer(
    tier_stats_return=None,
    list_artifacts_return=None,
    lifecycle_return=None,
    promote_return=True,
    delete_return=True,
    tier_stats_raises=None,
    list_artifacts_raises=None,
    lifecycle_raises=None,
    promote_raises=None,
    delete_raises=None,
):
    opt = MagicMock()
    if tier_stats_raises:
        opt.tier_stats.side_effect = tier_stats_raises
    else:
        opt.tier_stats.return_value = tier_stats_return or {
            "hot": {"artifact_count": 5, "total_mb": 10},
            "total": {"artifact_count": 5, "total_mb": 10},
        }
    if list_artifacts_raises:
        opt.list_artifacts.side_effect = list_artifacts_raises
    else:
        opt.list_artifacts.return_value = list_artifacts_return or []
    if lifecycle_raises:
        opt.run_lifecycle_cycle.side_effect = lifecycle_raises
    else:
        opt.run_lifecycle_cycle.return_value = lifecycle_return or {"hot_to_warm": 2}
    if promote_raises:
        opt.promote.side_effect = promote_raises
    else:
        opt.promote.return_value = promote_return
    if delete_raises:
        opt.delete_artifact.side_effect = delete_raises
    else:
        opt.delete_artifact.return_value = delete_return
    return opt


def make_osint_cache(
    cache_stats_return=None,
    invalidate_raises=None,
    cache_stats_raises=None,
):
    cache = MagicMock()
    if cache_stats_raises:
        cache.cache_stats = AsyncMock(side_effect=cache_stats_raises)
    else:
        cache.cache_stats = AsyncMock(return_value=cache_stats_return or {"total_osint_keys": 42})
    if invalidate_raises:
        cache.invalidate_entity = AsyncMock(side_effect=invalidate_raises)
    else:
        cache.invalidate_entity = AsyncMock(return_value=None)
    return cache


def make_job_queue(
    list_jobs_return=None,
    queue_stats_return=None,
    get_job_return=None,
    cancel_return=True,
    list_jobs_raises=None,
    get_job_raises=None,
    cancel_raises=None,
):
    queue = MagicMock()
    if list_jobs_raises:
        queue.list_jobs = AsyncMock(side_effect=list_jobs_raises)
    else:
        jobs = list_jobs_return or []
        queue.list_jobs = AsyncMock(return_value=jobs)
    queue.queue_stats = AsyncMock(
        return_value=queue_stats_return
        or {"queue_depth": 0, "workers_running": True, "total_jobs": 10}
    )
    if get_job_raises:
        queue.get_job = AsyncMock(side_effect=get_job_raises)
    else:
        queue.get_job = AsyncMock(return_value=get_job_return)
    if cancel_raises:
        queue.cancel_job = AsyncMock(side_effect=cancel_raises)
    else:
        queue.cancel_job = AsyncMock(return_value=cancel_return)
    return queue


def make_chroma_optimizer(
    stats_return=None,
    health_return=None,
    prune_return=None,
    stats_raises=None,
    health_raises=None,
    prune_raises=None,
):
    opt = MagicMock()
    if stats_raises:
        opt.collection_stats.side_effect = stats_raises
    else:
        opt.collection_stats.return_value = stats_return or {"total_documents": 100}
    if health_raises:
        opt.health_check.side_effect = health_raises
    else:
        opt.health_check.return_value = health_return or {
            "status": "ok",
            "collection_count": 3,
            "total_documents": 100,
        }
    if prune_raises:
        opt.prune_collection.side_effect = prune_raises
    else:
        opt.prune_collection.return_value = prune_return or {"pruned": 50}
    return opt


def make_governor(stats_return=None, stats_raises=None):
    gov = MagicMock()
    if stats_raises:
        gov.stats.side_effect = stats_raises
    else:
        gov.stats.return_value = stats_return or {"active_osint_scans": 1, "active_crawls": 2}
    return gov


# ---------------------------------------------------------------------------
# /storage/stats
# ---------------------------------------------------------------------------


class TestStorageStats:
    def test_happy_path(self):
        opt = make_storage_optimizer()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt):
            response = client.get("/api/performance/storage/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data

    def test_500_on_exception(self):
        opt = make_storage_optimizer(tier_stats_raises=RuntimeError("db down"))
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt):
            response = client.get("/api/performance/storage/stats")
        assert response.status_code == 500
        assert "db down" in response.json()["detail"]


# ---------------------------------------------------------------------------
# /storage/artifacts
# ---------------------------------------------------------------------------


class TestListArtifacts:
    def _mock_enums(self):
        """Return (StorageTier, ArtifactType) mock enum classes."""
        import enum

        class StorageTier(str, enum.Enum):
            hot = "hot"
            warm = "warm"
            cold = "cold"
            archive = "archive"

        class ArtifactType(str, enum.Enum):
            scan_result = "scan_result"
            entity_profile = "entity_profile"
            image = "image"

        return StorageTier, ArtifactType

    def test_no_filters(self):
        opt = make_storage_optimizer(list_artifacts_return=[{"id": "a1"}])
        StorageTier, ArtifactType = self._mock_enums()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", StorageTier
        ), patch("app.services.storage_optimizer.ArtifactType", ArtifactType):
            response = client.get("/api/performance/storage/artifacts")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        assert data["offset"] == 0

    def test_with_valid_filters(self):
        opt = make_storage_optimizer(list_artifacts_return=[])
        StorageTier, ArtifactType = self._mock_enums()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", StorageTier
        ), patch("app.services.storage_optimizer.ArtifactType", ArtifactType):
            response = client.get(
                "/api/performance/storage/artifacts?tier=hot&artifact_type=scan_result&limit=10&offset=5"
            )
        assert response.status_code == 200
        assert response.json()["offset"] == 5

    def test_400_invalid_tier(self):
        opt = make_storage_optimizer()
        StorageTier, ArtifactType = self._mock_enums()
        # Patch StorageTier to raise ValueError on bad input
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", side_effect=ValueError("invalid tier")
        ), patch("app.services.storage_optimizer.ArtifactType", ArtifactType):
            response = client.get("/api/performance/storage/artifacts?tier=invalid_tier")
        assert response.status_code == 400
        assert "Invalid tier or type" in response.json()["detail"]

    def test_500_on_exception(self):
        opt = make_storage_optimizer(list_artifacts_raises=RuntimeError("crash"))
        StorageTier, ArtifactType = self._mock_enums()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", StorageTier
        ), patch("app.services.storage_optimizer.ArtifactType", ArtifactType):
            response = client.get("/api/performance/storage/artifacts")
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /storage/lifecycle
# ---------------------------------------------------------------------------


class TestLifecycleCycle:
    def test_happy_path(self):
        opt = make_storage_optimizer(lifecycle_return={"hot_to_warm": 3, "warm_to_cold": 1})
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt):
            response = client.post("/api/performance/storage/lifecycle")
        assert response.status_code == 200
        data = response.json()
        assert "transitions" in data
        assert data["transitions"]["hot_to_warm"] == 3

    def test_500_on_exception(self):
        opt = make_storage_optimizer(lifecycle_raises=RuntimeError("lifecycle failed"))
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt):
            response = client.post("/api/performance/storage/lifecycle")
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /storage/promote
# ---------------------------------------------------------------------------


class TestPromoteArtifact:
    def _mock_storage_tier(self):
        import enum

        class StorageTier(str, enum.Enum):
            hot = "hot"
            warm = "warm"
            cold = "cold"
            archive = "archive"

        return StorageTier

    def test_happy_path(self):
        opt = make_storage_optimizer(promote_return=True)
        StorageTier = self._mock_storage_tier()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", StorageTier
        ):
            response = client.post(
                "/api/performance/storage/promote",
                json={"artifact_id": "art1", "target_tier": "warm"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["artifact_id"] == "art1"

    def test_404_when_not_found(self):
        opt = make_storage_optimizer(promote_return=False)
        StorageTier = self._mock_storage_tier()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", StorageTier
        ):
            response = client.post(
                "/api/performance/storage/promote",
                json={"artifact_id": "missing", "target_tier": "cold"},
            )
        assert response.status_code == 404
        assert "missing" in response.json()["detail"]

    def test_400_invalid_tier(self):
        opt = make_storage_optimizer()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", side_effect=ValueError("bad tier")
        ):
            response = client.post(
                "/api/performance/storage/promote",
                json={"artifact_id": "art1", "target_tier": "invalid"},
            )
        assert response.status_code == 400

    def test_500_on_exception(self):
        opt = make_storage_optimizer(promote_raises=RuntimeError("promote error"))
        StorageTier = self._mock_storage_tier()
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt), patch(
            "app.services.storage_optimizer.StorageTier", StorageTier
        ):
            response = client.post(
                "/api/performance/storage/promote",
                json={"artifact_id": "art1", "target_tier": "warm"},
            )
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /storage/artifact/{artifact_id}
# ---------------------------------------------------------------------------


class TestDeleteArtifact:
    def test_happy_path(self):
        opt = make_storage_optimizer(delete_return=True)
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt):
            response = client.delete("/api/performance/storage/artifact/art123")
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["artifact_id"] == "art123"

    def test_404_when_not_found(self):
        opt = make_storage_optimizer(delete_return=False)
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt):
            response = client.delete("/api/performance/storage/artifact/ghost")
        assert response.status_code == 404
        assert "ghost" in response.json()["detail"]

    def test_500_on_exception(self):
        opt = make_storage_optimizer(delete_raises=RuntimeError("delete error"))
        with patch("app.services.storage_optimizer.get_storage_optimizer", return_value=opt):
            response = client.delete("/api/performance/storage/artifact/art123")
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /cache/stats
# ---------------------------------------------------------------------------


class TestCacheStats:
    def test_happy_path(self):
        cache = make_osint_cache(cache_stats_return={"total_osint_keys": 100})
        with patch("app.services.storage_optimizer.get_osint_cache", return_value=cache):
            response = client.get("/api/performance/cache/stats")
        assert response.status_code == 200
        assert response.json()["total_osint_keys"] == 100

    def test_returns_error_dict_on_exception(self):
        """Cache stats never raises — returns error dict instead."""
        cache = make_osint_cache(cache_stats_raises=RuntimeError("redis down"))
        with patch("app.services.storage_optimizer.get_osint_cache", return_value=cache):
            response = client.get("/api/performance/cache/stats")
        assert response.status_code == 200
        data = response.json()
        assert "error" in data
        assert data["status"] == "unavailable"


# ---------------------------------------------------------------------------
# /cache/invalidate
# ---------------------------------------------------------------------------


class TestInvalidateCache:
    def test_happy_path(self):
        cache = make_osint_cache()
        with patch("app.services.storage_optimizer.get_osint_cache", return_value=cache):
            response = client.post("/api/performance/cache/invalidate", json={"entity_id": "ent42"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["entity_id"] == "ent42"

    def test_500_on_exception(self):
        cache = make_osint_cache(invalidate_raises=RuntimeError("invalidate failed"))
        with patch("app.services.storage_optimizer.get_osint_cache", return_value=cache):
            response = client.post("/api/performance/cache/invalidate", json={"entity_id": "ent42"})
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /jobs
# ---------------------------------------------------------------------------


class TestListJobs:
    def _mock_enums(self):
        import enum

        class JobStatus(str, enum.Enum):
            pending = "pending"
            running = "running"
            completed = "completed"
            failed = "failed"
            cancelled = "cancelled"

        class JobType(str, enum.Enum):
            entity_scan = "entity_scan"
            platform_crawl = "platform_crawl"
            fraud_analysis = "fraud_analysis"
            deep_crawl = "deep_crawl"
            image_intel = "image_intel"
            case_export = "case_export"
            custom = "custom"

        return JobStatus, JobType

    def test_no_filters(self):
        job = MagicMock()
        job.to_dict.return_value = {"job_id": "j1", "status": "pending"}
        queue = make_job_queue(list_jobs_return=[job])
        JobStatus, JobType = self._mock_enums()
        with patch("app.services.job_queue.get_job_queue", return_value=queue), patch(
            "app.services.job_queue.JobStatus", JobStatus
        ), patch("app.services.job_queue.JobType", JobType):
            response = client.get("/api/performance/jobs")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        assert data["jobs"][0]["job_id"] == "j1"

    def test_with_filters(self):
        queue = make_job_queue(list_jobs_return=[])
        JobStatus, JobType = self._mock_enums()
        with patch("app.services.job_queue.get_job_queue", return_value=queue), patch(
            "app.services.job_queue.JobStatus", JobStatus
        ), patch("app.services.job_queue.JobType", JobType):
            response = client.get(
                "/api/performance/jobs?status=pending&job_type=entity_scan&limit=10&offset=0"
            )
        assert response.status_code == 200

    def test_400_invalid_status(self):
        queue = make_job_queue()
        JobStatus, JobType = self._mock_enums()
        with patch("app.services.job_queue.get_job_queue", return_value=queue), patch(
            "app.services.job_queue.JobStatus", side_effect=ValueError("bad status")
        ), patch("app.services.job_queue.JobType", JobType):
            response = client.get("/api/performance/jobs?status=bogus")
        assert response.status_code == 400

    def test_500_on_exception(self):
        queue = make_job_queue(list_jobs_raises=RuntimeError("queue error"))
        JobStatus, JobType = self._mock_enums()
        with patch("app.services.job_queue.get_job_queue", return_value=queue), patch(
            "app.services.job_queue.JobStatus", JobStatus
        ), patch("app.services.job_queue.JobType", JobType):
            response = client.get("/api/performance/jobs")
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /jobs/stats
# ---------------------------------------------------------------------------


class TestJobStats:
    def test_happy_path(self):
        queue = make_job_queue(
            queue_stats_return={"queue_depth": 5, "workers_running": True, "total_jobs": 20}
        )
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.get("/api/performance/jobs/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["queue_depth"] == 5

    def test_returns_error_dict_on_exception(self):
        """queue_stats never raises — returns error dict."""
        queue = make_job_queue()
        queue.queue_stats = AsyncMock(side_effect=RuntimeError("stats failed"))
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.get("/api/performance/jobs/stats")
        assert response.status_code == 200
        assert "error" in response.json()


# ---------------------------------------------------------------------------
# /jobs/{job_id}
# ---------------------------------------------------------------------------


class TestGetJob:
    def test_happy_path(self):
        job = MagicMock()
        job.to_dict.return_value = {"job_id": "j99", "status": "running"}
        queue = make_job_queue(get_job_return=job)
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.get("/api/performance/jobs/j99")
        assert response.status_code == 200
        assert response.json()["job_id"] == "j99"

    def test_404_when_not_found(self):
        queue = make_job_queue(get_job_return=None)
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.get("/api/performance/jobs/missing_job")
        assert response.status_code == 404
        assert "missing_job" in response.json()["detail"]

    def test_500_on_exception(self):
        queue = make_job_queue(get_job_raises=RuntimeError("get_job failed"))
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.get("/api/performance/jobs/j99")
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# POST /jobs
# ---------------------------------------------------------------------------


class TestEnqueueJob:
    def _mock_job_type(self):
        import enum

        class JobType(str, enum.Enum):
            entity_scan = "entity_scan"
            platform_crawl = "platform_crawl"
            fraud_analysis = "fraud_analysis"
            deep_crawl = "deep_crawl"
            image_intel = "image_intel"
            case_export = "case_export"
            custom = "custom"

        return JobType

    def test_happy_path(self):
        JobType = self._mock_job_type()
        queue = MagicMock()
        queue.enqueue = AsyncMock(return_value="new-job-id")
        with patch(
            "app.services.job_queue.ensure_queue_started", new=AsyncMock(return_value=queue)
        ), patch("app.services.job_queue.JobType", JobType):
            response = client.post(
                "/api/performance/jobs",
                json={
                    "job_type": "entity_scan",
                    "payload": {"target": "user123"},
                    "priority": 5,
                    "created_by": "test",
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "new-job-id"
        assert data["status"] == "pending"

    def test_400_invalid_job_type(self):
        JobType = self._mock_job_type()
        # Make JobType raise ValueError for unknown type
        with patch(
            "app.services.job_queue.ensure_queue_started", new=AsyncMock(return_value=MagicMock())
        ), patch("app.services.job_queue.JobType", side_effect=ValueError("unknown job type")):
            response = client.post(
                "/api/performance/jobs", json={"job_type": "bogus_type", "payload": {}}
            )
        assert response.status_code == 400
        assert "Unknown job type" in response.json()["detail"]

    def test_500_on_exception(self):
        JobType = self._mock_job_type()
        queue = MagicMock()
        queue.enqueue = AsyncMock(side_effect=RuntimeError("enqueue failed"))
        with patch(
            "app.services.job_queue.ensure_queue_started", new=AsyncMock(return_value=queue)
        ), patch("app.services.job_queue.JobType", JobType):
            response = client.post(
                "/api/performance/jobs", json={"job_type": "entity_scan", "payload": {}}
            )
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /jobs/{job_id}/cancel
# ---------------------------------------------------------------------------


class TestCancelJob:
    def test_happy_path(self):
        queue = make_job_queue(cancel_return=True)
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.post("/api/performance/jobs/j10/cancel")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["job_id"] == "j10"

    def test_409_when_cannot_cancel(self):
        queue = make_job_queue(cancel_return=False)
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.post("/api/performance/jobs/j10/cancel")
        assert response.status_code == 409
        assert "j10" in response.json()["detail"]

    def test_500_on_exception(self):
        queue = make_job_queue(cancel_raises=RuntimeError("cancel error"))
        with patch("app.services.job_queue.get_job_queue", return_value=queue):
            response = client.post("/api/performance/jobs/j10/cancel")
        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /chroma/stats
# ---------------------------------------------------------------------------


class TestChromaStats:
    def test_happy_path(self):
        opt = make_chroma_optimizer(stats_return={"total_documents": 200})
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.get("/api/performance/chroma/stats")
        assert response.status_code == 200
        assert response.json()["total_documents"] == 200

    def test_with_collection_param(self):
        opt = make_chroma_optimizer(stats_return={"collection": "test_col", "total_documents": 50})
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.get("/api/performance/chroma/stats?collection=test_col")
        assert response.status_code == 200

    def test_returns_error_dict_on_exception(self):
        opt = make_chroma_optimizer(stats_raises=RuntimeError("chroma down"))
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.get("/api/performance/chroma/stats")
        assert response.status_code == 200
        assert "error" in response.json()


# ---------------------------------------------------------------------------
# /chroma/health
# ---------------------------------------------------------------------------


class TestChromaHealth:
    def test_happy_path(self):
        opt = make_chroma_optimizer(
            health_return={"status": "ok", "collection_count": 3, "total_documents": 500}
        )
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.get("/api/performance/chroma/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_returns_error_dict_on_exception(self):
        opt = make_chroma_optimizer(health_raises=RuntimeError("health check failed"))
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.get("/api/performance/chroma/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert "error" in data


# ---------------------------------------------------------------------------
# /chroma/prune
# ---------------------------------------------------------------------------


class TestPruneCollection:
    def test_happy_path(self):
        opt = make_chroma_optimizer(prune_return={"pruned": 100, "remaining": 9900})
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.post(
                "/api/performance/chroma/prune",
                json={"collection_name": "test_collection", "max_documents": 10000},
            )
        assert response.status_code == 200
        assert response.json()["pruned"] == 100

    def test_500_on_exception(self):
        opt = make_chroma_optimizer(prune_raises=RuntimeError("prune failed"))
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.post(
                "/api/performance/chroma/prune",
                json={"collection_name": "test_collection", "max_documents": 10000},
            )
        assert response.status_code == 500

    def test_default_max_documents(self):
        opt = make_chroma_optimizer(prune_return={"pruned": 0})
        with patch("app.services.chromadb_optimizer.get_collection_optimizer", return_value=opt):
            response = client.post(
                "/api/performance/chroma/prune", json={"collection_name": "col1"}
            )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# /governor/stats
# ---------------------------------------------------------------------------


class TestGovernorStats:
    def test_happy_path(self):
        gov = make_governor(stats_return={"active_osint_scans": 3, "active_crawls": 5})
        with patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/governor/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["active_osint_scans"] == 3

    def test_returns_error_dict_on_exception(self):
        gov = make_governor(stats_raises=RuntimeError("governor down"))
        with patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/governor/stats")
        assert response.status_code == 200
        assert "error" in response.json()


# ---------------------------------------------------------------------------
# /health (aggregated)
# ---------------------------------------------------------------------------


class TestAggregatedHealth:
    def _make_all_mocks(self):
        storage_opt = make_storage_optimizer()
        cache = make_osint_cache()
        queue = make_job_queue()
        chroma_opt = make_chroma_optimizer()
        gov = make_governor()
        return storage_opt, cache, queue, chroma_opt, gov

    def test_all_healthy(self):
        storage_opt, cache, queue, chroma_opt, gov = self._make_all_mocks()
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert "overall" in data
        assert data["overall"] in ("healthy", "partial", "degraded")
        assert "storage" in data
        assert "cache" in data
        assert "job_queue" in data
        assert "chromadb" in data
        assert "concurrency" in data

    def test_overall_healthy_when_all_ok(self):
        storage_opt = make_storage_optimizer()
        cache = make_osint_cache(cache_stats_return={"total_osint_keys": 10})
        queue = make_job_queue(
            queue_stats_return={"queue_depth": 0, "workers_running": True, "total_jobs": 0}
        )
        chroma_opt = make_chroma_optimizer(
            health_return={"status": "ok", "collection_count": 1, "total_documents": 50}
        )
        gov = make_governor()
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["overall"] == "healthy"

    def test_overall_degraded_when_service_errors(self):
        """When storage raises, overall should be 'degraded'."""
        storage_opt = make_storage_optimizer(tier_stats_raises=RuntimeError("storage error"))
        cache = make_osint_cache(cache_stats_return={"total_osint_keys": 10})
        queue = make_job_queue(
            queue_stats_return={"queue_depth": 0, "workers_running": True, "total_jobs": 0}
        )
        chroma_opt = make_chroma_optimizer(
            health_return={"status": "ok", "collection_count": 1, "total_documents": 50}
        )
        gov = make_governor()
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["overall"] == "degraded"
        assert data["storage"]["status"] == "error"

    def test_cache_degraded_in_health(self):
        """Cache error dict (from error key) → 'degraded' cache status."""
        storage_opt = make_storage_optimizer()
        # cache_stats returns error key → cache status "degraded"
        cache = make_osint_cache(cache_stats_return={"error": "redis down", "total_osint_keys": 0})
        queue = make_job_queue(
            queue_stats_return={"queue_depth": 0, "workers_running": True, "total_jobs": 0}
        )
        chroma_opt = make_chroma_optimizer(
            health_return={"status": "ok", "collection_count": 1, "total_documents": 50}
        )
        gov = make_governor()
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["cache"]["status"] == "degraded"

    def test_health_cache_exception(self):
        """Cache section raises → health[cache] status=error."""
        storage_opt = make_storage_optimizer()
        # Make get_osint_cache itself raise so the except block is hit
        cache = make_osint_cache(cache_stats_raises=RuntimeError("cache exploded"))
        queue = make_job_queue(
            queue_stats_return={"queue_depth": 0, "workers_running": True, "total_jobs": 0}
        )
        chroma_opt = make_chroma_optimizer(
            health_return={"status": "ok", "collection_count": 1, "total_documents": 50}
        )
        gov = make_governor()
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["cache"]["status"] == "error"

    def test_health_job_queue_exception(self):
        """Job queue section raises → health[job_queue] status=error."""
        storage_opt = make_storage_optimizer()
        cache = make_osint_cache(cache_stats_return={"total_osint_keys": 5})
        queue = make_job_queue()
        queue.queue_stats = AsyncMock(side_effect=RuntimeError("queue exploded"))
        chroma_opt = make_chroma_optimizer(
            health_return={"status": "ok", "collection_count": 1, "total_documents": 50}
        )
        gov = make_governor()
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["job_queue"]["status"] == "error"

    def test_health_chroma_exception(self):
        """Chroma section raises → health[chromadb] status=error."""
        storage_opt = make_storage_optimizer()
        cache = make_osint_cache(cache_stats_return={"total_osint_keys": 5})
        queue = make_job_queue(
            queue_stats_return={"queue_depth": 0, "workers_running": True, "total_jobs": 0}
        )
        chroma_opt = make_chroma_optimizer(health_raises=RuntimeError("chroma exploded"))
        gov = make_governor()
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["chromadb"]["status"] == "error"

    def test_health_concurrency_exception(self):
        """Concurrency section raises → health[concurrency] status=error."""
        storage_opt = make_storage_optimizer()
        cache = make_osint_cache(cache_stats_return={"total_osint_keys": 5})
        queue = make_job_queue(
            queue_stats_return={"queue_depth": 0, "workers_running": True, "total_jobs": 0}
        )
        chroma_opt = make_chroma_optimizer(
            health_return={"status": "ok", "collection_count": 1, "total_documents": 50}
        )
        gov = make_governor(stats_raises=RuntimeError("governor exploded"))
        with patch(
            "app.services.storage_optimizer.get_storage_optimizer", return_value=storage_opt
        ), patch("app.services.storage_optimizer.get_osint_cache", return_value=cache), patch(
            "app.services.job_queue.get_job_queue", return_value=queue
        ), patch(
            "app.services.chromadb_optimizer.get_collection_optimizer", return_value=chroma_opt
        ), patch("app.services.concurrency_governor.get_concurrency_governor", return_value=gov):
            response = client.get("/api/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["concurrency"]["status"] == "error"
