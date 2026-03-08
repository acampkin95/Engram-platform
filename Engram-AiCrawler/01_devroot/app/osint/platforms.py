"""Platform configurations for OSINT alias discovery."""


from __future__ import annotations
from pydantic import BaseModel


class PlatformConfig(BaseModel):
    """Configuration for a social/web platform."""

    name: str
    base_url: str
    profile_url_template: str
    search_url_template: str
    rate_limit_delay: float = 1.0


PLATFORM_CONFIGS: dict[str, PlatformConfig] = {
    "twitter": PlatformConfig(
        name="twitter",
        base_url="https://x.com",
        profile_url_template="https://x.com/{username}",
        search_url_template="https://x.com/search?q={query}&src=typed_query",
        rate_limit_delay=2.0,
    ),
    "linkedin": PlatformConfig(
        name="linkedin",
        base_url="https://www.linkedin.com",
        profile_url_template="https://www.linkedin.com/in/{username}",
        search_url_template="https://www.linkedin.com/search/results/all/?keywords={query}",
        rate_limit_delay=3.0,
    ),
    "instagram": PlatformConfig(
        name="instagram",
        base_url="https://www.instagram.com",
        profile_url_template="https://www.instagram.com/{username}/",
        search_url_template="https://www.instagram.com/explore/tags/{query}/",
        rate_limit_delay=2.0,
    ),
    "facebook": PlatformConfig(
        name="facebook",
        base_url="https://www.facebook.com",
        profile_url_template="https://www.facebook.com/{username}",
        search_url_template="https://www.facebook.com/search/top/?q={query}",
        rate_limit_delay=3.0,
    ),
    "reddit": PlatformConfig(
        name="reddit",
        base_url="https://www.reddit.com",
        profile_url_template="https://www.reddit.com/user/{username}",
        search_url_template="https://www.reddit.com/search/?q={query}",
        rate_limit_delay=1.0,
    ),
    "tiktok": PlatformConfig(
        name="tiktok",
        base_url="https://www.tiktok.com",
        profile_url_template="https://www.tiktok.com/@{username}",
        search_url_template="https://www.tiktok.com/search?q={query}",
        rate_limit_delay=2.0,
    ),
    "github": PlatformConfig(
        name="github",
        base_url="https://github.com",
        profile_url_template="https://github.com/{username}",
        search_url_template="https://github.com/search?q={query}&type=users",
        rate_limit_delay=1.0,
    ),
    "mastodon": PlatformConfig(
        name="mastodon",
        base_url="https://mastodon.social",
        profile_url_template="https://mastodon.social/@{username}",
        search_url_template="https://mastodon.social/search?q={query}",
        rate_limit_delay=1.0,
    ),
}


def get_platform(name: str) -> PlatformConfig | None:
    """Get platform configuration by name (case-insensitive)."""
    return PLATFORM_CONFIGS.get(name.lower())


def get_all_platforms() -> list[PlatformConfig]:
    """Get all platform configurations."""
    return list(PLATFORM_CONFIGS.values())
