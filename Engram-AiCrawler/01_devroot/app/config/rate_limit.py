"""Rate limiting configuration module for Upstash Redis-based distributed rate limiting."""

import os
from dataclasses import dataclass
from dotenv import load_dotenv
from datetime import UTC

load_dotenv()


@dataclass
class RateLimitException(Exception):
    """Base rate limit exception with retry information."""

    def __init__(self, message: str, retry_after: int = 60):
        self.message = message
        self.retry_after = retry_after
        super().__init__(message)

    def to_dict(self) -> dict:
        """Convert exception to dictionary for API responses."""
        return {
            "error": self.message,
            "status_code": 429,
            "retry_after": self.retry_after,
        }


@dataclass
class RateLimitConfig:
    """Rate limiting configuration loaded from environment variables."""

    # Feature flags
    rate_limit_enabled: bool

    # Redis configuration
    redis_url: str
    redis_prefix: str

    # Default rate limits (requests per time window)
    default_requests_per_minute: int
    default_requests_per_hour: int

    # Daily quota settings
    daily_quota_enabled: bool
    default_daily_quota: int

    # Tiered limits per role (multipliers applied to defaults)
    role_limits: dict[str, dict[str, int]]

    # Response settings
    retry_after_seconds: int
    include_rate_limit_headers: bool

    @classmethod
    def from_env(cls) -> "RateLimitConfig":
        rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "false").lower() == "true"

        redis_url = os.getenv("UPSTASH_REDIS_REST_URL", "")
        redis_prefix = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

        # Only require Redis config if rate limiting is enabled
        if rate_limit_enabled:
            if not redis_url:
                raise ValueError(
                    "UPSTASH_REDIS_REST_URL environment variable is required when RATE_LIMIT_ENABLED=true"
                )
            if not redis_prefix:
                raise ValueError(
                    "UPSTASH_REDIS_REST_TOKEN environment variable is required when RATE_LIMIT_ENABLED=true"
                )

        default_requests_per_minute = int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "60"))
        default_requests_per_hour = int(os.getenv("RATE_LIMIT_REQUESTS_PER_HOUR", "300"))

        daily_quota_enabled = os.getenv("RATE_LIMIT_DAILY_QUOTA_ENABLED", "true").lower() == "true"
        default_daily_quota = int(os.getenv("RATE_LIMIT_DEFAULT_DAILY_QUOTA", "1000"))

        # Tiered limits - multipliers for each role
        # Admin gets 2x limits, user gets default (1x)
        admin_multiplier = float(os.getenv("RATE_LIMIT_ADMIN_MULTIPLIER", "2.0"))
        user_multiplier = float(os.getenv("RATE_LIMIT_USER_MULTIPLIER", "1.0"))

        role_limits = {
            "admin": {
                "requests_per_minute": int(default_requests_per_minute * admin_multiplier),
                "requests_per_hour": int(default_requests_per_hour * admin_multiplier),
                "daily_quota": int(default_daily_quota * admin_multiplier),
            },
            "user": {
                "requests_per_minute": int(default_requests_per_minute * user_multiplier),
                "requests_per_hour": int(default_requests_per_hour * user_multiplier),
                "daily_quota": int(default_daily_quota * user_multiplier),
            },
        }

        retry_after_seconds = int(os.getenv("RATE_LIMIT_RETRY_AFTER_SECONDS", "60"))
        include_rate_limit_headers = (
            os.getenv("RATE_LIMIT_INCLUDE_HEADERS", "true").lower() == "true"
        )

        return cls(
            rate_limit_enabled=rate_limit_enabled,
            redis_url=redis_url,
            redis_prefix=redis_prefix,
            default_requests_per_minute=default_requests_per_minute,
            default_requests_per_hour=default_requests_per_hour,
            daily_quota_enabled=daily_quota_enabled,
            default_daily_quota=default_daily_quota,
            role_limits=role_limits,
            retry_after_seconds=retry_after_seconds,
            include_rate_limit_headers=include_rate_limit_headers,
        )

    def get_role_limits(self, role: str = "user") -> dict[str, int]:
        """Get rate limits for a specific role."""
        return self.role_limits.get(role.lower(), self.role_limits["user"])

    def get_rate_limit_key(self, user_id: str, window: str = "minute") -> str:
        """Construct Redis key for rate limit counter.

        Args:
            user_id: User identifier (or IP for anonymous users)
            window: Time window - 'minute' or 'hour'

        Returns:
            Redis key string for the rate limit counter
        """
        return f"{self.redis_prefix}:rate_limit:{user_id}:{window}"

    def get_daily_quota_key(self, user_id: str) -> str:
        """Construct Redis key for daily quota counter.

        Args:
            user_id: User identifier (or IP for anonymous users)

        Returns:
            Redis key string for the daily quota counter
        """
        return f"{self.redis_prefix}:rate_limit:{user_id}:daily"


def get_rate_limit_config() -> RateLimitConfig:
    """Get cached rate limit configuration.

    Note: This function is not cached with lru_cache because
    configuration may need to be reloaded in tests.
    """
    return RateLimitConfig.from_env()


def get_remaining_time_until_midnight() -> int:
    """Calculate seconds until midnight UTC.

    Returns:
        Number of seconds until the next midnight UTC
    """
    from datetime import datetime, timedelta

    now = datetime.now(UTC)
    tomorrow = now + timedelta(days=1)
    midnight = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    return int((midnight - now).total_seconds())
