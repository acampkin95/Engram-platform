"""Engram shared utilities for use across all microservices."""

__version__ = "0.1.0"
__all__ = [
    "get_logger",
    "configure_root_logging",
    "BaseEngramSettings",
    "create_http_client",
    "fetch_with_retry",
    "create_jwt_token",
    "verify_jwt_token",
    "extract_bearer_token",
    "build_health_response",
]

from engram_shared.auth import (
    create_jwt_token,
    extract_bearer_token,
    verify_jwt_token,
)
from engram_shared.config import BaseEngramSettings
from engram_shared.health import build_health_response
from engram_shared.http import create_http_client, fetch_with_retry
from engram_shared.logging import configure_root_logging, get_logger
