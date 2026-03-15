"""Extended tests for retry decorators and resilience patterns."""

import pytest
import time
from datetime import datetime

from app.core.retry import (
    with_retry,
    CircuitBreaker,
    CircuitState,
)
from app.core.exceptions import ServiceUnavailableError


class TestWithRetryEdgeCases:
    """Extended tests for with_retry decorator."""

    @pytest.mark.asyncio
    async def test_with_retry_zero_delay(self):
        """Test retry with zero delay between attempts."""
        call_count = 0

        @with_retry(max_attempts=3, min_wait=0, max_wait=0)
        async def quick_retry():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("fail")
            return "success"

        result = await quick_retry()
        assert result == "success"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_with_retry_multiple_exception_types(self):
        """Test retry with multiple exception types."""
        call_count = 0

        @with_retry(max_attempts=3, min_wait=0.01, retry_on=(ConnectionError, TimeoutError))
        async def multi_exception():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ConnectionError("connection fail")
            elif call_count == 2:
                raise TimeoutError("timeout")
            return "success"

        result = await multi_exception()
        assert result == "success"
        assert call_count == 3


class TestCircuitBreakerExtended:
    """Extended tests for CircuitBreaker."""

    def test_circuit_breaker_initial_state(self):
        """Test circuit breaker starts in CLOSED state."""
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0

    def test_circuit_breaker_records_failure(self):
        """Test that circuit breaker records failures."""
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        cb.record_failure()
        assert cb.failure_count == 1
        assert cb.state == CircuitState.CLOSED

    def test_circuit_breaker_opens_after_threshold(self):
        """Test circuit opens after failure threshold reached."""
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=30)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_circuit_breaker_allows_call_when_closed(self):
        """Test that calls are allowed when circuit is closed."""
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        assert cb._should_attempt() is True

    def test_circuit_breaker_blocks_call_when_open(self):
        """Test that calls are blocked when circuit is open."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=30)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb._should_attempt() is False

    def test_circuit_breaker_record_success_resets_failures(self):
        """Test that recording success resets failure count."""
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2
        cb.record_success()
        assert cb.failure_count == 0

    def test_circuit_breaker_half_open_after_timeout(self):
        """Test circuit transitions to HALF_OPEN after recovery timeout."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.001)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        time.sleep(0.01)
        assert cb._should_attempt() is True
        assert cb.state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_circuit_breaker_call_decorator(self):
        """Test circuit breaker call decorator."""
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=30)

        @cb.call
        async def operation():
            return "success"

        result = await operation()
        assert result == "success"

    @pytest.mark.asyncio
    async def test_circuit_breaker_call_blocks_when_open(self):
        """Test circuit breaker call decorator blocks when open."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=30)
        cb.record_failure()

        @cb.call
        async def operation():
            return "success"

        with pytest.raises(ServiceUnavailableError):
            await operation()


class TestRetryIntegration:
    """Integration tests for retry mechanisms."""

    @pytest.mark.asyncio
    async def test_concurrent_retry_calls(self):
        """Test multiple concurrent retry operations."""
        import asyncio
        results = []

        @with_retry(max_attempts=2, min_wait=0.01)
        async def concurrent_op(index):
            await asyncio.sleep(0.01)
            results.append(index)
            return index

        tasks = [concurrent_op(i) for i in range(5)]
        await asyncio.gather(*tasks)
        assert len(results) == 5

    @pytest.mark.asyncio
    async def test_retry_eventual_success(self):
        """Test that retry eventually succeeds after failures."""
        call_count = 0

        @with_retry(max_attempts=5, min_wait=0.01)
        async def eventually_succeeds():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError(f"Attempt {call_count} failed")
            return "success"

        result = await eventually_succeeds()
        assert result == "success"
        assert call_count == 3
