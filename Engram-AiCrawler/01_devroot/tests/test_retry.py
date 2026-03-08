"""Tests for retry decorators and resilience patterns.

Extends CircuitBreaker tests from test_exceptions.py with:
- with_retry decorator tests
- lm_studio_retry tests
- redis_retry tests
"""

import pytest
from unittest.mock import AsyncMock

from app.core.retry import (
    with_retry,
    lm_studio_retry,
    redis_retry,
    CircuitBreaker,
    CircuitState,
)
from app.core.exceptions import ExternalServiceError, ServiceUnavailableError


class TestWithRetryDecorator:
    """Tests for the with_retry decorator factory."""

    @pytest.mark.asyncio
    async def test_with_retry_passes_on_success(self):
        """Successful call passes through without retry."""
        call_count = 0

        @with_retry(max_attempts=3, min_wait=0.01, max_wait=0.1)
        async def success_func():
            nonlocal call_count
            call_count += 1
            return "success"

        result = await success_func()

        assert result == "success"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_with_retry_retries_on_exception(self):
        """Retries on specified exception type."""
        call_count = 0

        @with_retry(max_attempts=3, min_wait=0.01, max_wait=0.1, retry_on=ConnectionError)
        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ConnectionError("fail")
            return "success"

        result = await flaky_func()

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_with_retry_respects_max_attempts(self):
        """Raises after max attempts exhausted."""
        call_count = 0

        @with_retry(max_attempts=2, min_wait=0.01, max_wait=0.1, retry_on=ConnectionError)
        async def always_fail():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("fail")

        with pytest.raises(ConnectionError):
            await always_fail()

        assert call_count == 2

    @pytest.mark.asyncio
    async def test_with_retry_reraises_original_exception(self):
        """Reraises the original exception after retries exhausted."""

        @with_retry(max_attempts=2, min_wait=0.01, max_wait=0.1, retry_on=ValueError)
        async def bad_value():
            raise ValueError("bad value")

        with pytest.raises(ValueError, match="bad value"):
            await bad_value()

    @pytest.mark.asyncio
    async def test_with_retry_only_retries_specified_exception(self):
        """Does not retry on non-specified exception types."""
        call_count = 0

        @with_retry(max_attempts=3, min_wait=0.01, max_wait=0.1, retry_on=ConnectionError)
        async def wrong_exception():
            nonlocal call_count
            call_count += 1
            raise ValueError("bad")

        with pytest.raises(ValueError):
            await wrong_exception()

        assert call_count == 1  # No retries

    @pytest.mark.asyncio
    async def test_with_retry_passes_args_and_kwargs(self):
        """Passes through function arguments correctly."""
        received_args = None

        @with_retry(max_attempts=2, min_wait=0.01, max_wait=0.1)
        async def func_with_args(*args, **kwargs):
            nonlocal received_args
            received_args = (args, kwargs)
            return "ok"

        await func_with_args("arg1", "arg2", kwarg1="kw1", kwarg2="kw2")

        assert received_args == (("arg1", "arg2"), {"kwarg1": "kw1", "kwarg2": "kw2"})


class TestLMStudioRetry:
    """Tests for the lm_studio_retry decorator."""

    @pytest.mark.asyncio
    async def test_lm_studio_retry_on_external_service_error(self):
        """Retries on ExternalServiceError."""
        call_count = 0

        @lm_studio_retry
        async def flaky_lm():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ExternalServiceError("fail")
            return "success"

        result = await flaky_lm()

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_lm_studio_retry_on_connection_error(self):
        """Retries on ConnectionError."""
        call_count = 0

        @lm_studio_retry
        async def flaky_connection():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ConnectionError("network fail")
            return "success"

        result = await flaky_connection()

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_lm_studio_retry_on_timeout_error(self):
        """Retries on TimeoutError."""
        call_count = 0

        @lm_studio_retry
        async def timeout_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise TimeoutError("timed out")
            return "success"

        result = await timeout_func()

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_lm_studio_retry_max_attempts(self):
        """Respects max attempts of 3."""
        call_count = 0

        @lm_studio_retry
        async def always_fail():
            nonlocal call_count
            call_count += 1
            raise ExternalServiceError("fail")

        with pytest.raises(ExternalServiceError):
            await always_fail()

        assert call_count == 3

    @pytest.mark.asyncio
    async def test_lm_studio_retry_no_retry_on_other_exceptions(self):
        """Does not retry on non-specified exception types."""
        call_count = 0

        @lm_studio_retry
        async def wrong_error():
            nonlocal call_count
            call_count += 1
            raise ValueError("bad")

        with pytest.raises(ValueError):
            await wrong_error()

        assert call_count == 1


class TestRedisRetry:
    """Tests for the redis_retry decorator."""

    @pytest.mark.asyncio
    async def test_redis_retry_on_connection_error(self):
        """Retries on ConnectionError."""
        call_count = 0

        @redis_retry
        async def flaky_redis():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ConnectionError("redis down")
            return "success"

        result = await flaky_redis()

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_redis_retry_on_timeout_error(self):
        """Retries on TimeoutError."""
        call_count = 0

        @redis_retry
        async def timeout_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise TimeoutError("timeout")
            return "success"

        result = await timeout_func()

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_redis_retry_on_os_error(self):
        """Retries on OSError."""
        call_count = 0

        @redis_retry
        async def os_error_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise OSError("socket error")
            return "success"

        result = await os_error_func()

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_redis_retry_max_attempts(self):
        """Respects max attempts of 3."""
        call_count = 0

        @redis_retry
        async def always_fail():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("fail")

        with pytest.raises(ConnectionError):
            await always_fail()

        assert call_count == 3


class TestCircuitBreakerIntegration:
    """Tests for CircuitBreaker combined with retry patterns."""

    @pytest.mark.asyncio
    async def test_circuit_breaker_with_successful_calls(self):
        """Circuit breaker allows multiple successful calls."""
        cb = CircuitBreaker(failure_threshold=3)
        mock_fn = AsyncMock(return_value="ok")
        wrapped = cb.call(mock_fn)

        for _ in range(5):
            result = await wrapped()
            assert result == "ok"

        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0

    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_after_threshold_failures(self):
        """Circuit breaker opens after threshold failures."""
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=999)
        mock_fn = AsyncMock(side_effect=ConnectionError("fail"))
        wrapped = cb.call(mock_fn)

        # First failure
        with pytest.raises(ConnectionError):
            await wrapped()
        assert cb.state == CircuitState.CLOSED

        # Second failure - opens circuit
        with pytest.raises(ConnectionError):
            await wrapped()
        assert cb.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_circuit_breaker_blocks_when_open(self):
        """Circuit breaker blocks calls when open."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=999)
        mock_fn = AsyncMock(return_value="ok")
        wrapped = cb.call(mock_fn)

        # Trigger open state
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # Should raise ServiceUnavailableError without calling function
        with pytest.raises(ServiceUnavailableError, match="Circuit breaker OPEN"):
            await wrapped()

        mock_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_circuit_breaker_half_open_allows_one_attempt(self):
        """Circuit breaker in HALF_OPEN allows attempts."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # Wait for recovery timeout
        import time

        time.sleep(0.02)

        # Should attempt (transitions to HALF_OPEN)
        assert cb._should_attempt() is True
        assert cb.state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_circuit_breaker_custom_threshold(self):
        """Circuit breaker respects custom failure threshold."""
        cb = CircuitBreaker(failure_threshold=10, recovery_timeout=60)

        for _ in range(9):
            cb.record_failure()

        assert cb.state == CircuitState.CLOSED

        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_circuit_breaker_custom_recovery_timeout(self):
        """Circuit breaker respects custom recovery timeout."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # Should still block immediately
        assert cb._should_attempt() is False

        # Wait for recovery
        import time

        time.sleep(0.06)
        assert cb._should_attempt() is True
