import pytest
import time
from unittest.mock import AsyncMock

from app.core.exceptions import (
    AppError,
    ExternalServiceError,
    CrawlError,
    ValidationError,
    StorageError,
    RateLimitError,
    AuthenticationError,
    AuthorizationError,
    ServiceUnavailableError,
)
from app.core.retry import CircuitBreaker, CircuitState


class TestExceptionHierarchy:
    def test_app_error_defaults(self):
        err = AppError("something broke")
        assert err.message == "something broke"
        assert err.status_code == 500
        assert err.correlation_id is not None

    def test_app_error_to_dict(self):
        err = AppError("test", correlation_id="cid-123")
        d = err.to_dict()
        assert d["error"] == "test"
        assert d["status_code"] == 500
        assert d["correlation_id"] == "cid-123"
        assert "timestamp" in d

    def test_external_service_error(self):
        err = ExternalServiceError("LM Studio down")
        assert err.status_code == 502

    def test_crawl_error(self):
        assert CrawlError("fail").status_code == 500

    def test_validation_error(self):
        assert ValidationError("bad input").status_code == 400

    def test_storage_error(self):
        assert StorageError("db fail").status_code == 500

    def test_rate_limit_error(self):
        assert RateLimitError("too fast").status_code == 429

    def test_authentication_error(self):
        assert AuthenticationError("no token").status_code == 401

    def test_authorization_error(self):
        assert AuthorizationError("forbidden").status_code == 403

    def test_service_unavailable_error(self):
        assert ServiceUnavailableError("circuit open").status_code == 503

    def test_custom_status_code_override(self):
        err = AppError("custom", status_code=418)
        assert err.status_code == 418

    def test_exception_inherits_from_exception(self):
        err = ExternalServiceError("test")
        assert isinstance(err, Exception)
        assert isinstance(err, AppError)


class TestCircuitBreaker:
    def test_starts_closed(self):
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=10)
        assert cb.state == CircuitState.CLOSED

    def test_opens_after_threshold(self):
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=10)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_open_blocks_requests(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=999)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb._should_attempt() is False

    def test_half_open_after_recovery_timeout(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        time.sleep(0.02)
        assert cb._should_attempt() is True
        assert cb.state == CircuitState.HALF_OPEN

    def test_half_open_success_closes(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()
        time.sleep(0.02)
        cb._should_attempt()
        cb.record_success()
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_failure_reopens(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()
        time.sleep(0.02)
        cb._should_attempt()
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_success_resets_failure_count(self):
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb.failure_count == 0

    @pytest.mark.asyncio
    async def test_call_decorator_passes_on_success(self):
        cb = CircuitBreaker(failure_threshold=3)
        mock_fn = AsyncMock(return_value="ok")
        wrapped = cb.call(mock_fn)
        result = await wrapped()
        assert result == "ok"
        mock_fn.assert_called_once()

    @pytest.mark.asyncio
    async def test_call_decorator_records_failure(self):
        cb = CircuitBreaker(failure_threshold=3)
        mock_fn = AsyncMock(side_effect=ConnectionError("fail"))
        wrapped = cb.call(mock_fn)
        with pytest.raises(ConnectionError):
            await wrapped()
        assert cb.failure_count == 1

    @pytest.mark.asyncio
    async def test_call_decorator_blocks_when_open(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=999)
        cb.record_failure()
        mock_fn = AsyncMock(return_value="ok")
        wrapped = cb.call(mock_fn)
        with pytest.raises(ServiceUnavailableError):
            await wrapped()
        mock_fn.assert_not_called()
