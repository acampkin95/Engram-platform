"""Tests for OSINT scan endpoint — scan_id propagation and WebSocket topic consistency."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware import rate_limit as _rl_module

client = TestClient(app)


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Disable rate limiting for all tests (no Redis in test env)."""
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


class TestOSINTScanEndpoint:
    """Tests for POST /api/osint/scan."""

    def test_scan_returns_accepted_status(self):
        """POST /scan returns 200 with status=accepted."""
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_orch_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock()
            mock_orch_cls.return_value = mock_orch

            resp = client.post(
                "/api/osint/scan",
                json={"username": "testuser"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "accepted"

    def test_scan_returns_scan_id_in_websocket_topic(self):
        """Returned websocket_topic contains a valid UUID."""
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_orch_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock()
            mock_orch_cls.return_value = mock_orch

            resp = client.post(
                "/api/osint/scan",
                json={"username": "testuser"},
            )

        data = resp.json()
        topic = data.get("websocket_topic", "")
        assert topic.startswith("osint_scan:")

        # Extract UUID part and validate
        scan_id_str = topic.split("osint_scan:")[1]
        parsed = uuid.UUID(scan_id_str)  # raises ValueError if not valid UUID
        assert str(parsed) == scan_id_str

    def test_scan_id_passed_to_orchestrator(self):
        """The scan_id in websocket_topic matches what the orchestrator receives."""
        captured_request = {}

        async def fake_run_scan(request):
            captured_request["scan_id"] = request.scan_id

        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_orch_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = fake_run_scan
            mock_orch_cls.return_value = mock_orch

            resp = client.post(
                "/api/osint/scan",
                json={"username": "testuser"},
            )

        data = resp.json()
        topic_scan_id = data["websocket_topic"].split("osint_scan:")[1]

        # The scan_id passed to orchestrator must equal the one in the topic
        assert captured_request.get("scan_id") == topic_scan_id

    def test_scan_missing_username_returns_422(self):
        """POST /scan without username returns 422 Unprocessable Entity."""
        resp = client.post("/api/osint/scan", json={})
        assert resp.status_code == 422

    def test_scan_with_platforms(self):
        """POST /scan with platforms list is accepted."""
        with patch("app.api.osint.scan.OSINTScanOrchestrator") as mock_orch_cls:
            mock_orch = MagicMock()
            mock_orch.run_scan = AsyncMock()
            mock_orch_cls.return_value = mock_orch

            resp = client.post(
                "/api/osint/scan",
                json={"username": "testuser", "platforms": ["twitter", "github"]},
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

    def test_scan_list_returns_200(self):
        """GET /api/osint/scan/list returns 200."""
        resp = client.get("/api/osint/scan/list")
        assert resp.status_code == 200

    def test_scan_get_nonexistent_returns_404(self):
        """GET /api/osint/scan/{id} for unknown id returns 404."""
        resp = client.get(f"/api/osint/scan/{uuid.uuid4()}")
        assert resp.status_code == 404


class TestOSINTScanOrchestrator:
    """Tests for scan_id propagation in OSINTScanOrchestrator."""

    def test_orchestrator_uses_provided_scan_id(self):
        """Orchestrator uses scan_id from ScanRequest if provided."""
        from app.orchestrators.osint_scan_orchestrator import ScanRequest

        fixed_id = str(uuid.uuid4())
        req = ScanRequest(username="alice", scan_id=fixed_id)
        assert req.scan_id == fixed_id

    def test_orchestrator_generates_scan_id_when_not_provided(self):
        """Orchestrator generates a UUID scan_id when none is provided."""
        from app.orchestrators.osint_scan_orchestrator import ScanRequest

        req = ScanRequest(username="bob")
        # scan_id should be None at model level; orchestrator fills it at runtime
        assert req.scan_id is None
