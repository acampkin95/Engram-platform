"""Base Platform Adapter — abstract crawl interface with rate limiting and stealth.

All platform-specific adapters inherit from PlatformCrawlerBase, which handles:
- Rate limiting (per-platform delay + jitter)
- User-agent rotation (realistic browser strings)
- crawl4ai configuration (headless, JS, timeouts)
- Graceful fallback when JS rendering fails
- Result normalisation into a common CrawlResult dict
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field

from app.osint.platforms.registry import PlatformAdapter, get_registry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Rotating user-agent pool (realistic desktop + mobile strings)
# ---------------------------------------------------------------------------

_USER_AGENTS = [
    # Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    # Chrome on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    # Firefox on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    # Safari on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    # Edge on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
]


def _random_user_agent() -> str:
    return random.choice(_USER_AGENTS)


# ---------------------------------------------------------------------------
# Platform crawl result
# ---------------------------------------------------------------------------


class PlatformCrawlResult(BaseModel):
    """Normalised result from any platform crawl."""

    platform_id: str
    query: str
    url: str
    success: bool
    markdown: str | None = None
    error: str | None = None

    # Structured extractions (platform adapters fill these directly)
    names: list[str] = Field(default_factory=list)
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    addresses: list[str] = Field(default_factory=list)
    usernames: list[str] = Field(default_factory=list)
    image_urls: list[str] = Field(default_factory=list)
    profile_urls: list[str] = Field(default_factory=list)  # Profile URLs found on page
    relationships: list[dict[str, str]] = Field(default_factory=list)

    # For passing into EntityEnrichmentPipeline.extract_pii()
    def to_crawl_dict(self) -> dict[str, Any]:
        """Convert to the format expected by EntityEnrichmentPipeline.extract_pii()."""
        return {
            "success": self.success,
            "query": self.url,
            "markdown": self.markdown or "",
        }


# ---------------------------------------------------------------------------
# Rate limiter per platform
# ---------------------------------------------------------------------------


class _PerPlatformRateLimiter:
    """Tracks last request time per platform and enforces minimum delay."""

    def __init__(self) -> None:
        self._last_request: dict[str, float] = {}

    async def wait(self, platform_id: str, delay: float) -> None:
        """Wait until at least `delay` seconds have passed since last request."""
        now = time.monotonic()
        last = self._last_request.get(platform_id, 0.0)
        elapsed = now - last
        # Add 10-30% jitter to look more human
        jitter = delay * random.uniform(0.1, 0.3)
        wait_time = max(0.0, (delay + jitter) - elapsed)
        if wait_time > 0:
            logger.debug(f"[{platform_id}] rate-limit wait {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
        self._last_request[platform_id] = time.monotonic()


_rate_limiter = _PerPlatformRateLimiter()


# ---------------------------------------------------------------------------
# Base adapter
# ---------------------------------------------------------------------------


class PlatformCrawlerBase(ABC):
    """Abstract base for all platform crawlers.

    Subclasses override `search()` and optionally `_extract()`.
    """

    def __init__(self, platform: PlatformAdapter) -> None:
        self.platform = platform

    @abstractmethod
    async def search(self, query: str) -> PlatformCrawlResult:
        """Execute a search and return normalised results."""
        ...

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    async def _crawl(
        self,
        url: str,
        wait_for_selector: str | None = None,
        js_code: str | None = None,
    ) -> dict[str, Any]:
        """Perform a single crawl4ai request with platform-appropriate settings.

        Returns a dict with keys: success, markdown, error.
        """
        await _rate_limiter.wait(self.platform.id, self.platform.rate_limit_delay)

        try:
            from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

            browser_cfg = BrowserConfig(
                headless=True,
                user_agent=_random_user_agent(),
                # Extra stealth args
                extra_args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            )

            run_cfg = CrawlerRunConfig(
                check_robots_txt=True,
                cache_mode=CacheMode.ENABLED,
                word_count_threshold=30,
                page_timeout=self.platform.page_timeout_ms,
                wait_for=wait_for_selector,
                js_code=js_code,
                exclude_external_links=False,
            )

            async with AsyncWebCrawler(config=browser_cfg) as crawler:
                result = await crawler.arun(url, config=run_cfg)
                return {
                    "success": result.success,
                    "markdown": result.markdown if result.success else None,
                    "error": result.error_message if not result.success else None,
                }

        except ImportError:
            # crawl4ai not installed — return empty result (useful for tests)
            logger.warning("crawl4ai not available, returning stub")
            return {"success": False, "markdown": None, "error": "crawl4ai not available"}
        except Exception as exc:
            logger.warning(f"[{self.platform.id}] crawl failed for {url}: {exc}")
            return {"success": False, "markdown": None, "error": str(exc)}

    def _make_result(
        self,
        query: str,
        url: str,
        crawl_raw: dict[str, Any],
    ) -> PlatformCrawlResult:
        """Build a PlatformCrawlResult from a raw crawl dict."""
        return PlatformCrawlResult(
            platform_id=self.platform.id,
            query=query,
            url=url,
            success=crawl_raw.get("success", False),
            markdown=crawl_raw.get("markdown"),
            error=crawl_raw.get("error"),
        )


# ---------------------------------------------------------------------------
# Generic adapter (fallback for platforms without a custom adapter)
# ---------------------------------------------------------------------------


class GenericPlatformCrawler(PlatformCrawlerBase):
    """Generic crawl-and-pass-to-enrichment adapter.

    Used for platforms that have a registry entry but no dedicated adapter.
    Simply crawls the search URL and returns the markdown for the
    EntityEnrichmentPipeline to process.
    """

    async def search(self, query: str) -> PlatformCrawlResult:
        url = self.platform.build_search_url(query)
        raw = await self._crawl(url)
        return self._make_result(query, url, raw)


# ---------------------------------------------------------------------------
# Crawler factory
# ---------------------------------------------------------------------------


def get_crawler(platform_id: str) -> PlatformCrawlerBase:
    """Return the best available crawler for a platform.

    Returns the custom adapter if one is registered, otherwise
    falls back to GenericPlatformCrawler.
    """
    from app.osint.platforms import _CUSTOM_ADAPTERS  # imported lazily to avoid circular

    registry = get_registry()
    platform = registry.get(platform_id)
    if not platform:
        raise ValueError(f"Unknown platform: {platform_id!r}")

    adapter_cls = _CUSTOM_ADAPTERS.get(platform_id)
    if adapter_cls:
        return adapter_cls(platform)
    return GenericPlatformCrawler(platform)
