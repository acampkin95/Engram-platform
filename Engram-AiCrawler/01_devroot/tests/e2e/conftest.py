"""
E2E test infrastructure for Crawl4AI OSINT API.

Provides shared fixtures:
- `app_client`: TestClient with all external dependencies mocked
  (Redis, ChromaDB, LM Studio, auth disabled, rate limit disabled)
- `auth_client`: TestClient with auth enabled and a pre-signed JWT
- `mock_crawl_result`: Reusable successful crawl result mock
"""

import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

# Python 3.9+ compatibility for UTC timezone
from app._compat import UTC

# ---------------------------------------------------------------------------
# Shared mock factories
# ---------------------------------------------------------------------------


def _make_disabled_auth_config():
    """Return a ClerkConfig mock with auth disabled."""
    from app.config.auth import ClerkConfig

    cfg = MagicMock(spec=ClerkConfig)
    cfg.auth_enabled = False
    cfg.protected_routes_enabled = False
    cfg.admin_users = []
    return cfg


def _make_enabled_auth_config(public_key: str):
    """Return a ClerkConfig mock with auth enabled and a given public key."""
    from app.config.auth import ClerkConfig

    cfg = MagicMock(spec=ClerkConfig)
    cfg.auth_enabled = True
    cfg.protected_routes_enabled = True
    cfg.jwt_key = public_key
    cfg.issuer = "https://test.clerk.com"
    cfg.audience = "test-app"
    cfg.admin_users = ["admin@test.com"]
    return cfg


# ---------------------------------------------------------------------------
# Core app client (all dependencies mocked, auth disabled)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="package")
def _base_patches():
    """
    Package-scoped patch context that mocks all external I/O.
    Scoped to the tests/e2e/ package so it tears down before other test
    modules run, preventing cross-test pollution.
    - Redis / rate limiter
    - ChromaDB
    - LM Studio
    - Auth (disabled)
    """
    disabled_auth = _make_disabled_auth_config()

    with (
        patch("app.middleware.rate_limit._config.rate_limit_enabled", False),
        patch("app.config.auth.get_clerk_config", return_value=disabled_auth),
        patch("app.config.get_clerk_config", return_value=disabled_auth),
        patch("app.api.crawl.get_clerk_config", return_value=disabled_auth),
        patch("app.api.data.get_clerk_config", return_value=disabled_auth),
        patch("app.api.chat.get_clerk_config", return_value=disabled_auth),
        patch(
            "app.services.lm_studio_bridge.check_lm_studio_connection",
            return_value="connected",
        ),
    ):
        yield


@pytest.fixture(scope="package")
def app_client(_base_patches):
    """
    Package-scoped TestClient with all external dependencies mocked.
    Safe to use for read-only E2E tests that don't mutate global state.
    """
    from app.main import app

    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def fresh_app_client(_base_patches):
    """
    Function-scoped TestClient — use when tests mutate crawl_jobs or other
    module-level state and need isolation.
    """
    from app.main import app
    from app.services.job_store import get_job_store

    crawl_store = get_job_store("crawl_jobs")
    asyncio.run(crawl_store.clear())
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Auth-enabled client with real JWT
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def _rsa_key_pair():
    """Generate a real RSA key pair once per session."""
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization

    private_key_obj = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key_obj.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = (
        private_key_obj.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem


@pytest.fixture
def auth_headers(_rsa_key_pair):
    """
    Returns HTTP headers dict with a valid Bearer JWT for a regular user.
    Patch get_clerk_config at the call site when using this fixture.
    """
    import jwt
    from datetime import datetime, timedelta

    private_pem, _ = _rsa_key_pair
    payload = {
        "sub": "user_e2e_test",
        "email": "e2e@test.com",
        "iss": "https://test.clerk.com",
        "aud": "test-app",
        "iat": int(datetime.now(tz=UTC).timestamp()),
        "exp": int((datetime.now(tz=UTC) + timedelta(hours=1)).timestamp()),
    }
    token = jwt.encode(payload, private_pem, algorithm="RS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(_rsa_key_pair):
    """Returns HTTP headers dict with a valid Bearer JWT for an admin user."""
    import jwt
    from datetime import datetime, timedelta

    private_pem, _ = _rsa_key_pair
    payload = {
        "sub": "admin_e2e_test",
        "email": "admin@test.com",
        "iss": "https://test.clerk.com",
        "aud": "test-app",
        "iat": int(datetime.now(tz=UTC).timestamp()),
        "exp": int((datetime.now(tz=UTC) + timedelta(hours=1)).timestamp()),
    }
    token = jwt.encode(payload, private_pem, algorithm="RS256")
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Mock crawl result
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_crawl_result():
    """A reusable successful AsyncWebCrawler result mock."""
    result = MagicMock()
    result.success = True
    result.markdown = "# Test Page\n\nSome content here."
    result.html = "<html><body><h1>Test</h1></body></html>"
    result.extracted_content = None
    result.links = {"internal": ["https://example.com/page2"]}
    result.media = {}
    result.screenshot = None
    result.pdf = None
    result.error_message = None
    result.metadata = {"title": "Test Page"}
    return result


@pytest.fixture
def mock_crawler_context(mock_crawl_result):
    """
    Patches AsyncWebCrawler so crawl endpoints don't hit real browsers.
    Usage: `with mock_crawler_context: ...` or use as pytest fixture.
    """
    mock_instance = AsyncMock()
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=None)
    mock_instance.arun = AsyncMock(return_value=mock_crawl_result)

    with patch("app.api.crawl.AsyncWebCrawler", return_value=mock_instance) as mock:
        yield mock
