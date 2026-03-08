"""Input sanitization middleware — strips null bytes and oversized payloads."""
from __future__ import annotations

import logging
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

# Maximum request body size: 10 MB
MAX_BODY_BYTES = 10 * 1024 * 1024


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """Reject requests with oversized bodies or null bytes in query params."""

    def __init__(self, app: ASGIApp, max_body_bytes: int = MAX_BODY_BYTES) -> None:
        super().__init__(app)
        self.max_body_bytes = max_body_bytes

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Block oversized bodies
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_body_bytes:
            logger.warning(
                "Rejected oversized request: %d bytes from %s",
                int(content_length),
                request.client.host if request.client else "unknown",
            )
            return Response(
                content='{"detail":"Request body too large"}',
                status_code=413,
                media_type="application/json",
            )

        # Block null bytes in query string
        raw_query = request.url.query
        if "\x00" in raw_query or "%00" in raw_query:
            logger.warning("Rejected request with null bytes in query: %s", request.url.path)
            return Response(
                content='{"detail":"Invalid characters in request"}',
                status_code=400,
                media_type="application/json",
            )

        return await call_next(request)
