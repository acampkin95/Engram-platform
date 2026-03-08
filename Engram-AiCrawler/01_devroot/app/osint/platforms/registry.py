"""Platform Registry — metadata and routing for all supported OSINT platforms.

Each PlatformAdapter describes one crawlable platform: its search URL
templates, rate limits, JS requirements, anti-bot difficulty, and which
entity fields it's likely to yield.

The registry is the single source of truth used by:
- SearchVectorGenerator (to know which platforms exist)
- PlatformCrawler (to route queries and configure crawl4ai)
- API /platforms endpoint (to return available platforms)
"""

from __future__ import annotations

from enum import Enum

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11"""

        def __new__(cls, value):
            obj = str.__new__(cls, value)
            obj._value_ = value
            return obj


from urllib.parse import quote_plus

from pydantic import BaseModel


class PlatformCategory(StrEnum):
    PEOPLE_SEARCH = "people_search"
    SOCIAL_MEDIA = "social_media"
    PROFESSIONAL = "professional"
    PUBLIC_RECORDS = "public_records"
    IMAGE_SEARCH = "image_search"
    EMAIL_LOOKUP = "email_lookup"
    PHONE_LOOKUP = "phone_lookup"
    DARK_WEB = "dark_web"
    GENERAL = "general"


class AntiBotLevel(StrEnum):
    """How aggressively the platform blocks scrapers."""

    LOW = "low"  # Static pages, minimal protection
    MEDIUM = "medium"  # Basic JS checks, rate limiting
    HIGH = "high"  # Login walls, CAPTCHA, fingerprinting
    VERY_HIGH = "very_high"  # Requires real account session


class PlatformAdapter(BaseModel):
    """Metadata and URL-building for one OSINT platform."""

    # Identity
    id: str  # e.g. "whitepages"
    name: str  # Display name
    base_url: str
    category: PlatformCategory

    # Search URL template — use {query} placeholder
    search_url_template: str
    # Profile URL template — use {username} placeholder (optional)
    profile_url_template: str | None = None

    # Crawl configuration
    requires_js: bool = True  # Whether Playwright (JS) is needed
    anti_bot_level: AntiBotLevel = AntiBotLevel.MEDIUM
    rate_limit_delay: float = 2.0  # Seconds between requests
    page_timeout_ms: int = 30000

    # What this platform yields (guides extraction prioritisation)
    yields_names: bool = False
    yields_emails: bool = False
    yields_phones: bool = False
    yields_addresses: bool = False
    yields_social_profiles: bool = False
    yields_images: bool = False
    yields_relationships: bool = False

    # Whether we have a purpose-built adapter (vs generic crawl4ai)
    has_custom_adapter: bool = False

    # CSS selectors for targeted extraction (optional — used by custom adapters)
    result_container_selector: str | None = None
    name_selector: str | None = None
    detail_selector: str | None = None

    def build_search_url(self, query: str) -> str:
        """Build a search URL for the given query."""
        return self.search_url_template.format(query=quote_plus(query))

    def build_profile_url(self, username: str) -> str | None:
        """Build a profile URL for the given username."""
        if not self.profile_url_template:
            return None
        return self.profile_url_template.format(username=username)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class PlatformRegistry:
    """Singleton registry of all supported platforms."""

    def __init__(self) -> None:
        self._platforms: dict[str, PlatformAdapter] = {}
        self._register_all()

    def _register_all(self) -> None:
        """Register all built-in platforms."""
        for p in _BUILTIN_PLATFORMS:
            self._platforms[p.id] = p

    def get(self, platform_id: str) -> PlatformAdapter | None:
        return self._platforms.get(platform_id.lower())

    def all(self) -> list[PlatformAdapter]:
        return list(self._platforms.values())

    def by_category(self, category: PlatformCategory) -> list[PlatformAdapter]:
        return [p for p in self._platforms.values() if p.category == category]

    def for_query_type(self, query_type: str) -> list[PlatformAdapter]:
        """Return platforms suitable for a given vector type."""
        mapping: dict[str, list[str]] = {
            "name": [
                "whitepages",
                "truepeoplesearch",
                "fastpeoplesearch",
                "familytreenow",
                "spokeo",
                "peoplefinders",
                "twitter",
                "linkedin",
                "facebook",
                "reddit",
            ],
            "email": ["emailrep", "hunter_io", "truepeoplesearch", "whitepages", "spokeo"],
            "phone": ["truecaller_web", "whitepages", "truepeoplesearch", "fastpeoplesearch"],
            "username": [
                "github",
                "reddit",
                "twitter",
                "instagram",
                "tiktok",
                "pinterest",
                "gitlab",
            ],
            "address": ["whitepages", "truepeoplesearch", "fastpeoplesearch", "familytreenow"],
            "keyword": ["google_news", "reddit", "twitter"],
            "image": ["google_images", "tineye", "yandex_images"],
        }
        ids = mapping.get(query_type, [])
        return [self._platforms[i] for i in ids if i in self._platforms]

    def ids(self) -> list[str]:
        return list(self._platforms.keys())


# ---------------------------------------------------------------------------
# Built-in platform definitions
# ---------------------------------------------------------------------------

_BUILTIN_PLATFORMS: list[PlatformAdapter] = [
    # ---- People Search ----
    PlatformAdapter(
        id="whitepages",
        name="WhitePages",
        base_url="https://www.whitepages.com",
        category=PlatformCategory.PEOPLE_SEARCH,
        search_url_template="https://www.whitepages.com/name/{query}",
        requires_js=True,
        anti_bot_level=AntiBotLevel.HIGH,
        rate_limit_delay=3.0,
        yields_names=True,
        yields_phones=True,
        yields_addresses=True,
        has_custom_adapter=True,
        result_container_selector=".card",
    ),
    PlatformAdapter(
        id="truepeoplesearch",
        name="TruePeopleSearch",
        base_url="https://www.truepeoplesearch.com",
        category=PlatformCategory.PEOPLE_SEARCH,
        search_url_template="https://www.truepeoplesearch.com/results?name={query}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_names=True,
        yields_phones=True,
        yields_addresses=True,
        yields_relationships=True,
        has_custom_adapter=True,
        result_container_selector=".card-summary",
        name_selector=".h4",
        detail_selector=".content-value",
    ),
    PlatformAdapter(
        id="fastpeoplesearch",
        name="FastPeopleSearch",
        base_url="https://www.fastpeoplesearch.com",
        category=PlatformCategory.PEOPLE_SEARCH,
        search_url_template="https://www.fastpeoplesearch.com/name/{query}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_names=True,
        yields_phones=True,
        yields_addresses=True,
        has_custom_adapter=True,
        result_container_selector=".card",
    ),
    PlatformAdapter(
        id="familytreenow",
        name="FamilyTreeNow",
        base_url="https://www.familytreenow.com",
        category=PlatformCategory.PEOPLE_SEARCH,
        search_url_template="https://www.familytreenow.com/search/genealogy/results?first={query}&lntp=1",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_names=True,
        yields_addresses=True,
        yields_relationships=True,
    ),
    PlatformAdapter(
        id="spokeo",
        name="Spokeo",
        base_url="https://www.spokeo.com",
        category=PlatformCategory.PEOPLE_SEARCH,
        search_url_template="https://www.spokeo.com/{query}",
        requires_js=True,
        anti_bot_level=AntiBotLevel.HIGH,
        rate_limit_delay=4.0,
        yields_names=True,
        yields_phones=True,
        yields_addresses=True,
        yields_emails=True,
    ),
    PlatformAdapter(
        id="peoplefinders",
        name="PeopleFinders",
        base_url="https://www.peoplefinders.com",
        category=PlatformCategory.PEOPLE_SEARCH,
        search_url_template="https://www.peoplefinders.com/people/{query}",
        requires_js=True,
        anti_bot_level=AntiBotLevel.MEDIUM,
        rate_limit_delay=3.0,
        yields_names=True,
        yields_phones=True,
        yields_addresses=True,
    ),
    # ---- Social Media ----
    PlatformAdapter(
        id="twitter",
        name="Twitter / X",
        base_url="https://x.com",
        category=PlatformCategory.SOCIAL_MEDIA,
        search_url_template="https://x.com/search?q={query}&src=typed_query&f=user",
        profile_url_template="https://x.com/{username}",
        requires_js=True,
        anti_bot_level=AntiBotLevel.VERY_HIGH,
        rate_limit_delay=5.0,
        yields_names=True,
        yields_social_profiles=True,
        yields_images=True,
        has_custom_adapter=True,
    ),
    PlatformAdapter(
        id="reddit",
        name="Reddit",
        base_url="https://www.reddit.com",
        category=PlatformCategory.SOCIAL_MEDIA,
        search_url_template="https://www.reddit.com/search/?q={query}&type=user",
        profile_url_template="https://www.reddit.com/user/{username}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_names=True,
        yields_social_profiles=True,
        has_custom_adapter=True,
    ),
    PlatformAdapter(
        id="instagram",
        name="Instagram",
        base_url="https://www.instagram.com",
        category=PlatformCategory.SOCIAL_MEDIA,
        search_url_template="https://www.instagram.com/{query}/",
        profile_url_template="https://www.instagram.com/{username}/",
        requires_js=True,
        anti_bot_level=AntiBotLevel.VERY_HIGH,
        rate_limit_delay=5.0,
        yields_images=True,
        yields_social_profiles=True,
    ),
    PlatformAdapter(
        id="tiktok",
        name="TikTok",
        base_url="https://www.tiktok.com",
        category=PlatformCategory.SOCIAL_MEDIA,
        search_url_template="https://www.tiktok.com/search/user?q={query}",
        profile_url_template="https://www.tiktok.com/@{username}",
        requires_js=True,
        anti_bot_level=AntiBotLevel.HIGH,
        rate_limit_delay=4.0,
        yields_social_profiles=True,
        yields_images=True,
    ),
    PlatformAdapter(
        id="pinterest",
        name="Pinterest",
        base_url="https://www.pinterest.com",
        category=PlatformCategory.SOCIAL_MEDIA,
        search_url_template="https://www.pinterest.com/search/users/?q={query}",
        profile_url_template="https://www.pinterest.com/{username}/",
        requires_js=True,
        anti_bot_level=AntiBotLevel.MEDIUM,
        rate_limit_delay=3.0,
        yields_social_profiles=True,
        yields_images=True,
    ),
    # ---- Professional ----
    PlatformAdapter(
        id="github",
        name="GitHub",
        base_url="https://github.com",
        category=PlatformCategory.PROFESSIONAL,
        search_url_template="https://github.com/search?q={query}&type=users",
        profile_url_template="https://github.com/{username}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=1.5,
        yields_names=True,
        yields_emails=True,
        yields_social_profiles=True,
        has_custom_adapter=True,
    ),
    PlatformAdapter(
        id="linkedin",
        name="LinkedIn",
        base_url="https://www.linkedin.com",
        category=PlatformCategory.PROFESSIONAL,
        search_url_template="https://www.linkedin.com/search/results/people/?keywords={query}",
        profile_url_template="https://www.linkedin.com/in/{username}",
        requires_js=True,
        anti_bot_level=AntiBotLevel.VERY_HIGH,
        rate_limit_delay=6.0,
        yields_names=True,
        yields_social_profiles=True,
        yields_relationships=True,
        has_custom_adapter=True,
    ),
    PlatformAdapter(
        id="gitlab",
        name="GitLab",
        base_url="https://gitlab.com",
        category=PlatformCategory.PROFESSIONAL,
        search_url_template="https://gitlab.com/search?search={query}&scope=users",
        profile_url_template="https://gitlab.com/{username}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=1.5,
        yields_names=True,
        yields_emails=True,
        yields_social_profiles=True,
    ),
    # ---- Public Records ----
    PlatformAdapter(
        id="courtlistener",
        name="CourtListener",
        base_url="https://www.courtlistener.com",
        category=PlatformCategory.PUBLIC_RECORDS,
        search_url_template="https://www.courtlistener.com/?q={query}&type=p&order_by=score+desc",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_names=True,
        yields_addresses=True,
    ),
    PlatformAdapter(
        id="opencorporates",
        name="OpenCorporates",
        base_url="https://opencorporates.com",
        category=PlatformCategory.PUBLIC_RECORDS,
        search_url_template="https://opencorporates.com/officers?q={query}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_names=True,
        yields_addresses=True,
        yields_relationships=True,
    ),
    # ---- Email OSINT ----
    PlatformAdapter(
        id="emailrep",
        name="EmailRep.io",
        base_url="https://emailrep.io",
        category=PlatformCategory.EMAIL_LOOKUP,
        search_url_template="https://emailrep.io/{query}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=1.0,
        yields_names=True,
        yields_social_profiles=True,
        has_custom_adapter=True,
    ),
    # ---- Phone Lookup ----
    PlatformAdapter(
        id="truecaller_web",
        name="Truecaller (Web)",
        base_url="https://www.truecaller.com",
        category=PlatformCategory.PHONE_LOOKUP,
        search_url_template="https://www.truecaller.com/search/us/{query}",
        requires_js=True,
        anti_bot_level=AntiBotLevel.HIGH,
        rate_limit_delay=4.0,
        yields_names=True,
        yields_phones=True,
    ),
    # ---- Image Search ----
    PlatformAdapter(
        id="google_images",
        name="Google Images",
        base_url="https://images.google.com",
        category=PlatformCategory.IMAGE_SEARCH,
        search_url_template="https://www.google.com/search?q={query}&tbm=isch",
        requires_js=True,
        anti_bot_level=AntiBotLevel.HIGH,
        rate_limit_delay=5.0,
        yields_images=True,
    ),
    PlatformAdapter(
        id="tineye",
        name="TinEye",
        base_url="https://tineye.com",
        category=PlatformCategory.IMAGE_SEARCH,
        search_url_template="https://tineye.com/search?url={query}",
        requires_js=False,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_images=True,
    ),
    # ---- General ----
    PlatformAdapter(
        id="google_news",
        name="Google News",
        base_url="https://news.google.com",
        category=PlatformCategory.GENERAL,
        search_url_template="https://news.google.com/search?q={query}&hl=en",
        requires_js=True,
        anti_bot_level=AntiBotLevel.MEDIUM,
        rate_limit_delay=3.0,
        yields_names=True,
    ),
    PlatformAdapter(
        id="duckduckgo",
        name="DuckDuckGo",
        base_url="https://duckduckgo.com",
        category=PlatformCategory.GENERAL,
        search_url_template="https://duckduckgo.com/?q={query}&ia=web",
        requires_js=True,
        anti_bot_level=AntiBotLevel.LOW,
        rate_limit_delay=2.0,
        yields_names=True,
    ),
]


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_registry: PlatformRegistry | None = None


def get_registry() -> PlatformRegistry:
    """Return the module-level PlatformRegistry singleton."""
    global _registry
    if _registry is None:
        _registry = PlatformRegistry()
    return _registry
