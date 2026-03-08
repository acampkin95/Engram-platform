"""Tests for app/osint/whois_dns_service.py — WHOIS, DNS, IP, ASN lookups."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import OsintServiceError
from app.osint.whois_dns_service import (
    WhoisDnsService,
    _safe_str,
    _validate_domain,
    _validate_ip,
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _make_mock_session(response_data: dict, status: int = 200) -> MagicMock:
    """Create a mock aiohttp session that returns given JSON data."""
    mock_resp = AsyncMock()
    mock_resp.status = status
    mock_resp.json = AsyncMock(return_value=response_data)

    mock_ctx = MagicMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.closed = False
    mock_session.close = AsyncMock()
    mock_session.get.return_value = mock_ctx
    return mock_session


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------


class TestValidateDomain:
    def test_valid_domain(self):
        assert _validate_domain("example.com") == "example.com"

    def test_strips_trailing_dot(self):
        assert _validate_domain("example.com.") == "example.com"

    def test_lowercases(self):
        assert _validate_domain("EXAMPLE.COM") == "example.com"

    def test_strips_whitespace(self):
        assert _validate_domain("  example.com  ") == "example.com"

    def test_subdomain_valid(self):
        assert _validate_domain("sub.example.co.uk") == "sub.example.co.uk"

    def test_invalid_domain_raises(self):
        with pytest.raises(OsintServiceError):
            _validate_domain("not a domain!")

    def test_bare_hostname_raises(self):
        with pytest.raises(OsintServiceError):
            _validate_domain("localhost")


class TestValidateIp:
    def test_valid_ipv4(self):
        assert _validate_ip("192.168.1.1") == "192.168.1.1"

    def test_valid_ipv6(self):
        assert _validate_ip("::1") == "::1"

    def test_strips_whitespace(self):
        assert _validate_ip("  8.8.8.8  ") == "8.8.8.8"

    def test_invalid_ip_raises(self):
        with pytest.raises(OsintServiceError):
            _validate_ip("not-an-ip")


class TestSafeStr:
    def test_none_returns_none(self):
        assert _safe_str(None) is None

    def test_string_passthrough(self):
        assert _safe_str("hello") == "hello"

    def test_list_returns_first_element(self):
        assert _safe_str(["first", "second"]) == "first"

    def test_empty_list_returns_none(self):
        assert _safe_str([]) is None

    def test_datetime_returns_iso(self):
        from datetime import datetime

        dt = datetime(2024, 1, 15, 10, 30, 0)
        assert "2024" in _safe_str(dt)

    def test_int_returns_string(self):
        assert _safe_str(42) == "42"


# ---------------------------------------------------------------------------
# Init / session
# ---------------------------------------------------------------------------


class TestWhoisDnsServiceInit:
    def test_creates_instance(self):
        assert WhoisDnsService() is not None

    def test_session_initially_none(self):
        svc = WhoisDnsService(session=None)
        assert svc._session is None


class TestGetSession:
    @pytest.mark.asyncio
    async def test_creates_session_when_none(self):
        svc = WhoisDnsService()
        session = await svc._get_session()
        assert session is not None
        await svc.close()

    @pytest.mark.asyncio
    async def test_reuses_open_session(self):
        svc = WhoisDnsService()
        s1 = await svc._get_session()
        s2 = await svc._get_session()
        assert s1 is s2
        await svc.close()


class TestClose:
    @pytest.mark.asyncio
    async def test_close_with_no_session(self):
        svc = WhoisDnsService()
        await svc.close()  # no session — should be a no-op

    @pytest.mark.asyncio
    async def test_close_after_session_created(self):
        svc = WhoisDnsService()
        await svc._get_session()
        await svc.close()


# ---------------------------------------------------------------------------
# lookup_domain
# ---------------------------------------------------------------------------


class TestLookupDomain:
    @pytest.mark.asyncio
    async def test_invalid_domain_raises(self):
        svc = WhoisDnsService()
        with pytest.raises(OsintServiceError):
            await svc.lookup_domain("not-valid!")
        await svc.close()

    @pytest.mark.asyncio
    async def test_whois_via_library_called(self):
        svc = WhoisDnsService()
        mock_return = MagicMock(domain="example.com", registrar="R", fallback_used=False)
        with patch.object(
            svc, "_whois_via_library", new_callable=AsyncMock, return_value=mock_return
        ):
            result = await svc.lookup_domain("example.com")
            assert result.registrar == "R"
        await svc.close()

    @pytest.mark.asyncio
    async def test_library_fails_no_api_key_raises(self):
        from app.config import osint_providers as _cp
        from app.config.osint_providers import ProviderConfig

        _cp._cache.clear()  # prevent cache hit from earlier test
        svc = WhoisDnsService()
        # Patch the providers dict directly — whois is a property with no setter
        no_key_cfg = ProviderConfig(
            name="whois",
            api_key=None,
            base_url="",
            fallback_url="",
            cache_ttl_seconds=0,
            rate_limit_per_minute=0,
        )
        svc._settings.providers["whois"] = no_key_cfg
        with patch.object(
            svc, "_whois_via_library", new_callable=AsyncMock, side_effect=Exception("lib fail")
        ):
            with pytest.raises(OsintServiceError):
                await svc.lookup_domain("no-api-key-test.com")
        await svc.close()


# ---------------------------------------------------------------------------
# _whois_via_library
# ---------------------------------------------------------------------------


class TestWhoisViaLibrary:
    @pytest.mark.asyncio
    async def test_raises_when_whois_not_installed(self):
        svc = WhoisDnsService()
        with patch.dict("sys.modules", {"whois": None}):
            with pytest.raises((OsintServiceError, Exception)):
                await svc._whois_via_library("example.com")
        await svc.close()

    @pytest.mark.asyncio
    async def test_successful_library_call(self):
        mock_w = MagicMock()
        mock_w.registrar = "Some Registrar"
        mock_w.creation_date = "2010-01-01"
        mock_w.expiration_date = "2030-01-01"
        mock_w.updated_date = "2023-01-01"
        mock_w.name_servers = ["ns1.test.com"]
        mock_w.status = ["clientTransferProhibited"]
        mock_w.name = None
        mock_w.text = "raw whois text"

        mock_whois_module = MagicMock()
        mock_whois_module.whois.return_value = mock_w

        svc = WhoisDnsService()
        with patch.dict("sys.modules", {"whois": mock_whois_module}):
            result = await svc._whois_via_library("example.com")
            assert result.domain == "example.com"
            assert result.registrar == "Some Registrar"
            assert result.fallback_used is False
        await svc.close()

    @pytest.mark.asyncio
    async def test_name_servers_str_becomes_list(self):
        mock_w = MagicMock()
        mock_w.registrar = "R"
        mock_w.creation_date = None
        mock_w.expiration_date = None
        mock_w.updated_date = None
        mock_w.name_servers = "ns1.example.com"
        mock_w.status = []
        mock_w.name = None
        mock_w.text = ""

        mock_whois_module = MagicMock()
        mock_whois_module.whois.return_value = mock_w

        svc = WhoisDnsService()
        with patch.dict("sys.modules", {"whois": mock_whois_module}):
            result = await svc._whois_via_library("example.com")
            assert isinstance(result.name_servers, list)
        await svc.close()

    @pytest.mark.asyncio
    async def test_with_registrant_info(self):
        mock_w = MagicMock()
        mock_w.registrar = "R"
        mock_w.creation_date = None
        mock_w.expiration_date = None
        mock_w.updated_date = None
        mock_w.name_servers = []
        mock_w.status = []
        mock_w.name = "John Doe"
        mock_w.text = ""
        mock_w.org = "Acme Corp"
        mock_w.country = "US"
        mock_w.state = "CA"
        mock_w.city = "San Francisco"

        mock_whois_module = MagicMock()
        mock_whois_module.whois.return_value = mock_w

        svc = WhoisDnsService()
        with patch.dict("sys.modules", {"whois": mock_whois_module}):
            result = await svc._whois_via_library("example.com")
            assert result.registrant is not None
            assert result.registrant["name"] == "John Doe"
        await svc.close()


# ---------------------------------------------------------------------------
# lookup_dns
# ---------------------------------------------------------------------------


class TestLookupDns:
    @pytest.mark.asyncio
    async def test_invalid_domain_raises(self):
        svc = WhoisDnsService()
        with pytest.raises(OsintServiceError):
            await svc.lookup_dns("invalid!")
        await svc.close()

    @pytest.mark.asyncio
    async def test_valid_domain_uses_library_path(self):
        from app.config import osint_providers as _cp

        _cp._cache.clear()  # prevent cache contamination from other tests
        svc = WhoisDnsService()
        mock_response = MagicMock(domain="example.com", records=[], fallback_used=False)
        with patch.object(
            svc, "_dns_via_library", new_callable=AsyncMock, return_value=mock_response
        ) as mock_lib:
            await svc.lookup_dns("example.com")
            mock_lib.assert_called_once()
        await svc.close()

    @pytest.mark.asyncio
    async def test_library_failure_falls_back_to_google(self):
        from app.config import osint_providers as _cp

        _cp._cache.clear()  # prevent cache hit from earlier test
        svc = WhoisDnsService()
        mock_response = MagicMock(domain="example.com", records=[], fallback_used=True)
        with patch.object(
            svc, "_dns_via_library", new_callable=AsyncMock, side_effect=Exception("dns lib failed")
        ):
            with patch.object(
                svc, "_dns_via_google", new_callable=AsyncMock, return_value=mock_response
            ) as mock_google:
                await svc.lookup_dns("example.com")
                mock_google.assert_called_once()
        await svc.close()

    @pytest.mark.asyncio
    async def test_default_record_types_includes_a(self):
        from app.config import osint_providers as _cp

        _cp._cache.clear()  # prevent cache hit from earlier test
        svc = WhoisDnsService()
        captured_args = {}

        async def capture_dns_lib(domain, record_types):
            captured_args["record_types"] = record_types
            return MagicMock(domain=domain, records=[], fallback_used=False)

        with patch.object(svc, "_dns_via_library", side_effect=capture_dns_lib):
            await svc.lookup_dns("example.com")

        assert "A" in captured_args["record_types"]
        assert "MX" in captured_args["record_types"]
        await svc.close()


# ---------------------------------------------------------------------------
# _dns_via_library
# ---------------------------------------------------------------------------


class TestDnsViaLibrary:
    @pytest.mark.asyncio
    async def test_raises_when_dns_not_installed(self):
        svc = WhoisDnsService()
        with patch.dict("sys.modules", {"dns": None, "dns.resolver": None}):
            with pytest.raises((OsintServiceError, Exception)):
                await svc._dns_via_library("example.com", ["A"])
        await svc.close()


# ---------------------------------------------------------------------------
# lookup_ip
# ---------------------------------------------------------------------------


class TestLookupIp:
    @pytest.mark.asyncio
    async def test_invalid_ip_raises(self):
        svc = WhoisDnsService()
        with pytest.raises(OsintServiceError):
            await svc.lookup_ip("not-an-ip")
        await svc.close()

    @pytest.mark.asyncio
    async def test_successful_ip_lookup(self):
        response_data = {
            "status": "success",
            "country": "United States",
            "countryCode": "US",
            "regionName": "California",
            "city": "San Francisco",
            "lat": 37.77,
            "lon": -122.42,
            "isp": "Test ISP",
            "org": "Test Org",
            "as": "AS12345 Test AS",
            "asname": "TESTNET",
            "reverse": "test.example.com",
            "query": "1.2.3.4",
        }
        svc = WhoisDnsService()
        svc._session = _make_mock_session(response_data)
        result = await svc.lookup_ip("1.2.3.4")
        assert result.ip == "1.2.3.4"
        assert result.country == "United States"
        assert result.asn == "AS12345"

    @pytest.mark.asyncio
    async def test_ip_api_failure_status_raises(self):
        response_data = {"status": "fail", "message": "reserved range"}
        svc = WhoisDnsService()
        svc._session = _make_mock_session(response_data)
        with pytest.raises(OsintServiceError):
            await svc.lookup_ip("192.168.1.1")

    @pytest.mark.asyncio
    async def test_ip_no_asn_returns_none_asn(self):
        response_data = {
            "status": "success",
            "country": "US",
            "countryCode": "US",
            "regionName": "",
            "city": "",
            "lat": 0.0,
            "lon": 0.0,
            "isp": "",
            "org": "",
            "as": "",
            "asname": "",
            "reverse": "",
            "query": "10.0.0.1",
        }
        svc = WhoisDnsService()
        svc._session = _make_mock_session(response_data)
        result = await svc.lookup_ip("10.0.0.1")  # unique IP to avoid cache collision
        assert result.asn is None


# ---------------------------------------------------------------------------
# lookup_asn
# ---------------------------------------------------------------------------


class TestLookupAsn:
    @pytest.mark.asyncio
    async def test_prepends_as_if_missing(self):
        response_data = {
            "data": {
                "name": "TestNet",
                "description_short": "Test AS",
                "country_code": "US",
                "website": "https://test.net",
                "email_contacts": ["admin@test.net"],
                "looking_glass": None,
                "traffic_estimation": "medium",
                "rir_allocation": {},
            }
        }
        mock_session = _make_mock_session(response_data, status=200)
        svc = WhoisDnsService()
        svc._session = mock_session
        result = await svc.lookup_asn("15169")
        assert result["asn"] == 15169
        assert result["name"] == "TestNet"

    @pytest.mark.asyncio
    async def test_handles_as_prefix(self):
        response_data = {
            "data": {
                "name": "Google",
                "description_short": "G",
                "country_code": "US",
                "website": None,
                "email_contacts": [],
                "looking_glass": None,
                "traffic_estimation": None,
                "rir_allocation": {},
            }
        }
        mock_session = _make_mock_session(response_data, status=200)
        svc = WhoisDnsService()
        svc._session = mock_session
        result = await svc.lookup_asn("AS15169")
        assert result["asn"] == 15169

    @pytest.mark.asyncio
    async def test_non_200_raises_osint_error(self):
        mock_resp = AsyncMock()
        mock_resp.status = 404

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.closed = False
        mock_session.close = AsyncMock()
        mock_session.get.return_value = mock_ctx

        svc = WhoisDnsService()
        svc._session = mock_session

        with pytest.raises(OsintServiceError):
            await svc.lookup_asn("99999")
