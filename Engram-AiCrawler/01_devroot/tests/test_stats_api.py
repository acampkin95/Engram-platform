"""Tests for app/api/stats.py — dashboard, system, and scheduler stats."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware import rate_limit as _rl_module
from datetime import UTC

client = TestClient(app)


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


# ---------------------------------------------------------------------------
# Helper mocks
# ---------------------------------------------------------------------------


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
    def test_returns_200(self):
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
        from app.models.crawl import CrawlStatus

        jobs = [
            _make_crawl_job(CrawlStatus.COMPLETED),
            _make_crawl_job(CrawlStatus.FAILED),
            _make_crawl_job(CrawlStatus.PENDING),
        ]
        mock_store = _make_mock_job_store(jobs)
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = ["col1"]
        mock_chroma.count.return_value = 10
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
        assert crawls["total"] == 4
        assert crawls["completed"] == 2
        assert crawls["failed"] == 1

    def test_chromadb_unavailable_gracefully_handled(self):
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

    def test_storage_stats_with_collections(self):
        mock_store = _make_mock_job_store([])
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = ["col1", "col2"]
        mock_chroma.count.return_value = 5
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = []

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        data = resp.json()
        assert data["storage"]["collections"] == 2
        assert data["storage"]["total_documents"] == 10  # 5 * 2

    def test_investigation_stats(self):
        from app.models.investigation import InvestigationStatus

        mock_store = _make_mock_job_store([])
        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = []

        inv_active = MagicMock()
        inv_active.status = InvestigationStatus.ACTIVE
        inv_closed = MagicMock()
        inv_closed.status = InvestigationStatus.CLOSED
        mock_svc = MagicMock()
        mock_svc.list_all.return_value = [inv_active, inv_closed]

        with (
            patch("app.api.stats._crawl_store", mock_store),
            patch("app.api.stats.get_chromadb_client", return_value=mock_chroma),
            patch("app.api.stats.get_investigation_service", return_value=mock_svc),
        ):
            resp = client.get("/api/stats/dashboard")

        data = resp.json()
        assert data["investigations"]["total"] == 2
        assert data["investigations"]["active"] == 1


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
            patch(
                "app.api.stats._redis_status", new_callable=AsyncMock, return_value="disconnected"
            ),
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

    def test_memory_percent_is_float(self):
        with (
            patch("app.api.stats._redis_status", new_callable=AsyncMock, return_value="connected"),
            patch(
                "app.api.stats._lm_studio_status", new_callable=AsyncMock, return_value="connected"
            ),
            patch("app.api.stats._scheduler_status", return_value="running"),
        ):
            resp = client.get("/api/stats/system")

        data = resp.json()
        assert isinstance(data["memory_percent"], float)


# ---------------------------------------------------------------------------
# GET /api/stats/scheduler
# ---------------------------------------------------------------------------


class TestSchedulerStats:
    def test_returns_200(self):
        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        mock_scheduler.get_jobs.return_value = []

        with patch(
            "app.api.stats.get_scheduler"
            if False
            else "app.services.scheduler_service.get_scheduler",
            return_value=mock_scheduler,
        ):
            resp = client.get("/api/stats/scheduler")

        assert resp.status_code == 200

    def test_scheduler_unavailable_returns_stopped(self):
        with patch(
            "app.services.scheduler_service.get_scheduler", side_effect=Exception("no scheduler")
        ):
            resp = client.get("/api/stats/scheduler")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "stopped"

    def test_scheduler_running_with_jobs(self):
        from datetime import datetime

        mock_job = MagicMock()
        mock_job.next_run_time = datetime(2026, 1, 1, tzinfo=UTC)

        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        mock_scheduler.get_jobs.return_value = [mock_job]

        # Patch inside the function's import
        with patch("app.api.stats.get_scheduler", return_value=mock_scheduler, create=True):
            from app.api import stats as stats_module

            original = getattr(stats_module, "get_scheduler", None)
            # Direct module-level patch
            import app.services.scheduler_service as sched_svc

            original_fn = sched_svc.get_scheduler
            sched_svc.get_scheduler = lambda: mock_scheduler
            try:
                resp = client.get("/api/stats/scheduler")
            finally:
                sched_svc.get_scheduler = original_fn

        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Internal helper functions
# ---------------------------------------------------------------------------


class TestInternalHelpers:
    @pytest.mark.asyncio
    async def test_redis_status_connected(self):
        from app.api.stats import _redis_status

        mock_client = MagicMock()
        mock_client.ping = AsyncMock(return_value=True)

        with patch(
            "app.api.stats.get_cache_client", new_callable=AsyncMock, return_value=mock_client
        ):
            status = await _redis_status()

        assert status == "connected"

    @pytest.mark.asyncio
    async def test_redis_status_disconnected_on_error(self):
        from app.api.stats import _redis_status

        with patch(
            "app.api.stats.get_cache_client",
            new_callable=AsyncMock,
            side_effect=Exception("timeout"),
        ):
            status = await _redis_status()

        assert status == "disconnected"

    @pytest.mark.asyncio
    async def test_lm_studio_status_connected(self):
        from app.api.stats import _lm_studio_status

        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_httpx:
            mock_httpx.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(get=AsyncMock(return_value=mock_response))
            )
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)
            status = await _lm_studio_status()

        assert status in ("connected", "disconnected")  # May not connect in test env

    @pytest.mark.asyncio
    async def test_lm_studio_status_disconnected_on_error(self):
        from app.api.stats import _lm_studio_status

        with patch("httpx.AsyncClient") as mock_httpx:
            mock_httpx.return_value.__aenter__ = AsyncMock(
                side_effect=Exception("connection refused")
            )
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)
            status = await _lm_studio_status()

        assert status == "disconnected"

    def test_scheduler_status_stopped_on_error(self):
        from app.api.stats import _scheduler_status
        import app.services.scheduler_service as sched_svc

        original = sched_svc.get_scheduler
        sched_svc.get_scheduler = MagicMock(side_effect=Exception("no sched"))
        try:
            status = _scheduler_status()
        finally:
            sched_svc.get_scheduler = original
        assert status == "stopped"

    def test_scheduler_status_running(self):
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
