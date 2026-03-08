"""Tests for app/api/osint/threat_intel.py — all 12 endpoints, happy + error paths."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.osint.threat_intel import router
from app.core.exceptions import (
    OsintServiceError,
    ProviderRateLimitError,
    ProviderUnavailableError,
)
from app.middleware import rate_limit as _rl_module

# ---------------------------------------------------------------------------
# App / client setup
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


def _mock_result(data: dict) -> MagicMock:
    """Return a MagicMock whose .model_dump() returns *data*."""
    m = MagicMock()
    m.model_dump.return_value = data
    return m


# ---------------------------------------------------------------------------
# Helpers — patch targets
# ---------------------------------------------------------------------------

_WHOIS_PATCH = "app.api.osint.threat_intel._get_whois_service"
_THREAT_PATCH = "app.api.osint.threat_intel._get_threat_service"
_EMAIL_PATCH = "app.api.osint.threat_intel._get_email_service"
_SETTINGS_PATCH = "app.api.osint.threat_intel.get_osint_settings"


# ===========================================================================
# POST /api/osint/whois/domain
# ===========================================================================


class TestWhoisDomain:
    def test_happy_path(self):
        result_data = {"domain": "example.com", "registrar": "Test Registrar"}
        mock_result = _mock_result(result_data)
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_domain = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/domain", json={"domain": "example.com"})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_osint_service_error(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_domain = AsyncMock(
                side_effect=OsintServiceError("not found", status_code=404)
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/domain", json={"domain": "bad.com"})
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"]

    def test_generic_exception_returns_500(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_domain = AsyncMock(side_effect=RuntimeError("boom"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/domain", json={"domain": "example.com"})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/whois/dns
# ===========================================================================


class TestWhoisDns:
    def test_happy_path_no_record_types(self):
        result_data = {"domain": "example.com", "records": {}}
        mock_result = _mock_result(result_data)
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_dns = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/dns", json={"domain": "example.com"})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_happy_path_with_record_types(self):
        result_data = {"domain": "example.com", "records": {"A": ["1.2.3.4"]}}
        mock_result = _mock_result(result_data)
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_dns = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/whois/dns",
                json={"domain": "example.com", "record_types": ["A", "MX"]},
            )
        assert resp.status_code == 200

    def test_osint_service_error(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_dns = AsyncMock(side_effect=OsintServiceError("dns error", status_code=422))
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/dns", json={"domain": "example.com"})
        assert resp.status_code == 422

    def test_generic_exception_returns_500(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_dns = AsyncMock(side_effect=Exception("network error"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/dns", json={"domain": "example.com"})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/whois/ip
# ===========================================================================


class TestWhoisIp:
    def test_happy_path(self):
        result_data = {"ip": "1.2.3.4", "country": "US"}
        mock_result = _mock_result(result_data)
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_ip = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/ip", json={"ip": "1.2.3.4"})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_osint_service_error(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_ip = AsyncMock(side_effect=OsintServiceError("ip error", status_code=400))
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/ip", json={"ip": "invalid"})
        assert resp.status_code == 400

    def test_generic_exception_returns_500(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_ip = AsyncMock(side_effect=ValueError("bad ip"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/ip", json={"ip": "1.2.3.4"})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/whois/asn  (query param)
# ===========================================================================


class TestWhoisAsn:
    def test_happy_path(self):
        asn_data = {"asn": "AS15169", "name": "Google LLC"}
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_asn = AsyncMock(return_value=asn_data)
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/asn?asn=AS15169")
        assert resp.status_code == 200
        assert resp.json() == asn_data

    def test_osint_service_error(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_asn = AsyncMock(
                side_effect=OsintServiceError("asn not found", status_code=404)
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/asn?asn=AS99999")
        assert resp.status_code == 404

    def test_generic_exception_returns_500(self):
        with patch(_WHOIS_PATCH) as mock_get:
            svc = MagicMock()
            svc.lookup_asn = AsyncMock(side_effect=ConnectionError("timeout"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/whois/asn?asn=AS15169")
        assert resp.status_code == 500

    def test_missing_asn_param_returns_422(self):
        resp = client.post("/api/osint/whois/asn")
        assert resp.status_code == 422


# ===========================================================================
# POST /api/osint/threat/shodan
# ===========================================================================


class TestThreatShodan:
    def test_happy_path(self):
        result_data = {"query": "apache", "total": 5, "matches": []}
        mock_result = _mock_result(result_data)
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.search_shodan = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/shodan", json={"query": "apache", "limit": 10})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_rate_limit_error_returns_429(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.search_shodan = AsyncMock(
                side_effect=ProviderRateLimitError(
                    "rate limited", provider="shodan", retry_after=60
                )
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/shodan", json={"query": "apache", "limit": 10})
        assert resp.status_code == 429

    def test_provider_unavailable_returns_503(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.search_shodan = AsyncMock(side_effect=ProviderUnavailableError("shodan down"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/shodan", json={"query": "apache", "limit": 10})
        assert resp.status_code == 503

    def test_osint_service_error(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.search_shodan = AsyncMock(
                side_effect=OsintServiceError("query error", status_code=400)
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/shodan", json={"query": "apache", "limit": 10})
        assert resp.status_code == 400

    def test_generic_exception_returns_500(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.search_shodan = AsyncMock(side_effect=RuntimeError("unexpected"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/shodan", json={"query": "apache", "limit": 10})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/threat/vt
# ===========================================================================


class TestThreatVirusTotal:
    def test_happy_path(self):
        result_data = {"indicator": "1.2.3.4", "malicious": 0}
        mock_result = _mock_result(result_data)
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_virustotal = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/threat/vt",
                json={"indicator": "1.2.3.4", "indicator_type": "ip"},
            )
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_rate_limit_error_returns_429(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_virustotal = AsyncMock(
                side_effect=ProviderRateLimitError("vt rate limit", provider="virustotal")
            )
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/threat/vt",
                json={"indicator": "1.2.3.4", "indicator_type": "ip"},
            )
        assert resp.status_code == 429

    def test_provider_unavailable_returns_503(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_virustotal = AsyncMock(side_effect=ProviderUnavailableError("vt unavailable"))
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/threat/vt",
                json={"indicator": "1.2.3.4", "indicator_type": "ip"},
            )
        assert resp.status_code == 503

    def test_osint_service_error(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_virustotal = AsyncMock(
                side_effect=OsintServiceError("vt error", status_code=422)
            )
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/threat/vt",
                json={"indicator": "bad", "indicator_type": "ip"},
            )
        assert resp.status_code == 422

    def test_generic_exception_returns_500(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_virustotal = AsyncMock(side_effect=Exception("crash"))
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/threat/vt",
                json={"indicator": "1.2.3.4", "indicator_type": "ip"},
            )
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/threat/ip-rep
# ===========================================================================


class TestThreatIpReputation:
    def test_happy_path(self):
        result_data = {"ip": "1.2.3.4", "reputation_score": 85}
        mock_result = _mock_result(result_data)
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_ip_reputation = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/ip-rep", json={"ip": "1.2.3.4"})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_osint_service_error(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_ip_reputation = AsyncMock(
                side_effect=OsintServiceError("ip rep error", status_code=400)
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/ip-rep", json={"ip": "invalid"})
        assert resp.status_code == 400

    def test_generic_exception_returns_500(self):
        with patch(_THREAT_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_ip_reputation = AsyncMock(side_effect=OSError("network"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/threat/ip-rep", json={"ip": "1.2.3.4"})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/email/breach
# ===========================================================================


class TestEmailBreach:
    def test_happy_path(self):
        result_data = {"email": "test@example.com", "breaches": []}
        mock_result = _mock_result(result_data)
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_breach = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/breach", json={"email": "test@example.com"})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_rate_limit_error_returns_429(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_breach = AsyncMock(
                side_effect=ProviderRateLimitError("hibp rate limit", provider="hibp")
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/breach", json={"email": "test@example.com"})
        assert resp.status_code == 429

    def test_provider_unavailable_returns_503(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_breach = AsyncMock(side_effect=ProviderUnavailableError("hibp unavailable"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/breach", json={"email": "test@example.com"})
        assert resp.status_code == 503

    def test_osint_service_error(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_breach = AsyncMock(
                side_effect=OsintServiceError("breach error", status_code=422)
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/breach", json={"email": "bad-email"})
        assert resp.status_code == 422

    def test_generic_exception_returns_500(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.check_breach = AsyncMock(side_effect=RuntimeError("crash"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/breach", json={"email": "test@example.com"})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/email/verify
# ===========================================================================


class TestEmailVerify:
    def test_happy_path(self):
        result_data = {"email": "test@example.com", "deliverable": True}
        mock_result = _mock_result(result_data)
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.verify_email = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/verify", json={"email": "test@example.com"})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_rate_limit_error_returns_429(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.verify_email = AsyncMock(
                side_effect=ProviderRateLimitError("hunter rate limit", provider="hunter")
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/verify", json={"email": "test@example.com"})
        assert resp.status_code == 429

    def test_osint_service_error(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.verify_email = AsyncMock(
                side_effect=OsintServiceError("verify error", status_code=400)
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/verify", json={"email": "bad@example.com"})
        assert resp.status_code == 400

    def test_generic_exception_returns_500(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.verify_email = AsyncMock(side_effect=Exception("timeout"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/verify", json={"email": "test@example.com"})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/email/reverse
# ===========================================================================


class TestEmailReverse:
    def test_happy_path(self):
        result_data = {"email": "test@example.com", "person": {"name": "John Doe"}}
        mock_result = _mock_result(result_data)
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.reverse_lookup = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/reverse", json={"email": "test@example.com"})
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_rate_limit_error_returns_429(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.reverse_lookup = AsyncMock(
                side_effect=ProviderRateLimitError("hunter rate limit", provider="hunter")
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/reverse", json={"email": "test@example.com"})
        assert resp.status_code == 429

    def test_osint_service_error(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.reverse_lookup = AsyncMock(
                side_effect=OsintServiceError("reverse error", status_code=404)
            )
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/reverse", json={"email": "unknown@example.com"})
        assert resp.status_code == 404

    def test_generic_exception_returns_500(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.reverse_lookup = AsyncMock(side_effect=RuntimeError("crash"))
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/reverse", json={"email": "test@example.com"})
        assert resp.status_code == 500


# ===========================================================================
# POST /api/osint/email/bulk
# ===========================================================================


class TestEmailBulk:
    def test_happy_path(self):
        result_data = {"results": [{"email": "a@b.com", "breaches": []}]}
        mock_result = _mock_result(result_data)
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.bulk_check = AsyncMock(return_value=mock_result)
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/email/bulk",
                json={"emails": ["a@b.com", "c@d.com"]},
            )
        assert resp.status_code == 200
        assert resp.json() == result_data

    def test_osint_service_error(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.bulk_check = AsyncMock(side_effect=OsintServiceError("bulk error", status_code=400))
            mock_get.return_value = svc
            resp = client.post("/api/osint/email/bulk", json={"emails": ["bad"]})
        assert resp.status_code == 400

    def test_generic_exception_returns_500(self):
        with patch(_EMAIL_PATCH) as mock_get:
            svc = MagicMock()
            svc.bulk_check = AsyncMock(side_effect=Exception("crash"))
            mock_get.return_value = svc
            resp = client.post(
                "/api/osint/email/bulk",
                json={"emails": ["a@b.com"]},
            )
        assert resp.status_code == 500


# ===========================================================================
# GET /api/osint/providers/status
# ===========================================================================


class TestProvidersStatus:
    def test_happy_path(self):
        status_data = {
            "shodan": {"configured": True, "healthy": True},
            "virustotal": {"configured": False, "healthy": False},
        }
        mock_settings = MagicMock()
        mock_settings.get_status.return_value = status_data
        with patch(_SETTINGS_PATCH, return_value=mock_settings):
            resp = client.get("/api/osint/providers/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["providers"] == status_data
        assert "timestamp" in body

    def test_timestamp_is_present(self):
        mock_settings = MagicMock()
        mock_settings.get_status.return_value = {}
        with patch(_SETTINGS_PATCH, return_value=mock_settings):
            resp = client.get("/api/osint/providers/status")
        assert resp.status_code == 200
        assert resp.json().get("timestamp") is not None
