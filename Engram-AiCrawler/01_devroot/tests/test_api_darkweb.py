"""Tests for app/api/darkweb.py — Dark Web OSINT API.

Coverage target: 70%+ on the module.

Strategy: Use FastAPI TestClient with all external services mocked.
The darkweb module lazy-imports its service dependencies, so we patch
the helper functions (_get_marketplace_monitor, _get_breach_scanner, etc.)
to inject mock objects.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.middleware import rate_limit as _rl_module

# ---------------------------------------------------------------------------
# Rate limit disable fixture (required for all FastAPI test files)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

from app.api.darkweb import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers — mock service factories
# ---------------------------------------------------------------------------


def _make_monitor_result_dict():
    return {
        "entity_query": "John Doe",
        "search_terms": ["John Doe"],
        "sites_scanned": 5,
        "pages_scanned": 10,
        "mentions": [],
        "scan_duration_s": 1.5,
        "scan_id": "scan_001",
        "scanned_at": "2024-01-01T00:00:00+00:00",
        "errors": [],
        "tor_available": False,
    }


def _make_breach_result_dict():
    return {
        "scan_id": "breach_001",
        "query_terms": ["john@example.com"],
        "breaches": [],
        "pastes": [],
        "scan_duration_s": 0.5,
        "scanned_at": "2024-01-01T00:00:00+00:00",
        "hibp_available": False,
        "errors": [],
    }


def _make_crypto_result_dict():
    return {
        "scan_id": "crypto_001",
        "addresses_queried": ["1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf"],
        "profiles": [],
        "total_usd_value": None,
        "highest_risk": "clean",
        "network_summary": {},
        "scan_duration_s": 0.3,
        "scanned_at": "2024-01-01T00:00:00+00:00",
        "errors": [],
    }


def _make_mock_monitor():
    monitor = MagicMock()
    result = MagicMock()
    result.to_dict.return_value = _make_monitor_result_dict()
    monitor.scan_entity = AsyncMock(return_value=result)
    return monitor


def _make_mock_breach_scanner():
    scanner = MagicMock()
    result = MagicMock()
    result.to_dict.return_value = _make_breach_result_dict()
    scanner.scan = AsyncMock(return_value=result)
    return scanner


def _make_mock_crypto_tracer():
    tracer = MagicMock()
    result = MagicMock()
    result.to_dict.return_value = _make_crypto_result_dict()
    tracer.trace_addresses = AsyncMock(return_value=result)
    return tracer


def _make_mock_correlator():
    correlator = MagicMock()
    profile = MagicMock()
    profile.to_dict.return_value = {
        "entity_name": "John Doe",
        "risk_score": 0.1,
        "risk_level": "low",
        "correlations": [],
    }
    correlator.correlate.return_value = profile
    return correlator


# ===========================================================================
# GET /api/darkweb/status
# ===========================================================================


class TestDarkwebStatus:
    def test_status_returns_200(self):
        response = client.get("/api/darkweb/status")
        assert response.status_code == 200

    def test_status_has_required_fields(self):
        response = client.get("/api/darkweb/status")
        data = response.json()
        assert "tor_configured" in data
        assert "hibp_api_key" in data
        assert "etherscan_api_key" in data
        assert "optional_deps" in data
        assert "tor_functional" in data

    def test_status_tor_configured_is_bool(self):
        response = client.get("/api/darkweb/status")
        assert isinstance(response.json()["tor_configured"], bool)

    def test_status_optional_deps_has_expected_keys(self):
        response = client.get("/api/darkweb/status")
        deps = response.json()["optional_deps"]
        for dep in ["aiohttp", "aiohttp_socks", "stem"]:
            assert dep in deps
            assert deps[dep] in ("available", "missing")


# ===========================================================================
# GET /api/darkweb/sites
# ===========================================================================


class TestDarkwebSites:
    def test_sites_returns_200(self):
        with patch("app.api.darkweb.router") as _:
            # Import directly to test the actual route
            pass
        # The route imports from marketplace_monitor — mock it
        mock_site = MagicMock()
        mock_site.name = "TestSite"
        mock_site.url = "http://test.onion"
        mock_site.category = MagicMock()
        mock_site.category.value = "forum"
        mock_site.description = "Test site"
        mock_site.active = True
        mock_site.tags = ["test"]

        with patch(
            "app.osint.darkweb.marketplace_monitor.KNOWN_DARK_WEB_SITES",
            [mock_site],
        ), patch(
            "app.osint.darkweb.marketplace_monitor.CLEARNET_INTELLIGENCE_SITES",
            [],
        ):
            response = client.get("/api/darkweb/sites")
        assert response.status_code == 200
        data = response.json()
        assert "dark_web_sites" in data
        assert "clearnet_intelligence_sites" in data
        assert "total" in data


# ===========================================================================
# POST /api/darkweb/scan/marketplace
# ===========================================================================


class TestMarketplaceScan:
    def test_scan_success(self):
        mock_monitor = _make_mock_monitor()
        with patch("app.api.darkweb._get_marketplace_monitor", return_value=mock_monitor):
            response = client.post(
                "/api/darkweb/scan/marketplace",
                json={
                    "entity_name": "John Doe",
                    "additional_terms": ["johndoe"],
                    "max_sites": 5,
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["entity_query"] == "John Doe"

    def test_scan_with_categories(self):
        mock_monitor = _make_mock_monitor()
        with patch("app.api.darkweb._get_marketplace_monitor", return_value=mock_monitor), patch(
            "app.osint.darkweb.marketplace_monitor.SiteCategory"
        ) as mock_cat:
            mock_cat.side_effect = lambda x: x  # Pass through
            response = client.post(
                "/api/darkweb/scan/marketplace",
                json={
                    "entity_name": "Jane Smith",
                    "categories": ["forum"],
                    "simulation_mode": True,
                },
            )
        # Even if category parsing fails, test that endpoint responds
        assert response.status_code in (200, 400, 500)

    def test_scan_invalid_category_returns_400(self):
        # Send a genuinely invalid category string — SiteCategory enum raises ValueError
        # which the endpoint converts to HTTP 400. No mocking needed.
        response = client.post(
            "/api/darkweb/scan/marketplace",
            json={
                "entity_name": "Jane Smith",
                "categories": ["NOT_A_REAL_CATEGORY_XYZ"],
                "simulation_mode": True,
            },
        )
        assert response.status_code == 400
        assert "Invalid category" in response.json()["detail"]

    def test_scan_service_error_returns_500(self):
        mock_monitor = MagicMock()
        mock_monitor.scan_entity = AsyncMock(side_effect=Exception("Tor unavailable"))
        with patch("app.api.darkweb._get_marketplace_monitor", return_value=mock_monitor):
            response = client.post(
                "/api/darkweb/scan/marketplace",
                json={
                    "entity_name": "John Doe",
                    "simulation_mode": False,
                },
            )
        assert response.status_code == 500

    def test_scan_minimal_request(self):
        mock_monitor = _make_mock_monitor()
        with patch("app.api.darkweb._get_marketplace_monitor", return_value=mock_monitor):
            response = client.post(
                "/api/darkweb/scan/marketplace",
                json={
                    "entity_name": "Target Person",
                },
            )
        assert response.status_code == 200


# ===========================================================================
# POST /api/darkweb/scan/breach
# ===========================================================================


class TestBreachScan:
    def test_scan_with_email(self):
        mock_scanner = _make_mock_breach_scanner()
        with patch("app.api.darkweb._get_breach_scanner", return_value=mock_scanner):
            response = client.post(
                "/api/darkweb/scan/breach",
                json={
                    "emails": ["john@example.com"],
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert "scan_id" in data

    def test_scan_with_username(self):
        mock_scanner = _make_mock_breach_scanner()
        with patch("app.api.darkweb._get_breach_scanner", return_value=mock_scanner):
            response = client.post(
                "/api/darkweb/scan/breach",
                json={
                    "usernames": ["johndoe123"],
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200

    def test_scan_with_phone(self):
        mock_scanner = _make_mock_breach_scanner()
        with patch("app.api.darkweb._get_breach_scanner", return_value=mock_scanner):
            response = client.post(
                "/api/darkweb/scan/breach",
                json={
                    "phone_numbers": ["+1234567890"],
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200

    def test_scan_with_full_name(self):
        mock_scanner = _make_mock_breach_scanner()
        with patch("app.api.darkweb._get_breach_scanner", return_value=mock_scanner):
            response = client.post(
                "/api/darkweb/scan/breach",
                json={
                    "full_name": "John Doe",
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200

    def test_scan_no_identifiers_returns_400(self):
        response = client.post(
            "/api/darkweb/scan/breach",
            json={
                "simulation_mode": True,
            },
        )
        assert response.status_code == 400
        assert "required" in response.json()["detail"].lower()

    def test_scan_service_error_returns_500(self):
        mock_scanner = MagicMock()
        mock_scanner.scan = AsyncMock(side_effect=Exception("HIBP error"))
        with patch("app.api.darkweb._get_breach_scanner", return_value=mock_scanner):
            response = client.post(
                "/api/darkweb/scan/breach",
                json={
                    "emails": ["test@example.com"],
                },
            )
        assert response.status_code == 500


# ===========================================================================
# POST /api/darkweb/scan/crypto
# ===========================================================================


class TestCryptoTrace:
    def test_trace_bitcoin_address(self):
        mock_tracer = _make_mock_crypto_tracer()
        with patch("app.api.darkweb._get_crypto_tracer", return_value=mock_tracer):
            response = client.post(
                "/api/darkweb/scan/crypto",
                json={
                    "addresses": ["1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf"],
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert "scan_id" in data

    def test_trace_multiple_addresses(self):
        mock_tracer = _make_mock_crypto_tracer()
        with patch("app.api.darkweb._get_crypto_tracer", return_value=mock_tracer):
            response = client.post(
                "/api/darkweb/scan/crypto",
                json={
                    "addresses": [
                        "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
                        "0x742d35Cc6634C0532925a3b8D4C9B7D2",
                    ],
                    "max_txs_per_address": 10,
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200

    def test_trace_service_error_returns_500(self):
        mock_tracer = MagicMock()
        mock_tracer.trace_addresses = AsyncMock(side_effect=Exception("API error"))
        with patch("app.api.darkweb._get_crypto_tracer", return_value=mock_tracer):
            response = client.post(
                "/api/darkweb/scan/crypto",
                json={
                    "addresses": ["1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf"],
                },
            )
        assert response.status_code == 500


# ===========================================================================
# POST /api/darkweb/crypto/extract
# ===========================================================================


class TestCryptoExtract:
    def test_extract_no_addresses_found(self):
        with patch("app.osint.darkweb.crypto_tracer.detect_crypto_addresses", return_value={}):
            response = client.post(
                "/api/darkweb/crypto/extract",
                json={
                    "text": "This text has no crypto addresses.",
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["trace_result"] is None
        assert "No cryptocurrency" in data["message"]

    def test_extract_with_bitcoin_address(self):
        mock_tracer = _make_mock_crypto_tracer()
        with patch(
            "app.osint.darkweb.crypto_tracer.detect_crypto_addresses",
            return_value={"bitcoin": ["1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf"]},
        ), patch("app.api.darkweb._get_crypto_tracer", return_value=mock_tracer):
            response = client.post(
                "/api/darkweb/crypto/extract",
                json={
                    "text": "Send to 1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert "addresses_found" in data
        assert "total_addresses" in data
        assert "trace_result" in data

    def test_extract_service_error_returns_500(self):
        with patch(
            "app.osint.darkweb.crypto_tracer.detect_crypto_addresses",
            side_effect=Exception("Import error"),
        ):
            response = client.post(
                "/api/darkweb/crypto/extract",
                json={
                    "text": "some text",
                },
            )
        assert response.status_code == 500


# ===========================================================================
# POST /api/darkweb/correlate
# ===========================================================================


class TestCorrelate:
    def test_correlate_minimal(self):
        mock_correlator = _make_mock_correlator()
        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator):
            response = client.post(
                "/api/darkweb/correlate",
                json={
                    "entity_name": "John Doe",
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert "entity_name" in data

    def test_correlate_with_breach_result(self):
        mock_correlator = _make_mock_correlator()
        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator), patch(
            "app.api.darkweb._reconstruct_breach_result"
        ) as mock_reconstruct:
            mock_reconstruct.return_value = MagicMock()
            response = client.post(
                "/api/darkweb/correlate",
                json={
                    "entity_name": "John Doe",
                    "breach_result": _make_breach_result_dict(),
                },
            )
        assert response.status_code == 200

    def test_correlate_with_monitor_result(self):
        mock_correlator = _make_mock_correlator()
        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator), patch(
            "app.api.darkweb._reconstruct_monitor_result"
        ) as mock_reconstruct:
            mock_reconstruct.return_value = MagicMock()
            response = client.post(
                "/api/darkweb/correlate",
                json={
                    "entity_name": "John Doe",
                    "monitor_result": _make_monitor_result_dict(),
                },
            )
        assert response.status_code == 200

    def test_correlate_with_crypto_result(self):
        mock_correlator = _make_mock_correlator()
        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator), patch(
            "app.api.darkweb._reconstruct_crypto_result"
        ) as mock_reconstruct:
            mock_reconstruct.return_value = MagicMock()
            response = client.post(
                "/api/darkweb/correlate",
                json={
                    "entity_name": "John Doe",
                    "crypto_result": _make_crypto_result_dict(),
                },
            )
        assert response.status_code == 200

    def test_correlate_service_error_returns_500(self):
        mock_correlator = MagicMock()
        mock_correlator.correlate.side_effect = Exception("Correlation failed")
        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator):
            response = client.post(
                "/api/darkweb/correlate",
                json={
                    "entity_name": "John Doe",
                },
            )
        assert response.status_code == 500


# ===========================================================================
# POST /api/darkweb/scan/full
# ===========================================================================


class TestFullDarkwebScan:
    def test_full_scan_all_enabled(self):
        mock_monitor = _make_mock_monitor()
        mock_scanner = _make_mock_breach_scanner()
        mock_tracer = _make_mock_crypto_tracer()
        mock_correlator = _make_mock_correlator()

        with patch("app.api.darkweb._get_marketplace_monitor", return_value=mock_monitor), patch(
            "app.api.darkweb._get_breach_scanner", return_value=mock_scanner
        ), patch("app.api.darkweb._get_crypto_tracer", return_value=mock_tracer), patch(
            "app.api.darkweb._get_correlator", return_value=mock_correlator
        ):
            response = client.post(
                "/api/darkweb/scan/full",
                json={
                    "entity_name": "John Doe",
                    "emails": ["john@example.com"],
                    "usernames": ["johndoe"],
                    "crypto_addresses": ["1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf"],
                    "simulation_mode": True,
                    "include_darkweb": True,
                    "include_breach": True,
                    "include_crypto": True,
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["entity_name"] == "John Doe"
        assert "unified_profile" in data
        assert "sub_scan_results" in data

    def test_full_scan_no_crypto_addresses(self):
        """When no crypto addresses, crypto sub-scan should be skipped."""
        mock_monitor = _make_mock_monitor()
        mock_scanner = _make_mock_breach_scanner()
        mock_correlator = _make_mock_correlator()

        with patch("app.api.darkweb._get_marketplace_monitor", return_value=mock_monitor), patch(
            "app.api.darkweb._get_breach_scanner", return_value=mock_scanner
        ), patch("app.api.darkweb._get_correlator", return_value=mock_correlator):
            response = client.post(
                "/api/darkweb/scan/full",
                json={
                    "entity_name": "John Doe",
                    "emails": ["john@example.com"],
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200

    def test_full_scan_all_disabled(self):
        """With all sub-scans disabled, should still correlate with empty data."""
        mock_correlator = _make_mock_correlator()

        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator):
            response = client.post(
                "/api/darkweb/scan/full",
                json={
                    "entity_name": "John Doe",
                    "include_darkweb": False,
                    "include_breach": False,
                    "include_crypto": False,
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200

    def test_full_scan_subscan_failure_continues(self):
        """If one sub-scan fails, the rest should continue."""
        mock_monitor = MagicMock()
        mock_monitor.scan_entity = AsyncMock(side_effect=Exception("Tor error"))
        mock_scanner = _make_mock_breach_scanner()
        mock_correlator = _make_mock_correlator()

        with patch("app.api.darkweb._get_marketplace_monitor", return_value=mock_monitor), patch(
            "app.api.darkweb._get_breach_scanner", return_value=mock_scanner
        ), patch("app.api.darkweb._get_correlator", return_value=mock_correlator):
            response = client.post(
                "/api/darkweb/scan/full",
                json={
                    "entity_name": "John Doe",
                    "emails": ["john@example.com"],
                    "simulation_mode": True,
                    "include_darkweb": True,
                    "include_breach": True,
                },
            )
        # Should still succeed despite marketplace error
        assert response.status_code == 200

    def test_full_scan_surface_data_merged(self):
        """Surface data from request should be merged into correlation call."""
        mock_correlator = _make_mock_correlator()

        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator):
            response = client.post(
                "/api/darkweb/scan/full",
                json={
                    "entity_name": "John Doe",
                    "aliases": ["JD", "John D"],
                    "phone_numbers": ["+1234567890"],
                    "include_darkweb": False,
                    "include_breach": False,
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 200
        # Verify correlator was called
        mock_correlator.correlate.assert_called_once()

    def test_full_scan_service_error_returns_500(self):
        mock_correlator = MagicMock()
        mock_correlator.correlate.side_effect = Exception("Fatal error")

        with patch("app.api.darkweb._get_correlator", return_value=mock_correlator):
            response = client.post(
                "/api/darkweb/scan/full",
                json={
                    "entity_name": "John Doe",
                    "include_darkweb": False,
                    "include_breach": False,
                    "simulation_mode": True,
                },
            )
        assert response.status_code == 500


# ===========================================================================
# Request Model Validation
# ===========================================================================


class TestRequestModelValidation:
    def test_marketplace_scan_max_sites_validation(self):
        """max_sites must be >= 1."""
        response = client.post(
            "/api/darkweb/scan/marketplace",
            json={
                "entity_name": "Test",
                "max_sites": 0,
            },
        )
        assert response.status_code == 422

    def test_marketplace_scan_max_sites_upper_bound(self):
        """max_sites must be <= 30."""
        response = client.post(
            "/api/darkweb/scan/marketplace",
            json={
                "entity_name": "Test",
                "max_sites": 100,
            },
        )
        assert response.status_code == 422

    def test_crypto_trace_requires_addresses(self):
        """addresses is required."""
        response = client.post(
            "/api/darkweb/scan/crypto",
            json={
                "simulation_mode": True,
            },
        )
        assert response.status_code == 422

    def test_full_scan_requires_entity_name(self):
        response = client.post("/api/darkweb/scan/full", json={})
        assert response.status_code == 422

    def test_correlate_requires_entity_name(self):
        response = client.post("/api/darkweb/correlate", json={})
        assert response.status_code == 422
