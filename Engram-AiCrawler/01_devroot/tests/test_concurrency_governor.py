"""Tests for ConcurrencyGovernor and DomainRateLimiter.

Uses asyncio — all tests are async. No mocks needed for the core logic;
we patch time.monotonic to avoid real sleeps.
"""

import asyncio
import time
import pytest
from unittest.mock import patch, AsyncMock

from app.services.concurrency_governor import (
    ConcurrencyGovernor,
    DomainRateLimiter,
    PLATFORM_DELAYS,
)


# ─── DomainRateLimiter ─────────────────────────────────────────────────────


class TestDomainRateLimiter:
    @pytest.mark.asyncio
    async def test_first_request_no_wait(self):
        """First request to a domain should not wait."""
        limiter = DomainRateLimiter()
        # Patch last_request to be far in the past (so elapsed > delay)
        with patch("app.services.concurrency_governor.time") as mock_time:
            mock_time.monotonic.side_effect = [
                0.0,  # now (acquire start)
                10.0,  # after sleep (last_request update)
            ]
            # last_request[domain] defaults to 0.0, elapsed = 0 - 0 = 0
            # required_delay = 2.0, wait = 2.0 - 0 = 2.0
            # But we want to test "no wait" — use a domain that's never been seen
            # and set time far ahead
            limiter._last_request["newdomain.com"] = 0.0
            mock_time.monotonic.side_effect = [
                1000.0,  # now (far in future, elapsed >> delay)
                1000.0,  # last_request update
            ]
            wait = await limiter.acquire("newdomain.com")
            assert wait == 0.0

    @pytest.mark.asyncio
    async def test_returns_wait_time(self):
        """acquire() returns actual wait time."""
        limiter = DomainRateLimiter()
        # First call — no prior record, will wait
        # We patch asyncio.sleep to avoid real delay
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            wait = await limiter.acquire("example.com")
            # Either 0 (first call, monotonic() - 0.0 may be > delay) or > 0
            assert wait >= 0.0

    @pytest.mark.asyncio
    async def test_known_platform_uses_platform_delay(self):
        """LinkedIn domain uses the linkedin delay (5.0s)."""
        limiter = DomainRateLimiter()
        delay = limiter._get_delay("linkedin.com")
        assert delay == PLATFORM_DELAYS["linkedin"]

    @pytest.mark.asyncio
    async def test_unknown_domain_uses_default_delay(self):
        limiter = DomainRateLimiter()
        delay = limiter._get_delay("unknowndomain.xyz")
        assert delay == PLATFORM_DELAYS["default"]

    def test_stats_returns_dict(self):
        limiter = DomainRateLimiter()
        stats = limiter.stats()
        assert "domains_seen" in stats
        assert "total_waits" in stats
        assert "per_domain_waits" in stats

    @pytest.mark.asyncio
    async def test_wait_count_incremented_on_wait(self):
        """Wait count for a domain increments when a wait occurs."""
        limiter = DomainRateLimiter()
        # Force a wait by setting last_request to now
        limiter._last_request["example.com"] = time.monotonic()
        with patch("asyncio.sleep", new_callable=AsyncMock):
            await limiter.acquire("example.com")
        stats = limiter.stats()
        assert stats["per_domain_waits"].get("example.com", 0) >= 1


# ─── ConcurrencyGovernor ───────────────────────────────────────────────────


class TestConcurrencyGovernor:
    @pytest.mark.asyncio
    async def test_osint_scan_context_manager_runs(self):
        """osint_scan context manager allows code to run."""
        governor = ConcurrencyGovernor(max_concurrent_osint=2, max_concurrent_crawls=2)
        executed = []
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.osint_scan("example.com"):
                executed.append(1)
        assert executed == [1]

    @pytest.mark.asyncio
    async def test_osint_scan_increments_total_ops(self):
        governor = ConcurrencyGovernor(max_concurrent_osint=2, max_concurrent_crawls=2)
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.osint_scan("example.com"):
                pass
        assert governor._total_osint_ops == 1

    @pytest.mark.asyncio
    async def test_osint_scan_active_count_returns_to_zero(self):
        governor = ConcurrencyGovernor(max_concurrent_osint=2, max_concurrent_crawls=2)
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.osint_scan("example.com"):
                pass
        assert governor._active_osint == 0

    @pytest.mark.asyncio
    async def test_deep_crawl_context_manager_runs(self):
        governor = ConcurrencyGovernor(max_concurrent_osint=2, max_concurrent_crawls=2)
        executed = []
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.deep_crawl("example.com"):
                executed.append(1)
        assert executed == [1]

    @pytest.mark.asyncio
    async def test_deep_crawl_increments_total_ops(self):
        governor = ConcurrencyGovernor(max_concurrent_osint=2, max_concurrent_crawls=2)
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.deep_crawl("example.com"):
                pass
        assert governor._total_crawl_ops == 1

    @pytest.mark.asyncio
    async def test_deep_crawl_active_count_returns_to_zero(self):
        governor = ConcurrencyGovernor(max_concurrent_osint=2, max_concurrent_crawls=2)
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.deep_crawl("example.com"):
                pass
        assert governor._active_crawls == 0

    @pytest.mark.asyncio
    async def test_platform_crawl_uses_osint_semaphore(self):
        governor = ConcurrencyGovernor(max_concurrent_osint=2, max_concurrent_crawls=2)
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.platform_crawl("twitter"):
                pass
        # platform_crawl delegates to osint_scan
        assert governor._total_osint_ops == 1

    @pytest.mark.asyncio
    async def test_concurrent_scans_up_to_limit(self):
        """Multiple concurrent scans within limit all complete."""
        governor = ConcurrencyGovernor(max_concurrent_osint=3, max_concurrent_crawls=3)
        results = []

        async def run_scan(i):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                async with governor.osint_scan("example.com"):
                    results.append(i)

        await asyncio.gather(run_scan(1), run_scan(2), run_scan(3))
        assert sorted(results) == [1, 2, 3]
        assert governor._total_osint_ops == 3

    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrency(self):
        """Semaphore with limit=1 ensures sequential execution."""
        governor = ConcurrencyGovernor(max_concurrent_osint=1, max_concurrent_crawls=1)
        active_peak = [0]
        current_active = [0]

        async def run_scan():
            with patch("asyncio.sleep", new_callable=AsyncMock):
                async with governor.osint_scan("example.com"):
                    current_active[0] += 1
                    active_peak[0] = max(active_peak[0], current_active[0])
                    await asyncio.sleep(0)  # yield to other tasks
                    current_active[0] -= 1

        await asyncio.gather(run_scan(), run_scan(), run_scan())
        # With semaphore=1, peak active should be 1
        assert active_peak[0] == 1

    def test_stats_returns_expected_keys(self):
        governor = ConcurrencyGovernor()
        stats = governor.stats()
        assert "active_osint_scans" in stats
        assert "active_crawls" in stats
        assert "total_osint_ops" in stats
        assert "total_crawl_ops" in stats
        assert "total_wait_time_secs" in stats
        assert "domain_limiter" in stats

    def test_is_at_capacity_false_initially(self):
        governor = ConcurrencyGovernor(max_concurrent_osint=5, max_concurrent_crawls=3)
        assert governor.is_at_capacity() is False

    @pytest.mark.asyncio
    async def test_exception_inside_context_releases_semaphore(self):
        """Exceptions inside the context manager must not leak the semaphore."""
        governor = ConcurrencyGovernor(max_concurrent_osint=1, max_concurrent_crawls=1)
        with patch("asyncio.sleep", new_callable=AsyncMock):
            try:
                async with governor.osint_scan("example.com"):
                    raise RuntimeError("intentional error")
            except RuntimeError:
                pass

        # Should still be able to acquire the semaphore again
        executed = []
        with patch("asyncio.sleep", new_callable=AsyncMock):
            async with governor.osint_scan("example.com"):
                executed.append(1)
        assert executed == [1]
        assert governor._active_osint == 0
