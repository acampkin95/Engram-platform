"""
Tor/Dark Web Crawler Adapter — Phase 8.1

Provides SOCKS5-proxied HTTP crawling for .onion sites via Tor,
circuit management, and Crawl4AI integration for dark web content extraction.

Requirements (optional — gracefully degraded if missing):
  pip install aiohttp-socks stem requests[socks]

Tor must be running locally or in Docker:
  docker run -d -p 9050:9050 -p 9051:9051 dperson/torproxy
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, UTC

from enum import StrEnum

from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class TorStatus(StrEnum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    CIRCUIT_BUILDING = "circuit_building"
    ERROR = "error"

@dataclass
class TorCircuit:
    circuit_id: str
    status: str
    path: list[str]  # relay fingerprints
    built_at: datetime
    requests_made: int = 0
    max_requests: int = 50  # rotate after N requests

@dataclass
class DarkWebPage:
    url: str
    onion_host: str
    status_code: int
    html: str
    text: str
    title: str
    links: list[str]
    forms: list[dict[str, Any]]
    keywords_found: list[str]
    crawled_at: datetime
    circuit_id: str | None
    response_time_ms: float
    content_hash: str
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "onion_host": self.onion_host,
            "status_code": self.status_code,
            "title": self.title,
            "text_length": len(self.text),
            "links_count": len(self.links),
            "keywords_found": self.keywords_found,
            "crawled_at": self.crawled_at.isoformat(),
            "circuit_id": self.circuit_id,
            "response_time_ms": self.response_time_ms,
            "content_hash": self.content_hash,
            "error": self.error,
        }

@dataclass
class TorCrawlConfig:
    """Configuration for Tor crawler."""

    tor_socks_host: str = field(default_factory=lambda: os.getenv("TOR_SOCKS_HOST", "127.0.0.1"))
    tor_socks_port: int = field(default_factory=lambda: int(os.getenv("TOR_SOCKS_PORT", "9050")))
    tor_control_host: str = field(
        default_factory=lambda: os.getenv("TOR_CONTROL_HOST", "127.0.0.1")
    )
    tor_control_port: int = field(
        default_factory=lambda: int(os.getenv("TOR_CONTROL_PORT", "9051"))
    )
    tor_control_password: str = field(default_factory=lambda: os.getenv("TOR_CONTROL_PASSWORD", ""))
    request_timeout: int = 60  # seconds
    max_retries: int = 3
    retry_delay: float = 5.0
    circuit_rotate_every: int = 50  # requests per circuit
    max_concurrent: int = 3  # .onion sites are slow
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0"
    verify_tor: bool = True  # verify we're actually using Tor
    extract_links: bool = True
    extract_forms: bool = True
    follow_redirects: bool = True
    max_page_size_mb: float = 5.0

# ---------------------------------------------------------------------------
# Tor Controller (stem-based)
# ---------------------------------------------------------------------------

class TorController:
    """Manages Tor circuits via stem control protocol."""

    def __init__(self, config: TorCrawlConfig):
        self.config = config
        self._controller = None
        self._stem_available = False
        self._current_circuit: TorCircuit | None = None
        self._circuit_request_count = 0
        self._status = TorStatus.DISCONNECTED

        try:
            import stem  # noqa: F401

            self._stem_available = True
        except ImportError:
            logger.warning(
                "stem not installed — circuit management disabled. "
                "Install with: pip install stem"
            )

    async def connect(self) -> bool:
        """Connect to Tor control port."""
        if not self._stem_available:
            logger.info("stem unavailable — skipping control port connection")
            self._status = TorStatus.CONNECTED  # assume Tor is running
            return True

        try:
            loop = asyncio.get_event_loop()
            self._controller = await loop.run_in_executor(None, self._connect_sync)
            self._status = TorStatus.CONNECTED
            logger.info("Connected to Tor control port")
            return True
        except Exception as exc:
            logger.error(f"Failed to connect to Tor control port: {exc}")
            self._status = TorStatus.ERROR
            # Still usable without control port
            return False

    def _connect_sync(self):
        """Synchronous stem connection (run in executor)."""
        import stem.control  # type: ignore

        controller = stem.control.Controller.from_port(
            address=self.config.tor_control_host,
            port=self.config.tor_control_port,
        )
        controller.authenticate(password=self.config.tor_control_password)
        return controller

    async def new_circuit(self) -> str | None:
        """Request a new Tor circuit (new identity)."""
        if not self._controller:
            return None
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._controller.signal, "NEWNYM")
            await asyncio.sleep(1.0)  # allow circuit to build
            self._circuit_request_count = 0
            logger.info("New Tor circuit requested")
            return f"circuit_{int(time.time())}"
        except Exception as exc:
            logger.warning(f"Circuit rotation failed: {exc}")
            return None

    async def get_exit_ip(self) -> str | None:
        """Get current Tor exit node IP via check.torproject.org."""
        try:
            import aiohttp  # type: ignore

            connector = self._make_connector()
            if connector is None:
                return None
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(
                    "https://check.torproject.org/api/ip",
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    data = await resp.json()
                    return data.get("IP")
        except Exception as exc:
            logger.debug(f"Could not get exit IP: {exc}")
            return None

    def _make_connector(self):
        """Create SOCKS5 connector for aiohttp."""
        try:
            from aiohttp_socks import ProxyConnector  # type: ignore

            return ProxyConnector.from_url(
                f"socks5://{self.config.tor_socks_host}:{self.config.tor_socks_port}"
            )
        except ImportError:
            logger.warning("aiohttp-socks not installed. Install: pip install aiohttp-socks")
            return None

    async def disconnect(self):
        """Close Tor control connection."""
        if self._controller:
            try:
                self._controller.close()
            except Exception:
                pass
            self._controller = None
        self._status = TorStatus.DISCONNECTED

    @property
    def status(self) -> TorStatus:
        return self._status

    @property
    def is_available(self) -> bool:
        return self._status in (TorStatus.CONNECTED, TorStatus.CIRCUIT_BUILDING)

# ---------------------------------------------------------------------------
# HTML Parser (minimal, no heavy deps)
# ---------------------------------------------------------------------------

def _extract_title(html: str) -> str:
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    return m.group(1).strip() if m else ""

def _extract_text(html: str) -> str:
    """Strip tags and return visible text."""
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def _extract_links(html: str, base_url: str) -> list[str]:
    """Extract href links from HTML."""
    links = []
    parsed_base = urlparse(base_url)
    for m in re.finditer(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE):
        href = m.group(1).strip()
        if href.startswith("http://") or href.startswith("https://"):
            links.append(href)
        elif href.startswith("/"):
            links.append(f"{parsed_base.scheme}://{parsed_base.netloc}{href}")
        elif href.startswith("#") or href.startswith("javascript:"):
            continue
        else:
            links.append(href)
    return list(dict.fromkeys(links))  # deduplicate preserving order

def _extract_forms(html: str) -> list[dict[str, Any]]:
    """Extract form structures."""
    forms = []
    for form_match in re.finditer(r"<form([^>]*)>(.*?)</form>", html, re.DOTALL | re.IGNORECASE):
        attrs_str = form_match.group(1)
        body = form_match.group(2)
        action = re.search(r'action=["\']([^"\']*)["\']', attrs_str)
        method = re.search(r'method=["\']([^"\']*)["\']', attrs_str)
        inputs = []
        for inp in re.finditer(r"<input([^>]*)>", body, re.IGNORECASE):
            inp_attrs = inp.group(1)
            name = re.search(r'name=["\']([^"\']*)["\']', inp_attrs)
            itype = re.search(r'type=["\']([^"\']*)["\']', inp_attrs)
            inputs.append(
                {
                    "name": name.group(1) if name else "",
                    "type": itype.group(1) if itype else "text",
                }
            )
        forms.append(
            {
                "action": action.group(1) if action else "",
                "method": (method.group(1) if method else "GET").upper(),
                "inputs": inputs,
            }
        )
    return forms

def _find_keywords(text: str, keywords: list[str]) -> list[str]:
    """Return which keywords appear in text (case-insensitive)."""
    text_lower = text.lower()
    return [kw for kw in keywords if kw.lower() in text_lower]

# ---------------------------------------------------------------------------
# Main Tor Crawler
# ---------------------------------------------------------------------------

class TorCrawler:
    """
    Async HTTP crawler that routes all traffic through Tor SOCKS5 proxy.

    Usage:
        config = TorCrawlConfig()
        async with TorCrawler(config) as crawler:
            page = await crawler.fetch("http://example.onion/")
    """

    def __init__(self, config: TorCrawlConfig | None = None):
        self.config = config or TorCrawlConfig()
        self.controller = TorController(self.config)
        self._session = None
        self._request_count = 0
        self._semaphore = asyncio.Semaphore(self.config.max_concurrent)

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *_):
        await self.stop()

    async def start(self):
        """Initialize Tor connection and HTTP session."""
        await self.controller.connect()

        try:
            import aiohttp  # type: ignore
            from aiohttp_socks import ProxyConnector  # type: ignore

            connector = ProxyConnector.from_url(
                f"socks5://{self.config.tor_socks_host}:{self.config.tor_socks_port}"
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                headers={"User-Agent": self.config.user_agent},
                timeout=aiohttp.ClientTimeout(total=self.config.request_timeout),
            )
            logger.info("TorCrawler session started with SOCKS5 proxy")
        except ImportError as exc:
            logger.error(
                f"aiohttp / aiohttp-socks not available: {exc}. "
                "Install: pip install aiohttp aiohttp-socks"
            )
            self._session = None

    async def stop(self):
        """Close session and Tor connection."""
        if self._session:
            await self._session.close()
            self._session = None
        await self.controller.disconnect()

    def _is_onion(self, url: str) -> bool:
        parsed = urlparse(url)
        return parsed.netloc.endswith(".onion")

    async def _rotate_circuit_if_needed(self):
        """Rotate Tor circuit after threshold requests."""
        self._request_count += 1
        if self._request_count % self.config.circuit_rotate_every == 0:
            logger.info(f"Rotating Tor circuit after {self._request_count} requests")
            await self.controller.new_circuit()

    async def fetch(
        self,
        url: str,
        keywords: list[str] | None = None,
    ) -> DarkWebPage:
        """
        Fetch a single URL through Tor.

        Args:
            url: Target URL (.onion or clearnet)
            keywords: List of keywords to search for in page content

        Returns:
            DarkWebPage with extracted content
        """
        keywords = keywords or []
        start_time = time.time()
        onion_host = urlparse(url).netloc

        if self._session is None:
            return DarkWebPage(
                url=url,
                onion_host=onion_host,
                status_code=0,
                html="",
                text="",
                title="",
                links=[],
                forms=[],
                keywords_found=[],
                crawled_at=datetime.now(UTC),
                circuit_id=None,
                response_time_ms=0.0,
                content_hash="",
                error="Tor session not available — install aiohttp aiohttp-socks",
            )

        async with self._semaphore:
            await self._rotate_circuit_if_needed()

            for attempt in range(self.config.max_retries):
                try:
                    async with self._session.get(
                        url,
                        allow_redirects=self.config.follow_redirects,
                        max_line_size=8190 * 1024,
                    ) as resp:
                        # Size guard
                        content_length = int(resp.headers.get("Content-Length", 0))
                        max_bytes = int(self.config.max_page_size_mb * 1024 * 1024)
                        if content_length > max_bytes:
                            return DarkWebPage(
                                url=url,
                                onion_host=onion_host,
                                status_code=resp.status,
                                html="",
                                text="",
                                title="",
                                links=[],
                                forms=[],
                                keywords_found=[],
                                crawled_at=datetime.now(UTC),
                                circuit_id=None,
                                response_time_ms=(time.time() - start_time) * 1000,
                                content_hash="",
                                error=f"Page too large ({content_length} bytes)",
                            )

                        html = await resp.text(errors="replace")

                        text = _extract_text(html)
                        title = _extract_title(html)
                        links = _extract_links(html, url) if self.config.extract_links else []
                        forms = _extract_forms(html) if self.config.extract_forms else []
                        kw_found = _find_keywords(text, keywords)
                        content_hash = hashlib.sha256(
                            html.encode("utf-8", errors="replace")
                        ).hexdigest()

                        return DarkWebPage(
                            url=url,
                            onion_host=onion_host,
                            status_code=resp.status,
                            html=html,
                            text=text,
                            title=title,
                            links=links,
                            forms=forms,
                            keywords_found=kw_found,
                            crawled_at=datetime.now(UTC),
                            circuit_id=f"circuit_{self._request_count}",
                            response_time_ms=(time.time() - start_time) * 1000,
                            content_hash=content_hash,
                        )

                except TimeoutError:
                    if attempt < self.config.max_retries - 1:
                        await asyncio.sleep(self.config.retry_delay)
                        continue
                    return DarkWebPage(
                        url=url,
                        onion_host=onion_host,
                        status_code=0,
                        html="",
                        text="",
                        title="",
                        links=[],
                        forms=[],
                        keywords_found=[],
                        crawled_at=datetime.now(UTC),
                        circuit_id=None,
                        response_time_ms=(time.time() - start_time) * 1000,
                        content_hash="",
                        error="Timeout",
                    )
                except Exception as exc:
                    if attempt < self.config.max_retries - 1:
                        await asyncio.sleep(self.config.retry_delay)
                        continue
                    return DarkWebPage(
                        url=url,
                        onion_host=onion_host,
                        status_code=0,
                        html="",
                        text="",
                        title="",
                        links=[],
                        forms=[],
                        keywords_found=[],
                        crawled_at=datetime.now(UTC),
                        circuit_id=None,
                        response_time_ms=(time.time() - start_time) * 1000,
                        content_hash="",
                        error=str(exc),
                    )

        # Should not reach here
        return DarkWebPage(
            url=url,
            onion_host=onion_host,
            status_code=0,
            html="",
            text="",
            title="",
            links=[],
            forms=[],
            keywords_found=[],
            crawled_at=datetime.now(UTC),
            circuit_id=None,
            response_time_ms=0.0,
            content_hash="",
            error="Unknown error",
        )

    async def crawl_many(
        self,
        urls: list[str],
        keywords: list[str] | None = None,
    ) -> list[DarkWebPage]:
        """Fetch multiple URLs concurrently (respects max_concurrent)."""
        tasks = [self.fetch(url, keywords) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=False)

    async def verify_tor_connection(self) -> dict[str, Any]:
        """Verify traffic is routed through Tor."""
        exit_ip = await self.controller.get_exit_ip()
        return {
            "tor_available": self._session is not None,
            "controller_connected": self.controller.is_available,
            "exit_ip": exit_ip,
            "socks_proxy": (f"{self.config.tor_socks_host}:{self.config.tor_socks_port}"),
        }

# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_tor_crawler_instance: TorCrawler | None = None

def get_tor_crawler(config: TorCrawlConfig | None = None) -> TorCrawler:
    """Get or create the global TorCrawler instance."""
    global _tor_crawler_instance
    if _tor_crawler_instance is None:
        _tor_crawler_instance = TorCrawler(config or TorCrawlConfig())
    return _tor_crawler_instance

def is_onion_url(url: str) -> bool:
    """Check if a URL points to a .onion hidden service."""
    try:
        return urlparse(url).netloc.endswith(".onion")
    except Exception:
        return False
