"""Centralised configuration for external OSINT service providers.

Reads API keys from environment variables and provides health-check helpers,
fallback endpoint URLs, and per-provider cache TTL settings.
"""


from __future__ import annotations
import logging
import os
import time
from dataclasses import dataclass, field
from functools import wraps
from typing import TYPE_CHECKING, Optional, TypeVar
from collections.abc import Callable

if TYPE_CHECKING:
    import aiohttp

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProviderConfig:
    """Configuration for a single OSINT provider."""

    name: str
    api_key: str | None
    base_url: str
    fallback_url: str
    cache_ttl_seconds: int
    rate_limit_per_minute: int

    @property
    def has_api_key(self) -> bool:
        return bool(self.api_key and self.api_key.strip())


@dataclass
class OsintProviderSettings:
    """Aggregated settings for all OSINT providers."""

    providers: dict[str, ProviderConfig] = field(default_factory=dict)

    # -- convenience accessors ------------------------------------------------

    @property
    def shodan(self) -> ProviderConfig:
        return self.providers["shodan"]

    @property
    def virustotal(self) -> ProviderConfig:
        return self.providers["virustotal"]

    @property
    def hunter(self) -> ProviderConfig:
        return self.providers["hunter"]

    @property
    def hibp(self) -> ProviderConfig:
        return self.providers["hibp"]

    @property
    def whois(self) -> ProviderConfig:
        return self.providers["whois"]

    def get_status(self) -> dict[str, dict]:
        """Return a serialisable status dict for every provider."""
        return {
            name: {
                "name": cfg.name,
                "has_api_key": cfg.has_api_key,
                "mode": "full" if cfg.has_api_key else "limited",
                "cache_ttl_seconds": cfg.cache_ttl_seconds,
                "rate_limit_per_minute": cfg.rate_limit_per_minute,
            }
            for name, cfg in self.providers.items()
        }


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _env_int(key: str, default: int = 0) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


def load_osint_provider_settings() -> OsintProviderSettings:
    """Build provider settings from environment variables."""

    providers: dict[str, ProviderConfig] = {
        "shodan": ProviderConfig(
            name="Shodan",
            api_key=_env("SHODAN_API_KEY") or None,
            base_url="https://api.shodan.io",
            fallback_url="https://internetdb.shodan.io",
            cache_ttl_seconds=_env_int("SHODAN_CACHE_TTL_SECONDS", 604800),  # 7 days
            rate_limit_per_minute=_env_int("SHODAN_RATE_LIMIT_PER_MINUTE", 1),
        ),
        "virustotal": ProviderConfig(
            name="VirusTotal",
            api_key=_env("VIRUSTOTAL_API_KEY") or None,
            base_url="https://www.virustotal.com/api/v3",
            fallback_url="https://urlhaus-api.abuse.ch/v1",
            cache_ttl_seconds=_env_int("VIRUSTOTAL_CACHE_TTL_SECONDS", 2592000),  # 30 days
            rate_limit_per_minute=_env_int("VIRUSTOTAL_RATE_LIMIT_PER_MINUTE", 4),
        ),
        "hunter": ProviderConfig(
            name="Hunter.io",
            api_key=_env("HUNTER_API_KEY") or None,
            base_url="https://api.hunter.io/v2",
            fallback_url="",
            cache_ttl_seconds=_env_int("HUNTER_CACHE_TTL_SECONDS", 604800),
            rate_limit_per_minute=_env_int("HUNTER_RATE_LIMIT_PER_MINUTE", 10),
        ),
        "hibp": ProviderConfig(
            name="Have I Been Pwned",
            api_key=_env("HIBP_API_KEY") or None,
            base_url="https://haveibeenpwned.com/api/v3",
            fallback_url="",
            cache_ttl_seconds=_env_int("HIBP_CACHE_TTL_SECONDS", 86400),  # 1 day
            rate_limit_per_minute=_env_int("HIBP_RATE_LIMIT_PER_MINUTE", 10),
        ),
        "whois": ProviderConfig(
            name="WHOIS",
            api_key=_env("WHOIS_API_KEY") or None,
            base_url="https://www.whoisxmlapi.com/whoisserver/WhoisService",
            fallback_url="",
            cache_ttl_seconds=_env_int("WHOIS_CACHE_TTL_SECONDS", 2592000),  # 30 days
            rate_limit_per_minute=_env_int("WHOIS_RATE_LIMIT_PER_MINUTE", 30),
        ),
    }

    settings = OsintProviderSettings(providers=providers)

    configured = [n for n, c in providers.items() if c.has_api_key]
    limited = [n for n, c in providers.items() if not c.has_api_key]
    if configured:
        logger.info(f"OSINT providers with API keys: {', '.join(configured)}")
    if limited:
        logger.info(f"OSINT providers in limited/keyless mode: {', '.join(limited)}")

    return settings


# Module-level singleton — import and use directly.
_settings: OsintProviderSettings | None = None


def get_osint_settings() -> OsintProviderSettings:
    global _settings
    if _settings is None:
        _settings = load_osint_provider_settings()
    return _settings


# ---------------------------------------------------------------------------
# Shared aiohttp session — create once, reuse across all OSINT services
# ---------------------------------------------------------------------------

_http_session: Optional[aiohttp.ClientSession] = None


async def get_http_session() -> aiohttp.ClientSession:
    """Return a shared aiohttp ClientSession for external API calls.

    Creates the session lazily on first use. The session uses connection
    pooling (100 connections, 10 per host) for optimal performance.
    """
    global _http_session
    if _http_session is None or _http_session.closed:
        import aiohttp

        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=10,
            ttl_dns_cache=300,
            enable_cleanup_closed=True,
        )
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        _http_session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={"User-Agent": "Crawl4AI-OSINT/1.0"},
        )
    return _http_session


async def close_http_session() -> None:
    """Close the shared HTTP session — call during app shutdown."""
    global _http_session
    if _http_session and not _http_session.closed:
        await _http_session.close()
        _http_session = None


# ---------------------------------------------------------------------------
# Simple in-memory TTL cache for OSINT responses
# ---------------------------------------------------------------------------

_cache: dict[str, tuple] = {}  # key -> (value, expires_at)

F = TypeVar("F", bound=Callable)


def osint_cache(ttl_seconds: int = 3600, prefix: str = ""):
    """Decorator that caches async function results with a TTL.

    Cache key is built from the prefix + function args.
    """

    def decorator(func: F) -> F:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from prefix + positional args (skip self)
            key_parts = [prefix or func.__name__]
            for a in args[1:]:  # skip self
                key_parts.append(str(a))
            for k, v in sorted(kwargs.items()):
                key_parts.append(f"{k}={v}")
            cache_key = ":".join(key_parts)

            # Check cache
            now = time.monotonic()
            if cache_key in _cache:
                value, expires_at = _cache[cache_key]
                if now < expires_at:
                    logger.debug(f"Cache hit: {cache_key}")
                    return value
                else:
                    del _cache[cache_key]

            # Execute and cache
            result = await func(*args, **kwargs)
            _cache[cache_key] = (result, now + ttl_seconds)

            # Lazy cleanup: remove up to 10 expired entries
            expired = [k for k, (_, exp) in list(_cache.items())[:50] if now >= exp]
            for k in expired[:10]:
                _cache.pop(k, None)

            return result

        return wrapper  # type: ignore

    return decorator


def clear_osint_cache(prefix: str = "") -> int:
    """Clear cached entries, optionally filtered by prefix. Returns count cleared."""
    if not prefix:
        count = len(_cache)
        _cache.clear()
        return count
    keys = [k for k in _cache if k.startswith(prefix)]
    for k in keys:
        del _cache[k]
    return len(keys)
