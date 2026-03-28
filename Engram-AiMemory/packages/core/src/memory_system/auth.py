"""
Authentication utilities for the AI Memory System API.

Provides:
- JWT creation and verification
- API key checking
- Password hashing (bcrypt)
- FastAPI dependencies for route protection
"""

import hmac
from datetime import datetime, timedelta
from typing import Any

# Using bcrypt directly — passlib 1.7.4 is incompatible with bcrypt 5.x
import bcrypt as _bcrypt_lib
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt

from memory_system.compat import UTC
from memory_system.config import get_settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    salt = _bcrypt_lib.gensalt()
    return _bcrypt_lib.hashpw(password.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return _bcrypt_lib.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# JWT utilities
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"


def create_access_token(
    data: dict[str, Any],
    secret: str,
    expire_hours: int = 24,
) -> str:
    """Create a signed JWT access token.

    Args:
        data: Payload dict (must include "sub" key).
        secret: HMAC secret for signing.
        expire_hours: Token lifetime in hours.

    Returns:
        Encoded JWT string.
    """
    payload = data.copy()
    payload["exp"] = datetime.now(UTC) + timedelta(hours=expire_hours)
    payload["iat"] = datetime.now(UTC)
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_access_token(token: str, secret: str) -> dict[str, Any]:
    """Decode and verify a JWT access token.

    Args:
        token: Encoded JWT string.
        secret: HMAC secret used when signing.

    Returns:
        Decoded payload dict.

    Raises:
        ValueError: If token is expired or invalid.
    """
    try:
        return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except ExpiredSignatureError as e:
        raise ValueError("Token has expired") from e
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e


# ---------------------------------------------------------------------------
# API key utilities
# ---------------------------------------------------------------------------


def check_api_key(key: str, allowed_keys: list[str]) -> bool:
    """Check whether a key is in the allowed list.

    Returns False (not True) if allowed_keys is empty — no keys configured
    means API key auth is disabled (not open to everyone).
    """
    if not allowed_keys:
        return False
    return any(hmac.compare_digest(key, k) for k in allowed_keys)


# ---------------------------------------------------------------------------
# FastAPI security schemes
# ---------------------------------------------------------------------------

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_bearer_scheme = HTTPBearer(auto_error=False)


async def require_auth(
    api_key: str | None = Security(_api_key_header),  # noqa: B008
    bearer: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),  # noqa: B008
) -> str:
    """FastAPI dependency — require either a valid API key or a valid JWT.

    Returns the authenticated identity string (API key or username).

    Raises:
        HTTPException 401: If neither credential is valid.
    """
    settings = get_settings()

    # --- Try API key first ---
    if api_key is not None:
        api_keys = settings.api_keys if isinstance(settings.api_keys, list) else [settings.api_keys]
        if check_api_key(api_key, api_keys):
            return f"apikey:{api_key[:4]}..."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # --- Try JWT Bearer ---
    if bearer is not None:
        try:
            payload = decode_access_token(bearer.credentials, settings.jwt_secret)
            return payload.get("sub", "unknown")
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            ) from e

    # --- No credentials provided ---
    # If no API keys are configured AND no admin password hash set, allow through
    # (backwards-compatible: unauthenticated mode when API_KEYS is empty)
    if not settings.api_keys and settings.admin_password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication not configured. Set API_KEYS or ADMIN_PASSWORD_HASH in environment.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required: provide X-API-Key header or Authorization: Bearer token",
        headers={"WWW-Authenticate": "Bearer"},
    )
