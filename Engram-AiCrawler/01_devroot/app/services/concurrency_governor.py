"""Concurrency Governor — Phase 6.5.

Provides pipeline-level rate limiting and concurrency control for OSINT operations.

Features:
  - Global semaphore: cap total concurrent OSINT operations
  - Per-domain rate limiting: min delay between requests to the same host
  - Per-platform throttle: respect each platform's rate limit
  - Async context manager API for easy integration
  - Stats: current active count, wait times, domain last-seen
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any
from collections.abc import AsyncIterator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_CONCURRENT_OSINT = int(os.getenv("OSINT_MAX_CONCURRENT", "5"))
MAX_CONCURRENT_CRAWLS = int(os.getenv("OSINT_MAX_CONCURRENT_CRAWLS", "3"))
DEFAULT_DOMAIN_DELAY_SECS = float(os.getenv("OSINT_DOMAIN_DELAY_SECS", "2.0"))

# Per-platform minimum delay (seconds) between requests
PLATFORM_DELAYS: dict[str, float] = {
    "linkedin": 5.0,
    "facebook": 5.0,
    "instagram": 4.0,
    "twitter": 3.0,
    "tiktok": 3.0,
    "reddit": 2.0,
    "github": 1.0,
    "pipl": 3.0,
    "spokeo": 3.0,
    "whitepages": 2.0,
    "intelius": 3.0,
    "beenverified": 3.0,
    "default": DEFAULT_DOMAIN_DELAY_SECS,
}


# ---------------------------------------------------------------------------
# Domain rate limiter
# ---------------------------------------------------------------------------


class DomainRateLimiter:
    """Tracks last-request time per domain and enforces minimum delays.

    Thread-safe via asyncio.Lock per domain.
    """

    def __init__(self) -> None:
        self._last_request: dict[str, float] = defaultdict(float)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._wait_counts: dict[str, int] = defaultdict(int)

    def _get_delay(self, domain: str) -> float:
        """Return the configured delay for a domain/platform."""
        domain_lower = domain.lower()
        for platform, delay in PLATFORM_DELAYS.items():
            if platform in domain_lower:
                return delay
        return PLATFORM_DELAYS["default"]

    async def acquire(self, domain: str) -> float:
        """Wait until the domain's rate limit allows a new request.

        Returns the actual wait time in seconds.
        """
        async with self._locks[domain]:
            now = time.monotonic()
            required_delay = self._get_delay(domain)
            last = self._last_request[domain]
            elapsed = now - last
            wait_time = max(0.0, required_delay - elapsed)

            if wait_time > 0:
                self._wait_counts[domain] += 1
                logger.debug("DomainRateLimiter: waiting %.2fs for domain '%s'", wait_time, domain)
                await asyncio.sleep(wait_time)

            self._last_request[domain] = time.monotonic()
            return wait_time

    def stats(self) -> dict[str, Any]:
        return {
            "domains_seen": len(self._last_request),
            "total_waits": sum(self._wait_counts.values()),
            "per_domain_waits": dict(self._wait_counts),
            "configured_delays": PLATFORM_DELAYS,
        }


# ---------------------------------------------------------------------------
# Global concurrency semaphores
# ---------------------------------------------------------------------------


class ConcurrencyGovernor:
    """Central concurrency controller for OSINT operations.

    Usage:
        governor = ConcurrencyGovernor()

        # Limit concurrent OSINT scans
        async with governor.osint_scan('linkedin'):
            await do_platform_crawl(...)

        # Limit concurrent deep crawls
        async with governor.deep_crawl():
            await run_deep_crawl(...)
    """

    def __init__(
        self,
        max_concurrent_osint: int = MAX_CONCURRENT_OSINT,
        max_concurrent_crawls: int = MAX_CONCURRENT_CRAWLS,
    ) -> None:
        self._osint_semaphore = asyncio.Semaphore(max_concurrent_osint)
        self._crawl_semaphore = asyncio.Semaphore(max_concurrent_crawls)
        self._domain_limiter = DomainRateLimiter()
        self._active_osint = 0
        self._active_crawls = 0
        self._total_osint_ops = 0
        self._total_crawl_ops = 0
        self._total_wait_time = 0.0
        self._lock = asyncio.Lock()

    @asynccontextmanager
    async def osint_scan(self, domain: str = "default") -> AsyncIterator[None]:
        """Context manager for a rate-limited OSINT scan operation."""
        # First apply domain rate limiting
        wait_secs = await self._domain_limiter.acquire(domain)
        self._total_wait_time += wait_secs

        # Then acquire global semaphore
        async with self._osint_semaphore:
            async with self._lock:
                self._active_osint += 1
                self._total_osint_ops += 1
            try:
                yield
            finally:
                async with self._lock:
                    self._active_osint -= 1

    @asynccontextmanager
    async def deep_crawl(self, domain: str = "default") -> AsyncIterator[None]:
        """Context manager for a rate-limited deep crawl operation."""
        wait_secs = await self._domain_limiter.acquire(domain)
        self._total_wait_time += wait_secs

        async with self._crawl_semaphore:
            async with self._lock:
                self._active_crawls += 1
                self._total_crawl_ops += 1
            try:
                yield
            finally:
                async with self._lock:
                    self._active_crawls -= 1

    @asynccontextmanager
    async def platform_crawl(self, platform: str) -> AsyncIterator[None]:
        """Context manager for a single platform crawl (uses osint_scan semaphore)."""
        async with self.osint_scan(domain=platform):
            yield

    def stats(self) -> dict[str, Any]:
        return {
            "active_osint_scans": self._active_osint,
            "active_crawls": self._active_crawls,
            "total_osint_ops": self._total_osint_ops,
            "total_crawl_ops": self._total_crawl_ops,
            "total_wait_time_secs": round(self._total_wait_time, 2),
            "max_concurrent_osint": MAX_CONCURRENT_OSINT,
            "max_concurrent_crawls": MAX_CONCURRENT_CRAWLS,
            "domain_limiter": self._domain_limiter.stats(),
        }

    def is_at_capacity(self) -> bool:
        """True if both semaphores are fully occupied."""
        return (
            self._active_osint >= MAX_CONCURRENT_OSINT
            and self._active_crawls >= MAX_CONCURRENT_CRAWLS
        )


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_governor_instance: ConcurrencyGovernor | None = None


def get_concurrency_governor() -> ConcurrencyGovernor:
    global _governor_instance
    if _governor_instance is None:
        _governor_instance = ConcurrencyGovernor()
    return _governor_instance
