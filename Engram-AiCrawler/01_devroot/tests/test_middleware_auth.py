"""Tests for authentication middleware."""

import pytest
from datetime import datetime, timedelta, UTC
from unittest.mock import MagicMock, patch, PropertyMock
from fastapi import Request, HTTPException

from app.middleware.auth import (
    verify_jwt_token,
    require_auth,
    get_current_user,
    require_admin_user,
)
from app.config.auth import (
    TokenExpiredError,
    InvalidTokenError,
    AuthorizationError,
    ClerkConfig,
    UserRole,
)
from app.models.auth import AuthenticatedUser


class TestVerifyJwtToken:
    """Tests for JWT token verification."""

    @pytest.fixture
    def mock_clerk_config(self):
        """Create mock Clerk configuration."""
        config = MagicMock(spec=ClerkConfig)
        config.jwt_key = "test-key"
        config.audience = "test-audience"
        config.issuer = "https://test.clerk.dev"
        config.admin_users = ["admin@example.com"]
        return config

    def test_verify_missing_authorization_header(self, mock_clerk_config):
        """Missing Authorization header raises error."""
        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with pytest.raises(AuthorizationError, match="Missing or invalid"):
                verify_jwt_token("")

    def test_verify_malformed_authorization_header(self, mock_clerk_config):
        """Malformed Authorization header raises error."""
        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with pytest.raises(AuthorizationError):
                verify_jwt_token("InvalidFormat token")

    def test_verify_valid_token_calls_jwt_decode(self, mock_clerk_config):
        """Valid token calls jwt.decode with correct parameters."""
        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.jwt.decode") as mock_decode:
                mock_decode.return_value = {
                    "sub": "user_123",
                    "email": "test@example.com",
                    "iat": 100,
                    "exp": 9999999999,
                }

                result = verify_jwt_token("Bearer token")

                mock_decode.assert_called_once()
                assert result.user_id == "user_123"

    def test_verify_admin_user_gets_admin_role(self, mock_clerk_config):
        """Admin user gets ADMIN role."""
        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.jwt.decode") as mock_decode:
                mock_decode.return_value = {
                    "sub": "admin_123",
                    "email": "admin@example.com",
                    "iat": 100,
                    "exp": 9999999999,
                }

                result = verify_jwt_token("Bearer token")
                assert result.role == UserRole.ADMIN

    def test_verify_regular_user_gets_user_role(self, mock_clerk_config):
        """Regular user gets USER role."""
        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.jwt.decode") as mock_decode:
                mock_decode.return_value = {
                    "sub": "user_123",
                    "email": "regular@example.com",
                    "iat": 100,
                    "exp": 9999999999,
                }

                result = verify_jwt_token("Bearer token")
                assert result.role == UserRole.USER

    def test_verify_expired_token_raises_error(self, mock_clerk_config):
        """Expired token raises TokenExpiredError."""
        import jwt

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.jwt.decode") as mock_decode:
                mock_decode.side_effect = jwt.ExpiredSignatureError()

                with pytest.raises(TokenExpiredError, match="expired"):
                    verify_jwt_token("Bearer token")

    def test_verify_invalid_signature_raises_error(self, mock_clerk_config):
        """Invalid signature raises InvalidTokenError."""
        import jwt

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.jwt.decode") as mock_decode:
                mock_decode.side_effect = jwt.InvalidSignatureError()

                with pytest.raises(InvalidTokenError, match="signature"):
                    verify_jwt_token("Bearer token")

    def test_verify_missing_claims_raises_error(self, mock_clerk_config):
        """Token missing required claims raises InvalidTokenError."""
        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.jwt.decode") as mock_decode:
                mock_decode.return_value = {
                    "sub": "user_123",
                    # Missing email
                    "exp": 9999999999,
                }

                with pytest.raises(InvalidTokenError, match="required claims"):
                    verify_jwt_token("Bearer token")


class TestRequireAuth:
    """Tests for require_auth dependency."""

    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock(spec=Request)
        request.headers = {}
        request.state = MagicMock()
        return request

    @pytest.fixture
    def mock_clerk_config(self):
        """Create mock Clerk configuration."""
        config = MagicMock(spec=ClerkConfig)
        config.auth_enabled = True
        return config

    @pytest.mark.asyncio
    async def test_require_auth_disabled(self, mock_request, mock_clerk_config):
        """Auth disabled returns None."""
        mock_clerk_config.auth_enabled = False

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            dependency = await require_auth()
            result = await dependency(mock_request)
            assert result is None

    @pytest.mark.asyncio
    async def test_require_auth_missing_header(self, mock_request, mock_clerk_config):
        """Missing Authorization header raises 401."""
        mock_request.headers = {}

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            dependency = await require_auth()

            with pytest.raises(HTTPException) as exc:
                await dependency(mock_request)

            assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_require_auth_valid_token(self, mock_request, mock_clerk_config):
        """Valid token sets user in request state."""
        mock_request.headers = {"Authorization": "Bearer valid-token"}
        mock_user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role=UserRole.USER,
            iat=0,
            exp=9999999999,
        )

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.verify_jwt_token", return_value=mock_user):
                dependency = await require_auth()
                await dependency(mock_request)

                assert hasattr(mock_request.state, "user")


class TestGetCurrentUser:
    """Tests for get_current_user helper."""

    @pytest.mark.asyncio
    async def test_get_current_user_exists(self):
        """Returns user from request state."""
        request = MagicMock(spec=Request)
        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role=UserRole.USER,
            iat=0,
            exp=9999999999,
        )
        request.state.user = user

        result = await get_current_user(request)
        assert result is user

    @pytest.mark.asyncio
    async def test_get_current_user_missing(self):
        """Returns None when no user in request state."""
        request = MagicMock(spec=Request)
        type(request.state).user = PropertyMock(return_value=None)

        result = await get_current_user(request)
        assert result is None


class TestRequireAdminUser:
    """Tests for require_admin_user dependency."""

    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock(spec=Request)
        request.headers = {}
        request.state = MagicMock()
        return request

    @pytest.fixture
    def mock_clerk_config(self):
        """Create mock Clerk configuration."""
        config = MagicMock(spec=ClerkConfig)
        config.auth_enabled = True
        return config

    @pytest.mark.asyncio
    async def test_admin_user_allowed(self, mock_request, mock_clerk_config):
        """Admin user is allowed."""
        mock_request.headers = {"Authorization": "Bearer admin-token"}
        mock_admin = AuthenticatedUser(
            user_id="admin_123",
            email="admin@example.com",
            role=UserRole.ADMIN,
            iat=0,
            exp=9999999999,
        )

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.verify_jwt_token", return_value=mock_admin):
                user = await require_admin_user(mock_request)
                assert user is not None
                assert user.role == UserRole.ADMIN

    @pytest.mark.asyncio
    async def test_non_admin_user_forbidden(self, mock_request, mock_clerk_config):
        """Non-admin user gets 403."""
        mock_request.headers = {"Authorization": "Bearer user-token"}
        mock_user = AuthenticatedUser(
            user_id="user_123",
            email="user@example.com",
            role=UserRole.USER,
            iat=0,
            exp=9999999999,
        )

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with patch("app.middleware.auth.verify_jwt_token", return_value=mock_user):
                with pytest.raises(HTTPException) as exc:
                    await require_admin_user(mock_request)

                assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_auth_header(self, mock_request, mock_clerk_config):
        """Missing Authorization header gets 401."""
        mock_request.headers = {}

        with patch("app.middleware.auth.get_clerk_config", return_value=mock_clerk_config):
            with pytest.raises(HTTPException) as exc:
                await require_admin_user(mock_request)

            assert exc.value.status_code == 401


class TestAuthenticatedUser:
    """Tests for AuthenticatedUser model."""

    def test_user_creation(self):
        """User is created with correct values."""
        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role=UserRole.USER,
            iat=100,
            exp=9999999999,
        )

        assert user.user_id == "user_123"
        assert user.email == "test@example.com"

    def test_is_token_expired_false(self):
        """Token not expired returns False."""
        future_exp = int((datetime.now(UTC) + timedelta(hours=1)).timestamp())
        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role=UserRole.USER,
            iat=100,
            exp=future_exp,
        )

        assert user.is_token_expired() is False

    def test_is_token_expired_true(self):
        """Token expired returns True."""
        past_exp = 1577836800  # Fixed past timestamp: 2020-01-01 00:00:00 UTC
        user = AuthenticatedUser(
            user_id="user_123",
            email="test@example.com",
            role=UserRole.USER,
            iat=100,
            exp=past_exp,
        )

        assert user.is_token_expired() is True
