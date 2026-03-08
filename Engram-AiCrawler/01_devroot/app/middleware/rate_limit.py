"""Rate limiting middleware using Upstash Redis for distributed rate limiting.

This module implements tiered rate limiting with:
- Sliding window algorithm for per-minute limits
- Daily quota tracking with midnight UTC reset
- Tiered limits: admin 2x user limits, 10x daily quota
- HTTP 429 with Retry-After header
- Feature flag support (RATE_LIMIT_ENABLED)
"""


from __future__ import annotations
import os
from datetime import datetime, timedelta, UTC

import redis.asyncio as aioredis
from redis.asyncio.connection import ConnectionPool  # noqa: F401 – kept for type hints
from fastapi import Request, HTTPException, status

from app.utils.auth import is_admin
from app.utils.auth import get_user_id
from app.config.rate_limit import RateLimitConfig, get_rate_limit_config


try:
    _config = get_rate_limit_config()
except ValueError:
    # Fallback for standard Redis deployments (non-Upstash):
    # preserves backward-compat when UPSTASH_REDIS_REST_URL is not configured.
    _user_rpm = int(os.getenv("USER_REQUESTS_PER_MINUTE", "60"))
    _admin_rpm = int(os.getenv("ADMIN_REQUESTS_PER_MINUTE", "120"))
    _user_dq = int(os.getenv("USER_DAILY_QUOTA", "1000"))
    _admin_dq = int(os.getenv("ADMIN_DAILY_QUOTA", "10000"))
    _config = RateLimitConfig(
        rate_limit_enabled=os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true",
        redis_url=os.getenv("REDIS_URL", "redis://redis:6379/0"),
        redis_prefix="rl",
        default_requests_per_minute=_user_rpm,
        default_requests_per_hour=_user_rpm * 5,
        daily_quota_enabled=True,
        default_daily_quota=_user_dq,
        role_limits={
            "admin": {
                "requests_per_minute": _admin_rpm,
                "requests_per_hour": _admin_rpm * 5,
                "daily_quota": _admin_dq,
            },
            "user": {
                "requests_per_minute": _user_rpm,
                "requests_per_hour": _user_rpm * 5,
                "daily_quota": _user_dq,
            },
        },
        retry_after_seconds=60,
        include_rate_limit_headers=True,
    )

EXEMPTED_PATHS: list = [
    "/health",
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/ws",
]


class RateLimitExceeded(HTTPException):
    """Exception raised when rate limit is exceeded."""

    def __init__(
        self,
        detail: str,
        retry_after: int,
        limit_type: str,
        quota_used: int,
        quota_remaining: int,
    ):
        headers = {
            "Retry-After": str(retry_after),
            "X-RateLimit-Limit": str(quota_used + quota_remaining),
            "X-RateLimit-Remaining": str(quota_remaining),
            "X-RateLimit-Reset": str(int(datetime.now(UTC).timestamp() + retry_after)),
            "X-RateLimit-Type": limit_type,
        }
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers=headers,
        )
        self.retry_after = retry_after


class RateLimiter:
    """Distributed rate limiter using Upstash Redis."""

    def __init__(self):
        self._pool: ConnectionPool | None = None
        self._redis: aioredis.Redis | None = None

    async def initialize(self):
        """Initialize Redis connection (uses shared pool)."""
        if self._redis is not None:
            return

        from app.services.redis_pool import get_redis_pool

        self._redis = await get_redis_pool()

    async def close(self):
        """Release reference to shared Redis client (pool managed by app lifespan)."""
        self._redis = None
        self._pool = None

    async def check_rate_limit(
        self, request: Request, identifier: str
    ) -> tuple[bool, RateLimitExceeded | None]:
        """
        Check if request should be rate limited.

        Args:
            request: FastAPI Request object
            identifier: Unique identifier (user ID, IP address, etc.)

        Returns:
            Tuple of (allowed, rate_limit_exception)
        """
        if not _config.rate_limit_enabled:
            return True, None

        if request.url.path in EXEMPTED_PATHS:
            return True, None

        await self.initialize()

        is_user_admin = await is_admin(request)

        minute_allowed, minute_exception = await self._check_sliding_window(
            identifier, is_user_admin
        )
        if not minute_allowed:
            return False, minute_exception

        daily_allowed, daily_exception = await self._check_daily_quota(identifier, is_user_admin)
        if not daily_allowed:
            return False, daily_exception

        return True, None

    async def _check_sliding_window(
        self, identifier: str, is_admin: bool
    ) -> tuple[bool, RateLimitExceeded | None]:
        """
        Check sliding window rate limit (per minute).

        Uses Redis sorted set to track request timestamps.
        """
        assert self._redis is not None, "Redis not initialized"

        current_time = datetime.now(UTC)
        window_start = current_time - timedelta(seconds=60)

        key = f"rate_limit:minute:{identifier}"
        limit = (
            _config.role_limits["admin"]["requests_per_minute"]
            if is_admin
            else _config.role_limits["user"]["requests_per_minute"]
        )

        pipe = self._redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start.timestamp())
        pipe.zadd(key, {str(current_time.timestamp()): current_time.timestamp()})
        pipe.zcard(key)
        pipe.expire(key, 120)

        results = await pipe.execute()
        count = results[2]

        if count > limit:
            oldest = await self._redis.zrange(key, 0, 0, withscores=True)
            if oldest:
                retry_after = int(oldest[0][1] - current_time.timestamp()) + 1
            else:
                retry_after = 60

            return False, RateLimitExceeded(
                detail=f"Per-minute rate limit exceeded ({limit} requests/minute)",
                retry_after=max(1, retry_after),
                limit_type="minute",
                quota_used=limit,
                quota_remaining=0,
            )

        return True, None

    async def _check_daily_quota(
        self, identifier: str, is_admin: bool
    ) -> tuple[bool, RateLimitExceeded | None]:
        """
        Check daily quota limit.

        Quota resets at midnight UTC.
        """
        assert self._redis is not None, "Redis not initialized"

        current_time = datetime.now(UTC)
        today = current_time.date()

        key = f"rate_limit:daily:{identifier}:{today.isoformat()}"
        limit = (
            _config.role_limits["admin"]["daily_quota"]
            if is_admin
            else _config.role_limits["user"]["daily_quota"]
        )

        usage = await self._redis.incr(key)

        if usage > limit:
            tomorrow = (current_time + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            retry_after = int((tomorrow - current_time).total_seconds())

            return False, RateLimitExceeded(
                detail=f"Daily quota exceeded ({limit} requests/day)",
                retry_after=retry_after,
                limit_type="daily",
                quota_used=limit,
                quota_remaining=0,
            )

        end_of_day = current_time.replace(hour=23, minute=59, second=59, microsecond=999999)
        ttl_seconds = int((end_of_day - current_time).total_seconds()) + 1
        await self._redis.expire(key, ttl_seconds)

        return True, None

    async def reset_user_quota(self, identifier: str):
        """
        Reset rate limit for a specific user (admin function).

        Args:
            identifier: User identifier to reset
        """
        await self.initialize()
        assert self._redis is not None, "Redis not initialized"

        pattern = f"rate_limit:*:{identifier}"
        keys = []
        async for key in self._redis.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            await self._redis.delete(*keys)

    async def get_rate_limit_status(self, identifier: str, is_admin: bool) -> dict:
        """
        Get current rate limit status for a user.

        Args:
            identifier: User identifier
            is_admin: Whether user is admin

        Returns:
            Dict with rate limit information
        """
        await self.initialize()
        assert self._redis is not None, "Redis not initialized"

        current_time = datetime.now(UTC)
        today = current_time.date()

        minute_key = f"rate_limit:minute:{identifier}"
        minute_limit = (
            _config.role_limits["admin"]["requests_per_minute"]
            if is_admin
            else _config.role_limits["user"]["requests_per_minute"]
        )
        minute_count = await self._redis.zcard(minute_key)

        daily_key = f"rate_limit:daily:{identifier}:{today.isoformat()}"
        daily_limit = (
            _config.role_limits["admin"]["daily_quota"]
            if is_admin
            else _config.role_limits["user"]["daily_quota"]
        )
        daily_usage = int(await self._redis.get(daily_key) or 0)

        tomorrow = (current_time + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        daily_reset_seconds = int((tomorrow - current_time).total_seconds())

        return {
            "is_admin": is_admin,
            "minute": {
                "limit": minute_limit,
                "used": minute_count,
                "remaining": max(0, minute_limit - minute_count),
            },
            "daily": {
                "limit": daily_limit,
                "used": daily_usage,
                "remaining": max(0, daily_limit - daily_usage),
                "resets_in_seconds": daily_reset_seconds,
                "resets_at_utc": tomorrow.isoformat(),
            },
        }


# Global rate limiter instance
_rate_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    """Get or create global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def check_rate_limit(request: Request) -> tuple[bool, RateLimitExceeded | None]:
    """
    Check rate limit for a request.

    This function determines the identifier to use (user ID from auth,
    or IP address fallback) and checks against rate limits.

    Args:
        request: FastAPI Request object

    Returns:
        Tuple of (allowed, rate_limit_exception)
    """
    limiter = get_rate_limiter()

    try:
        user_id = await get_user_id(request)
        identifier = f"user:{user_id}"
    except HTTPException:
        identifier = f"ip:{request.client.host if request.client else 'unknown'}"

    return await limiter.check_rate_limit(request, identifier)
