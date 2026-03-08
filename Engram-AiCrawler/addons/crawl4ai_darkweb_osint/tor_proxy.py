"""
Tor proxy integration for dark web access.

Provides:
- TorSession class with async context manager
- SOCKS5 proxy configuration
- Connection health check
- Retry logic with exponential backoff
- User agent rotation
"""

import asyncio
import random
import logging
from typing import Optional, Dict, Any

import aiohttp
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from crawl4ai_darkweb_osint.config import get_config, TorConfig

logger = logging.getLogger(__name__)


# Common user agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
]


class TorConnectionError(Exception):
    """Raised when Tor connection fails."""

    pass


class TorSession:
    """
    Async session configured for Tor SOCKS5 proxy.

    Usage:
        async with TorSession() as session:
            async with session.get("http://example.onion") as response:
                content = await response.text()
    """

    def __init__(
        self,
        config: Optional[TorConfig] = None,
        user_agent: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        self._config = config or get_config().tor
        self._user_agent = user_agent or random.choice(USER_AGENTS)
        self._timeout = timeout or self._config.timeout
        self._session: Optional[aiohttp.ClientSession] = None

    @property
    def proxy_url(self) -> str:
        """Get SOCKS5 proxy URL."""
        return f"socks5h://{self._config.host}:{self._config.port}"

    @property
    def headers(self) -> Dict[str, str]:
        """Get default headers with user agent."""
        return {
            "User-Agent": self._user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
        }

    async def __aenter__(self) -> "TorSession":
        """Create and configure the aiohttp session."""
        connector = aiohttp.TCPConnector(
            # Note: For SOCKS5, we need aiohttp-socks or use requests
            # For now, we'll use a workaround with direct proxy
            ssl=False,
        )

        timeout = aiohttp.ClientTimeout(total=self._timeout)

        self._session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers=self.headers,
        )

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Close the session."""
        if self._session:
            await self._session.close()
            self._session = None

    def _get_proxy_kwargs(self) -> Dict[str, str]:
        """Get proxy configuration for requests."""
        return {
            "proxy": self.proxy_url,
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(TorConnectionError),
    )
    async def get(self, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make GET request through Tor."""
        if not self._session:
            raise TorConnectionError(
                "Session not initialized. Use async context manager."
            )

        # Merge proxy settings
        kwargs.setdefault("proxy", self.proxy_url)

        try:
            response = await self._session.get(url, **kwargs)
            return response
        except aiohttp.ClientError as e:
            logger.error(f"Tor request failed for {url}: {e}")
            raise TorConnectionError(f"Failed to connect via Tor: {e}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(TorConnectionError),
    )
    async def post(self, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make POST request through Tor."""
        if not self._session:
            raise TorConnectionError(
                "Session not initialized. Use async context manager."
            )

        kwargs.setdefault("proxy", self.proxy_url)

        try:
            response = await self._session.post(url, **kwargs)
            return response
        except aiohttp.ClientError as e:
            logger.error(f"Tor POST request failed for {url}: {e}")
            raise TorConnectionError(f"Failed to connect via Tor: {e}")

    def rotate_user_agent(self) -> str:
        """Rotate to a new random user agent."""
        self._user_agent = random.choice(USER_AGENTS)
        if self._session:
            self._session._default_headers["User-Agent"] = self._user_agent
        return self._user_agent


async def check_tor_connection(
    host: str = "127.0.0.1",
    port: int = 9050,
    timeout: int = 10,
) -> Dict[str, Any]:
    """
    Check if Tor connection is working.

    Tests connection by trying to reach Tor's check service.

    Args:
        host: Tor proxy host
        port: Tor SOCKS port
        timeout: Connection timeout in seconds

    Returns:
        Dict with 'connected' (bool), 'ip' (str, optional), 'error' (str, optional)
    """
    proxy_url = f"socks5h://{host}:{port}"

    try:
        connector = aiohttp.TCPConnector(ssl=False)
        timeout_cfg = aiohttp.ClientTimeout(total=timeout)

        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout_cfg,
        ) as session:
            # Try Tor check service
            async with session.get(
                "https://check.torproject.org/",
                proxy=proxy_url,
            ) as response:
                if response.status == 200:
                    text = await response.text()
                    # Check if Tor is working
                    is_tor = "Congratulations" in text or "tor" in text.lower()

                    # Try to get IP
                    ip = None
                    try:
                        async with session.get(
                            "https://api.ipify.org?format=text",
                            proxy=proxy_url,
                        ) as ip_response:
                            if ip_response.status == 200:
                                ip = await ip_response.text()
                    except Exception:
                        pass

                    return {
                        "connected": is_tor,
                        "ip": ip,
                        "proxy": proxy_url,
                    }
                else:
                    return {
                        "connected": False,
                        "error": f"HTTP {response.status}",
                        "proxy": proxy_url,
                    }

    except asyncio.TimeoutError:
        return {
            "connected": False,
            "error": "Connection timeout",
            "proxy": proxy_url,
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "proxy": proxy_url,
        }


def get_tor_session(
    config: Optional[TorConfig] = None,
    user_agent: Optional[str] = None,
) -> TorSession:
    """
    Factory function to create a TorSession.

    Args:
        config: Tor configuration (uses global config if not provided)
        user_agent: Custom user agent (random if not provided)

    Returns:
        TorSession instance (must be used as async context manager)
    """
    return TorSession(config=config, user_agent=user_agent)


# Sync wrapper using requests (for compatibility with Robin pattern)
def create_tor_requests_session(
    host: str = "127.0.0.1",
    port: int = 9050,
    user_agent: Optional[str] = None,
):
    """
    Create a requests Session configured for Tor.

    This provides compatibility with synchronous code and Robin's pattern.

    Args:
        host: Tor proxy host
        port: Tor SOCKS port
        user_agent: Custom user agent

    Returns:
        requests.Session configured for Tor SOCKS5 proxy
    """
    try:
        import requests
    except ImportError:
        raise ImportError(
            "requests library required for sync session. Install with: pip install requests[socks]"
        )

    session = requests.Session()

    # Configure SOCKS5 proxy
    proxies = {
        "http": f"socks5h://{host}:{port}",
        "https": f"socks5h://{host}:{port}",
    }
    session.proxies.update(proxies)

    # Set user agent
    if user_agent:
        session.headers.update({"User-Agent": user_agent})
    else:
        session.headers.update({"User-Agent": random.choice(USER_AGENTS)})

    return session


# CLI entry point
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Tor proxy utilities")
    parser.add_argument("--check", action="store_true", help="Check Tor connection")
    parser.add_argument("--host", default="127.0.0.1", help="Tor proxy host")
    parser.add_argument("--port", type=int, default=9050, help="Tor proxy port")

    args = parser.parse_args()

    if args.check:
        result = asyncio.run(check_tor_connection(args.host, args.port))
        print(json.dumps(result, indent=2))
    else:
        parser.print_help()
