from __future__ import annotations

import logging
import time
from enum import Enum
from functools import wraps

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from app.core.exceptions import ExternalServiceError, ServiceUnavailableError

logger = logging.getLogger(__name__)


def with_retry(
    max_attempts: int = 3,
    min_wait: float = 1,
    max_wait: float = 30,
    retry_on: type[Exception] = Exception,
):
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type(retry_on),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )


lm_studio_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=5, max=30),
    retry=retry_if_exception_type((ExternalServiceError, ConnectionError, TimeoutError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)


redis_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: float | None = None
        self.success_count = 0

    def _should_attempt(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            if self.last_failure_time is None:
                return False
            elapsed = time.monotonic() - self.last_failure_time
            if elapsed >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                return True
            return False

        return True  # HALF_OPEN allows attempts

    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= 2:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
        else:
            self.failure_count = 0
            self.state = CircuitState.CLOSED

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.monotonic()

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def call(self, func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not self._should_attempt():
                raise ServiceUnavailableError(
                    f"Circuit breaker OPEN: service unavailable (failures: {self.failure_count})"
                )
            try:
                result = await func(*args, **kwargs)
                self.record_success()
                return result
            except Exception:
                self.record_failure()
                raise

        return wrapper
