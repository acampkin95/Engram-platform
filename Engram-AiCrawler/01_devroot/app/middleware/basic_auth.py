"""Optional basic authentication middleware.

Replaces Clerk JWT auth with simple env-var-based basic auth.
Controlled by AUTH_ENABLED and BASIC_AUTH_USERNAME / BASIC_AUTH_PASSWORD env vars.
When AUTH_ENABLED=false (default), all requests pass through.
"""


from __future__ import annotations
import base64
import os
import secrets

from fastapi import Request, HTTPException, status


AUTH_ENABLED: bool = os.getenv("AUTH_ENABLED", "false").lower() == "true"
USERNAME: str = os.getenv("BASIC_AUTH_USERNAME", "")
PASSWORD: str = os.getenv("BASIC_AUTH_PASSWORD", "")
ADMIN_USERNAME: str = os.getenv("BASIC_AUTH_ADMIN_USERNAME", "")
ADMIN_PASSWORD: str = os.getenv("BASIC_AUTH_ADMIN_PASSWORD", "")

EXEMPTED_PATHS: list[str] = [
    "/health",
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/ws",
]


def _constant_time_compare(a: str, b: str) -> bool:
    return secrets.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


async def verify_basic_auth(request: Request) -> str | None:
    """Verify basic auth credentials from request.

    Returns:
        "admin", "user", or None (auth disabled). Raises 401 on bad credentials.
    """
    if not AUTH_ENABLED:
        return None

    if request.url.path in EXEMPTED_PATHS:
        return None

    if not USERNAME and not ADMIN_USERNAME:
        return None

    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Basic "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Basic realm='Crawl4AI OSINT'"},
        )

    try:
        decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
        username, password = decoded.split(":", 1)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Basic realm='Crawl4AI OSINT'"},
        )

    if (
        ADMIN_USERNAME
        and _constant_time_compare(username, ADMIN_USERNAME)
        and _constant_time_compare(password, ADMIN_PASSWORD)
    ):
        return "admin"

    if (
        USERNAME
        and _constant_time_compare(username, USERNAME)
        and _constant_time_compare(password, PASSWORD)
    ):
        return "user"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
        headers={"WWW-Authenticate": "Basic realm='Crawl4AI OSINT'"},
    )
