"""Tests for app/api/osint/scan.py — OSINT scan endpoints beyond existing tests."""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware import rate_limit as _rl_module

client = TestClient(app)


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


def _make_mock_scan_result(scan_id: str = None, username: str = "testuser"):
    if scan_id is None:
        scan_id = str(uuid.uuid4())
    return {
        "scan_id": scan_id,
        "username": username,
        "stage": "completed",
        "started_at": "2025-01-01T00:00:00",
        "completed_at": "2025-01-01T00:01:00",
        "profile_urls": [{"platform": "twitter", "url": "https://x.com/testuser"}],
        "crawl_results": [{"url": "https://x.com/testuser", "success": True, "word_count": 100}],
        "review": {"kept": 1, "deranked": 0, "archived": 0, "average_relevance": 0.9},
        "summary": {"aliases_found": 1},
        "stored_document_ids": ["doc1"],
        "knowledge_graph": {
            "entities": [{"id": "e1", "name": "testuser", "entity_type": "person"}],
            "relationships": [],
        },
    }


# ---------------------------------------------------------------------------
# POST /api/osint/scan — background scan
# ---------------------------------------------------------------------------


class TestStartOsintScan:
    def test_returns_accepted(self):
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock()
            mock_cls.return_value = mock_orch
            resp = client.post("/api/osint/scan", json={"username": "alice"})

        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

    def test_returns_websocket_topic(self):
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock()
            mock_cls.return_value = mock_orch
            resp = client.post("/api/osint/scan", json={"username": "bob"})

        data = resp.json()
        assert "websocket_topic" in data
        assert data["websocket_topic"].startswith("osint_scan:")

    def test_missing_username_returns_422(self):
        resp = client.post("/api/osint/scan", json={})
        assert resp.status_code == 422

    def test_username_too_long_returns_422(self):
        resp = client.post("/api/osint/scan", json={"username": "a" * 300})
        assert resp.status_code == 422

    def test_with_platforms_returns_accepted(self):
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock()
            mock_cls.return_value = mock_orch
            resp = client.post(
                "/api/osint/scan",
                json={
                    "username": "charlie",
                    "platforms": ["twitter", "linkedin"],
                    "query_context": "OSINT research",
                },
            )

        assert resp.status_code == 200

    def test_with_all_optional_fields(self):
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock()
            mock_cls.return_value = mock_orch
            resp = client.post(
                "/api/osint/scan",
                json={
                    "username": "dave",
                    "platforms": ["github"],
                    "max_concurrent_crawls": 3,
                    "query_context": "security researcher",
                    "reference_photo_labels": ["tall", "glasses"],
                },
            )

        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/osint/scan/sync — synchronous scan
# ---------------------------------------------------------------------------


class TestRunOsintScanSync:
    def test_sync_returns_result(self):
        mock_result = MagicMock()
        mock_result.scan_id = str(uuid.uuid4())
        mock_result.model_dump.return_value = _make_mock_scan_result()

        with (
            patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls,
            patch("app.api.osint.scan._scan_store") as mock_store,
        ):
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock(return_value=mock_result)
            mock_cls.return_value = mock_orch
            mock_store.set = AsyncMock()

            resp = client.post("/api/osint/scan/sync", json={"username": "testuser"})

        assert resp.status_code == 200

    def test_sync_missing_username_returns_422(self):
        resp = client.post("/api/osint/scan/sync", json={})
        assert resp.status_code == 422

    def test_sync_lm_studio_error_returns_502(self):
        from app.services.lm_studio_bridge import LMStudioError

        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock(side_effect=LMStudioError("LM Studio down"))
            mock_cls.return_value = mock_orch

            resp = client.post("/api/osint/scan/sync", json={"username": "testuser"})

        assert resp.status_code == 502

    def test_sync_generic_error_returns_500(self):
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock(side_effect=Exception("Unexpected"))
            mock_cls.return_value = mock_orch

            resp = client.post("/api/osint/scan/sync", json={"username": "testuser"})

        assert resp.status_code == 500

    def test_sync_stores_result(self):
        scan_id = str(uuid.uuid4())
        result_data = _make_mock_scan_result(scan_id=scan_id)
        mock_result = MagicMock()
        mock_result.scan_id = scan_id
        mock_result.model_dump.return_value = result_data

        mock_store = MagicMock()
        mock_store.set = AsyncMock()

        with (
            patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_cls,
            patch("app.api.osint.scan._scan_store", mock_store),
        ):
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock(return_value=mock_result)
            mock_cls.return_value = mock_orch

            resp = client.post("/api/osint/scan/sync", json={"username": "testuser"})

        assert resp.status_code == 200
        mock_store.set.assert_called_once()


# ---------------------------------------------------------------------------
# GET /api/osint/scan/list
# ---------------------------------------------------------------------------


class TestListScanResults:
    def test_empty_list_returns_200(self):
        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.values = AsyncMock(return_value=[])
            resp = client.get("/api/osint/scan/list")

        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["scans"] == []

    def test_returns_scan_summaries(self):
        scans = [
            _make_mock_scan_result(username="alice"),
            _make_mock_scan_result(username="bob"),
        ]
        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.values = AsyncMock(return_value=scans)
            resp = client.get("/api/osint/scan/list")

        data = resp.json()
        assert data["count"] == 2
        assert len(data["scans"]) == 2

    def test_scan_summary_fields(self):
        scan = _make_mock_scan_result(username="alice")
        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.values = AsyncMock(return_value=[scan])
            resp = client.get("/api/osint/scan/list")

        data = resp.json()
        summary = data["scans"][0]
        assert "scan_id" in summary
        assert "username" in summary
        assert "stage" in summary
        assert "started_at" in summary
        assert "completed_at" in summary
        assert "summary" in summary


# ---------------------------------------------------------------------------
# GET /api/osint/scan/{scan_id}
# ---------------------------------------------------------------------------


class TestGetScanResult:
    def test_existing_scan_returns_200(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id)

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(f"/api/osint/scan/{scan_id}")

        assert resp.status_code == 200

    def test_nonexistent_scan_returns_404(self):
        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=None)
            resp = client.get(f"/api/osint/scan/{uuid.uuid4()}")

        assert resp.status_code == 404

    def test_returns_full_scan_data(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id, username="testuser")

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(f"/api/osint/scan/{scan_id}")

        data = resp.json()
        assert data["scan_id"] == scan_id
        assert data["username"] == "testuser"


# ---------------------------------------------------------------------------
# GET /api/osint/scan/{scan_id}/export
# ---------------------------------------------------------------------------


class TestExportScanResult:
    def test_export_json_returns_200(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id)

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(f"/api/osint/scan/{scan_id}/export?format=json")

        assert resp.status_code == 200
        assert "application/json" in resp.headers["content-type"]

    def test_export_csv_returns_200(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id)

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(f"/api/osint/scan/{scan_id}/export?format=csv")

        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]

    def test_export_nonexistent_returns_404(self):
        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=None)
            resp = client.get(f"/api/osint/scan/{uuid.uuid4()}/export?format=json")

        assert resp.status_code == 404

    def test_export_invalid_format_returns_422(self):
        scan_id = str(uuid.uuid4())
        resp = client.get(f"/api/osint/scan/{scan_id}/export?format=xlsx")
        assert resp.status_code == 422

    def test_export_json_has_content_disposition(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id, username="testuser")

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(f"/api/osint/scan/{scan_id}/export?format=json")

        assert "attachment" in resp.headers.get("content-disposition", "")
        assert "testuser" in resp.headers.get("content-disposition", "")

    def test_export_csv_has_correct_headers(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id)

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(f"/api/osint/scan/{scan_id}/export?format=csv")

        content = resp.text
        assert "scan_id" in content or "type" in content

    def test_export_json_without_aliases(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id)

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(
                f"/api/osint/scan/{scan_id}/export?format=json&include=entities,relationships"
            )

        assert resp.status_code == 200
        data = resp.json()
        # profile_urls should be absent since "aliases" not in include
        assert "profile_urls" not in data

    def test_export_json_without_metadata(self):
        scan_id = str(uuid.uuid4())
        scan = _make_mock_scan_result(scan_id=scan_id)

        with patch("app.api.osint.scan._scan_store") as mock_store:
            mock_store.get = AsyncMock(return_value=scan)
            resp = client.get(
                f"/api/osint/scan/{scan_id}/export?format=json&include=aliases,entities"
            )

        assert resp.status_code == 200
        data = resp.json()
        # review and summary stripped since "metadata" not in include
        assert "review" not in data
        assert "summary" not in data


# ---------------------------------------------------------------------------
# WebSocket progress callback
# ---------------------------------------------------------------------------


class TestWsProgressCallback:
    @pytest.mark.asyncio
    async def test_callback_calls_manager(self):
        from app.api.osint.scan import _ws_progress_callback
        from app.orchestrators.osint_scan_orchestrator import ScanStage

        with patch("app.api.osint.scan.manager") as mock_manager:
            mock_manager.send_osint_scan_update = AsyncMock()
            await _ws_progress_callback("scan-id-123", ScanStage.ALIAS_DISCOVERY, {"count": 5})
            mock_manager.send_osint_scan_update.assert_called_once_with(
                "scan-id-123",
                ScanStage.ALIAS_DISCOVERY.value,
                {"count": 5},
            )
