"""Shared JWT authentication utilities for Engram microservices."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt


def create_jwt_token(
    data: dict[str, Any],
    secret: str,
    algorithm: str = "HS256",
    expiry_hours: int = 24,
) -> str:
    """Create a signed JWT token.

    Args:
        data: Payload data to encode.
        secret: JWT signing secret.
        algorithm: JWT algorithm. Defaults to HS256.
        expiry_hours: Token expiry in hours. Defaults to 24.

    Returns:
        Signed JWT token string.
    """
    payload = data.copy()
    expire = datetime.now(UTC) + timedelta(hours=expiry_hours)
    payload.update({"exp": expire})
    return jwt.encode(payload, secret, algorithm=algorithm)


def verify_jwt_token(
    token: str,
    secret: str,
    algorithm: str = "HS256",
) -> dict[str, Any]:
    """Verify and decode a JWT token.

    Args:
        token: JWT token string to verify.
        secret: JWT signing secret.
        algorithm: JWT algorithm. Defaults to HS256.

    Returns:
        Decoded token payload.

    Raises:
        ValueError: If token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        return payload
    except JWTError as exc:
        raise ValueError(f"Invalid or expired token: {exc}") from exc


def extract_bearer_token(authorization: str) -> str:
    """Extract token from 'Bearer <token>' Authorization header.

    Args:
        authorization: Authorization header value.

    Returns:
        Extracted token string.

    Raises:
        ValueError: If header format is invalid.
    """
    if not authorization.startswith("Bearer "):
        raise ValueError("Authorization header must start with 'Bearer '")
    return authorization[7:].strip()
