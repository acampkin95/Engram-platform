"""Tests for EmailOsintService.

Strategy:
- _validate_email and _get_domain are pure functions — test directly.
- _email_heuristic_reverse is sync — test directly.
- _mx_verify is tested with a mocked aiohttp session.
- _hibp_api_check / _hibp_keyless_check / _hunter_* are tested with
  mocked HTTP responses; we verify the response *shape*, not mock internals.
- bulk_check concurrency is tested with real async logic.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from contextlib import asynccontextmanager


from app.osint.email_osint_service import (
    EmailOsintService,
    _validate_email,
    _get_domain,
)
from app.models.osint import (
    BreachCheckResponse,
)
from app.core.exceptions import OsintServiceError, ProviderRateLimitError, ProviderUnavailableError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_mock_response(status=200, json_data=None):
    """Build a mock aiohttp response that works as an async context manager."""
    resp = MagicMock()
    resp.status = status
    resp.json = AsyncMock(return_value=json_data or {})
    resp.raise_for_status = MagicMock()
    resp.headers = {}

    @asynccontextmanager
    async def _ctx(*args, **kwargs):
        yield resp

    return resp, _ctx


def make_service(settings_overrides=None):
    """Return EmailOsintService with mocked settings (no API keys by default)."""
    settings = MagicMock()
    settings.hibp.has_api_key = False
    settings.hibp.base_url = "https://haveibeenpwned.com/api/v3"
    settings.hibp.api_key = None
    settings.hunter.has_api_key = False
    settings.hunter.base_url = "https://api.hunter.io/v2"
    settings.hunter.api_key = None

    if settings_overrides:
        for attr, val in settings_overrides.items():
            parts = attr.split(".")
            obj = settings
            for p in parts[:-1]:
                obj = getattr(obj, p)
            setattr(obj, parts[-1], val)

    with patch("app.osint.email_osint_service.get_osint_settings", return_value=settings):
        svc = EmailOsintService()
    return svc


# ---------------------------------------------------------------------------
# _validate_email (pure function)
# ---------------------------------------------------------------------------


class TestValidateEmail:
    def test_valid_email_is_returned_lowercased(self):
        assert _validate_email("User@Example.COM") == "user@example.com"

    def test_strips_whitespace(self):
        assert _validate_email("  alice@example.com  ") == "alice@example.com"

    def test_rejects_missing_at_sign(self):
        with pytest.raises(OsintServiceError):
            _validate_email("notanemail")

    def test_rejects_missing_domain(self):
        with pytest.raises(OsintServiceError):
            _validate_email("user@")

    def test_rejects_missing_local_part(self):
        with pytest.raises(OsintServiceError):
            _validate_email("@example.com")

    def test_rejects_empty_string(self):
        with pytest.raises(OsintServiceError):
            _validate_email("")

    def test_valid_email_with_plus_addressing(self):
        result = _validate_email("user+tag@example.com")
        assert result == "user+tag@example.com"


# ---------------------------------------------------------------------------
# _get_domain (pure function)
# ---------------------------------------------------------------------------


class TestGetDomain:
    def test_extracts_domain(self):
        assert _get_domain("alice@example.com") == "example.com"

    def test_extracts_subdomain(self):
        assert _get_domain("alice@mail.example.com") == "mail.example.com"


# ---------------------------------------------------------------------------
# _email_heuristic_reverse (sync method — no network)
# ---------------------------------------------------------------------------


class TestEmailHeuristicReverse:
    def _service(self):
        return make_service()

    def test_extracts_first_and_last_from_dot_pattern(self):
        svc = self._service()
        result = svc._email_heuristic_reverse("john.doe@company.com")
        assert result.first_name == "John"
        assert result.last_name == "Doe"

    def test_extracts_first_and_last_from_underscore_pattern(self):
        svc = self._service()
        result = svc._email_heuristic_reverse("john_doe@company.com")
        assert result.first_name == "John"
        assert result.last_name == "Doe"

    def test_no_name_parts_when_no_separator(self):
        svc = self._service()
        result = svc._email_heuristic_reverse("johndoe@company.com")
        assert result.first_name is None
        assert result.last_name is None

    def test_company_extracted_from_domain(self):
        svc = self._service()
        result = svc._email_heuristic_reverse("user@acme.com")
        assert result.company == "Acme"

    def test_no_company_for_free_providers(self):
        svc = self._service()
        for domain in ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]:
            result = svc._email_heuristic_reverse(f"user@{domain}")
            assert result.company is None, f"Expected no company for {domain}"

    def test_fallback_used_is_true(self):
        svc = self._service()
        result = svc._email_heuristic_reverse("user@company.com")
        assert result.fallback_used is True

    def test_email_preserved_in_result(self):
        svc = self._service()
        result = svc._email_heuristic_reverse("alice@example.com")
        assert result.email == "alice@example.com"


# ---------------------------------------------------------------------------
# _mx_verify (async, mocked session)
# ---------------------------------------------------------------------------


class TestMxVerify:
    @pytest.mark.asyncio
    async def test_mx_found_returns_deliverable_status(self):
        """When MX records exist for a non-disposable domain, status is deliverable."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False  # ensure _get_session() reuses it

        dns_response = MagicMock()
        dns_response.status = 200
        dns_response.json = AsyncMock(return_value={"Answer": [{"data": "mail.example.com"}]})

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield dns_response

        mock_session.get = mock_get
        svc._session = mock_session

        # Patch dns.resolver to raise ImportError so it uses the HTTP fallback
        with patch.dict("sys.modules", {"dns": None, "dns.resolver": None}):
            result = await svc._mx_verify("user@example.com")

        assert result.mx_found is True
        assert result.status == "deliverable"
        assert result.fallback_used is True

    @pytest.mark.asyncio
    async def test_no_mx_records_returns_unknown_status(self):
        """When no MX records found, status is unknown."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False  # ensure _get_session() reuses it

        dns_response = MagicMock()
        dns_response.status = 200
        dns_response.json = AsyncMock(return_value={"Answer": []})

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield dns_response

        mock_session.get = mock_get
        svc._session = mock_session

        with patch.dict("sys.modules", {"dns": None, "dns.resolver": None}):
            result = await svc._mx_verify("user@example.com")

        assert result.mx_found is False
        assert result.status == "unknown"

    @pytest.mark.asyncio
    async def test_disposable_domain_with_mx_is_risky(self):
        """A disposable domain with MX records gets 'risky' status."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        dns_response = MagicMock()
        dns_response.status = 200
        dns_response.json = AsyncMock(return_value={"Answer": [{"data": "mx.mailinator.com"}]})

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield dns_response

        mock_session.get = mock_get
        svc._session = mock_session

        with patch.dict("sys.modules", {"dns": None, "dns.resolver": None}):
            result = await svc._mx_verify("user@mailinator.com")

        assert result.disposable is True
        assert result.status == "risky"

    @pytest.mark.asyncio
    async def test_free_provider_flagged(self):
        """Gmail is flagged as a free provider."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        dns_response = MagicMock()
        dns_response.status = 200
        dns_response.json = AsyncMock(return_value={"Answer": []})

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield dns_response

        mock_session.get = mock_get
        svc._session = mock_session

        with patch.dict("sys.modules", {"dns": None, "dns.resolver": None}):
            result = await svc._mx_verify("alice@gmail.com")

        assert result.free_provider is True

    @pytest.mark.asyncio
    async def test_role_based_address_flagged(self):
        """admin@ is flagged as role-based."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        dns_response = MagicMock()
        dns_response.status = 200
        dns_response.json = AsyncMock(return_value={"Answer": []})

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield dns_response

        mock_session.get = mock_get
        svc._session = mock_session

        with patch.dict("sys.modules", {"dns": None, "dns.resolver": None}):
            result = await svc._mx_verify("admin@company.com")

        assert result.role_based is True


# ---------------------------------------------------------------------------
# _hibp_keyless_check (mocked HTTP)
# ---------------------------------------------------------------------------


class TestHibpKeylessCheck:
    @pytest.mark.asyncio
    async def test_returns_breached_when_domain_in_breach_list(self):
        """When the email's domain matches a breach, breached=True."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False  # prevent _get_session() from creating a real session

        breach_data = [
            {
                "Name": "ExampleBreach",
                "Title": "Example Breach",
                "Domain": "example.com",
                "BreachDate": "2020-01-01",
                "PwnCount": 1000000,
                "DataClasses": ["Email addresses", "Passwords"],
                "IsVerified": True,
            }
        ]

        resp = MagicMock()
        resp.status = 200
        resp.json = AsyncMock(return_value=breach_data)

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield resp

        mock_session.get = mock_get
        svc._session = mock_session

        result = await svc._hibp_keyless_check("alice@example.com")

        assert result.breached is True
        assert result.breach_count == 1
        assert result.fallback_used is True
        assert result.breaches[0].name == "ExampleBreach"

    @pytest.mark.asyncio
    async def test_returns_not_breached_when_domain_not_in_list(self):
        """When domain doesn't match any breach, breached=False."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        breach_data = [{"Name": "OtherBreach", "Domain": "other.com", "IsVerified": True}]

        resp = MagicMock()
        resp.status = 200
        resp.json = AsyncMock(return_value=breach_data)

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield resp

        mock_session.get = mock_get
        svc._session = mock_session

        result = await svc._hibp_keyless_check("alice@example.com")

        assert result.breached is False
        assert result.breach_count == 0

    @pytest.mark.asyncio
    async def test_returns_safe_result_on_http_error(self):
        """On HTTP error, returns safe fallback (breached=False)."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        resp = MagicMock()
        resp.status = 503

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield resp

        mock_session.get = mock_get
        svc._session = mock_session

        result = await svc._hibp_keyless_check("alice@example.com")

        assert result.breached is False
        assert result.fallback_used is True


# ---------------------------------------------------------------------------
# _hibp_api_check (mocked HTTP with API key)
# ---------------------------------------------------------------------------


class TestHibpApiCheck:
    @pytest.mark.asyncio
    async def test_returns_breached_on_200(self):
        """200 response with breach data returns breached=True."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        breach_data = [
            {
                "Name": "Adobe",
                "Title": "Adobe",
                "Domain": "adobe.com",
                "BreachDate": "2013-10-04",
                "AddedDate": "2013-12-04",
                "PwnCount": 152445165,
                "DataClasses": ["Email addresses", "Password hints"],
                "Description": "In October 2013...",
                "IsVerified": True,
            }
        ]

        resp = MagicMock()
        resp.status = 200
        resp.json = AsyncMock(return_value=breach_data)
        resp.raise_for_status = MagicMock()
        resp.headers = {}

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield resp

        mock_session.get = mock_get
        svc._session = mock_session

        # Patch settings to have an API key
        svc._settings.hibp.api_key = "test-key"
        svc._settings.hibp.base_url = "https://haveibeenpwned.com/api/v3"

        result = await svc._hibp_api_check("alice@adobe.com")

        assert result.breached is True
        assert result.breach_count == 1
        assert result.fallback_used is False
        assert result.breaches[0].name == "Adobe"

    @pytest.mark.asyncio
    async def test_returns_not_breached_on_404(self):
        """404 means no breaches found."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        resp = MagicMock()
        resp.status = 404
        resp.headers = {}

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield resp

        mock_session.get = mock_get
        svc._session = mock_session

        svc._settings.hibp.api_key = "test-key"
        svc._settings.hibp.base_url = "https://haveibeenpwned.com/api/v3"

        result = await svc._hibp_api_check("clean@example.com")

        assert result.breached is False

    @pytest.mark.asyncio
    async def test_raises_rate_limit_error_on_429(self):
        """429 response raises ProviderRateLimitError."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        resp = MagicMock()
        resp.status = 429
        resp.headers = {"retry-after": "5"}

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield resp

        mock_session.get = mock_get
        svc._session = mock_session

        svc._settings.hibp.api_key = "test-key"
        svc._settings.hibp.base_url = "https://haveibeenpwned.com/api/v3"

        with pytest.raises(ProviderRateLimitError):
            await svc._hibp_api_check("alice@example.com")

    @pytest.mark.asyncio
    async def test_raises_provider_unavailable_on_401(self):
        """401 response raises ProviderUnavailableError."""
        svc = make_service()
        mock_session = MagicMock()
        mock_session.closed = False

        resp = MagicMock()
        resp.status = 401
        resp.headers = {}

        @asynccontextmanager
        async def mock_get(*args, **kwargs):
            yield resp

        mock_session.get = mock_get
        svc._session = mock_session

        svc._settings.hibp.api_key = "bad-key"
        svc._settings.hibp.base_url = "https://haveibeenpwned.com/api/v3"

        with pytest.raises(ProviderUnavailableError):
            await svc._hibp_api_check("alice@example.com")


# ---------------------------------------------------------------------------
# bulk_check
# ---------------------------------------------------------------------------


class TestBulkCheck:
    @pytest.mark.asyncio
    async def test_rejects_more_than_100_emails(self):
        """Raises OsintServiceError when more than 100 emails provided."""
        svc = make_service()
        emails = [f"user{i}@example.com" for i in range(101)]

        with pytest.raises(OsintServiceError, match="100"):
            await svc.bulk_check(emails)

    @pytest.mark.asyncio
    async def test_returns_result_for_each_email(self):
        """Returns one result per email in the input list."""
        svc = make_service()

        # Patch check_breach to return a safe result
        async def fake_check_breach(email):
            return BreachCheckResponse(email=email, breached=False)

        svc.check_breach = fake_check_breach

        emails = ["alice@example.com", "bob@example.com", "carol@example.com"]
        result = await svc.bulk_check(emails)

        assert result.total == 3
        assert len(result.results) == 3

    @pytest.mark.asyncio
    async def test_counts_breached_emails(self):
        """breached_count reflects number of breached emails."""
        svc = make_service()

        async def fake_check_breach(email):
            breached = "breached" in email
            return BreachCheckResponse(
                email=email, breached=breached, breach_count=1 if breached else 0
            )

        svc.check_breach = fake_check_breach

        emails = ["breached@example.com", "clean@example.com", "alsobreached@example.com"]
        result = await svc.bulk_check(emails)

        assert result.breached_count == 2

    @pytest.mark.asyncio
    async def test_invalid_email_recorded_as_error(self):
        """Invalid email addresses are recorded as errors, not exceptions."""
        svc = make_service()

        # check_breach for valid emails returns safely
        async def fake_check_breach(email):
            return BreachCheckResponse(email=email, breached=False)

        svc.check_breach = fake_check_breach

        emails = ["valid@example.com", "not-an-email"]
        result = await svc.bulk_check(emails)

        assert result.total == 2
        error_items = [r for r in result.results if r.error]
        assert len(error_items) == 1
        assert result.errors == 1

    @pytest.mark.asyncio
    async def test_exception_in_check_recorded_as_error(self):
        """Exception during check_breach is captured as error in item, not raised."""
        svc = make_service()

        async def failing_check(email):
            raise OsintServiceError("network failure")

        svc.check_breach = failing_check

        result = await svc.bulk_check(["alice@example.com"])

        assert result.total == 1
        assert result.results[0].error is not None
        assert result.errors == 1
