"""Shared health check utilities for Engram FastAPI services."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any


def build_health_response(
    service_name: str,
    version: str = "unknown",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a standard health check response dict.

    Args:
        service_name: Name of the service.
        version: Service version string.
        extra: Additional fields to include in response.

    Returns:
        Health check response dictionary.
    """
    response: dict[str, Any] = {
        "status": "ok",
        "service": service_name,
        "version": version,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if extra:
        response.update(extra)
    return response
