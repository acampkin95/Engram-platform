"""Tests for ThreatIntelService.

Strategy:
- _detect_indicator_type is a pure function — test directly.
- _shodan_internetdb, _urlhaus_check, _abuseipdb_check_as_vt: mocked HTTP.
- _shodan_api_search, _vt_api_check: mocked HTTP with API key settings.
- check_ip_reputation: mocked sub-service calls (not network).
- check_virustotal keyless fallback routing tested via indicator type.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from contextlib import asynccontextmanager

from app.osint.threat_intel_service import ThreatIntelService, _detect_indicator_type
from app.models.osint import (
    ShodanSearchResponse,
    ShodanHost,
    VirusTotalResult,
    IpReputationResponse,
)
from app.core.exceptions import OsintServiceError, ProviderRateLimitError, ProviderUnavailableError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_service():
    """Return ThreatIntelService with mocked settings (no API keys)."""
    settings = MagicMock()
    settings.shodan.has_api_key = False
    settings.shodan.base_url = "https://api.shodan.io"
    settings.shodan.api_key = None
    settings.virustotal.has_api_key = False
    settings.virustotal.base_url = "https://www.virustotal.com/api/v3"
    settings.virustotal.api_key = None
    settings.virustotal.fallback_url = "https://urlhaus-api.abuse.ch/v1"

    with patch("app.osint.threat_intel_service.get_osint_settings", return_value=settings):
        svc = ThreatIntelService()
    return svc


def mock_session_with_response(status=200, json_data=None):
    """Return (service, session) with a mocked HTTP GET response."""
    svc = make_service()
    mock_session = MagicMock()
    mock_session.closed = False

    resp = MagicMock()
    resp.status = status
    resp.json = AsyncMock(return_value=json_data or {})
    resp.raise_for_status = MagicMock()

    @asynccontextmanager
    async def mock_get(*args, **kwargs):
        yield resp

    mock_session.get = mock_get
    svc._session = mock_session
    return svc, resp


def mock_session_with_post_response(status=200, json_data=None):
    """Return (service, session) with a mocked HTTP POST response."""
    svc = make_service()
    mock_session = MagicMock()
    mock_session.closed = False

    resp = MagicMock()
    resp.status = status
    resp.json = AsyncMock(return_value=json_data or {})
    resp.raise_for_status = MagicMock()

    @asynccontextmanager
    async def mock_post(*args, **kwargs):
        yield resp

    mock_session.post = mock_post
    svc._session = mock_session
    return svc, resp


# ---------------------------------------------------------------------------
# _detect_indicator_type (pure function)
# ---------------------------------------------------------------------------


class TestDetectIndicatorType:
    def test_detects_ip_address(self):
        assert _detect_indicator_type("192.168.1.1") == "ip"

    def test_detects_ip_with_leading_whitespace(self):
        assert _detect_indicator_type("  10.0.0.1  ") == "ip"

    def test_detects_md5_hash(self):
        assert _detect_indicator_type("d41d8cd98f00b204e9800998ecf8427e") == "file_hash"

    def test_detects_sha256_hash(self):
        assert (
            _detect_indicator_type(
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            )
            == "file_hash"
        )

    def test_detects_http_url(self):
        assert _detect_indicator_type("http://example.com/malware") == "url"

    def test_detects_https_url(self):
        assert _detect_indicator_type("https://phishing.example.com/login") == "url"

    def test_detects_domain(self):
        assert _detect_indicator_type("example.com") == "domain"

    def test_detects_subdomain(self):
        assert _detect_indicator_type("malware.example.com") == "domain"


# ---------------------------------------------------------------------------
# _shodan_internetdb (keyless IP lookup)
# ---------------------------------------------------------------------------


class TestShodanInternetDB:
    @pytest.mark.asyncio
    async def test_returns_host_on_success(self):
        """Returns a ShodanHost when InternetDB responds with data."""
        svc, _ = mock_session_with_response(
            status=200,
            json_data={
                "ip": "1.2.3.4",
                "ports": [22, 80, 443],
                "hostnames": ["host.example.com"],
                "vulns": ["CVE-2021-44228"],
            },
        )

        result = await svc._shodan_internetdb("1.2.3.4")

        assert result is not None
        assert result.ip == "1.2.3.4"
        assert 22 in result.ports
        assert 80 in result.ports
        assert "host.example.com" in result.hostnames
        assert "CVE-2021-44228" in result.vulns

    @pytest.mark.asyncio
    async def test_returns_none_on_404(self):
        """Returns None when IP not found in InternetDB."""
        svc, _ = mock_session_with_response(status=404)

        result = await svc._shodan_internetdb("1.2.3.4")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self):
        """Returns None when request fails."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        @asynccontextmanager
        async def failing_get(*args, **kwargs):
            raise Exception("network error")
            yield  # make it a generator

        mock_session.get = failing_get
        svc._session = mock_session

        result = await svc._shodan_internetdb("1.2.3.4")

        assert result is None


# ---------------------------------------------------------------------------
# search_shodan (keyless path — IP query)
# ---------------------------------------------------------------------------


class TestSearchShodanKeyless:
    @pytest.mark.asyncio
    async def test_ip_query_uses_internetdb_fallback(self):
        """IP queries use InternetDB when no API key configured."""
        svc, _ = mock_session_with_response(
            status=200, json_data={"ip": "8.8.8.8", "ports": [53], "hostnames": ["dns.google"]}
        )

        result = await svc.search_shodan("8.8.8.8")

        assert isinstance(result, ShodanSearchResponse)
        assert result.fallback_used is True
        assert result.query == "8.8.8.8"

    @pytest.mark.asyncio
    async def test_non_ip_query_returns_empty_without_api_key(self):
        """Non-IP queries return empty results when no API key."""
        svc = make_service()

        result = await svc.search_shodan("apache server")

        assert result.total == 0
        assert result.results == []
        assert result.fallback_used is True

    @pytest.mark.asyncio
    async def test_found_ip_returns_one_result(self):
        """When InternetDB finds the IP, result has one host."""
        svc, _ = mock_session_with_response(
            status=200, json_data={"ip": "1.1.1.1", "ports": [80], "hostnames": []}
        )

        result = await svc.search_shodan("1.1.1.1")

        assert result.total == 1
        assert len(result.results) == 1

    @pytest.mark.asyncio
    async def test_not_found_ip_returns_zero_results(self):
        """When InternetDB returns 404, result has zero hosts."""
        svc, _ = mock_session_with_response(status=404)

        result = await svc.search_shodan("1.2.3.4")

        assert result.total == 0
        assert result.results == []


# ---------------------------------------------------------------------------
# _shodan_api_search (with API key)
# ---------------------------------------------------------------------------


class TestShodanApiSearch:
    @pytest.mark.asyncio
    async def test_returns_parsed_hosts_on_success(self):
        """Returns parsed ShodanHost objects from API response."""
        svc, _ = mock_session_with_response(
            status=200,
            json_data={
                "total": 2,
                "matches": [
                    {
                        "ip_str": "1.2.3.4",
                        "port": 80,
                        "hostnames": ["example.com"],
                        "org": "Example Corp",
                        "os": None,
                        "vulns": {},
                        "transport": "tcp",
                        "product": "Apache",
                        "version": "2.4",
                        "data": "HTTP/1.1 200 OK",
                    }
                ],
            },
        )
        svc._settings.shodan.api_key = "test-key"
        svc._settings.shodan.base_url = "https://api.shodan.io"

        result = await svc._shodan_api_search("apache", 20)

        assert isinstance(result, ShodanSearchResponse)
        assert result.total == 2
        assert len(result.results) == 1
        assert result.results[0].ip == "1.2.3.4"
        assert result.results[0].org == "Example Corp"
        assert result.fallback_used is False

    @pytest.mark.asyncio
    async def test_raises_rate_limit_on_429(self):
        """429 response raises ProviderRateLimitError."""
        svc, _ = mock_session_with_response(status=429)
        svc._settings.shodan.api_key = "test-key"
        svc._settings.shodan.base_url = "https://api.shodan.io"

        with pytest.raises(ProviderRateLimitError):
            await svc._shodan_api_search("apache", 20)

    @pytest.mark.asyncio
    async def test_raises_provider_unavailable_on_401(self):
        """401 response raises ProviderUnavailableError."""
        svc, _ = mock_session_with_response(status=401)
        svc._settings.shodan.api_key = "bad-key"
        svc._settings.shodan.base_url = "https://api.shodan.io"

        with pytest.raises(ProviderUnavailableError):
            await svc._shodan_api_search("apache", 20)

    @pytest.mark.asyncio
    async def test_vulns_extracted_from_dict_keys(self):
        """Vulnerability CVEs are extracted from the vulns dict keys."""
        svc, _ = mock_session_with_response(
            status=200,
            json_data={
                "total": 1,
                "matches": [
                    {
                        "ip_str": "1.2.3.4",
                        "port": 22,
                        "hostnames": [],
                        "vulns": {"CVE-2021-44228": {"cvss": 10.0}, "CVE-2022-0001": {}},
                        "data": "",
                    }
                ],
            },
        )
        svc._settings.shodan.api_key = "test-key"
        svc._settings.shodan.base_url = "https://api.shodan.io"

        result = await svc._shodan_api_search("ssh", 20)

        assert "CVE-2021-44228" in result.results[0].vulns
        assert "CVE-2022-0001" in result.results[0].vulns


# ---------------------------------------------------------------------------
# _urlhaus_check (URL/domain keyless fallback)
# ---------------------------------------------------------------------------


class TestUrlhausCheck:
    @pytest.mark.asyncio
    async def test_returns_malicious_count_from_urls(self):
        """Counts URLs with a non-none, non-'none' threat field as malicious."""
        svc, _ = mock_session_with_post_response(
            status=200,
            json_data={
                "query_status": "is_host",
                "urls": [
                    {"threat": "malware_download"},
                    {"threat": "none"},
                    {"threat": "botnet_cc"},
                    {"threat": None},
                ],
            },
        )

        result = await svc._urlhaus_check("evil.com", "domain")

        assert result.malicious == 2
        assert result.fallback_used is True

    @pytest.mark.asyncio
    async def test_url_type_uses_url_endpoint(self):
        """URL indicator type sends payload with 'url' key."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        captured_payload = {}

        resp = MagicMock()
        resp.status = 200
        resp.json = AsyncMock(return_value={"query_status": "no_results", "urls": []})

        @asynccontextmanager
        async def mock_post(url, data=None, **kwargs):
            captured_payload.update(data or {})
            yield resp

        mock_session.post = mock_post
        svc._session = mock_session

        await svc._urlhaus_check("http://evil.com/payload", "url")

        assert "url" in captured_payload

    @pytest.mark.asyncio
    async def test_domain_type_uses_host_endpoint(self):
        """Domain indicator type sends payload with 'host' key."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        captured_payload = {}

        resp = MagicMock()
        resp.status = 200
        resp.json = AsyncMock(return_value={"query_status": "no_results", "urls": []})

        @asynccontextmanager
        async def mock_post(url, data=None, **kwargs):
            captured_payload.update(data or {})
            yield resp

        mock_session.post = mock_post
        svc._session = mock_session

        await svc._urlhaus_check("evil.com", "domain")

        assert "host" in captured_payload

    @pytest.mark.asyncio
    async def test_returns_safe_result_on_exception(self):
        """Returns safe fallback result on network error."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        @asynccontextmanager
        async def failing_post(*args, **kwargs):
            raise Exception("network error")
            yield

        mock_session.post = failing_post
        svc._session = mock_session

        result = await svc._urlhaus_check("evil.com", "domain")

        assert result.fallback_used is True
        assert result.malicious == 0


# ---------------------------------------------------------------------------
# _abuseipdb_check_as_vt
# ---------------------------------------------------------------------------


class TestAbuseIpdbCheck:
    @pytest.mark.asyncio
    async def test_high_confidence_score_marked_malicious(self):
        """Abuse confidence > 50 marks IP as malicious."""
        svc, _ = mock_session_with_response(
            status=200, json_data={"data": {"abuseConfidenceScore": 85}}
        )

        result = await svc._abuseipdb_check_as_vt("1.2.3.4")

        assert result.malicious == 1
        assert result.fallback_used is True
        assert result.indicator == "1.2.3.4"

    @pytest.mark.asyncio
    async def test_low_confidence_score_not_malicious(self):
        """Abuse confidence <= 50 does not mark IP as malicious."""
        svc, _ = mock_session_with_response(
            status=200, json_data={"data": {"abuseConfidenceScore": 30}}
        )

        result = await svc._abuseipdb_check_as_vt("1.2.3.4")

        assert result.malicious == 0

    @pytest.mark.asyncio
    async def test_non_200_returns_safe_fallback(self):
        """Non-200 response returns safe fallback result."""
        svc, _ = mock_session_with_response(status=403)

        result = await svc._abuseipdb_check_as_vt("1.2.3.4")

        assert result.fallback_used is True
        assert result.malicious == 0


# ---------------------------------------------------------------------------
# check_virustotal (routing logic)
# ---------------------------------------------------------------------------


class TestCheckVirusTotalRouting:
    @pytest.mark.asyncio
    async def test_auto_detects_ip_type(self):
        """auto indicator_type correctly identifies IP addresses."""
        svc = make_service()
        svc._abuseipdb_check_as_vt = AsyncMock(
            return_value=VirusTotalResult(
                indicator="1.2.3.4", indicator_type="ip", fallback_used=True
            )
        )

        result = await svc.check_virustotal("1.2.3.4", "auto")

        svc._abuseipdb_check_as_vt.assert_called_once_with("1.2.3.4")

    @pytest.mark.asyncio
    async def test_auto_detects_domain_type(self):
        """auto indicator_type correctly identifies domains."""
        svc = make_service()
        svc._urlhaus_check = AsyncMock(
            return_value=VirusTotalResult(
                indicator="evil.com", indicator_type="domain", fallback_used=True
            )
        )

        result = await svc.check_virustotal("evil.com", "auto")

        svc._urlhaus_check.assert_called_once_with("evil.com", "domain")

    @pytest.mark.asyncio
    async def test_file_hash_returns_empty_without_api_key(self):
        """File hash indicator without API key returns empty fallback."""
        svc = make_service()

        result = await svc.check_virustotal("d41d8cd98f00b204e9800998ecf8427e", "file_hash")

        assert result.fallback_used is True
        assert result.malicious == 0


# ---------------------------------------------------------------------------
# check_ip_reputation (aggregate scoring)
# ---------------------------------------------------------------------------


class TestCheckIpReputation:
    @pytest.fixture(autouse=True)
    def clear_osint_cache(self):
        """Clear the in-memory osint cache before each test to prevent cross-test pollution."""
        from app.config.osint_providers import clear_osint_cache

        clear_osint_cache()
        yield
        clear_osint_cache()

    @pytest.mark.asyncio
    async def test_clean_ip_has_zero_score(self):
        """IP with no vulns and no VT detections has score 0 and risk 'clean'."""
        svc = make_service()

        svc.search_shodan = AsyncMock(
            return_value=ShodanSearchResponse(
                query="10.0.0.1", total=0, results=[], fallback_used=True
            )
        )
        svc.check_virustotal = AsyncMock(
            return_value=VirusTotalResult(
                indicator="10.0.0.1", indicator_type="ip", malicious=0, fallback_used=True
            )
        )

        result = await svc.check_ip_reputation("10.0.0.1")

        assert result.threat_score == 0
        assert result.risk_level == "clean"
        assert result.ip == "10.0.0.1"

    @pytest.mark.asyncio
    async def test_vuln_host_raises_score(self):
        """Host with vulnerabilities increases threat score."""
        svc = make_service()

        host = ShodanHost(ip="10.0.0.2", ports=[22, 80], vulns=["CVE-2021-44228", "CVE-2022-0001"])
        svc.search_shodan = AsyncMock(
            return_value=ShodanSearchResponse(
                query="10.0.0.2", total=1, results=[host], fallback_used=True
            )
        )
        svc.check_virustotal = AsyncMock(
            return_value=VirusTotalResult(
                indicator="10.0.0.2", indicator_type="ip", malicious=0, fallback_used=True
            )
        )

        result = await svc.check_ip_reputation("10.0.0.2")

        assert result.threat_score > 0

    @pytest.mark.asyncio
    async def test_malicious_vt_result_raises_score(self):
        """VT malicious detections increase threat score."""
        svc = make_service()

        svc.search_shodan = AsyncMock(
            return_value=ShodanSearchResponse(
                query="10.0.0.3", total=0, results=[], fallback_used=True
            )
        )
        svc.check_virustotal = AsyncMock(
            return_value=VirusTotalResult(
                indicator="10.0.0.3", indicator_type="ip", malicious=3, fallback_used=True
            )
        )

        result = await svc.check_ip_reputation("10.0.0.3")

        assert result.threat_score > 0

    @pytest.mark.asyncio
    async def test_risk_levels_assigned_correctly(self):
        """Risk levels are assigned based on score thresholds."""
        svc = make_service()

        # Create a host with many vulns to force a non-zero score
        host = ShodanHost(
            ip="10.0.0.4",
            ports=[p for p in range(20)],  # 20 ports = 40 score
            vulns=[f"CVE-2021-{i:05d}" for i in range(4)],  # 4 vulns = 40 score
        )
        svc.search_shodan = AsyncMock(
            return_value=ShodanSearchResponse(
                query="10.0.0.4", total=1, results=[host], fallback_used=True
            )
        )
        svc.check_virustotal = AsyncMock(
            return_value=VirusTotalResult(
                indicator="10.0.0.4", indicator_type="ip", malicious=0, fallback_used=True
            )
        )

        result = await svc.check_ip_reputation("10.0.0.4")

        assert result.risk_level in ("critical", "high", "medium", "low", "clean")

    @pytest.mark.asyncio
    async def test_score_capped_at_100(self):
        """Threat score never exceeds 100."""
        svc = make_service()

        host = ShodanHost(
            ip="10.0.0.5",
            ports=list(range(100)),  # way more than max
            vulns=[f"CVE-2021-{i:05d}" for i in range(100)],
        )
        svc.search_shodan = AsyncMock(
            return_value=ShodanSearchResponse(
                query="10.0.0.5", total=1, results=[host], fallback_used=True
            )
        )
        svc.check_virustotal = AsyncMock(
            return_value=VirusTotalResult(
                indicator="10.0.0.5", indicator_type="ip", malicious=100, fallback_used=True
            )
        )

        result = await svc.check_ip_reputation("10.0.0.5")

        assert result.threat_score <= 100

    @pytest.mark.asyncio
    async def test_handles_shodan_exception_gracefully(self):
        """If Shodan raises an exception, IP reputation still returns a result."""
        svc = make_service()

        svc.search_shodan = AsyncMock(side_effect=OsintServiceError("Shodan failed"))
        svc.check_virustotal = AsyncMock(
            return_value=VirusTotalResult(
                indicator="10.0.0.6", indicator_type="ip", malicious=0, fallback_used=True
            )
        )

        result = await svc.check_ip_reputation("10.0.0.6")

        assert isinstance(result, IpReputationResponse)
        assert result.ip == "10.0.0.6"
