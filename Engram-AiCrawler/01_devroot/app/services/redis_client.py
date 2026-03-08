"""Redis client service for rate limiting with Upstash Redis."""

from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio
from redis.asyncio.connection import ConnectionPool  # noqa: F401 – kept for downstream imports

from app.config.rate_limit import (
    RateLimitConfig,
    get_rate_limit_config,
    RateLimitException,
    get_remaining_time_until_midnight,
)

logger = logging.getLogger(__name__)

# Global Redis client instance
_redis_client: redis.asyncio.Redis | None = None


@asynccontextmanager
async def get_redis_client(config: RateLimitConfig | None = None):
    """Get or create a Redis client instance.

    This is an async context manager that yields a Redis client.
    The client is managed globally to allow connection reuse.

    Args:
        config: Optional rate limit configuration. If not provided,
                it will be loaded from environment.

    Yields:
        redis.asyncio.Redis: Redis client instance
    """

    global _redis_client

    if _redis_client is None:
        from app.services.redis_pool import get_redis_pool

        _redis_client = await get_redis_pool()
        logger.info("Redis client initialized from shared pool")

    try:
        yield _redis_client
    except Exception as e:
        logger.error(f"Redis client error: {e}")
        raise


class RateLimitService:
    """Rate limiting service using Upstash Redis."""

    def __init__(self, config: RateLimitConfig | None = None):
        self.config = config or get_rate_limit_config()

    async def check_rate_limit(
        self,
        user_id: str,
        role: str = "user",
    ) -> dict[str, Any]:
        """Check if a user is within rate limits.

        Performs atomic rate limit checks for minute, hour, and daily windows.

        Args:
            user_id: User identifier (or IP for anonymous users)
            role: User role for tiered limits ('admin' or 'user')

        Returns:
            Dict with keys: allowed (bool), current_count, limit, remaining, reset_time, retry_after

        Raises:
            RateLimitException: If rate limit is exceeded
        """
        limits = self.config.get_role_limits(role)
        minute_limit = limits["requests_per_minute"]
        hour_limit = limits["requests_per_hour"]

        minute_key = f"{self.config.redis_prefix}:rate_limit:{user_id}:minute"
        hour_key = f"{self.config.redis_prefix}:rate_limit:{user_id}:hour"

        try:
            async with get_redis_client(self.config) as client:
                # Use pipeline for atomic operations
                pipe = client.pipeline()

                # Increment counters with TTL
                pipe.incr(minute_key)
                pipe.expire(minute_key, 60)
                pipe.incr(hour_key)
                pipe.expire(hour_key, 3600)

                results = await pipe.execute()

                minute_count = results[0]
                hour_count = results[2]

                # Check daily quota if enabled
                daily_info = None
                if self.config.daily_quota_enabled:
                    daily_info = await self._check_daily_quota(client, user_id, role)
                    if not daily_info["allowed"]:
                        raise RateLimitException(
                            "Daily quota exceeded",
                            retry_after=daily_info["reset_time"],
                        )

                # Check minute limit
                minute_remaining = max(0, minute_limit - minute_count)
                if minute_count > minute_limit:
                    raise RateLimitException(
                        "Rate limit exceeded (per minute)",
                        retry_after=60,
                    )

                # Check hour limit
                hour_remaining = max(0, hour_limit - hour_count)
                if hour_count > hour_limit:
                    raise RateLimitException(
                        "Rate limit exceeded (per hour)",
                        retry_after=3600,
                    )

                return {
                    "allowed": True,
                    "minute": {
                        "current": minute_count,
                        "limit": minute_limit,
                        "remaining": minute_remaining,
                        "reset_in": 60,
                    },
                    "hour": {
                        "current": hour_count,
                        "limit": hour_limit,
                        "remaining": hour_remaining,
                        "reset_in": 3600,
                    },
                    "daily": daily_info,
                }

        except RateLimitException:
            raise
        except Exception as e:
            # Fail open - log error and allow request
            logger.warning(f"Rate limit check failed, failing open: {e}")
            return {
                "allowed": True,
                "minute": {
                    "current": 0,
                    "limit": minute_limit,
                    "remaining": minute_limit,
                    "reset_in": 60,
                },
                "hour": {
                    "current": 0,
                    "limit": hour_limit,
                    "remaining": hour_limit,
                    "reset_in": 3600,
                },
                "daily": None,
                "error": str(e),
            }

    async def _check_daily_quota(
        self,
        client: redis.asyncio.Redis,
        user_id: str,
        role: str = "user",
    ) -> dict[str, Any]:
        """Check daily quota for a user.

        Args:
            client: Redis client instance
            user_id: User identifier
            role: User role for tiered limits

        Returns:
            Dict with quota information
        """
        limits = self.config.get_role_limits(role)
        daily_limit = limits["daily_quota"]
        daily_key = f"{self.config.redis_prefix}:rate_limit:{user_id}:daily"

        # Get seconds until midnight
        seconds_until_midnight = get_remaining_time_until_midnight()

        # Increment daily counter with TTL until midnight
        pipe = client.pipeline()
        pipe.incr(daily_key)
        pipe.expire(daily_key, seconds_until_midnight)
        results = await pipe.execute()

        daily_count = results[0]
        daily_remaining = max(0, daily_limit - daily_count)

        return {
            "enabled": True,
            "current": daily_count,
            "limit": daily_limit,
            "remaining": daily_remaining,
            "reset_time": seconds_until_midnight,
            "allowed": daily_count <= daily_limit,
        }

    async def reset_rate_limit(
        self,
        user_id: str,
        window: str = "minute",
    ) -> bool:
        """Reset rate limit counter for a user.

        Args:
            user_id: User identifier
            window: Time window to reset ('minute', 'hour', or 'all')

        Returns:
            True if reset was successful, False otherwise
        """
        try:
            async with get_redis_client(self.config) as client:
                if window == "all":
                    # Reset all windows
                    keys = [
                        f"{self.config.redis_prefix}:rate_limit:{user_id}:minute",
                        f"{self.config.redis_prefix}:rate_limit:{user_id}:hour",
                    ]
                    if self.config.daily_quota_enabled:
                        keys.append(f"{self.config.redis_prefix}:rate_limit:{user_id}:daily")
                    await client.delete(*keys)
                else:
                    key = f"{self.config.redis_prefix}:rate_limit:{user_id}:{window}"
                    await client.delete(key)

                logger.info(f"Rate limit reset for user {user_id}, window: {window}")
                return True

        except Exception as e:
            logger.error(f"Failed to reset rate limit: {e}")
            return False

    async def reset_daily_quota(self, user_id: str) -> bool:
        """Reset daily quota for a user.

        Args:
            user_id: User identifier

        Returns:
            True if reset was successful, False otherwise
        """
        try:
            async with get_redis_client(self.config) as client:
                daily_key = f"{self.config.redis_prefix}:rate_limit:{user_id}:daily"
                await client.delete(daily_key)
                logger.info(f"Daily quota reset for user {user_id}")
                return True

        except Exception as e:
            logger.error(f"Failed to reset daily quota: {e}")
            return False

    async def get_user_rate_limit_info(
        self,
        user_id: str,
        role: str = "user",
    ) -> dict[str, Any]:
        """Get current rate limit information for a user without incrementing counters.

        Args:
            user_id: User identifier
            role: User role for tiered limits

        Returns:
            Dict with current usage and limits
        """
        limits = self.config.get_role_limits(role)
        minute_limit = limits["requests_per_minute"]
        hour_limit = limits["requests_per_hour"]

        try:
            async with get_redis_client(self.config) as client:
                minute_key = f"{self.config.redis_prefix}:rate_limit:{user_id}:minute"
                hour_key = f"{self.config.redis_prefix}:rate_limit:{user_id}:hour"

                pipe = client.pipeline()
                pipe.get(minute_key)
                pipe.get(hour_key)
                results = await pipe.execute()

                minute_count = int(results[0] or 0)
                hour_count = int(results[1] or 0)

                daily_info = None
                if self.config.daily_quota_enabled:
                    daily_key = f"{self.config.redis_prefix}:rate_limit:{user_id}:daily"
                    daily_count = int(await client.get(daily_key) or 0)
                    daily_limit = limits["daily_quota"]
                    daily_info = {
                        "current": daily_count,
                        "limit": daily_limit,
                        "remaining": max(0, daily_limit - daily_count),
                    }

                return {
                    "user_id": user_id,
                    "role": role,
                    "limits": {
                        "minute": {"limit": minute_limit, "current": minute_count},
                        "hour": {"limit": hour_limit, "current": hour_count},
                        "daily": daily_info,
                    },
                }

        except Exception as e:
            logger.error(f"Failed to get rate limit info: {e}")
            return {
                "user_id": user_id,
                "role": role,
                "error": str(e),
            }


async def close_redis_client():
    """Close the global Redis client connection."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis client connection closed")


# Singleton instance
_rate_limit_service: RateLimitService | None = None


def get_rate_limit_service() -> RateLimitService:
    """Get the rate limit service instance."""
    global _rate_limit_service
    if _rate_limit_service is None:
        _rate_limit_service = RateLimitService()
    return _rate_limit_service
