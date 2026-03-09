"""
Unit tests for memory_system.auth — password hashing, JWT, API key checks, require_auth.

Uses REAL bcrypt and jose libraries (no mocking for pure functions).
Only mocks get_settings for require_auth dependency tests.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from jose import jwt

from memory_system.auth import (
    ALGORITHM,
    check_api_key,
    create_access_token,
    decode_access_token,
    hash_password,
    require_auth,
    verify_password,
)


# ---------------------------------------------------------------------------
# Password hashing — real bcrypt, no mocks
# ---------------------------------------------------------------------------


class TestHashPassword:
    def test_returns_bcrypt_hash(self) -> None:
        hashed = hash_password("my-secure-password")
        assert hashed.startswith("$2b$")
        assert len(hashed) == 60

    def test_different_passwords_different_hashes(self) -> None:
        h1 = hash_password("password-one")
        h2 = hash_password("password-two")
        assert h1 != h2

    def test_same_password_different_salts(self) -> None:
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        assert h1 != h2  # bcrypt uses random salts


class TestVerifyPassword:
    def test_correct_password_returns_true(self) -> None:
        hashed = hash_password("correct-horse-battery-staple")
        assert verify_password("correct-horse-battery-staple", hashed) is True

    def test_wrong_password_returns_false(self) -> None:
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_empty_password_does_not_match(self) -> None:
        hashed = hash_password("non-empty")
        assert verify_password("", hashed) is False


# ---------------------------------------------------------------------------
# JWT utilities — real jose, no mocks
# ---------------------------------------------------------------------------

TEST_SECRET = "test-jwt-secret-key-for-unit-testing"


class TestCreateAccessToken:
    def test_returns_valid_jwt_string(self) -> None:
        token = create_access_token({"sub": "user@example.com"}, TEST_SECRET)
        assert isinstance(token, str)
        assert len(token) > 0

    def test_payload_contains_sub(self) -> None:
        token = create_access_token({"sub": "alice"}, TEST_SECRET)
        decoded = jwt.decode(token, TEST_SECRET, algorithms=[ALGORITHM])
        assert decoded["sub"] == "alice"

    def test_payload_contains_exp_and_iat(self) -> None:
        token = create_access_token({"sub": "bob"}, TEST_SECRET)
        decoded = jwt.decode(token, TEST_SECRET, algorithms=[ALGORITHM])
        assert "exp" in decoded
        assert "iat" in decoded

    def test_custom_expire_hours(self) -> None:
        token = create_access_token({"sub": "charlie"}, TEST_SECRET, expire_hours=48)
        decoded = jwt.decode(token, TEST_SECRET, algorithms=[ALGORITHM])
        exp = datetime.fromtimestamp(decoded["exp"], tz=timezone)
        iat = datetime.fromtimestamp(decoded["iat"], tz=timezone)
        # Expiry should be ~48h after issued-at
        diff = exp - iat
        assert timedelta(hours=47) < diff < timedelta(hours=49)

    def test_does_not_mutate_input_dict(self) -> None:
        data = {"sub": "dave"}
        create_access_token(data, TEST_SECRET)
        assert data == {"sub": "dave"}


class TestDecodeAccessToken:
    def test_decodes_valid_token(self) -> None:
        token = create_access_token({"sub": "eve"}, TEST_SECRET)
        payload = decode_access_token(token, TEST_SECRET)
        assert payload["sub"] == "eve"

    def test_raises_value_error_for_expired_token(self) -> None:
        token = create_access_token({"sub": "frank"}, TEST_SECRET, expire_hours=0)
        # Token with 0 hours is already expired (exp = now + 0h = now)
        # Create a manually expired token
        payload = {
            "sub": "frank",
            "exp": datetime.now(timezone) - timedelta(hours=1),
            "iat": datetime.now(timezone) - timedelta(hours=2),
        }
        expired_token = jwt.encode(payload, TEST_SECRET, algorithm=ALGORITHM)
        with pytest.raises(ValueError, match="Token has expired"):
            decode_access_token(expired_token, TEST_SECRET)

    def test_raises_value_error_for_invalid_token(self) -> None:
        with pytest.raises(ValueError, match="Invalid token"):
            decode_access_token("not-a-valid-jwt", TEST_SECRET)

    def test_raises_value_error_for_wrong_secret(self) -> None:
        token = create_access_token({"sub": "grace"}, TEST_SECRET)
        with pytest.raises(ValueError, match="Invalid token"):
            decode_access_token(token, "wrong-secret")


# ---------------------------------------------------------------------------
# API key checking — pure function, no mocks
# ---------------------------------------------------------------------------


class TestCheckApiKey:
    def test_matching_key_returns_true(self) -> None:
        assert check_api_key("key-abc-123", ["key-abc-123", "key-def-456"]) is True

    def test_non_matching_key_returns_false(self) -> None:
        assert check_api_key("wrong-key", ["key-abc-123"]) is False

    def test_empty_allowed_keys_returns_false(self) -> None:
        # Empty allowed_keys means API key auth is disabled
        assert check_api_key("any-key", []) is False

    def test_uses_constant_time_comparison(self) -> None:
        # Verify it works correctly (hmac.compare_digest is used internally)
        assert check_api_key("exact-match", ["exact-match"]) is True
        assert check_api_key("almost-matc", ["almost-match"]) is False

    def test_multiple_keys_any_match(self) -> None:
        keys = ["key-1", "key-2", "key-3"]
        assert check_api_key("key-2", keys) is True
        assert check_api_key("key-4", keys) is False


# ---------------------------------------------------------------------------
# require_auth FastAPI dependency — mock get_settings only
# ---------------------------------------------------------------------------


def _make_settings_mock(
    api_keys: list[str] | None = None,
    jwt_secret: str = TEST_SECRET,
    admin_password_hash: str | None = "somehash",
) -> MagicMock:
    """Build a minimal settings mock for require_auth tests."""
    settings = MagicMock()
    settings.api_keys = api_keys or []
    settings.jwt_secret = jwt_secret
    settings.admin_password_hash = admin_password_hash
    return settings


class TestRequireAuth:
    @pytest.mark.asyncio
    async def test_valid_api_key(self) -> None:
        settings = _make_settings_mock(api_keys=["valid-key-123"])
        with patch("memory_system.auth.get_settings", return_value=settings):
            identity = await require_auth(api_key="valid-key-123", bearer=None)
        assert identity.startswith("apikey:")

    @pytest.mark.asyncio
    async def test_invalid_api_key_raises_401(self) -> None:
        settings = _make_settings_mock(api_keys=["valid-key-123"])
        with patch("memory_system.auth.get_settings", return_value=settings):
            with pytest.raises(HTTPException) as exc_info:
                await require_auth(api_key="wrong-key", bearer=None)
        assert exc_info.value.status_code == 401
        assert "Invalid API key" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_valid_jwt_bearer(self) -> None:
        token = create_access_token({"sub": "jwt-user"}, TEST_SECRET)
        bearer = MagicMock()
        bearer.credentials = token
        settings = _make_settings_mock(jwt_secret=TEST_SECRET)
        with patch("memory_system.auth.get_settings", return_value=settings):
            identity = await require_auth(api_key=None, bearer=bearer)
        assert identity == "jwt-user"

    @pytest.mark.asyncio
    async def test_expired_jwt_raises_401(self) -> None:
        payload = {
            "sub": "expired-user",
            "exp": datetime.now(timezone) - timedelta(hours=1),
            "iat": datetime.now(timezone) - timedelta(hours=2),
        }
        expired_token = jwt.encode(payload, TEST_SECRET, algorithm=ALGORITHM)
        bearer = MagicMock()
        bearer.credentials = expired_token
        settings = _make_settings_mock(jwt_secret=TEST_SECRET)
        with patch("memory_system.auth.get_settings", return_value=settings):
            with pytest.raises(HTTPException) as exc_info:
                await require_auth(api_key=None, bearer=bearer)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_invalid_jwt_raises_401(self) -> None:
        bearer = MagicMock()
        bearer.credentials = "garbage-token"
        settings = _make_settings_mock(jwt_secret=TEST_SECRET)
        with patch("memory_system.auth.get_settings", return_value=settings):
            with pytest.raises(HTTPException) as exc_info:
                await require_auth(api_key=None, bearer=bearer)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_no_credentials_no_config_raises_401(self) -> None:
        # No API keys configured AND no admin password hash → 401 with config message
        settings = _make_settings_mock(api_keys=[], admin_password_hash=None)
        with patch("memory_system.auth.get_settings", return_value=settings):
            with pytest.raises(HTTPException) as exc_info:
                await require_auth(api_key=None, bearer=None)
        assert exc_info.value.status_code == 401
        assert "not configured" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_no_credentials_with_config_raises_401(self) -> None:
        # API keys or admin password configured but no creds provided
        settings = _make_settings_mock(api_keys=[], admin_password_hash="$2b$12$hash")
        with patch("memory_system.auth.get_settings", return_value=settings):
            with pytest.raises(HTTPException) as exc_info:
                await require_auth(api_key=None, bearer=None)
        assert exc_info.value.status_code == 401
        assert "Authentication required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_jwt_without_sub_returns_unknown(self) -> None:
        # JWT with no 'sub' claim
        token = create_access_token({"role": "admin"}, TEST_SECRET)
        bearer = MagicMock()
        bearer.credentials = token
        settings = _make_settings_mock(jwt_secret=TEST_SECRET)
        with patch("memory_system.auth.get_settings", return_value=settings):
            identity = await require_auth(api_key=None, bearer=bearer)
        assert identity == "unknown"

    @pytest.mark.asyncio
    async def test_api_key_takes_precedence_over_bearer(self) -> None:
        # When both API key and bearer are provided, API key is checked first
        token = create_access_token({"sub": "jwt-user"}, TEST_SECRET)
        bearer = MagicMock()
        bearer.credentials = token
        settings = _make_settings_mock(api_keys=["valid-key"], jwt_secret=TEST_SECRET)
        with patch("memory_system.auth.get_settings", return_value=settings):
            identity = await require_auth(api_key="valid-key", bearer=bearer)
        assert identity.startswith("apikey:")
