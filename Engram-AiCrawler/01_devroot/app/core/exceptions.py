from __future__ import annotations

import uuid
from datetime import datetime
from app._compat import UTC


class AppError(Exception):
    status_code: int = 500

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        correlation_id: str | None = None,
    ):
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.correlation_id = correlation_id or str(uuid.uuid4())
        super().__init__(message)

    def to_dict(self) -> dict:
        return {
            "error": self.message,
            "status_code": self.status_code,
            "correlation_id": self.correlation_id,
            "timestamp": datetime.now(UTC).isoformat(),
        }


class ExternalServiceError(AppError):
    status_code = 502


class CrawlError(AppError):
    status_code = 500


class ValidationError(AppError):
    status_code = 400


class StorageError(AppError):
    status_code = 500


class RateLimitError(AppError):
    status_code = 429


class AuthenticationError(AppError):
    status_code = 401


class AuthorizationError(AppError):
    status_code = 403


class ServiceUnavailableError(AppError):
    status_code = 503


class OsintServiceError(AppError):
    """Raised when an OSINT service operation fails."""

    status_code = 502


class ProviderUnavailableError(AppError):
    """Raised when an OSINT provider is down or has no API key for a required operation."""

    status_code = 503


class ProviderRateLimitError(RateLimitError):
    """Raised when an external OSINT provider's rate limit is exceeded."""

    def __init__(
        self,
        message: str,
        provider: str,
        retry_after: int | None = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.provider = provider
        self.retry_after = retry_after
