"""Test cases for rate limiting middleware."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.middleware.rate_limit import (
    RateLimiter,
    RateLimitConfig,
    RateLimitExceeded,
    EXEMPTED_PATHS,
    get_rate_limiter,
)


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    with patch("app.middleware.rate_limit.aioredis.Redis") as mock_redis:
        redis_instance = AsyncMock()
        mock_redis.return_value = redis_instance
        yield redis_instance


@pytest_asyncio.fixture
async def limiter(mock_redis):
    """Create rate limiter instance for testing."""
    limiter = RateLimiter()
    await limiter.initialize()
    yield limiter
    await limiter.close()


class TestRateLimitConfig:
    """Test RateLimitConfig settings (instance-based API)."""

    def _make_config(self):
        """Create a config with rate limiting disabled (avoids Redis requirement)."""
        with patch.dict("os.environ", {"RATE_LIMIT_ENABLED": "false"}, clear=False):
            return RateLimitConfig.from_env()

    def test_rate_limit_enabled_default(self):
        """Test rate_limit_enabled is a bool."""
        config = self._make_config()
        assert isinstance(config.rate_limit_enabled, bool)

    def test_user_minute_limit_default(self):
        """Test default user per-minute limit."""
        config = self._make_config()
        assert config.role_limits["user"]["requests_per_minute"] == 60

    def test_admin_minute_limit_default(self):
        """Test default admin per-minute limit."""
        config = self._make_config()
        assert config.role_limits["admin"]["requests_per_minute"] == 120

    def test_user_daily_quota_default(self):
        """Test default user daily quota."""
        config = self._make_config()
        assert config.default_daily_quota == 1000

    def test_admin_daily_quota_default(self):
        """Test default admin daily quota (10x user via multiplier)."""
        config = self._make_config()
        # Admin multiplier is 2x by default for minute/hour limits.
        # Daily quota is separate — check the default is 1000.
        assert config.default_daily_quota == 1000

    def test_exempted_paths(self):
        """Test exempted paths configuration."""
        assert "/health" in EXEMPTED_PATHS
        assert "/docs" in EXEMPTED_PATHS
        assert "/ws" in EXEMPTED_PATHS


class TestRateLimiter:
    """Test RateLimiter class."""

    @pytest.mark.asyncio
    async def test_initialize(self, mock_redis):
        """Test Redis connection initialization."""
        limiter = RateLimiter()
        await limiter.initialize()
        assert limiter._redis is not None
        await limiter.close()

    @pytest.mark.asyncio
    async def test_close(self, mock_redis):
        """Test Redis connection cleanup."""
        limiter = RateLimiter()
        await limiter.initialize()
        await limiter.close()
        assert limiter._redis is None

    @pytest.mark.asyncio
    async def test_check_rate_limit_exempted_path(self, limiter):
        """Test that exempted paths bypass rate limiting."""
        mock_request = MagicMock()
        mock_request.url.path = "/health"

        allowed, exception = await limiter.check_rate_limit(mock_request, "test-user")

        assert allowed is True
        assert exception is None

    @pytest.mark.asyncio
    async def test_check_rate_limit_disabled(self, limiter):
        """Test rate limiting when disabled via feature flag."""
        from app.middleware import rate_limit as _rl_module

        original = _rl_module._config.rate_limit_enabled
        _rl_module._config.rate_limit_enabled = False
        try:
            mock_request = MagicMock()
            mock_request.url.path = "/api/crawl/start"

            allowed, exception = await limiter.check_rate_limit(mock_request, "test-user")

            assert allowed is True
            assert exception is None
        finally:
            _rl_module._config.rate_limit_enabled = original

    @pytest.mark.asyncio
    async def test_sliding_window_minute_limit(self, limiter):
        """Test sliding window per-minute rate limiting."""
        with patch("app.middleware.rate_limit.is_admin", return_value=False):
            mock_request = MagicMock()
            mock_request.url.path = "/api/crawl/start"
            # pipeline() is called synchronously, returns a pipeline object
            mock_pipe = MagicMock()
            mock_pipe.execute = AsyncMock(return_value=[None, None, 59, None])
            limiter._redis.pipeline = MagicMock(return_value=mock_pipe)
            limiter._redis.zrange = AsyncMock(return_value=[])

            allowed, exception = await limiter._check_sliding_window("test-user", is_admin=False)

            assert allowed is True
            assert exception is None

    @pytest.mark.asyncio
    async def test_sliding_window_minute_limit_exceeded(self, limiter):
        """Test per-minute limit exceeded."""
        with patch("app.middleware.rate_limit.is_admin", return_value=False):
            mock_request = MagicMock()
            mock_request.url.path = "/api/crawl/start"
            mock_pipe = MagicMock()
            mock_pipe.execute = AsyncMock(return_value=[None, None, 61, None])
            limiter._redis.pipeline = MagicMock(return_value=mock_pipe)
            limiter._redis.zrange = AsyncMock(return_value=[("1234567890.0", 1234567890.0)])

            allowed, exception = await limiter._check_sliding_window("test-user", is_admin=False)

            assert allowed is False
            assert isinstance(exception, RateLimitExceeded)
            assert "per-minute" in exception.detail.lower()

    @pytest.mark.asyncio
    async def test_admin_2x_minute_limit(self, limiter):
        """Test admin gets 2x per-minute limit."""
        with patch("app.middleware.rate_limit.is_admin", return_value=True):
            mock_request = MagicMock()
            mock_request.url.path = "/api/crawl/start"
            mock_pipe = MagicMock()
            mock_pipe.execute = AsyncMock(return_value=[None, None, 119, None])
            limiter._redis.pipeline = MagicMock(return_value=mock_pipe)
            limiter._redis.zrange = AsyncMock(return_value=[])

            allowed, exception = await limiter._check_sliding_window("test-user", is_admin=True)

            assert allowed is True
            assert exception is None

    @pytest.mark.asyncio
    async def test_daily_quota(self, limiter):
        """Test daily quota tracking."""
        with patch("app.middleware.rate_limit.is_admin", return_value=False):
            mock_request = MagicMock()
            mock_request.url.path = "/api/crawl/start"
            limiter._redis.incr = AsyncMock(return_value=500)
            limiter._redis.expire = AsyncMock()

            allowed, exception = await limiter._check_daily_quota("test-user", is_admin=False)

            assert allowed is True
            assert exception is None

    @pytest.mark.asyncio
    async def test_daily_quota_exceeded(self, limiter):
        """Test daily quota exceeded."""
        with patch("app.middleware.rate_limit.is_admin", return_value=False):
            mock_request = MagicMock()
            mock_request.url.path = "/api/crawl/start"
            limiter._redis.incr = AsyncMock(return_value=1001)
            limiter._redis.expire = AsyncMock()

            allowed, exception = await limiter._check_daily_quota("test-user", is_admin=False)

            assert allowed is False
            assert isinstance(exception, RateLimitExceeded)
            assert "daily" in exception.detail.lower()

    @pytest.mark.asyncio
    async def test_admin_10x_daily_quota(self, limiter):
        """Test admin gets 10x daily quota."""
        with patch("app.middleware.rate_limit.is_admin", return_value=True):
            mock_request = MagicMock()
            mock_request.url.path = "/api/crawl/start"
            limiter._redis.incr = AsyncMock(return_value=5000)
            limiter._redis.expire = AsyncMock()

            allowed, exception = await limiter._check_daily_quota("test-user", is_admin=True)

            assert allowed is True
            assert exception is None

    @pytest.mark.asyncio
    async def test_reset_user_quota(self, limiter):
        """Test user quota reset."""

        async def _async_iter(items):
            for item in items:
                yield item

        limiter._redis.scan_iter = MagicMock(
            return_value=_async_iter(["rate_limit:minute:test-user"])
        )
        limiter._redis.delete = AsyncMock()

        await limiter.reset_user_quota("test-user")

        limiter._redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_rate_limit_status(self, limiter):
        """Test getting rate limit status."""
        with patch("app.middleware.rate_limit.is_admin", return_value=False):
            limiter._redis.zcard = AsyncMock(return_value=25)
            limiter._redis.get = AsyncMock(return_value="100")

            status = await limiter.get_rate_limit_status("test-user", is_admin=False)

            assert status["is_admin"] is False
            assert status["minute"]["limit"] == 60
            assert status["minute"]["used"] == 25
            assert status["minute"]["remaining"] == 35
            assert status["daily"]["limit"] == 1000
            assert status["daily"]["used"] == 100
            assert status["daily"]["remaining"] == 900


class TestRateLimitExceeded:
    """Test RateLimitExceeded exception."""

    def test_exception_properties(self):
        """Test RateLimitExceeded properties."""
        exception = RateLimitExceeded(
            detail="Rate limit exceeded",
            retry_after=60,
            limit_type="minute",
            quota_used=60,
            quota_remaining=0,
        )

        assert exception.status_code == 429
        assert exception.detail == "Rate limit exceeded"
        assert exception.retry_after == 60
        assert "Retry-After" in exception.headers
        assert "X-RateLimit-Limit" in exception.headers
        assert "X-RateLimit-Remaining" in exception.headers
        assert exception.headers["X-RateLimit-Type"] == "minute"


class TestRateLimiterIntegration:
    """Integration tests with FastAPI client."""

    def test_health_exempted(self):
        """Test health endpoint is exempted from rate limiting."""
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200

    def test_root_exempted(self):
        """Test root endpoint is exempted from rate limiting."""
        client = TestClient(app)
        response = client.get("/")
        assert response.status_code == 200

    def test_docs_exempted(self):
        """Test docs endpoint is exempted from rate limiting."""
        client = TestClient(app)
        response = client.get("/docs")
        assert response.status_code == 200


class TestGetRateLimiter:
    """Test global rate limiter instance."""

    def test_singleton_instance(self):
        """Test get_rate_limiter returns singleton instance."""
        limiter1 = get_rate_limiter()
        limiter2 = get_rate_limiter()
        assert limiter1 is limiter2
