"""Tests for auth utility functions - require_admin, is_admin, get_user_id, get_user_email."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from app.utils.auth import require_admin, is_admin, get_user_id, get_user_email
from app.models.auth import AuthenticatedUser
from app.config import UserRole


class TestRequireAdmin:
    """Tests for require_admin function."""

    @pytest.mark.asyncio
    async def test_require_admin_with_admin_user(self):
        """Test that admin user passes require_admin."""
        request = MagicMock()
        admin_user = AuthenticatedUser(
            user_id="admin-123",
            email="admin@example.com",
            role=UserRole.ADMIN,
            iat=1000,
            exp=2000,
        )

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = admin_user

            result = await require_admin(request)

            assert result.user_id == "admin-123"
            assert result.role == UserRole.ADMIN

    @pytest.mark.asyncio
    async def test_require_admin_with_regular_user(self):
        """Test that regular user is rejected with 403."""
        request = MagicMock()
        regular_user = AuthenticatedUser(
            user_id="user-123",
            email="user@example.com",
            role=UserRole.USER,
            iat=1000,
            exp=2000,
        )

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = regular_user

            with pytest.raises(HTTPException) as exc_info:
                await require_admin(request)

            assert exc_info.value.status_code == 403
            assert "Admin access required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_admin_unauthenticated(self):
        """Test that unauthenticated user is rejected with 401."""
        request = MagicMock()

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await require_admin(request)

            assert exc_info.value.status_code == 401
            assert "Authentication required" in exc_info.value.detail


class TestIsAdmin:
    """Tests for is_admin function."""

    @pytest.mark.asyncio
    async def test_is_admin_with_admin_user(self):
        """Test that admin user returns True."""
        request = MagicMock()
        admin_user = AuthenticatedUser(
            user_id="admin-123",
            email="admin@example.com",
            role=UserRole.ADMIN,
            iat=1000,
            exp=2000,
        )

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = admin_user

            result = await is_admin(request)

            assert result is True

    @pytest.mark.asyncio
    async def test_is_admin_with_regular_user(self):
        """Test that regular user returns False."""
        request = MagicMock()
        regular_user = AuthenticatedUser(
            user_id="user-123",
            email="user@example.com",
            role=UserRole.USER,
            iat=1000,
            exp=2000,
        )

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = regular_user

            result = await is_admin(request)

            assert result is False

    @pytest.mark.asyncio
    async def test_is_admin_unauthenticated(self):
        """Test that unauthenticated user returns False."""
        request = MagicMock()

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = None

            result = await is_admin(request)

            assert result is False


class TestGetUserId:
    """Tests for get_user_id function."""

    @pytest.mark.asyncio
    async def test_get_user_id_with_authenticated_user(self):
        """Test getting user ID from authenticated request."""
        request = MagicMock()
        user = AuthenticatedUser(
            user_id="user-abc123",
            email="user@example.com",
            role=UserRole.USER,
            iat=1000,
            exp=2000,
        )

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = user

            result = await get_user_id(request)

            assert result == "user-abc123"

    @pytest.mark.asyncio
    async def test_get_user_id_unauthenticated(self):
        """Test that unauthenticated request raises HTTPException."""
        request = MagicMock()

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await get_user_id(request)

            assert exc_info.value.status_code == 401
            assert "Authentication required" in exc_info.value.detail


class TestGetUserEmail:
    """Tests for get_user_email function."""

    @pytest.mark.asyncio
    async def test_get_user_email_with_authenticated_user(self):
        """Test getting user email from authenticated request."""
        request = MagicMock()
        user = AuthenticatedUser(
            user_id="user-123",
            email="test@example.com",
            role=UserRole.USER,
            iat=1000,
            exp=2000,
        )

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = user

            result = await get_user_email(request)

            assert result == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_user_email_unauthenticated(self):
        """Test that unauthenticated request raises HTTPException."""
        request = MagicMock()

        with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await get_user_email(request)

            assert exc_info.value.status_code == 401
            assert "Authentication required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_user_email_different_users(self):
        """Test getting email for different users."""
        request = MagicMock()

        for email in ["user1@example.com", "admin@example.com", "test@test.com"]:
            user = AuthenticatedUser(
                user_id="user-123",
                email=email,
                role=UserRole.USER,
                iat=1000,
                exp=2000,
            )

            with patch("app.utils.auth.get_current_user", new_callable=AsyncMock) as mock_get_user:
                mock_get_user.return_value = user

                result = await get_user_email(request)

                assert result == email
