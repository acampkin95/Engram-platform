"""Shared HTTP client factory for Engram microservices."""

from __future__ import annotations

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


def create_http_client(
    base_url: str = "",
    timeout: float = 30.0,
    max_connections: int = 10,
    headers: dict[str, str] | None = None,
) -> httpx.AsyncClient:
    """Create a configured async HTTP client.

    Args:
        base_url: Base URL for all requests.
        timeout: Request timeout in seconds.
        max_connections: Maximum connection pool size.
        headers: Default headers to include in all requests.

    Returns:
        Configured AsyncClient instance. Use as async context manager.
    """
    return httpx.AsyncClient(
        base_url=base_url,
        timeout=httpx.Timeout(timeout),
        limits=httpx.Limits(max_connections=max_connections),
        headers=headers or {},
        follow_redirects=True,
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)
async def fetch_with_retry(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    """Make an HTTP request with automatic retry on failure.

    Args:
        client: The async HTTP client to use.
        method: HTTP method (GET, POST, etc.).
        url: Request URL.
        **kwargs: Additional arguments passed to the client request.

    Returns:
        HTTP response.

    Raises:
        httpx.HTTPStatusError: On 4xx/5xx after retries exhausted.
        httpx.RequestError: On network errors after retries exhausted.
    """
    response = await client.request(method, url, **kwargs)
    response.raise_for_status()
    return response
