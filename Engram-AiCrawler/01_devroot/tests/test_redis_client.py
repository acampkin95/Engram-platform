"""Tests for Redis client service and RateLimitService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.redis_client import (
    RateLimitService,
    get_rate_limit_service,
    close_redis_client,
)
from app.config.rate_limit import RateLimitConfig, RateLimitException


@pytest.fixture
def mock_config():
    """Create a mock RateLimitConfig for testing."""
    return RateLimitConfig(
        rate_limit_enabled=True,
        redis_url="redis://localhost:6379",
        redis_prefix="test-prefix",
        default_requests_per_minute=60,
        default_requests_per_hour=300,
        daily_quota_enabled=True,
        default_daily_quota=1000,
        role_limits={
            "admin": {
                "requests_per_minute": 120,
                "requests_per_hour": 600,
                "daily_quota": 2000,
            },
            "user": {
                "requests_per_minute": 60,
                "requests_per_hour": 300,
                "daily_quota": 1000,
            },
        },
        retry_after_seconds=60,
        include_rate_limit_headers=True,
    )


@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    mock = AsyncMock()
    mock.pipeline = MagicMock()
    return mock


class TestRateLimitService:
    """Tests for RateLimitService class."""

    def test_init_with_default_config(self, mock_config):
        """Test RateLimitService initialization with config."""
        service = RateLimitService(config=mock_config)
        assert service.config == mock_config

    def test_init_with_none_config(self):
        """Test RateLimitService initialization without config."""
        with patch("app.services.redis_client.get_rate_limit_config") as mock_get_config:
            mock_get_config.return_value = MagicMock()
            service = RateLimitService()
            mock_get_config.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_rate_limit_allowed(self, mock_config, mock_redis):
        """Test rate limit check when under the limit."""
        service = RateLimitService(config=mock_config)

        # Mock pipeline results
        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(
            return_value=[5, None, 10, None]
        )  # minute_count, expire, hour_count, expire

        mock_redis.pipeline.return_value = mock_pipe

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)

            result = await service.check_rate_limit("test-user", role="user")

            assert result["allowed"] is True
            assert result["minute"]["current"] == 5
            assert result["minute"]["limit"] == 60
            assert result["hour"]["current"] == 10
            assert result["hour"]["limit"] == 300

    @pytest.mark.asyncio
    async def test_check_rate_limit_minute_exceeded(self, mock_config, mock_redis):
        """Test rate limit check when minute limit is exceeded."""
        service = RateLimitService(config=mock_config)

        # Mock pipeline results - exceed minute limit
        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(return_value=[61, None, 10, None])

        mock_redis.pipeline.return_value = mock_pipe

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)

            with pytest.raises(RateLimitException) as exc_info:
                await service.check_rate_limit("test-user", role="user")

            assert "per minute" in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_check_rate_limit_hour_exceeded(self, mock_config, mock_redis):
        """Test rate limit check when hour limit is exceeded."""
        service = RateLimitService(config=mock_config)

        # Mock pipeline results - exceed hour limit
        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(return_value=[5, None, 301, None])

        mock_redis.pipeline.return_value = mock_pipe

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)

            with pytest.raises(RateLimitException) as exc_info:
                await service.check_rate_limit("test-user", role="user")

            assert "per hour" in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_check_rate_limit_admin_tier(self, mock_config, mock_redis):
        """Test rate limit check for admin user (2x limits)."""
        service = RateLimitService(config=mock_config)

        # Mock pipeline results - within admin limits
        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(return_value=[100, None, 500, None])

        mock_redis.pipeline.return_value = mock_pipe

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)

            result = await service.check_rate_limit("admin-user", role="admin")

            assert result["allowed"] is True
            assert result["minute"]["limit"] == 120  # Admin gets 2x
            assert result["hour"]["limit"] == 600

    @pytest.mark.asyncio
    async def test_check_rate_limit_fail_open(self, mock_config, mock_redis):
        """Test that rate limiting fails open on Redis errors."""
        service = RateLimitService(config=mock_config)

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.side_effect = Exception("Redis connection failed")

            result = await service.check_rate_limit("test-user", role="user")

            assert result["allowed"] is True
            assert "error" in result

    @pytest.mark.asyncio
    async def test_reset_rate_limit_minute(self, mock_config, mock_redis):
        """Test resetting minute rate limit."""
        service = RateLimitService(config=mock_config)

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_redis.delete = AsyncMock(return_value=1)

            result = await service.reset_rate_limit("test-user", window="minute")

            assert result is True
            mock_redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_reset_rate_limit_hour(self, mock_config, mock_redis):
        """Test resetting hour rate limit."""
        service = RateLimitService(config=mock_config)

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_redis.delete = AsyncMock(return_value=1)

            result = await service.reset_rate_limit("test-user", window="hour")

            assert result is True

    @pytest.mark.asyncio
    async def test_reset_rate_limit_all(self, mock_config, mock_redis):
        """Test resetting all rate limits."""
        service = RateLimitService(config=mock_config)

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_redis.delete = AsyncMock(return_value=3)

            result = await service.reset_rate_limit("test-user", window="all")

            assert result is True
            # Should delete 3 keys: minute, hour, daily
            assert mock_redis.delete.call_count == 1

    @pytest.mark.asyncio
    async def test_reset_rate_limit_failure(self, mock_config, mock_redis):
        """Test reset rate limit handles failures gracefully."""
        service = RateLimitService(config=mock_config)

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_redis.delete = AsyncMock(side_effect=Exception("Redis error"))

            result = await service.reset_rate_limit("test-user", window="minute")

            assert result is False

    @pytest.mark.asyncio
    async def test_reset_daily_quota(self, mock_config, mock_redis):
        """Test resetting daily quota."""
        service = RateLimitService(config=mock_config)

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_redis.delete = AsyncMock(return_value=1)

            result = await service.reset_daily_quota("test-user")

            assert result is True

    @pytest.mark.asyncio
    async def test_get_user_rate_limit_info(self, mock_config, mock_redis):
        """Test getting rate limit info without incrementing counters."""
        service = RateLimitService(config=mock_config)

        mock_pipe = AsyncMock()
        mock_pipe.execute = AsyncMock(return_value=["25", "100"])

        mock_redis.pipeline.return_value = mock_pipe
        mock_redis.get = AsyncMock(return_value="50")

        with patch("app.services.redis_client.get_redis_client") as mock_get_client:
            mock_get_client.return_value.__aenter__ = AsyncMock(return_value=mock_redis)
            mock_get_client.return_value.__aexit__ = AsyncMock(return_value=None)

            result = await service.get_user_rate_limit_info("test-user", role="user")

            assert result["user_id"] == "test-user"
            assert result["role"] == "user"
            assert result["limits"]["minute"]["current"] == 25
            assert result["limits"]["minute"]["limit"] == 60
            assert result["limits"]["hour"]["current"] == 100
            assert result["limits"]["daily"]["current"] == 50


class TestGetRateLimitService:
    """Tests for get_rate_limit_service singleton."""

    def test_singleton_returns_same_instance(self):
        """Test that get_rate_limit_service returns the same instance."""
        with patch("app.services.redis_client._rate_limit_service", None):
            with patch("app.services.redis_client.RateLimitService") as MockService:
                mock_instance = MagicMock()
                MockService.return_value = mock_instance

                service1 = get_rate_limit_service()
                service2 = get_rate_limit_service()

                assert service1 is service2


class TestRedisClientManagement:
    """Tests for Redis client connection management."""

    @pytest.mark.asyncio
    async def test_close_redis_client(self):
        """Test closing the global Redis client."""
        with patch("app.services.redis_client._redis_client") as mock_client:
            mock_client.close = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)

            await close_redis_client()

            mock_client.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_close_redis_client_when_none(self):
        """Test closing Redis client when it's None (no-op)."""
        with patch("app.services.redis_client._redis_client", None):
            # Should not raise any exception
            await close_redis_client()


class TestRateLimitConfig:
    """Tests for RateLimitConfig."""

    def test_get_role_limits_user(self, mock_config):
        """Test getting limits for user role."""
        limits = mock_config.get_role_limits("user")
        assert limits["requests_per_minute"] == 60
        assert limits["requests_per_hour"] == 300
        assert limits["daily_quota"] == 1000

    def test_get_role_limits_admin(self, mock_config):
        """Test getting limits for admin role."""
        limits = mock_config.get_role_limits("admin")
        assert limits["requests_per_minute"] == 120
        assert limits["requests_per_hour"] == 600
        assert limits["daily_quota"] == 2000

    def test_get_role_limits_case_insensitive(self, mock_config):
        """Test that role lookup is case insensitive."""
        limits1 = mock_config.get_role_limits("USER")
        limits2 = mock_config.get_role_limits("User")

        assert limits1 == limits2

    def test_get_role_limits_unknown_defaults_to_user(self, mock_config):
        """Test that unknown roles default to user limits."""
        limits = mock_config.get_role_limits("unknown_role")
        assert limits == mock_config.role_limits["user"]

    def test_get_rate_limit_key(self, mock_config):
        """Test constructing rate limit Redis key."""
        key = mock_config.get_rate_limit_key("user-123", "minute")
        assert key == "test-prefix:rate_limit:user-123:minute"

    def test_get_daily_quota_key(self, mock_config):
        """Test constructing daily quota Redis key."""
        key = mock_config.get_daily_quota_key("user-123")
        assert key == "test-prefix:rate_limit:user-123:daily"


class TestRateLimitException:
    """Tests for RateLimitException."""

    def test_exception_init(self):
        """Test RateLimitException initialization."""
        exc = RateLimitException("Rate limit exceeded", retry_after=30)
        assert exc.message == "Rate limit exceeded"
        assert exc.retry_after == 30

    def test_exception_to_dict(self):
        """Test converting exception to dictionary."""
        exc = RateLimitException("Too many requests", retry_after=60)
        result = exc.to_dict()
        assert result["error"] == "Too many requests"
        assert result["status_code"] == 429
        assert result["retry_after"] == 60
