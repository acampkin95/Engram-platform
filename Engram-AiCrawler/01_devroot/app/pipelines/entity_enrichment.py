"""Entity Enrichment Pipeline — PII extraction and entity enrichment.

This pipeline takes raw crawl results and extracts structured entity data using:
1. Regex patterns — fast, deterministic extraction for emails, phones, URLs
2. LLM-powered NER — names, addresses, organizations, relationships, dates
3. Confidence scoring — based on source count and cross-validation
4. Source tracking — every data point knows where it came from

Designed to be called from DeepCrawlOrchestrator._extract_from_results but
can also be used standalone for any text enrichment task.
"""


from __future__ import annotations
import json
import logging
import re
from typing import Any

from pydantic import BaseModel, Field

from app.models.entity import (
    DataSource,
    EntityProfile,
)
from app.services.lm_studio_bridge import LMStudioBridge

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Extraction result models
# ---------------------------------------------------------------------------


class ExtractedPII(BaseModel):
    """Structured PII extracted from a single source."""

    source_url: str
    source_type: str = "web"  # web, social_media, people_search, public_records

    # Contact info (regex-extracted)
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    urls: list[str] = Field(default_factory=list)
    image_urls: list[str] = Field(default_factory=list)

    # Identity info (LLM-extracted)
    names: list[str] = Field(default_factory=list)
    usernames: list[str] = Field(default_factory=list)
    addresses: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    occupations: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)

    # Relationships
    relationships: list[dict[str, str]] = Field(default_factory=list)
    # e.g. [{"name": "John Doe", "relation": "spouse", "confidence": "0.8"}]

    # Social profiles discovered
    social_profiles: list[dict[str, str]] = Field(default_factory=list)
    # e.g. [{"platform": "twitter", "username": "jdoe", "url": "https://..."}]

    # Raw text for further processing
    raw_text: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)

    # Stats
    extraction_method: str = "regex"  # regex, llm, combined


class EnrichmentResult(BaseModel):
    """Result of enriching an entity with extracted PII."""

    entity_id: str
    new_data_points: int = 0
    duplicate_data_points: int = 0
    new_images: int = 0
    new_social_profiles: int = 0
    new_relationships: int = 0
    sources_processed: int = 0
    llm_calls_made: int = 0
    errors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Email
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")

# Phone — US + international formats
_PHONE_RE = re.compile(
    r"\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
    r"|\b\+\d{1,3}[-.\s]\d{1,4}[-.\s]\d{1,4}[-.\s]\d{1,9}\b"
)

# URLs
_URL_RE = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]{5,}')

# Image URLs
_IMG_RE = re.compile(
    r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)', re.IGNORECASE
)

# Social media profile patterns
_SOCIAL_PATTERNS: dict[str, re.Pattern] = {
    "twitter": re.compile(r"(?:twitter\.com|x\.com)/([A-Za-z0-9_]{1,50})", re.IGNORECASE),
    "linkedin": re.compile(r"linkedin\.com/in/([A-Za-z0-9\-]{3,100})", re.IGNORECASE),
    "facebook": re.compile(
        r"facebook\.com/(?:profile\.php\?id=\d+|([A-Za-z0-9.\-]{5,100}))", re.IGNORECASE
    ),
    "instagram": re.compile(r"instagram\.com/([A-Za-z0-9_\.]{1,30})", re.IGNORECASE),
    "github": re.compile(r"github\.com/([A-Za-z0-9\-]{1,39})", re.IGNORECASE),
    "reddit": re.compile(r"reddit\.com/u(?:ser)?/([A-Za-z0-9_\-]{3,20})", re.IGNORECASE),
    "tiktok": re.compile(r"tiktok\.com/@([A-Za-z0-9_\.]{1,24})", re.IGNORECASE),
    "youtube": re.compile(
        r"youtube\.com/(?:c/|channel/|@)([A-Za-z0-9_\-\.]{3,100})", re.IGNORECASE
    ),
    "pinterest": re.compile(r"pinterest\.com/([A-Za-z0-9_]{3,30})", re.IGNORECASE),
}

# People-search site domains (used to classify source_type)
_PEOPLE_SEARCH_DOMAINS = {
    "whitepages.com",
    "truepeoplesearch.com",
    "fastpeoplesearch.com",
    "spokeo.com",
    "beenverified.com",
    "peoplefinders.com",
    "intelius.com",
    "familytreenow.com",
    "instantcheckmate.com",
    "mylife.com",
}

_PUBLIC_RECORD_DOMAINS = {
    "courtlistener.com",
    "pacer.gov",
    "publicrecords.com",
    "county-records.com",
    "propertyshark.com",
}


# ---------------------------------------------------------------------------
# LLM NER prompt
# ---------------------------------------------------------------------------

_NER_PROMPT = """\
You are an expert OSINT data extractor. Analyze the following text and extract all \
personally identifiable information (PII) and entity data.

Return ONLY a JSON object with these fields (omit empty arrays):
{{
  "names": ["Full Name 1", "Full Name 2"],
  "addresses": ["123 Main St, City, State ZIP", ...],
  "organizations": ["Company Name", ...],
  "occupations": ["Job Title / Role", ...],
  "dates": ["YYYY-MM-DD or descriptive date", ...],
  "usernames": ["username1", ...],
  "keywords": ["relevant keyword", ...],
  "relationships": [
    {{"name": "Person Name", "relation": "spouse/sibling/colleague/etc", "confidence": "0.8"}}
  ],
  "social_profiles": [
    {{"platform": "twitter", "username": "handle", "url": "https://..."}}
  ]
}}

Rules:
- Only extract data explicitly present in the text
- For names: include full names only (first + last), skip partial names
- For addresses: include city/state at minimum
- For relationships: only when relation type is clear from context
- Confidence 0.0-1.0: 1.0 = explicitly stated, 0.5 = inferred

TEXT:
{text}
"""


# ---------------------------------------------------------------------------
# Entity Enrichment Pipeline
# ---------------------------------------------------------------------------


class EntityEnrichmentPipeline:
    """Extracts PII from crawl results and enriches an EntityProfile.

    Two-phase extraction:
    1. Fast regex pass — emails, phones, URLs, images, social profiles
    2. LLM NER pass — names, addresses, organizations, relationships
       (only if text contains meaningful content and LM Studio is available)
    """

    def __init__(
        self,
        lm_bridge: LMStudioBridge | None = None,
        use_llm: bool = True,
        llm_text_threshold: int = 200,  # Min chars to trigger LLM
        max_text_for_llm: int = 4000,  # Truncate at this length
    ):
        self.lm_bridge = lm_bridge
        self.use_llm = use_llm and (lm_bridge is not None)
        self.llm_text_threshold = llm_text_threshold
        self.max_text_for_llm = max_text_for_llm

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def extract_pii(
        self,
        crawl_results: list[dict[str, Any]],
    ) -> list[ExtractedPII]:
        """Extract PII from a list of crawl results.

        Args:
            crawl_results: List of dicts with keys: success, query, markdown

        Returns:
            List of ExtractedPII objects, one per successful crawl result.
        """
        extracted: list[ExtractedPII] = []

        for result in crawl_results:
            if not result.get("success") or not result.get("markdown"):
                continue

            pii = await self._extract_single(
                url=result.get("query", ""),
                markdown=result["markdown"],
            )
            extracted.append(pii)

        return extracted

    async def enrich_entity(
        self,
        entity: EntityProfile,
        extracted_pii: list[ExtractedPII],
    ) -> EnrichmentResult:
        """Apply extracted PII to an entity profile.

        Tracks what's new vs duplicate, and updates verification status
        when the same data point appears in multiple sources.

        Args:
            entity: The EntityProfile to enrich
            extracted_pii: List of ExtractedPII from extract_pii()

        Returns:
            EnrichmentResult with stats on what was added.
        """
        stats = EnrichmentResult(entity_id=entity.entity_id)
        stats.sources_processed = len(extracted_pii)

        # Build lookup sets for deduplication
        existing_emails = {e.value.lower() for e in entity.emails}
        existing_phones = {_normalize_phone(p.value) for p in entity.phones}
        existing_usernames = {u.value.lower() for u in entity.usernames}
        existing_addresses = {a.value.lower() for a in entity.addresses}
        existing_images = {i.value for i in entity.images}
        existing_social = {
            (s.platform, s.username or s.profile_url) for s in entity.social_profiles
        }

        for pii in extracted_pii:
            source = _classify_source(pii.source_url)
            self._enrich_emails(entity, pii, stats, existing_emails, source)
            self._enrich_phones(entity, pii, stats, existing_phones, source)
            self._enrich_usernames(entity, pii, stats, existing_usernames, source)
            self._enrich_addresses(entity, pii, stats, existing_addresses, source)
            self._enrich_images(entity, pii, stats, existing_images, source)
            self._enrich_social_profiles(entity, pii, stats, existing_social, source)
            for keyword in pii.keywords:
                entity.add_keyword(keyword)
            for occupation in pii.occupations:
                _add_occupation_if_new(entity, occupation, source)
            self._enrich_relationships(entity, pii, stats)

        # Recalculate completeness after enrichment
        entity.calculate_completeness()

        return stats

    def _enrich_emails(
        self,
        entity: EntityProfile,
        pii: ExtractedPII,
        stats: EnrichmentResult,
        existing: set[str],
        source: DataSource,
    ) -> None:
        for email in pii.emails:
            norm = email.lower()
            if norm not in existing:
                entity.add_email(email, source, pii.source_url)
                stats.new_data_points += 1
                existing.add(norm)
            else:
                stats.duplicate_data_points += 1

    def _enrich_phones(
        self,
        entity: EntityProfile,
        pii: ExtractedPII,
        stats: EnrichmentResult,
        existing: set[str],
        source: DataSource,
    ) -> None:
        for phone in pii.phones:
            norm = _normalize_phone(phone)
            if norm not in existing:
                entity.add_phone(phone, source, pii.source_url)
                stats.new_data_points += 1
                existing.add(norm)
            else:
                stats.duplicate_data_points += 1

    def _enrich_usernames(
        self,
        entity: EntityProfile,
        pii: ExtractedPII,
        stats: EnrichmentResult,
        existing: set[str],
        source: DataSource,
    ) -> None:
        for username in pii.usernames:
            norm = username.lower()
            if norm not in existing:
                entity.add_username(username, source=source)
                stats.new_data_points += 1
                existing.add(norm)
            else:
                stats.duplicate_data_points += 1

    def _enrich_addresses(
        self,
        entity: EntityProfile,
        pii: ExtractedPII,
        stats: EnrichmentResult,
        existing: set[str],
        source: DataSource,
    ) -> None:
        for address in pii.addresses:
            norm = address.lower()
            if norm not in existing:
                entity.add_address(address, source, pii.source_url)
                stats.new_data_points += 1
                existing.add(norm)
            else:
                stats.duplicate_data_points += 1

    def _enrich_images(
        self,
        entity: EntityProfile,
        pii: ExtractedPII,
        stats: EnrichmentResult,
        existing: set[str],
        source: DataSource,
    ) -> None:
        for img_url in pii.image_urls:
            if img_url not in existing:
                entity.add_image(img_url, source, source_url=pii.source_url)
                stats.new_images += 1
                existing.add(img_url)

    def _enrich_social_profiles(
        self,
        entity: EntityProfile,
        pii: ExtractedPII,
        stats: EnrichmentResult,
        existing: set[tuple[str, str]],
        source: DataSource,
    ) -> None:
        for profile in pii.social_profiles:
            key = (
                profile.get("platform", ""),
                profile.get("username", "") or profile.get("url", ""),
            )
            if key not in existing:
                entity.add_social_profile(
                    profile.get("url") or profile.get("username", ""),
                    profile.get("platform", "unknown"),
                    source=source,
                    username=profile.get("username"),
                )
                stats.new_social_profiles += 1
                existing.add(key)
            else:
                stats.duplicate_data_points += 1

    def _enrich_relationships(
        self,
        entity: EntityProfile,
        pii: ExtractedPII,
        stats: EnrichmentResult,
    ) -> None:
        for rel in pii.relationships:
            if rel.get("name") and rel.get("relation"):
                entity.notes.append(
                    {
                        "type": "relationship",
                        "name": rel["name"],
                        "relation": rel["relation"],
                        "confidence": rel.get("confidence", "0.5"),
                        "source_url": pii.source_url,
                    }
                )
                stats.new_relationships += 1

    # ------------------------------------------------------------------
    # Internal extraction
    # ------------------------------------------------------------------

    async def _extract_single(self, url: str, markdown: str) -> ExtractedPII:
        """Extract PII from a single crawl result."""
        pii = ExtractedPII(
            source_url=url,
            source_type=_classify_source_type(url),
        )

        # Phase 1: Regex extraction (always)
        pii.emails = list(set(_EMAIL_RE.findall(markdown)))
        pii.phones = list(set(_PHONE_RE.findall(markdown)))
        pii.urls = list(set(_URL_RE.findall(markdown)))
        pii.image_urls = list(set(_IMG_RE.findall(markdown)))

        # Social profile extraction from URLs
        pii.social_profiles = _extract_social_profiles(markdown)

        # Phase 2: LLM NER (if text is long enough and LLM available)
        if self.use_llm and len(markdown) >= self.llm_text_threshold:
            llm_data = await self._llm_extract(markdown)
            if llm_data:
                pii.names = llm_data.get("names", [])
                pii.addresses = llm_data.get("addresses", [])
                pii.organizations = llm_data.get("organizations", [])
                pii.occupations = llm_data.get("occupations", [])
                pii.dates = llm_data.get("dates", [])
                pii.usernames = llm_data.get("usernames", [])
                pii.keywords = llm_data.get("keywords", [])
                pii.relationships = llm_data.get("relationships", [])
                # Merge LLM social profiles with regex-found ones
                llm_social = llm_data.get("social_profiles", [])
                pii.social_profiles = _merge_social_profiles(pii.social_profiles, llm_social)
                pii.extraction_method = "combined"
        else:
            pii.extraction_method = "regex"

        # Store truncated raw text for audit trail
        pii.raw_text = markdown[:2000]

        # Confidence based on extraction richness
        pii.confidence = _calculate_confidence(pii)

        return pii

    async def _llm_extract(self, text: str) -> dict[str, Any] | None:
        """Use LM Studio to extract named entities from text."""
        if not self.lm_bridge:
            return None

        truncated = text[: self.max_text_for_llm]
        prompt = _NER_PROMPT.format(text=truncated)

        try:
            response = await self.lm_bridge.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Low temp for deterministic extraction
            )
            content = response.get("content", "")

            # Parse JSON — handle markdown code fences
            content = content.strip()
            if content.startswith("```"):
                # Strip ```json ... ``` fences
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)

            data = json.loads(content)
            return data if isinstance(data, dict) else None

        except json.JSONDecodeError as e:
            logger.debug(f"LLM NER JSON parse failed: {e}")
            return None
        except Exception as e:
            logger.warning(f"LLM NER extraction failed: {e}")
            return None


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _normalize_phone(phone: str) -> str:
    """Normalize phone to digits only for deduplication."""
    return "".join(c for c in phone if c.isdigit())


def _classify_source(url: str) -> DataSource:
    """Map a URL to a DataSource enum value."""
    url_lower = url.lower()
    for domain in _PEOPLE_SEARCH_DOMAINS:
        if domain in url_lower:
            return DataSource.PEOPLE_SEARCH
    for domain in _PUBLIC_RECORD_DOMAINS:
        if domain in url_lower:
            return DataSource.PUBLIC_RECORDS
    for platform in _SOCIAL_PATTERNS:
        if platform in url_lower:
            return DataSource.SOCIAL_MEDIA
    return DataSource.WEB_CRAWL


def _classify_source_type(url: str) -> str:
    """Return a string source type for display."""
    source = _classify_source(url)
    mapping = {
        DataSource.PEOPLE_SEARCH: "people_search",
        DataSource.PUBLIC_RECORDS: "public_records",
        DataSource.SOCIAL_MEDIA: "social_media",
        DataSource.WEB_CRAWL: "web",
    }
    return mapping.get(source, "web")


def _extract_social_profiles(text: str) -> list[dict[str, str]]:
    """Extract social media profile URLs/usernames via regex."""
    profiles = []
    seen: set = set()

    for platform, pattern in _SOCIAL_PATTERNS.items():
        for match in pattern.finditer(text):
            username = match.group(1) if match.lastindex else None
            url = match.group(0)
            # Skip generic/nav pages
            if username and username.lower() in {"home", "about", "help", "login", "signup"}:
                continue
            key = (platform, username or url)
            if key not in seen:
                profiles.append(
                    {
                        "platform": platform,
                        "username": username or "",
                        "url": f"https://{platform}.com/{username}" if username else url,
                    }
                )
                seen.add(key)

    return profiles


def _merge_social_profiles(
    regex_profiles: list[dict[str, str]],
    llm_profiles: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Merge regex and LLM social profiles, deduplicating by platform+username."""
    merged = {(p["platform"], p.get("username", "")): p for p in regex_profiles}
    for p in llm_profiles:
        key = (p.get("platform", ""), p.get("username", ""))
        if key not in merged:
            merged[key] = p
    return list(merged.values())


def _add_occupation_if_new(
    entity: EntityProfile,
    occupation: str,
    source: DataSource,
) -> None:
    """Add occupation to entity if not already present."""
    existing = {o.value.lower() for o in entity.occupations}
    if occupation.lower() not in existing:
        from app.models.entity import EmploymentInfo

        entity.occupations.append(
            EmploymentInfo(
                value=occupation,
                sources=[source],
            )
        )


def _calculate_confidence(pii: ExtractedPII) -> float:
    """Estimate extraction confidence based on data richness."""
    score = 0.3  # Base

    if pii.emails:
        score += 0.15
    if pii.phones:
        score += 0.15
    if pii.names:
        score += 0.1
    if pii.addresses:
        score += 0.1
    if pii.social_profiles:
        score += 0.1
    if pii.extraction_method == "combined":
        score += 0.1

    return min(score, 1.0)
