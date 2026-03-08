"""Tests for app/api/stats.py — covering /dashboard, /system, /scheduler endpoints.

Target: 70%+ coverage on app/api/stats.py
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.api.stats import router as stats_router
from app.middleware import rate_limit as _rl_module
from datetime import UTC

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI()
app.include_router(stats_router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


def _make_mock_job_store(values: list | None = None):
    store = MagicMock()
    store.values = AsyncMock(return_value=values or [])
    return store


def _make_crawl_job(status):
    return {"status": status, "job_id": "j1"}


# ---------------------------------------------------------------------------
# GET /api/stats/dashboard
# ---------------------------------------------------------------------------


class TestDashboardStats:
    def test_returns_200_empty(self):
        mock_store = _make_mock_job_store([])
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = []
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = []

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        assert resp.status_code == 200

    def test_response_has_expected_keys(self):
        mock_store = _make_mock_job_store([])
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = []
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = []

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        data = resp.json()
        assert "crawls" in data
        assert "data_sets" in data
        assert "storage" in data
        assert "investigations" in data

    def test_crawl_stats_counts(self):
        from app.models.crawl import CrawlStatus

        jobs = [
            _make_crawl_job(CrawlStatus.COMPLETED),
            _make_crawl_job(CrawlStatus.COMPLETED),
            _make_crawl_job(CrawlStatus.FAILED),
            _make_crawl_job(CrawlStatus.PENDING),
            _make_crawl_job(CrawlStatus.RUNNING),
            _make_crawl_job(CrawlStatus.CANCELLED),
        ]
        mock_store = _make_mock_job_store(jobs)
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = []
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = []

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        data = resp.json()
        crawls = data["crawls"]
        assert crawls["total"] == 6
        assert crawls["completed"] == 2
        assert crawls["failed"] == 1
        assert crawls["active"] == 2  # PENDING + RUNNING
        assert crawls["cancelled"] == 1

    def test_chromadb_unavailable_falls_back_to_zero(self):
        mock_store = _make_mock_job_store([])
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = []

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", side_effect=Exception("ChromaDB down")),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        assert resp.status_code == 200
        data = resp.json()
        assert data["storage"]["collections"] == 0
        assert data["storage"]["total_documents"] == 0

    def test_storage_stats_with_multiple_collections(self):
        mock_store = _make_mock_job_store([])
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = ["col1", "col2", "col3"]
        mock_chroma.count.return_value = 7
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = []

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        data = resp.json()
        assert data["storage"]["collections"] == 3
        assert data["storage"]["total_documents"] == 21  # 7 * 3

    def test_investigation_stats_active_and_total(self):
        from app.models.investigation import InvestigationStatus

        mock_store = _make_mock_job_store([])
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = []

        inv_active = MagicMock()
        inv_active.status = InvestigationStatus.ACTIVE
        inv_active2 = MagicMock()
        inv_active2.status = InvestigationStatus.ACTIVE
        inv_closed = MagicMock()
        inv_closed.status = InvestigationStatus.CLOSED

        mock_svc = MagicMock()
        mock_svc.list_all.return_value = [inv_active, inv_active2, inv_closed]

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        data = resp.json()
        assert data["investigations"]["total"] == 3
        assert data["investigations"]["active"] == 2

    def test_data_sets_aggregation(self):
        """data_sets is a module-level dict that gets populated by other routes; we patch it."""
        mock_store = _make_mock_job_store([])
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = []
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = []

        fake_data_sets = {
            "ds1": {"size_bytes": 1000, "file_count": 5},
            "ds2": {"size_bytes": 2000, "file_count": 10},
        }

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
            patch("app.api.stats.data_sets", fake_data_sets),
        ):
            resp = client.get("/api/stats/dashboard")

        data = resp.json()
        assert data["data_sets"]["total"] == 2
        assert data["data_sets"]["total_size_bytes"] == 3000
        assert data["data_sets"]["total_files"] == 15


# ---------------------------------------------------------------------------
# GET /api/stats/system
# ---------------------------------------------------------------------------


class TestSystemStats:
    def test_returns_200(self):
        with (
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status", new_callable=AsyncMock, return_value="connected"
            ),
            patch("app.api.stats._scheduler_status", return_value="running"),
        ):
            resp = client.get("/api/stats/system")

        assert resp.status_code == 200

    def test_has_expected_keys(self):
        with (
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status",
                new_callable=AsyncMock,
                return_value="disconnected",
            ),
            patch("app.api.stats._scheduler_status", return_value="stopped"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert "redis" in data
        assert "lm_studio" in data
        assert "scheduler" in data
        assert "memory_percent" in data
        assert "disk_percent" in data

    def test_redis_disconnected_shown(self):
        with (
            patch(
                "app.api.stats._redis_status", new_callable=AsyncMock, return_value="disconnected"
            ),
            patch(
                "app.api.stats._lm_studio_status", new_callable=AsyncMock, return_value="connected"
            ),
            patch("app.api.stats._scheduler_status", return_value="stopped"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert data["redis"] == "disconnected"

    def test_lm_studio_status_reflected(self):
        with (
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status",
                new_callable=AsyncMock,
                return_value="disconnected",
            ),
            patch("app.api.stats._scheduler_status", return_value="stopped"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert data["lm_studio"] == "disconnected"

    def test_scheduler_status_reflected(self):
        with (
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status", new_callable=AsyncMock, return_value="connected"
            ),
            patch("app.api.stats._scheduler_status", return_value="running"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert data["scheduler"] == "running"

    def test_memory_and_disk_are_floats(self):
        with (
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status", new_callable=AsyncMock, return_value="connected"
            ),
            patch("app.api.stats._scheduler_status", return_value="running"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert isinstance(data["memory_percent"], float | int)
        assert isinstance(data["disk_percent"], float | int)

    def test_psutil_none_returns_zero_percents(self):
        """When psutil is None (not installed), memory/disk should be 0.0."""
        with (
            patch("app.api.stats._psutil", None),
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status", new_callable=AsyncMock, return_value="connected"
            ),
            patch("app.api.stats._scheduler_status", return_value="stopped"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert data["memory_percent"] == 0.0
        assert data["disk_percent"] == 0.0

    def test_psutil_exception_returns_zero_percents(self):
        """When psutil raises, memory/disk should be 0.0."""
        mock_psutil = MagicMock()
        mock_psutil.virtual_memory.side_effect = OSError("no memory info")

        with (
            patch("app.api.stats._psutil", mock_psutil),
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status", new_callable=AsyncMock, return_value="connected"
            ),
            patch("app.api.stats._scheduler_status", return_value="stopped"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert data["memory_percent"] == 0.0
        assert data["disk_percent"] == 0.0


# ---------------------------------------------------------------------------
# GET /api/stats/scheduler
# ---------------------------------------------------------------------------


class TestSchedulerStats:
    def test_returns_200_when_running(self):
        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        mock_scheduler.get_jobs.return_value = []

        import app.services.scheduler_service as sched_svc

        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = lambda: mock_scheduler
        try:
            resp = client.get("/api/stats/scheduler")
        finally:
            sched_svc.get_scheduler = original

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert data["jobs_count"] == 0

    def test_returns_stopped_when_scheduler_unavailable(self):
        import app.services.scheduler_service as sched_svc

        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = MagicMock(side_effect=Exception("no scheduler"))
        try:
            resp = client.get("/api/stats/scheduler")
        finally:
            sched_svc.get_scheduler = original

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "stopped"
        assert data["jobs_count"] == 0
        assert data["next_run"] is None

    def test_scheduler_with_jobs_returns_next_run(self):
        from datetime import datetime

        mock_job = MagicMock()
        mock_job.next_run_time = datetime(2026, 6, 1, 12, 0, 0, tzinfo=UTC)

        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        mock_scheduler.get_jobs.return_value = [mock_job]

        import app.services.scheduler_service as sched_svc

        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = lambda: mock_scheduler
        try:
            resp = client.get("/api/stats/scheduler")
        finally:
            sched_svc.get_scheduler = original

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert data["jobs_count"] == 1
        assert data["next_run"] is not None
        assert "2026" in data["next_run"]

    def test_scheduler_jobs_with_no_next_run_time(self):
        """Jobs where next_run_time is None should not affect next_run."""
        mock_job = MagicMock()
        mock_job.next_run_time = None

        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        mock_scheduler.get_jobs.return_value = [mock_job]

        import app.services.scheduler_service as sched_svc

        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = lambda: mock_scheduler
        try:
            resp = client.get("/api/stats/scheduler")
        finally:
            sched_svc.get_scheduler = original

        assert resp.status_code == 200
        data = resp.json()
        assert data["next_run"] is None

    def test_scheduler_stopped(self):
        mock_scheduler = MagicMock()
        mock_scheduler.running = False
        mock_scheduler.get_jobs.return_value = []

        import app.services.scheduler_service as sched_svc

        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = lambda: mock_scheduler
        try:
            resp = client.get("/api/stats/scheduler")
        finally:
            sched_svc.get_scheduler = original

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "stopped"


# ---------------------------------------------------------------------------
# Internal helpers: _redis_status, _lm_studio_status, _scheduler_status
# ---------------------------------------------------------------------------


class TestRedisStatus:
    def test_connected_when_ping_succeeds(self):
        import asyncio
        from app.api.stats import _redis_status

        mock_client = MagicMock()
        mock_client.ping = AsyncMock(return_value=True)

        with patch(
            "app.api.stats.get_cache_client", new_callable=AsyncMock, return_value=mock_client
        ):
            status = asyncio.run(_redis_status())

        assert status == "connected"

    def test_disconnected_when_get_cache_client_raises(self):
        import asyncio
        from app.api.stats import _redis_status

        with patch(
            "app.api.stats.get_cache_client",
            new_callable=AsyncMock,
            side_effect=Exception("timeout"),
        ):
            status = asyncio.run(_redis_status())

        assert status == "disconnected"

    def test_connected_when_ping_is_not_coroutine(self):
        """Handles sync ping (non-async) path."""
        import asyncio
        from app.api.stats import _redis_status

        mock_client = MagicMock()
        # ping returns a non-coroutine (sync value)
        mock_client.ping = MagicMock(return_value=True)

        with patch(
            "app.api.stats.get_cache_client", new_callable=AsyncMock, return_value=mock_client
        ):
            status = asyncio.run(_redis_status())

        assert status == "connected"


class TestLmStudioStatus:
    def test_connected_on_200_response(self):
        import asyncio
        from app.api.stats import _lm_studio_status

        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_response))
        )
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.stats.httpx.AsyncClient", return_value=mock_async_client):
            status = asyncio.run(_lm_studio_status())

        assert status == "connected"

    def test_disconnected_on_500_response(self):
        import asyncio
        from app.api.stats import _lm_studio_status

        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_response))
        )
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.stats.httpx.AsyncClient", return_value=mock_async_client):
            status = asyncio.run(_lm_studio_status())

        assert status == "disconnected"

    def test_disconnected_on_connection_error(self):
        import asyncio
        from app.api.stats import _lm_studio_status

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(side_effect=Exception("connection refused"))
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.stats.httpx.AsyncClient", return_value=mock_async_client):
            status = asyncio.run(_lm_studio_status())

        assert status == "disconnected"


class TestSchedulerStatus:
    def test_running_when_scheduler_running(self):
        from app.api.stats import _scheduler_status
        import app.services.scheduler_service as sched_svc

        mock_sched = MagicMock()
        mock_sched.running = True
        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = lambda: mock_sched
        try:
            status = _scheduler_status()
        finally:
            sched_svc.get_scheduler = original
        assert status == "running"

    def test_stopped_when_scheduler_not_running(self):
        from app.api.stats import _scheduler_status
        import app.services.scheduler_service as sched_svc

        mock_sched = MagicMock()
        mock_sched.running = False
        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = lambda: mock_sched
        try:
            status = _scheduler_status()
        finally:
            sched_svc.get_scheduler = original
        assert status == "stopped"

    def test_stopped_on_exception(self):
        from app.api.stats import _scheduler_status
        import app.services.scheduler_service as sched_svc

        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = MagicMock(side_effect=Exception("no sched"))
        try:
            status = _scheduler_status()
        finally:
            sched_svc.get_scheduler = original
        assert status == "stopped"
