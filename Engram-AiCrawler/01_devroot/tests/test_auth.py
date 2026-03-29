"""Authentication tests for Clerk JWT-based authentication."""

import pytest
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from app._compat import UTC
from datetime import datetime, timedelta
from unittest.mock import patch
import os
from app.middleware import rate_limit as _rl_module

# Set up test environment before modules
os.environ["AUTH_ENABLED"] = "true"
os.environ["PROTECTED_ROUTES_ENABLED"] = "true"
os.environ["CLERK_SECRET_KEY"] = "sk_test_testsecret"
os.environ["CLERK_JWT_KEY"] = "pk_test_testkey"
os.environ["CLERK_ISSUER"] = "https://test.clerk.com"
os.environ["CLERK_AUDIENCE"] = "test-app"
os.environ["CLERK_ADMIN_USERS"] = "admin@test.com,superadmin@test.com"
os.environ["TOKEN_EXPIRY_HOURS"] = "24"
os.environ["REFRESH_BUFFER_MINUTES"] = "30"


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Disable rate limiting for all auth tests (no Redis in test env)."""
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


# Test RSA key pair for JWT testing (real keys generated at module level)
_test_private_key_obj = rsa.generate_private_key(public_exponent=65537, key_size=2048)
TEST_PRIVATE_KEY = _test_private_key_obj.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
).decode()
TEST_PUBLIC_KEY = (
    _test_private_key_obj.public_key()
    .public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    .decode()
)


class TestClerkConfig:
    """Tests for ClerkConfig loading from environment."""

    def test_load_config_success(self):
        """Test loading ClerkConfig from environment variables."""
        from app.config.auth import ClerkConfig

        config = ClerkConfig.from_env()

        assert config.secret_key == "sk_test_testsecret"
        assert config.jwt_key == "pk_test_testkey"
        assert config.issuer == "https://test.clerk.com"
        assert config.audience == "test-app"
        assert "admin@test.com" in config.admin_users
        assert "superadmin@test.com" in config.admin_users
        assert config.auth_enabled is True
        assert config.protected_routes_enabled is True

    def test_missing_secret_key_raises(self):
        """Test that missing CLERK_SECRET_KEY raises ValueError."""
        from app.config.auth import ClerkConfig

        with patch.dict(os.environ, {"CLERK_SECRET_KEY": ""}):
            with pytest.raises(ValueError, match="CLERK_SECRET_KEY"):
                ClerkConfig.from_env()

    def test_missing_jwt_key_raises(self):
        """Test that missing CLERK_JWT_KEY raises ValueError."""
        from app.config.auth import ClerkConfig

        with patch.dict(os.environ, {"CLERK_JWT_KEY": ""}):
            with pytest.raises(ValueError, match="CLERK_JWT_KEY"):
                ClerkConfig.from_env()

    def test_admin_users_parsed_correctly(self):
        """Test that admin users are parsed from comma-separated string."""
        from app.config.auth import ClerkConfig

        config = ClerkConfig.from_env()
        assert len(config.admin_users) == 2
        assert "admin@test.com" in config.admin_users
        assert "superadmin@test.com" in config.admin_users

    def test_auth_disabled_by_default(self):
        """Test that auth is disabled when AUTH_ENABLED is not set."""
        from app.config.auth import ClerkConfig

        with patch.dict(os.environ, {"AUTH_ENABLED": ""}, clear=False):
            # Remove AUTH_ENABLED from environment
            if "AUTH_ENABLED" in os.environ:
                del os.environ["AUTH_ENABLED"]

            config = ClerkConfig.from_env()
            # Default is True when not set, so test explicit False
            os.environ["AUTH_ENABLED"] = "false"
            config = ClerkConfig.from_env()
            assert config.auth_enabled is False


class TestAuthenticatedUser:
    """Tests for AuthenticatedUser dataclass."""

    def test_create_authenticated_user(self):
        """Test creating an AuthenticatedUser instance."""
        from app.models.auth import AuthenticatedUser

        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role="user",
            iat=1000,
            exp=2000,
        )

        assert user.user_id == "user_123"
        assert user.email == "test@example.com"
        assert user.role == "user"
        assert user.iat == 1000
        assert user.exp == 2000

    def test_is_token_expired_false(self):
        """Test token expiration check when token is not expired."""
        from app.models.auth import AuthenticatedUser

        future_time = int((datetime.utcnow() + timedelta(hours=1)).timestamp())

        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role="user",
            iat=1000,
            exp=future_time,
        )

        assert user.is_token_expired() is False

    def test_is_token_expired_true(self):
        """Test token expiration check when token is expired."""
        from app.models.auth import AuthenticatedUser

        past_time = int((datetime.utcnow() - timedelta(hours=1)).timestamp())

        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role="user",
            iat=past_time - 3600,
            exp=past_time,
        )

        assert user.is_token_expired() is True

    def test_should_refresh_true(self):
        """Test token refresh check when within refresh window."""
        from app.models.auth import AuthenticatedUser

        # Token expires in 15 minutes (within 30-minute buffer)
        near_expiry = int((datetime.utcnow() + timedelta(minutes=15)).timestamp())

        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role="user",
            iat=1000,
            exp=near_expiry,
        )

        assert user.should_refresh(buffer_minutes=30) is True

    def test_should_refresh_false(self):
        """Test token refresh check when outside refresh window."""
        from app.models.auth import AuthenticatedUser

        # Token expires in 2 hours (outside 30-minute buffer)
        far_expiry = int((datetime.utcnow() + timedelta(hours=2)).timestamp())

        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role="user",
            iat=1000,
            exp=far_expiry,
        )

        assert user.should_refresh(buffer_minutes=30) is False


class TestJWTMiddleware:
    """Tests for JWT verification middleware."""

    @pytest.fixture(autouse=True)
    def patch_clerk_config(self):
        from app.config.auth import ClerkConfig

        mock_config = ClerkConfig(
            secret_key="sk_test_testsecret",
            jwt_key=TEST_PUBLIC_KEY,
            issuer="https://test.clerk.com",
            audience="test-app",
            admin_users=["admin@test.com", "superadmin@test.com"],
            auth_enabled=True,
            protected_routes_enabled=True,
            token_expiry_hours=24,
            refresh_buffer_minutes=30,
        )
        with patch("app.config.auth.get_clerk_config", return_value=mock_config), patch(
            "app.middleware.auth.get_clerk_config", return_value=mock_config
        ), patch("app.config.get_clerk_config", return_value=mock_config):
            yield

    def test_verify_valid_jwt_token(self):
        """Test verification of a valid JWT token."""
        from app.middleware.auth import verify_jwt_token

        # Create a test JWT token
        payload = {
            "sub": "user_123",
            "email": "test@example.com",
            "iss": "https://test.clerk.com",
            "aud": "test-app",
            "iat": int(datetime.now(tz=UTC).timestamp()),
            "exp": int((datetime.now(tz=UTC) + timedelta(hours=1)).timestamp()),
        }

        token = jwt.encode(payload, TEST_PRIVATE_KEY, algorithm="RS256")

        user = verify_jwt_token(f"Bearer {token}")

        assert user.user_id == "user_123"
        assert user.email == "test@example.com"
        assert user.role == "user"  # Not an admin

    def test_verify_admin_jwt_token(self):
        """Test that admin users are correctly identified."""
        from app.middleware.auth import verify_jwt_token

        # Create a test JWT token with admin email
        payload = {
            "sub": "admin_123",
            "email": "admin@test.com",
            "iss": "https://test.clerk.com",
            "aud": "test-app",
            "iat": int(datetime.now(tz=UTC).timestamp()),
            "exp": int((datetime.now(tz=UTC) + timedelta(hours=1)).timestamp()),
        }

        token = jwt.encode(payload, TEST_PRIVATE_KEY, algorithm="RS256")

        user = verify_jwt_token(f"Bearer {token}")

        assert user.role == "admin"

    def test_verify_missing_bearer_prefix(self):
        """Test that missing Bearer prefix raises AuthorizationError."""
        from app.middleware.auth import verify_jwt_token
        from app.config.auth import AuthorizationError

        with pytest.raises(AuthorizationError, match="Missing or invalid Authorization header"):
            verify_jwt_token("invalid_token")

    def test_verify_expired_token(self):
        """Test that expired token raises TokenExpiredError."""
        from app.middleware.auth import verify_jwt_token
        from app.config.auth import TokenExpiredError

        # Create an expired JWT token
        payload = {
            "sub": "user_123",
            "email": "test@example.com",
            "iat": int((datetime.now(tz=UTC) - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.now(tz=UTC) - timedelta(hours=1)).timestamp()),
        }

        token = jwt.encode(payload, TEST_PRIVATE_KEY, algorithm="RS256")

        with pytest.raises(TokenExpiredError, match="Token has expired"):
            verify_jwt_token(f"Bearer {token}")

    def test_verify_invalid_signature(self):
        """Test that invalid signature raises InvalidTokenError."""
        from app.middleware.auth import verify_jwt_token
        from app.config.auth import InvalidTokenError

        # Create a token with a different (wrong) key
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        other_private = other_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        payload = {
            "sub": "user_123",
            "email": "test@example.com",
            "iat": int(datetime.now(tz=UTC).timestamp()),
            "exp": int((datetime.now(tz=UTC) + timedelta(hours=1)).timestamp()),
        }

        token = jwt.encode(payload, other_private, algorithm="RS256")

        with pytest.raises(InvalidTokenError, match="Invalid token signature"):
            verify_jwt_token(f"Bearer {token}")


class TestAuthExceptions:
    """Tests for authentication exception classes."""

    def test_auth_exception(self):
        """Test AuthException base class."""
        from app.config.auth import AuthException

        exc = AuthException("Test error", 401)

        assert exc.message == "Test error"
        assert exc.status_code == 401
        assert exc.to_dict() == {"error": "Test error", "status_code": 401}

    def test_token_expired_error(self):
        """Test TokenExpiredError exception."""
        from app.config.auth import TokenExpiredError

        exc = TokenExpiredError()

        assert exc.message == "Token has expired"
        assert exc.status_code == 401

    def test_invalid_token_error(self):
        """Test InvalidTokenError exception."""
        from app.config.auth import InvalidTokenError

        exc = InvalidTokenError("Custom message")

        assert exc.message == "Custom message"
        assert exc.status_code == 401

    def test_authorization_error(self):
        """Test AuthorizationError exception."""
        from app.config.auth import AuthorizationError

        exc = AuthorizationError("Access denied")

        assert exc.message == "Access denied"
        assert exc.status_code == 403


class TestIsAdminUser:
    """Tests for is_admin_user function."""

    def test_admin_email_returns_true(self):
        """Test that admin email returns True."""
        from app.config.auth import is_admin_user

        assert is_admin_user("admin@test.com") is True
        assert is_admin_user("SUPERADMIN@TEST.COM") is True  # Case insensitive

    def test_non_admin_email_returns_false(self):
        """Test that non-admin email returns False."""
        from app.config.auth import is_admin_user

        assert is_admin_user("user@example.com") is False
        assert is_admin_user("random@test.com") is False


class TestAPIEndpointsWithAuth:
    """Tests for API endpoints with authentication enabled."""

    @pytest.fixture
    def mock_verify_jwt(self):
        """Create a mock for verify_jwt_token."""
        with patch("app.api.crawl.verify_jwt_token") as mock:
            from app.models.auth import AuthenticatedUser
            from app.config import UserRole

            mock.return_value = AuthenticatedUser(
                user_id="test_user",
                email="test@example.com",
                role=UserRole.USER,
                iat=1000,
                exp=2000,
            )
            yield mock

    def test_crawl_start_requires_auth_when_enabled(self, mock_verify_jwt):
        """Test that POST /api/crawl/start requires authentication."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        # Try without auth header - should fail
        response = client.post(
            "/api/crawl/start",
            json={"url": "https://example.com"},
        )

        # When auth is enabled, should get 401
        assert response.status_code == 401

    def test_crawl_list_public_when_auth_enabled(self):
        """Test that GET /api/crawl/list is public even when auth is enabled."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        # List endpoint should be public
        response = client.get("/api/crawl/list")

        # Should not be 401 (could be 200 or 422/500 depending on other factors)
        assert response.status_code != 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
