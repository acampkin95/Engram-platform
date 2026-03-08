"""Platform adapters for OSINT deep crawling."""
from __future__ import annotations


from app.osint.platforms.registry import (
    AntiBotLevel,
    PlatformAdapter,
    PlatformCategory,
    PlatformRegistry,
    get_registry,
)
from app.osint.platforms.base import (
    GenericPlatformCrawler,
    PlatformCrawlerBase,
    PlatformCrawlResult,
    get_crawler,
)
from app.osint.platforms.people_search import (
    EmailRepCrawler,
    FastPeopleSearchCrawler,
    TruePeopleSearchCrawler,
    WhitePagesCrawler,
)
from app.osint.platforms.social_media import (
    GitHubCrawler,
    LinkedInCrawler,
    RedditCrawler,
    TwitterCrawler,
)

_CUSTOM_ADAPTERS: dict[str, type[PlatformCrawlerBase]] = {
    "truepeoplesearch": TruePeopleSearchCrawler,
    "fastpeoplesearch": FastPeopleSearchCrawler,
    "whitepages": WhitePagesCrawler,
    "emailrep": EmailRepCrawler,
    "github": GitHubCrawler,
    "reddit": RedditCrawler,
    "linkedin": LinkedInCrawler,
    "twitter": TwitterCrawler,
}


# ---------------------------------------------------------------------------
# Convenience helpers used by alias_discovery and tests
# ---------------------------------------------------------------------------


def get_platform(platform_id: str) -> PlatformAdapter | None:
    """Return the PlatformAdapter for *platform_id*, or None if unknown."""
    return get_registry().get(platform_id)


def get_all_platforms() -> list[PlatformAdapter]:
    """Return all registered PlatformAdapters."""
    return list(get_registry().all())


# Convenience mapping: id -> PlatformAdapter for direct dict access in tests.
PLATFORM_CONFIGS: dict[str, PlatformAdapter] = {}  # populated lazily


def _ensure_platform_configs() -> None:
    """Populate PLATFORM_CONFIGS from the registry (called on first access)."""
    if not PLATFORM_CONFIGS:
        for adapter in get_all_platforms():
            PLATFORM_CONFIGS[adapter.id] = adapter


# Eagerly populate so tests can import PLATFORM_CONFIGS at module level.
_ensure_platform_configs()

__all__ = [
    "AntiBotLevel",
    "PlatformAdapter",
    "PlatformCategory",
    "PlatformRegistry",
    "get_registry",
    "get_platform",
    "get_all_platforms",
    "PLATFORM_CONFIGS",
    "GenericPlatformCrawler",
    "PlatformCrawlerBase",
    "PlatformCrawlResult",
    "get_crawler",
    "TruePeopleSearchCrawler",
    "FastPeopleSearchCrawler",
    "WhitePagesCrawler",
    "EmailRepCrawler",
    "GitHubCrawler",
    "RedditCrawler",
    "LinkedInCrawler",
    "TwitterCrawler",
    "_CUSTOM_ADAPTERS",
    "_ensure_platform_configs",
]
