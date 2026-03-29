"""
Tests for app/api/crawl.py — targets 70%+ coverage.

Strategy:
- Uses a minimal FastAPI app (avoids extraction.py 204-body assertion error from main app)
- Patches execute_crawl (async no-op) so no real browser runs
- Patches WebSocket manager to avoid real WS traffic
- Clears in-memory fallback store between tests
- Auth and rate limiting disabled via fixtures
"""
from __future__ import annotations

import uuid
import pytest
from app._compat import UTC
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Import the REAL execute_crawl before any patches can intercept it.
# This module-level reference bypasses the autouse mock_execute_crawl fixture,
# allowing us to unit-test the function body directly.
from app.api.crawl import router, _crawl_store, execute_crawl as _real_execute_crawl
from app.models.crawl import CrawlStatus

# ── Minimal app (avoids extraction.py 204-body assertion error in main) ──────
app = FastAPI()
app.include_router(router)
client = TestClient(app, raise_server_exceptions=True)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _mock_config(auth_enabled: bool = False, protected_routes_enabled: bool = False):
    m = MagicMock()
    m.auth_enabled = auth_enabled
    m.protected_routes_enabled = protected_routes_enabled
    return m


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Turn off rate limiting so tests are not throttled."""
    from app.middleware import rate_limit as _rl_module

    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


@pytest.fixture(autouse=True)
def clear_store():
    """Reset the in-memory fallback dict before/after every test."""
    _crawl_store._fallback.clear()
    yield
    _crawl_store._fallback.clear()


@pytest.fixture(autouse=True)
def mock_manager():
    """Patch WebSocket manager — `send_crawl_update` is async so use AsyncMock."""
    with patch("app.api.crawl.manager") as m:
        m.send_crawl_update = AsyncMock()
        yield m


@pytest.fixture(autouse=True)
def mock_auth():
    """Disable auth for all tests via a mocked ClerkConfig."""
    cfg = _mock_config()
    with patch("app.api.crawl.get_clerk_config", return_value=cfg):
        yield cfg


@pytest.fixture(autouse=True)
def mock_execute_crawl():
    """
    Replace execute_crawl with an AsyncMock so no real browser/crawler runs.

    Background tasks inside TestClient run synchronously after the response
    is returned — without this patch the test would attempt to launch Chromium.
    """
    with patch("app.api.crawl.execute_crawl", new_callable=AsyncMock) as m:
        yield m


# ── POST /api/crawl/start ─────────────────────────────────────────────────────


class TestStartCrawl:
    def test_start_crawl_happy_path(self):
        resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        assert resp.status_code == 202
        data = resp.json()
        assert "crawl_id" in data
        assert data["status"] == CrawlStatus.PENDING
        assert "example.com" in data["url"]

    def test_start_crawl_returns_crawl_response_shape(self):
        resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        data = resp.json()
        for field in ("crawl_id", "url", "status", "created_at"):
            assert field in data, f"Missing field: {field}"

    def test_start_crawl_invalid_url_raises_400(self):
        """Patch validate_url with a sync MagicMock (not AsyncMock).

        The production code calls validate_url() WITHOUT await, so an AsyncMock
        would silently return a coroutine instead of raising ValueError.
        Forcing new=MagicMock(...) bypasses pytest's auto-async detection.
        """
        with patch("app.api.crawl.validate_url", new=MagicMock(side_effect=ValueError("bad url"))):
            resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        assert resp.status_code == 400
        assert "URL validation failed" in resp.json()["detail"]

    def test_start_crawl_stores_job_in_store(self):
        resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        crawl_id = resp.json()["crawl_id"]
        assert crawl_id in _crawl_store._fallback

    def test_start_crawl_with_options(self):
        resp = client.post(
            "/api/crawl/start",
            json={
                "url": "https://example.com",
                "screenshot": True,
                "pdf": True,
                "word_count_threshold": 100,
                "bypass_cache": True,
                "exclude_external_links": True,
            },
        )
        assert resp.status_code == 202
        assert resp.json()["status"] == CrawlStatus.PENDING

    def test_start_crawl_background_task_called(self, mock_execute_crawl):
        client.post("/api/crawl/start", json={"url": "https://example.com"})
        mock_execute_crawl.assert_called_once()

    def test_start_crawl_manager_notified(self, mock_manager):
        client.post("/api/crawl/start", json={"url": "https://example.com"})
        mock_manager.send_crawl_update.assert_called()

    def test_start_crawl_multiple_creates_distinct_ids(self):
        r1 = client.post("/api/crawl/start", json={"url": "https://example.com"})
        r2 = client.post("/api/crawl/start", json={"url": "https://example.org"})
        assert r1.json()["crawl_id"] != r2.json()["crawl_id"]


# ── POST /api/crawl/batch ─────────────────────────────────────────────────────


class TestBatchCrawl:
    def test_batch_crawl_multiple_urls(self):
        resp = client.post(
            "/api/crawl/batch",
            json={"urls": ["https://example.com", "https://example.org"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        for item in data:
            assert item["status"] == CrawlStatus.PENDING
            assert "crawl_id" in item

    def test_batch_crawl_single_url(self):
        resp = client.post(
            "/api/crawl/batch",
            json={"urls": ["https://example.com"]},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_batch_crawl_three_urls(self):
        resp = client.post(
            "/api/crawl/batch",
            json={
                "urls": [
                    "https://alpha.example.com",
                    "https://beta.example.com",
                    "https://gamma.example.com",
                ]
            },
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_batch_crawl_with_config(self):
        resp = client.post(
            "/api/crawl/batch",
            json={
                "urls": ["https://example.com", "https://example.org"],
                "config": {"url": "https://placeholder.com", "screenshot": True},
            },
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_batch_crawl_empty_urls_rejected(self):
        """Pydantic min_length=1 must reject empty list with 422."""
        resp = client.post("/api/crawl/batch", json={"urls": []})
        assert resp.status_code == 422

    def test_batch_crawl_ids_are_unique(self):
        resp = client.post(
            "/api/crawl/batch",
            json={"urls": ["https://a.com", "https://b.com", "https://c.com"]},
        )
        ids = [item["crawl_id"] for item in resp.json()]
        assert len(ids) == len(set(ids))


# ── GET /api/crawl/status/{crawl_id} ─────────────────────────────────────────


class TestGetStatus:
    def _create(self, url: str = "https://example.com") -> str:
        r = client.post("/api/crawl/start", json={"url": url})
        return r.json()["crawl_id"]

    def test_get_status_found(self):
        crawl_id = self._create()
        resp = client.get(f"/api/crawl/status/{crawl_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["crawl_id"] == crawl_id
        assert data["status"] == CrawlStatus.PENDING

    def test_get_status_not_found(self):
        resp = client.get("/api/crawl/status/does-not-exist")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Crawl job not found"

    def test_get_status_after_cancel(self):
        crawl_id = self._create()
        client.post(f"/api/crawl/cancel/{crawl_id}")
        resp = client.get(f"/api/crawl/status/{crawl_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == CrawlStatus.CANCELLED

    def test_get_status_contains_url(self):
        crawl_id = self._create("https://mytest.example.com")
        resp = client.get(f"/api/crawl/status/{crawl_id}")
        assert "mytest.example.com" in resp.json()["url"]


# ── GET /api/crawl/list ───────────────────────────────────────────────────────


class TestListCrawls:
    def _create_n(self, n: int) -> list[str]:
        ids = []
        for i in range(n):
            r = client.post("/api/crawl/start", json={"url": f"https://example.com/page{i}"})
            ids.append(r.json()["crawl_id"])
        return ids

    def test_list_empty(self):
        resp = client.get("/api/crawl/list")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_all(self):
        self._create_n(3)
        resp = client.get("/api/crawl/list")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_list_filtered_by_status_pending(self):
        self._create_n(3)
        resp = client.get("/api/crawl/list", params={"status": "pending"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        assert all(item["status"] == CrawlStatus.PENDING for item in data)

    def test_list_filter_no_match(self):
        self._create_n(2)
        resp = client.get("/api/crawl/list", params={"status": "completed"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_filter_cancelled(self):
        ids = self._create_n(3)
        # Cancel 2 of them
        client.post(f"/api/crawl/cancel/{ids[0]}")
        client.post(f"/api/crawl/cancel/{ids[1]}")

        resp = client.get("/api/crawl/list", params={"status": "cancelled"})
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_with_limit(self):
        self._create_n(5)
        resp = client.get("/api/crawl/list", params={"limit": 2})
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_default_limit_100(self):
        self._create_n(4)
        resp = client.get("/api/crawl/list")
        assert resp.status_code == 200
        assert len(resp.json()) == 4

    def test_list_invalid_status_rejected(self):
        resp = client.get("/api/crawl/list", params={"status": "INVALID"})
        assert resp.status_code == 422


# ── POST /api/crawl/cancel/{crawl_id} ────────────────────────────────────────


class TestCancelCrawl:
    def _create(self) -> str:
        r = client.post("/api/crawl/start", json={"url": "https://example.com"})
        return r.json()["crawl_id"]

    def test_cancel_success_200(self):
        crawl_id = self._create()
        resp = client.post(f"/api/crawl/cancel/{crawl_id}")
        assert resp.status_code == 200

    def test_cancel_returns_message(self):
        crawl_id = self._create()
        resp = client.post(f"/api/crawl/cancel/{crawl_id}")
        assert "cancelled" in resp.json()["message"]
        assert crawl_id in resp.json()["message"]

    def test_cancel_updates_status_to_cancelled(self):
        crawl_id = self._create()
        client.post(f"/api/crawl/cancel/{crawl_id}")
        status_resp = client.get(f"/api/crawl/status/{crawl_id}")
        assert status_resp.json()["status"] == CrawlStatus.CANCELLED

    def test_cancel_sets_completed_at(self):
        crawl_id = self._create()
        client.post(f"/api/crawl/cancel/{crawl_id}")
        status_resp = client.get(f"/api/crawl/status/{crawl_id}")
        assert status_resp.json()["completed_at"] is not None

    def test_cancel_not_found_404(self):
        resp = client.post("/api/crawl/cancel/nonexistent-id")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Crawl job not found"

    def test_cancel_notifies_manager(self, mock_manager):
        crawl_id = self._create()
        # Reset call count from start_crawl
        mock_manager.send_crawl_update.reset_mock()
        client.post(f"/api/crawl/cancel/{crawl_id}")
        mock_manager.send_crawl_update.assert_called_once()


# ── DELETE /api/crawl/{crawl_id} ──────────────────────────────────────────────


class TestDeleteCrawl:
    def _create(self) -> str:
        r = client.post("/api/crawl/start", json={"url": "https://example.com"})
        return r.json()["crawl_id"]

    def test_delete_success_200(self):
        crawl_id = self._create()
        resp = client.delete(f"/api/crawl/{crawl_id}")
        assert resp.status_code == 200

    def test_delete_returns_message(self):
        crawl_id = self._create()
        resp = client.delete(f"/api/crawl/{crawl_id}")
        assert "deleted" in resp.json()["message"]
        assert crawl_id in resp.json()["message"]

    def test_delete_removes_from_store(self):
        crawl_id = self._create()
        client.delete(f"/api/crawl/{crawl_id}")
        # Subsequent status check should 404
        status_resp = client.get(f"/api/crawl/status/{crawl_id}")
        assert status_resp.status_code == 404

    def test_delete_removes_from_fallback_dict(self):
        crawl_id = self._create()
        assert crawl_id in _crawl_store._fallback
        client.delete(f"/api/crawl/{crawl_id}")
        assert crawl_id not in _crawl_store._fallback

    def test_delete_not_found_404(self):
        resp = client.delete("/api/crawl/nonexistent-id")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Crawl job not found"

    def test_delete_makes_list_shorter(self):
        ids = [self._create() for _ in range(3)]
        client.delete(f"/api/crawl/{ids[0]}")
        resp = client.get("/api/crawl/list")
        assert len(resp.json()) == 2


# ── POST /api/crawl/deep ──────────────────────────────────────────────────────


class TestDeepCrawl:
    def test_deep_crawl_happy_path(self):
        resp = client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com", "max_depth": 2, "max_pages": 10},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "crawl_id" in data
        assert data["message"] == "Deep crawl started"

    def test_deep_crawl_uses_defaults(self):
        resp = client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com"},
        )
        assert resp.status_code == 200
        assert "crawl_id" in resp.json()

    def test_deep_crawl_invalid_url_raises_400(self):
        """Same sync-MagicMock workaround — validate_url is called without await."""
        with patch("app.api.crawl.validate_url", new=MagicMock(side_effect=ValueError("bad url"))):
            resp = client.post(
                "/api/crawl/deep",
                json={"start_url": "https://example.com", "max_depth": 2},
            )
        assert resp.status_code == 400
        assert "URL validation failed" in resp.json()["detail"]

    def test_deep_crawl_stores_job(self):
        resp = client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com"},
        )
        crawl_id = resp.json()["crawl_id"]
        assert crawl_id in _crawl_store._fallback

    def test_deep_crawl_metadata_marks_deep(self):
        resp = client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com", "max_depth": 3},
        )
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback[crawl_id]
        assert job["metadata"]["deep_crawl"] is True

    def test_deep_crawl_metadata_stores_max_depth(self):
        resp = client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com", "max_depth": 5},
        )
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback[crawl_id]
        assert job["metadata"]["max_depth"] == 5

    def test_deep_crawl_status_is_pending(self):
        resp = client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com"},
        )
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback[crawl_id]
        assert job["status"] == CrawlStatus.PENDING

    def test_deep_crawl_returns_unique_ids(self):
        r1 = client.post("/api/crawl/deep", json={"start_url": "https://a.com"})
        r2 = client.post("/api/crawl/deep", json={"start_url": "https://b.com"})
        assert r1.json()["crawl_id"] != r2.json()["crawl_id"]

    def test_deep_crawl_notifies_manager(self, mock_manager):
        mock_manager.send_crawl_update.reset_mock()
        client.post("/api/crawl/deep", json={"start_url": "https://example.com"})
        mock_manager.send_crawl_update.assert_called()

    def test_deep_crawl_fires_background_task(self, mock_execute_crawl):
        mock_execute_crawl.reset_mock()
        client.post("/api/crawl/deep", json={"start_url": "https://example.com"})
        mock_execute_crawl.assert_called_once()


# ── Direct execute_crawl unit tests ──────────────────────────────────────────


def _make_crawl_result(success=True, markdown="# Test", error_message=None):
    """Build a fake crawl4ai result object."""
    r = MagicMock()
    r.success = success
    r.markdown = markdown
    r.html = "<h1>Test</h1>"
    r.extracted_content = None
    r.links = {"internal": ["https://example.com/page1"]}
    r.media = {}
    r.screenshot = None
    r.pdf = None
    r.metadata = {"title": "Test Page"}
    r.error_message = error_message
    return r


def _make_async_crawler_ctx(result):
    """AsyncWebCrawler async-context-manager mock."""
    crawler = AsyncMock()
    crawler.arun = AsyncMock(return_value=result)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=crawler)
    ctx.__aexit__ = AsyncMock(return_value=None)
    return ctx


def _seed_job(crawl_id: str, url: str = "https://example.com") -> None:
    """Directly insert a pending job into the in-memory fallback dict."""
    _crawl_store._fallback[crawl_id] = {
        "crawl_id": crawl_id,
        "url": url,
        "status": CrawlStatus.PENDING,
        "created_at": datetime.now(UTC),
        "completed_at": None,
        "markdown": None,
        "html": None,
        "extracted_content": None,
        "links": None,
        "media": None,
        "screenshot": None,
        "pdf": None,
        "error_message": None,
        "metadata": {},
    }


class TestExecuteCrawlViaEndpoint:
    """
    Tests that exercise the real execute_crawl body by temporarily overriding
    the autouse AsyncMock with the real function inside the TestClient call.

    The trick: `patch('app.api.crawl.execute_crawl', _real_execute_crawl)` swaps in
    the real coroutine function while still mocking its external dependencies
    (AsyncWebCrawler, cache services).  TestClient's anyio event loop executes the
    background task synchronously before returning, so coverage.py tracks every line.
    """

    def _run_with_real_crawl(
        self, mock_manager, result, cache_return=None, url="https://example.com", bypass_cache=False
    ):
        """Helper: POST /start with real execute_crawl + mocked dependencies."""
        ctx = _make_async_crawler_ctx(result)
        with patch("app.api.crawl.execute_crawl", _real_execute_crawl), patch(
            "app.api.crawl.get_crawl_result", AsyncMock(return_value=cache_return)
        ), patch("app.api.crawl.set_crawl_result", AsyncMock()), patch(
            "app.api.crawl.AsyncWebCrawler", return_value=ctx
        ):
            resp = client.post("/api/crawl/start", json={"url": url, "bypass_cache": bypass_cache})
        return resp

    def test_execute_crawl_success_marks_completed(self, mock_manager):
        """Happy path: crawler succeeds — job status becomes COMPLETED."""
        result = _make_crawl_result(success=True, markdown="# Hello world")
        resp = self._run_with_real_crawl(mock_manager, result)
        assert resp.status_code == 202
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback.get(crawl_id)
        assert job["status"] == CrawlStatus.COMPLETED
        assert job["markdown"] == "# Hello world"

    def test_execute_crawl_success_stores_html(self, mock_manager):
        """Successful crawl stores HTML in the job record."""
        result = _make_crawl_result(success=True, markdown="hello")
        result.html = "<p>hello</p>"
        resp = self._run_with_real_crawl(mock_manager, result)
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback.get(crawl_id)
        assert job["html"] == "<p>hello</p>"

    def test_execute_crawl_success_computes_content_hash(self, mock_manager):
        """Successful crawl stores a SHA-256 content hash in metadata."""
        result = _make_crawl_result(success=True, markdown="some content")
        resp = self._run_with_real_crawl(mock_manager, result)
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback.get(crawl_id)
        assert "content_hash" in job["metadata"]
        assert len(job["metadata"]["content_hash"]) == 64

    def test_execute_crawl_failure_marks_failed(self, mock_manager):
        """Crawler returns success=False — job becomes FAILED."""
        result = _make_crawl_result(success=False, markdown=None, error_message="timeout")
        ctx = _make_async_crawler_ctx(result)
        with patch("app.api.crawl.execute_crawl", _real_execute_crawl), patch(
            "app.api.crawl.get_crawl_result", AsyncMock(return_value=None)
        ), patch("app.api.crawl.set_crawl_result", AsyncMock()), patch(
            "app.api.crawl.AsyncWebCrawler", return_value=ctx
        ):
            resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback.get(crawl_id)
        assert job["status"] == CrawlStatus.FAILED
        assert job["error_message"] == "timeout"

    def test_execute_crawl_failure_unknown_error(self, mock_manager):
        """Crawler fails with no error_message — stores 'Unknown error'."""
        result = _make_crawl_result(success=False, markdown=None, error_message=None)
        ctx = _make_async_crawler_ctx(result)
        with patch("app.api.crawl.execute_crawl", _real_execute_crawl), patch(
            "app.api.crawl.get_crawl_result", AsyncMock(return_value=None)
        ), patch("app.api.crawl.set_crawl_result", AsyncMock()), patch(
            "app.api.crawl.AsyncWebCrawler", return_value=ctx
        ):
            resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback.get(crawl_id)
        assert job["status"] == CrawlStatus.FAILED
        assert "Unknown error" in job["error_message"]

    def test_execute_crawl_exception_marks_failed(self, mock_manager):
        """Unhandled exception inside execute_crawl marks job FAILED."""

        def _boom(*args, **kwargs):
            raise RuntimeError("network error")

        with patch("app.api.crawl.execute_crawl", _real_execute_crawl), patch(
            "app.api.crawl.get_crawl_result", AsyncMock(return_value=None)
        ), patch("app.api.crawl.set_crawl_result", AsyncMock()), patch(
            "app.api.crawl.AsyncWebCrawler", side_effect=_boom
        ):
            resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback.get(crawl_id)
        assert job["status"] == CrawlStatus.FAILED
        assert "network error" in job["error_message"]

    def test_execute_crawl_cache_hit_skips_browser(self, mock_manager):
        """Cache hit — job becomes COMPLETED without calling AsyncWebCrawler."""
        cached_data = {
            "markdown": "# Cached",
            "html": "<h1>Cached</h1>",
            "extracted_content": None,
            "links": [],
            "media": {},
            "metadata": {"title": "Cached"},
        }
        ctx = _make_async_crawler_ctx(_make_crawl_result())  # should not be used
        with patch("app.api.crawl.execute_crawl", _real_execute_crawl), patch(
            "app.api.crawl.get_crawl_result", AsyncMock(return_value=cached_data)
        ), patch("app.api.crawl.set_crawl_result", AsyncMock()), patch(
            "app.api.crawl.AsyncWebCrawler"
        ) as mock_browser:
            resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
            mock_browser.assert_not_called()
        crawl_id = resp.json()["crawl_id"]
        job = _crawl_store._fallback.get(crawl_id)
        assert job["status"] == CrawlStatus.COMPLETED
        assert job.get("metadata", {}).get("cache_hit") is True

    def test_execute_crawl_bypass_cache_skips_lookup(self, mock_manager):
        """bypass_cache=True must not call get_crawl_result."""
        result = _make_crawl_result(success=True)
        ctx = _make_async_crawler_ctx(result)
        with patch("app.api.crawl.execute_crawl", _real_execute_crawl), patch(
            "app.api.crawl.get_crawl_result", AsyncMock(return_value=None)
        ) as mock_get, patch("app.api.crawl.set_crawl_result", AsyncMock()), patch(
            "app.api.crawl.AsyncWebCrawler", return_value=ctx
        ):
            client.post(
                "/api/crawl/start", json={"url": "https://example.com", "bypass_cache": True}
            )
            mock_get.assert_not_called()

    def test_execute_crawl_sends_multiple_ws_updates(self, mock_manager):
        """execute_crawl must emit at least 2 WebSocket updates (running + completed)."""
        result = _make_crawl_result(success=True)
        mock_manager.send_crawl_update.reset_mock()
        resp = self._run_with_real_crawl(mock_manager, result)
        crawl_id = resp.json()["crawl_id"]
        # ≥ 2: one for start_crawl (pending) and ≥ 1 inside execute_crawl
        assert mock_manager.send_crawl_update.call_count >= 2


# ── Auth-path coverage ────────────────────────────────────────────────────────


class TestAuthPaths:
    """Tests that exercise the auth-enabled code branches."""

    def _auth_config(self, auth_enabled=True, protected_routes_enabled=True):
        m = MagicMock()
        m.auth_enabled = auth_enabled
        m.protected_routes_enabled = protected_routes_enabled
        return m

    def test_start_crawl_no_auth_header_when_auth_enabled_returns_401(self):
        cfg = self._auth_config()
        with patch("app.api.crawl.get_clerk_config", return_value=cfg):
            resp = client.post("/api/crawl/start", json={"url": "https://example.com"})
        assert resp.status_code == 401

    def test_start_crawl_with_auth_header_calls_verify(self):
        cfg = self._auth_config()
        mock_user = MagicMock()
        mock_user.user_id = "user_123"
        with patch("app.api.crawl.get_clerk_config", return_value=cfg), patch(
            "app.api.crawl.verify_jwt_token", return_value=mock_user
        ):
            resp = client.post(
                "/api/crawl/start",
                json={"url": "https://example.com"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 202
        data = resp.json()
        assert data["metadata"]["owner_id"] == "user_123"

    def test_delete_crawl_no_auth_header_when_auth_enabled_returns_401(self):
        """DELETE with auth enabled but no header should 401 before even checking store."""
        crawl_id = str(uuid.uuid4())
        _seed_job(crawl_id)
        cfg = self._auth_config()
        with patch("app.api.crawl.get_clerk_config", return_value=cfg):
            resp = client.delete(f"/api/crawl/{crawl_id}")
        assert resp.status_code == 401

    def test_delete_crawl_wrong_owner_returns_403(self):
        """A user trying to delete another user's job should get 403."""
        crawl_id = str(uuid.uuid4())
        job = _crawl_store._fallback[crawl_id] = {
            "crawl_id": crawl_id,
            "url": "https://example.com",
            "status": CrawlStatus.PENDING,
            "created_at": datetime.now(UTC),
            "completed_at": None,
            "markdown": None,
            "html": None,
            "extracted_content": None,
            "links": None,
            "media": None,
            "screenshot": None,
            "pdf": None,
            "error_message": None,
            "metadata": {"owner_id": "owner_abc"},
        }
        cfg = self._auth_config()
        mock_user = MagicMock()
        mock_user.user_id = "different_user"
        with patch("app.api.crawl.get_clerk_config", return_value=cfg), patch(
            "app.api.crawl.verify_jwt_token", return_value=mock_user
        ):
            resp = client.delete(
                f"/api/crawl/{crawl_id}",
                headers={"Authorization": "Bearer token"},
            )
        assert resp.status_code == 403

    def test_batch_crawl_no_auth_header_when_auth_enabled_returns_401(self):
        cfg = self._auth_config()
        with patch("app.api.crawl.get_clerk_config", return_value=cfg):
            resp = client.post(
                "/api/crawl/batch",
                json={"urls": ["https://example.com"]},
            )
        assert resp.status_code == 401
