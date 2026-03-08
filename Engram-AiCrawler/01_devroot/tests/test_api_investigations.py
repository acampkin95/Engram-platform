"""
Tests for app/api/investigations.py — targets 70%+ coverage.

Strategy:
- Minimal FastAPI app with only the investigations router
- Patches get_investigation_service to control service behaviour
- Tests all endpoints: create, list, get, update, delete, link_crawl, link_scan
- Covers happy paths AND 404 error paths
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.api.investigations import router
from app.middleware import rate_limit as _rl_module
from app.models.investigation import (
    Investigation,
    InvestigationStatus,
    InvestigationPriority,
    InvestigationSummary,
)
from datetime import datetime, UTC

# ── Minimal app ────────────────────────────────────────────────────────────────
app = FastAPI()
app.include_router(router)
client = TestClient(app, raise_server_exceptions=True)


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_get_redis():
    with patch("app.services.job_store._get_redis", new=AsyncMock(return_value=None)):
        yield


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_investigation(**kwargs) -> Investigation:
    defaults = dict(
        investigation_id="inv-001",
        name="Test Investigation",
        description="A test",
        status=InvestigationStatus.ACTIVE,
        priority=InvestigationPriority.MEDIUM,
        tags=["osint"],
        crawl_ids=[],
        scan_ids=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        closed_at=None,
        metadata={},
    )
    defaults.update(kwargs)
    return Investigation(**defaults)


def _make_summary(**kwargs) -> InvestigationSummary:
    defaults = dict(
        investigation_id="inv-001",
        name="Test Investigation",
        status=InvestigationStatus.ACTIVE,
        priority=InvestigationPriority.MEDIUM,
        tags=["osint"],
        crawl_count=0,
        scan_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    defaults.update(kwargs)
    return InvestigationSummary(**defaults)


def _mock_service(**overrides):
    svc = MagicMock()
    svc.create.return_value = _make_investigation()
    svc.list_all.return_value = [_make_investigation()]
    svc.get_summary.return_value = _make_summary()
    svc.get.return_value = _make_investigation()
    svc.update.return_value = _make_investigation()
    svc.delete.return_value = True
    svc.add_crawl.return_value = _make_investigation(crawl_ids=["crawl-1"])
    svc.add_scan.return_value = _make_investigation(scan_ids=["scan-1"])
    for k, v in overrides.items():
        setattr(svc, k, v)
    return svc


# ── POST / — create investigation ─────────────────────────────────────────────


class TestCreateInvestigation:
    def test_create_returns_201(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.post(
                "/api/investigations/",
                json={"name": "My Investigation", "priority": "high"},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Investigation"

    def test_create_calls_service(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            client.post(
                "/api/investigations/",
                json={"name": "My Investigation"},
            )
        svc.create.assert_called_once()

    def test_create_missing_name_returns_422(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.post("/api/investigations/", json={})
        assert resp.status_code == 422


# ── GET / — list investigations ────────────────────────────────────────────────


class TestListInvestigations:
    def test_list_returns_200(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_returns_summaries(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["investigation_id"] == "inv-001"

    def test_list_with_status_filter(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/?status=active")
        assert resp.status_code == 200
        svc.list_all.assert_called_once()
        call_kwargs = svc.list_all.call_args.kwargs
        assert call_kwargs["status"] == InvestigationStatus.ACTIVE

    def test_list_with_priority_filter(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/?priority=high")
        assert resp.status_code == 200
        call_kwargs = svc.list_all.call_args.kwargs
        assert call_kwargs["priority"] == InvestigationPriority.HIGH

    def test_list_with_limit_and_offset(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/?limit=10&offset=5")
        assert resp.status_code == 200
        call_kwargs = svc.list_all.call_args.kwargs
        assert call_kwargs["limit"] == 10
        assert call_kwargs["offset"] == 5

    def test_list_skips_missing_summary(self):
        """If get_summary returns None for an investigation, it is omitted."""
        svc = _mock_service()
        svc.get_summary.return_value = None
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_empty(self):
        svc = _mock_service()
        svc.list_all.return_value = []
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_invalid_limit_returns_422(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/?limit=0")
        assert resp.status_code == 422

    def test_list_invalid_offset_returns_422(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/?offset=-1")
        assert resp.status_code == 422


# ── GET /{investigation_id} — get single investigation ─────────────────────────


class TestGetInvestigation:
    def test_get_existing_returns_200(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/inv-001")
        assert resp.status_code == 200
        assert resp.json()["investigation_id"] == "inv-001"

    def test_get_missing_returns_404(self):
        svc = _mock_service()
        svc.get.return_value = None
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.get("/api/investigations/nonexistent")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


# ── PUT /{investigation_id} — update investigation ─────────────────────────────


class TestUpdateInvestigation:
    def test_update_existing_returns_200(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.put(
                "/api/investigations/inv-001",
                json={"name": "Updated Name"},
            )
        assert resp.status_code == 200
        svc.update.assert_called_once()

    def test_update_missing_returns_404(self):
        svc = _mock_service()
        svc.update.return_value = None
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.put(
                "/api/investigations/nonexistent",
                json={"name": "Updated Name"},
            )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_update_status(self):
        svc = _mock_service()
        updated = _make_investigation(status=InvestigationStatus.CLOSED)
        svc.update.return_value = updated
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.put(
                "/api/investigations/inv-001",
                json={"status": "closed"},
            )
        assert resp.status_code == 200
        assert resp.json()["status"] == "closed"


# ── DELETE /{investigation_id} — delete investigation ──────────────────────────


class TestDeleteInvestigation:
    def test_delete_existing_returns_200(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.delete("/api/investigations/inv-001")
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

    def test_delete_missing_returns_404(self):
        svc = _mock_service()
        svc.delete.return_value = False
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.delete("/api/investigations/nonexistent")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


# ── POST /{investigation_id}/crawls/{crawl_id} — link crawl ────────────────────


class TestLinkCrawl:
    def test_link_crawl_returns_200(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.post("/api/investigations/inv-001/crawls/crawl-1")
        assert resp.status_code == 200
        data = resp.json()
        assert "crawl-1" in data["crawl_ids"]

    def test_link_crawl_missing_investigation_returns_404(self):
        svc = _mock_service()
        svc.add_crawl.return_value = None
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.post("/api/investigations/nonexistent/crawls/crawl-1")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


# ── POST /{investigation_id}/scans/{scan_id} — link scan ──────────────────────


class TestLinkScan:
    def test_link_scan_returns_200(self):
        svc = _mock_service()
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.post("/api/investigations/inv-001/scans/scan-1")
        assert resp.status_code == 200
        data = resp.json()
        assert "scan-1" in data["scan_ids"]

    def test_link_scan_missing_investigation_returns_404(self):
        svc = _mock_service()
        svc.add_scan.return_value = None
        with patch("app.api.investigations.get_investigation_service", return_value=svc):
            resp = client.post("/api/investigations/nonexistent/scans/scan-1")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
