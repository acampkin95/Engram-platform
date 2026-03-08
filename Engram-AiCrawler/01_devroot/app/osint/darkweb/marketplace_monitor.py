"""
Dark Web Marketplace & Forum Monitor — Phase 8.2

Scans known dark web marketplaces and forums for entity mentions,
product listings, threat intelligence, and PII exposure.

Operates in two modes:
  1. Tor mode  — actual .onion crawling (requires Tor + aiohttp-socks)
  2. Simulation mode — returns structured mock data for dev/testing

All findings integrate with the case management and job queue systems.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, UTC
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


from typing import Any

from app.osint.darkweb.tor_crawler import TorCrawler, TorCrawlConfig, DarkWebPage

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & Types
# ---------------------------------------------------------------------------


class SiteCategory(StrEnum):
    MARKETPLACE = "marketplace"
    FORUM = "forum"
    PASTE_SITE = "paste_site"
    SEARCH_ENGINE = "search_engine"
    NEWS = "news"
    INTELLIGENCE = "intelligence"


class ThreatLevel(StrEnum):
    CRITICAL = "critical"  # Active threat / direct mention with PII
    HIGH = "high"  # Strong match, likely relevant
    MEDIUM = "medium"  # Partial match, needs review
    LOW = "low"  # Weak signal
    INFO = "info"  # Informational only


@dataclass
class DarkWebSite:
    """Known dark web site definition."""

    name: str
    url: str  # .onion URL or clearnet mirror
    category: SiteCategory
    description: str
    active: bool = True
    requires_registration: bool = False
    language: str = "en"
    tags: list[str] = field(default_factory=list)


@dataclass
class EntityMention:
    """A mention of a target entity found on a dark web site."""

    site_name: str
    site_url: str
    page_url: str
    category: SiteCategory
    threat_level: ThreatLevel
    matched_terms: list[str]
    context_snippet: str  # surrounding text (200 chars)
    full_text_hash: str
    found_at: datetime
    page_title: str
    confidence: float  # 0.0 – 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "site_name": self.site_name,
            "site_url": self.site_url,
            "page_url": self.page_url,
            "category": self.category.value,
            "threat_level": self.threat_level.value,
            "matched_terms": self.matched_terms,
            "context_snippet": self.context_snippet,
            "full_text_hash": self.full_text_hash,
            "found_at": self.found_at.isoformat(),
            "page_title": self.page_title,
            "confidence": self.confidence,
        }


@dataclass
class MonitorResult:
    """Aggregated result of a monitoring scan."""

    entity_query: str
    search_terms: list[str]
    sites_scanned: int
    pages_scanned: int
    mentions: list[EntityMention]
    scan_duration_s: float
    scan_id: str
    scanned_at: datetime
    errors: list[str]
    tor_available: bool

    @property
    def threat_summary(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for m in self.mentions:
            counts[m.threat_level.value] = counts.get(m.threat_level.value, 0) + 1
        return counts

    @property
    def highest_threat(self) -> ThreatLevel | None:
        order = [
            ThreatLevel.CRITICAL,
            ThreatLevel.HIGH,
            ThreatLevel.MEDIUM,
            ThreatLevel.LOW,
            ThreatLevel.INFO,
        ]
        for level in order:
            if any(m.threat_level == level for m in self.mentions):
                return level
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "entity_query": self.entity_query,
            "search_terms": self.search_terms,
            "sites_scanned": self.sites_scanned,
            "pages_scanned": self.pages_scanned,
            "total_mentions": len(self.mentions),
            "threat_summary": self.threat_summary,
            "highest_threat": self.highest_threat.value if self.highest_threat else None,
            "mentions": [m.to_dict() for m in self.mentions],
            "scan_duration_s": self.scan_duration_s,
            "scanned_at": self.scanned_at.isoformat(),
            "errors": self.errors,
            "tor_available": self.tor_available,
        }


# ---------------------------------------------------------------------------
# Known Dark Web Sites Registry
# ---------------------------------------------------------------------------

KNOWN_DARK_WEB_SITES: list[DarkWebSite] = [
    # ---- Dark Web Search Engines ----
    DarkWebSite(
        name="Ahmia",
        url="http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion",
        category=SiteCategory.SEARCH_ENGINE,
        description="Dark web search engine indexing .onion sites",
        tags=["search", "index"],
    ),
    DarkWebSite(
        name="Torch",
        url="http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rplyvk3noyd.onion",
        category=SiteCategory.SEARCH_ENGINE,
        description="One of the oldest Tor search engines",
        tags=["search", "index"],
    ),
    # ---- Forums ----
    DarkWebSite(
        name="Dread",
        url="http://dreadytofatroptsdj6io7l3xptbet6onoyno2yv7jicoxknyazubrad.onion",
        category=SiteCategory.FORUM,
        description="Reddit-like dark web forum (drugs, security, general)",
        tags=["forum", "community"],
    ),
    DarkWebSite(
        name="Dark Web Forums",
        url="http://darkfailenbsdla5mal2mxn2uz66od5vtzd5qozslagrfzachha3f3id.onion",
        category=SiteCategory.FORUM,
        description="Dark web link directory and forum aggregator",
        tags=["forum", "directory"],
    ),
    # ---- Intelligence / Threat ----
    DarkWebSite(
        name="Intel Exchange",
        url="http://rrcc5uuudhh4oz3c.onion",
        category=SiteCategory.INTELLIGENCE,
        description="OSINT and threat intelligence community",
        tags=["osint", "intelligence", "threat"],
    ),
    # ---- Paste Sites ----
    DarkWebSite(
        name="ZeroHedge Paste",
        url="http://zerobinqmdqd236y.onion",
        category=SiteCategory.PASTE_SITE,
        description="Anonymous paste site on Tor",
        tags=["paste", "anonymous"],
    ),
    DarkWebSite(
        name="Stronghold Paste",
        url="http://strongerw2ise74v3duebgsvug4mehyhlpa7f6kfwnas7zofs3kov7yd.onion",
        category=SiteCategory.PASTE_SITE,
        description="Encrypted paste site",
        tags=["paste", "encrypted"],
    ),
]

# Clearnet intelligence/monitoring sites (always accessible)
CLEARNET_INTELLIGENCE_SITES: list[DarkWebSite] = [
    DarkWebSite(
        name="IntelX",
        url="https://intelx.io",
        category=SiteCategory.INTELLIGENCE,
        description="Intelligence search engine (breaches, pastes, dark web)",
        tags=["intelligence", "breach", "clearnet"],
    ),
    DarkWebSite(
        name="Ahmia Clearnet",
        url="https://ahmia.fi",
        category=SiteCategory.SEARCH_ENGINE,
        description="Clearnet mirror of Ahmia dark web search",
        tags=["search", "clearnet"],
    ),
]


# ---------------------------------------------------------------------------
# Threat Scorer
# ---------------------------------------------------------------------------


class ThreatScorer:
    """Score entity mentions by threat level based on context."""

    # High-risk keywords that escalate threat level
    CRITICAL_INDICATORS = [
        "ssn",
        "social security",
        "passport number",
        "credit card",
        "bank account",
        "routing number",
        "identity theft",
        "doxx",
        "doxed",
        "real address",
        "home address",
        "swat",
    ]
    HIGH_INDICATORS = [
        "personal information",
        "leaked",
        "breach",
        "dump",
        "database",
        "hacked",
        "compromised",
        "stolen",
        "fraud",
        "scam",
        "impersonation",
        "fake id",
        "false identity",
    ]
    MEDIUM_INDICATORS = [
        "email",
        "phone",
        "username",
        "account",
        "profile",
        "social media",
        "linkedin",
        "facebook",
        "instagram",
    ]

    def score(
        self,
        text: str,
        matched_terms: list[str],
        category: SiteCategory,
    ) -> tuple[ThreatLevel, float]:
        """Return (threat_level, confidence)."""
        text_lower = text.lower()

        # Count indicator hits
        critical_hits = sum(1 for kw in self.CRITICAL_INDICATORS if kw in text_lower)
        high_hits = sum(1 for kw in self.HIGH_INDICATORS if kw in text_lower)
        medium_hits = sum(1 for kw in self.MEDIUM_INDICATORS if kw in text_lower)

        # Base confidence from match count
        match_count = len(matched_terms)
        base_confidence = min(0.3 + (match_count * 0.15), 0.9)

        # Escalate based on indicators
        if critical_hits >= 2:
            return ThreatLevel.CRITICAL, min(base_confidence + 0.3, 1.0)
        if critical_hits == 1 or high_hits >= 3:
            return ThreatLevel.HIGH, min(base_confidence + 0.2, 1.0)
        if high_hits >= 1 or medium_hits >= 3:
            return ThreatLevel.MEDIUM, min(base_confidence + 0.1, 1.0)
        if medium_hits >= 1 or match_count >= 2:
            return ThreatLevel.LOW, base_confidence
        return ThreatLevel.INFO, base_confidence * 0.5


def _extract_context(text: str, term: str, window: int = 200) -> str:
    """Extract surrounding context around a matched term."""
    idx = text.lower().find(term.lower())
    if idx < 0:
        return text[:window]
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(term) + window // 2)
    snippet = text[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


# ---------------------------------------------------------------------------
# Marketplace Monitor
# ---------------------------------------------------------------------------


class MarketplaceMonitor:
    """
    Scans dark web marketplaces and forums for entity mentions.

    Operates in Tor mode (real .onion crawling) or simulation mode
    (structured mock data) when Tor is unavailable.
    """

    def __init__(
        self,
        tor_config: TorCrawlConfig | None = None,
        simulation_mode: bool = False,
    ):
        self.tor_config = tor_config or TorCrawlConfig()
        self.simulation_mode = simulation_mode
        self.scorer = ThreatScorer()
        self._tor_crawler: TorCrawler | None = None

    async def scan_entity(
        self,
        entity_name: str,
        additional_terms: list[str] | None = None,
        categories: list[SiteCategory] | None = None,
        include_clearnet: bool = True,
        max_sites: int = 10,
    ) -> MonitorResult:
        """
        Scan dark web sites for mentions of an entity.

        Args:
            entity_name: Primary search target (person/org name)
            additional_terms: Extra search terms (email, alias, etc.)
            categories: Filter to specific site categories
            include_clearnet: Also scan clearnet intelligence sites
            max_sites: Maximum sites to scan

        Returns:
            MonitorResult with all findings
        """
        start_time = time.time()
        scan_id = hashlib.md5(f"{entity_name}{time.time()}".encode()).hexdigest()[:12]

        # Build search terms
        search_terms = [entity_name]
        if additional_terms:
            search_terms.extend(additional_terms)
        search_terms = list(dict.fromkeys(search_terms))  # dedup

        # Select sites
        sites = list(KNOWN_DARK_WEB_SITES)
        if include_clearnet:
            sites.extend(CLEARNET_INTELLIGENCE_SITES)
        if categories:
            sites = [s for s in sites if s.category in categories]
        sites = [s for s in sites if s.active][:max_sites]

        mentions: list[EntityMention] = []
        errors: list[str] = []
        pages_scanned = 0
        tor_available = False

        if self.simulation_mode:
            # Simulation mode for testing/dev
            result_mentions, pages_scanned = self._simulate_scan(entity_name, search_terms, sites)
            mentions.extend(result_mentions)
        else:
            # Real Tor crawling
            try:
                async with TorCrawler(self.tor_config) as crawler:
                    verify = await crawler.verify_tor_connection()
                    tor_available = verify.get("tor_available", False)

                    for site in sites:
                        try:
                            pages = await self._scan_site(crawler, site, search_terms)
                            pages_scanned += len(pages)
                            for page in pages:
                                site_mentions = self._extract_mentions(page, site, search_terms)
                                mentions.extend(site_mentions)
                        except Exception as exc:
                            errors.append(f"{site.name}: {exc}")
                            logger.warning(f"Error scanning {site.name}: {exc}")

            except Exception as exc:
                errors.append(f"Tor crawler error: {exc}")
                logger.error(f"Marketplace monitor error: {exc}")

        return MonitorResult(
            entity_query=entity_name,
            search_terms=search_terms,
            sites_scanned=len(sites),
            pages_scanned=pages_scanned,
            mentions=sorted(
                mentions,
                key=lambda m: (
                    ["critical", "high", "medium", "low", "info"].index(m.threat_level.value)
                ),
            ),
            scan_duration_s=time.time() - start_time,
            scan_id=scan_id,
            scanned_at=datetime.now(UTC),
            errors=errors,
            tor_available=tor_available,
        )

    async def _scan_site(
        self,
        crawler: TorCrawler,
        site: DarkWebSite,
        search_terms: list[str],
    ) -> list[DarkWebPage]:
        """Fetch site pages relevant to search terms."""
        pages = []

        # Fetch main page
        page = await crawler.fetch(site.url, keywords=search_terms)
        if page.status_code in (200, 301, 302) and not page.error:
            pages.append(page)

            # Follow relevant sub-links (max 3)
            relevant_links = [
                link
                for link in page.links
                if any(t.lower() in link.lower() for t in search_terms)
                and link.startswith(site.url[:30])  # same domain
            ][:3]

            for link in relevant_links:
                sub_page = await crawler.fetch(link, keywords=search_terms)
                if sub_page.status_code == 200 and not sub_page.error:
                    pages.append(sub_page)

        return pages

    def _extract_mentions(
        self,
        page: DarkWebPage,
        site: DarkWebSite,
        search_terms: list[str],
    ) -> list[EntityMention]:
        """Extract entity mentions from a crawled page."""
        if not page.keywords_found:
            return []

        threat_level, confidence = self.scorer.score(page.text, page.keywords_found, site.category)

        # Build context snippet from first matched term
        context = _extract_context(page.text, page.keywords_found[0])

        return [
            EntityMention(
                site_name=site.name,
                site_url=site.url,
                page_url=page.url,
                category=site.category,
                threat_level=threat_level,
                matched_terms=page.keywords_found,
                context_snippet=context,
                full_text_hash=page.content_hash,
                found_at=page.crawled_at,
                page_title=page.title,
                confidence=confidence,
            )
        ]

    def _simulate_scan(
        self,
        entity_name: str,
        search_terms: list[str],
        sites: list[DarkWebSite],
    ) -> tuple[list[EntityMention], int]:
        """
        Return simulated findings for testing.
        Produces realistic-looking but synthetic data.
        """
        mentions = []
        pages_scanned = len(sites)

        # Simulate a forum mention
        if sites:
            site = sites[0]
            mentions.append(
                EntityMention(
                    site_name=site.name,
                    site_url=site.url,
                    page_url=f"{site.url}/thread/12345",
                    category=site.category,
                    threat_level=ThreatLevel.MEDIUM,
                    matched_terms=search_terms[:2],
                    context_snippet=(
                        f"[SIMULATION] Thread discussing {entity_name}. "
                        "User posted personal information including email address. "
                        "Requires manual review."
                    ),
                    full_text_hash=hashlib.md5(entity_name.encode()).hexdigest(),
                    found_at=datetime.now(UTC),
                    page_title=f"Discussion: {entity_name}",
                    confidence=0.55,
                )
            )

        return mentions, pages_scanned


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_monitor_instance: MarketplaceMonitor | None = None


def get_marketplace_monitor(
    simulation_mode: bool = False,
) -> MarketplaceMonitor:
    """Get or create the global MarketplaceMonitor instance."""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = MarketplaceMonitor(simulation_mode=simulation_mode)
    return _monitor_instance
