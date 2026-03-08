"""Entity Profile Model for OSINT Deep Crawl Engine.

This is the core data structure for investigation targets. It captures
all known information about an entity (person, organization, or alias)
and supports incremental enrichment through the deep crawl pipeline.
"""


from __future__ import annotations
import uuid
from datetime import datetime, UTC
from typing import Any
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


from pydantic import BaseModel, Field, model_validator


class EntityType(StrEnum):
    """Type of entity being investigated."""

    PERSON = "person"
    ORGANIZATION = "organization"
    ALIAS = "alias"  # Potential alias of another entity
    UNKNOWN = "unknown"


class DataSource(StrEnum):
    """Where entity data originated."""

    USER_INPUT = "user_input"
    SOCIAL_MEDIA = "social_media"
    PUBLIC_RECORDS = "public_records"
    PEOPLE_SEARCH = "people_search"
    WEB_CRAWL = "web_crawl"
    IMAGE_SEARCH = "image_search"
    EMAIL_OSINT = "email_osint"
    PHONE_LOOKUP = "phone_lookup"
    DARK_WEB = "dark_web"
    BREACH_DATA = "breach_data"
    LM_INFERENCE = "lm_inference"  # LLM-extracted
    MANUAL_ENTRY = "manual_entry"


class VerificationStatus(StrEnum):
    """How verified a data point is."""

    UNVERIFIED = "unverified"
    PARTIAL = "partial"  # Found in 1 source
    VERIFIED = "verified"  # Found in 2+ independent sources
    CONTRADICTED = "contradicted"  # Conflicting information
    DISPUTED = "disputed"  # Flagged as potentially false


class ConfidenceLevel(StrEnum):
    """Overall confidence in data accuracy."""

    LOW = "low"  # 0-30%
    MEDIUM = "medium"  # 30-70%
    HIGH = "high"  # 70-90%
    VERY_HIGH = "very_high"  # 90-100%


class RiskLevel(StrEnum):
    """Risk assessment for the entity."""

    MINIMAL = "minimal"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class Gender(StrEnum):
    """Gender identification if known."""

    MALE = "male"
    FEMALE = "female"
    NON_BINARY = "non_binary"
    UNKNOWN = "unknown"


# ============================================================================
# COMPONENT MODELS - Individual data points with source tracking
# ============================================================================


class SourcedDataPoint(BaseModel):
    """Base class for data points with source tracking."""

    value: Any
    sources: list[DataSource] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)
    verification: VerificationStatus = VerificationStatus.UNVERIFIED
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    first_seen: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_seen: datetime = Field(default_factory=lambda: datetime.now(UTC))
    notes: str | None = None


class NameInfo(SourcedDataPoint):
    """Name information with components."""

    value: str = Field(..., min_length=1, max_length=200)  # Full name
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    suffix: str | None = None  # Jr., Sr., III, etc.
    nickname: str | None = None
    maiden_name: str | None = None
    aliases: list[str] = Field(default_factory=list)


class PhoneInfo(SourcedDataPoint):
    """Phone number with metadata."""

    value: str = Field(..., min_length=7, max_length=20)
    formatted: str | None = None  # E.164 format
    country_code: str | None = None
    carrier: str | None = None
    line_type: str | None = None  # mobile, landline, voip
    is_disposable: bool = False
    is_active: bool | None = None


class EmailInfo(SourcedDataPoint):
    """Email address with metadata."""

    value: str = Field(..., min_length=5, max_length=320)
    domain: str | None = None
    is_free_provider: bool = False
    is_disposable: bool = False
    is_business: bool = False
    deliverable: bool | None = None
    breach_count: int = 0


class AddressInfo(SourcedDataPoint):
    """Physical address."""

    value: str = Field(..., min_length=1)
    street: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None
    country_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    address_type: str | None = None  # residential, business, postal


class DateInfo(SourcedDataPoint):
    """Date with precision tracking."""

    value: datetime | None = None
    year: int | None = None
    month: int | None = None
    day: int | None = None
    precision: str = "full"  # full, month, year, approximate
    display: str | None = None  # Human-readable


class EmploymentInfo(SourcedDataPoint):
    """Employment/occupation information."""

    value: str = Field(..., min_length=1)
    company: str | None = None
    title: str | None = None
    industry: str | None = None
    start_date: DateInfo | None = None
    end_date: DateInfo | None = None
    is_current: bool = True
    location: str | None = None


class EducationInfo(SourcedDataPoint):
    """Educational background."""

    value: str = Field(..., min_length=1)
    institution: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    is_verified: bool = False


class SocialProfile(SourcedDataPoint):
    """Social media profile reference."""

    value: str = Field(..., min_length=1)  # Profile URL or handle
    platform: str  # twitter, linkedin, facebook, instagram, etc.
    username: str | None = None
    display_name: str | None = None
    profile_url: str | None = None
    profile_image_url: str | None = None
    bio: str | None = None
    follower_count: int | None = None
    following_count: int | None = None
    post_count: int | None = None
    account_created: datetime | None = None
    last_active: datetime | None = None
    is_verified: bool = False
    is_private: bool = False


class ImageReference(SourcedDataPoint):
    """Reference to an image associated with the entity."""

    value: str  # Image URL or local path
    image_hash: str | None = None  # Perceptual hash
    image_type: str = "unknown"  # profile, document, location, screenshot
    face_detected: bool = False
    face_encoding: list[float] | None = None
    is_profile_photo: bool = False
    width: int | None = None
    height: int | None = None
    file_size: int | None = None
    exif_data: dict[str, Any] | None = None
    reverse_search_urls: list[str] = Field(default_factory=list)
    is_stock_photo: bool | None = None
    is_ai_generated: bool | None = None


class RelationshipInfo(SourcedDataPoint):
    """Relationship to another entity."""

    value: str  # Related entity ID or name
    relationship_type: str  # family, friend, colleague, associate, romantic
    related_entity_id: str | None = None
    related_entity_name: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    is_current: bool = True
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class UsernameInfo(SourcedDataPoint):
    """Username/handle across platforms."""

    value: str = Field(..., min_length=1, max_length=100)
    platforms_found: list[str] = Field(default_factory=list)
    platforms_checked: list[str] = Field(default_factory=list)
    availability_status: dict[str, bool] = Field(default_factory=dict)  # platform: is_registered


# ============================================================================
# ENTITY PROFILE - Main model
# ============================================================================


class EntityProfile(BaseModel):
    """Complete entity profile for OSINT investigation.

    This is the "target dossier" that drives the deep crawl engine.
    It captures all known information about an entity and supports
    incremental enrichment through the pipeline.
    """

    # Identity
    entity_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: EntityType = EntityType.UNKNOWN
    investigation_id: str | None = None  # Link to case

    # Names
    primary_name: NameInfo | None = None
    known_names: list[NameInfo] = Field(default_factory=list)

    # Demographics
    date_of_birth: DateInfo | None = None
    date_of_death: DateInfo | None = None
    gender: Gender = Gender.UNKNOWN
    nationality: str | None = None
    ethnicity: str | None = None  # If known/disclosed
    languages: list[str] = Field(default_factory=list)

    # Contact Information
    phones: list[PhoneInfo] = Field(default_factory=list)
    emails: list[EmailInfo] = Field(default_factory=list)
    addresses: list[AddressInfo] = Field(default_factory=list)

    # Online Presence
    usernames: list[UsernameInfo] = Field(default_factory=list)
    social_profiles: list[SocialProfile] = Field(default_factory=list)
    websites: list[str] = Field(default_factory=list)

    # Professional
    occupations: list[EmploymentInfo] = Field(default_factory=list)
    education: list[EducationInfo] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)

    # Images
    images: list[ImageReference] = Field(default_factory=list)
    primary_image_id: str | None = None

    # Relationships
    relationships: list[RelationshipInfo] = Field(default_factory=list)

    # Keywords & Interests
    keywords: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)

    # Risk Assessment
    risk_level: RiskLevel = RiskLevel.MINIMAL
    risk_factors: list[str] = Field(default_factory=list)
    fraud_indicators: list[str] = Field(default_factory=list)

    # Identity Verification
    is_fake_identity: bool | None = None
    fake_identity_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    identity_inconsistencies: list[str] = Field(default_factory=list)

    # Metadata
    overall_confidence: ConfidenceLevel = ConfidenceLevel.LOW
    completeness_score: float = Field(default=0.0, ge=0.0, le=1.0)
    data_freshness: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Crawl Tracking
    crawl_depth: int = 0
    total_sources: int = 0
    last_crawled: datetime | None = None
    crawl_history: list[dict[str, Any]] = Field(default_factory=list)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Raw Data Storage
    raw_data: dict[str, Any] = Field(default_factory=dict)
    notes: list[dict[str, Any]] = Field(default_factory=list)

    @model_validator(mode="after")
    def set_primary_name_in_known_names(self):
        """Ensure primary name is in known_names list."""
        if self.primary_name and self.primary_name not in self.known_names:
            self.known_names.insert(0, self.primary_name)
        return self

    def add_phone(
        self,
        phone: str,
        source: DataSource = DataSource.USER_INPUT,
        source_url: str | None = None,
        **kwargs,
    ) -> None:
        """Add a phone number to the profile."""
        # Check for duplicates
        existing = next((p for p in self.phones if p.value == phone), None)
        if existing:
            if source not in existing.sources:
                existing.sources.append(source)
            if source_url and source_url not in existing.source_urls:
                existing.source_urls.append(source_url)
            existing.last_seen = datetime.now(UTC)
        else:
            self.phones.append(
                PhoneInfo(
                    value=phone,
                    sources=[source],
                    source_urls=[source_url] if source_url else [],
                    **kwargs,
                )
            )
        self.updated_at = datetime.now(UTC)

    def add_email(
        self,
        email: str,
        source: DataSource = DataSource.USER_INPUT,
        source_url: str | None = None,
        **kwargs,
    ) -> None:
        """Add an email address to the profile."""
        existing = next((e for e in self.emails if e.value.lower() == email.lower()), None)
        if existing:
            if source not in existing.sources:
                existing.sources.append(source)
            if source_url and source_url not in existing.source_urls:
                existing.source_urls.append(source_url)
            existing.last_seen = datetime.now(UTC)
        else:
            self.emails.append(
                EmailInfo(
                    value=email,
                    sources=[source],
                    source_urls=[source_url] if source_url else [],
                    **kwargs,
                )
            )
        self.updated_at = datetime.now(UTC)

    def add_address(
        self,
        address: str,
        source: DataSource = DataSource.USER_INPUT,
        source_url: str | None = None,
        **kwargs,
    ) -> None:
        """Add an address to the profile."""
        existing = next((a for a in self.addresses if a.value.lower() == address.lower()), None)
        if existing:
            if source not in existing.sources:
                existing.sources.append(source)
            if source_url and source_url not in existing.source_urls:
                existing.source_urls.append(source_url)
            existing.last_seen = datetime.now(UTC)
        else:
            self.addresses.append(
                AddressInfo(
                    value=address,
                    sources=[source],
                    source_urls=[source_url] if source_url else [],
                    **kwargs,
                )
            )
        self.updated_at = datetime.now(UTC)

    def add_social_profile(
        self,
        profile_url: str,
        platform: str,
        source: DataSource = DataSource.SOCIAL_MEDIA,
        **kwargs,
    ) -> None:
        """Add a social media profile to the entity."""
        existing = next(
            (p for p in self.social_profiles if p.value.lower() == profile_url.lower()), None
        )
        if existing:
            if source not in existing.sources:
                existing.sources.append(source)
            existing.last_seen = datetime.now(UTC)
        else:
            self.social_profiles.append(
                SocialProfile(value=profile_url, platform=platform, sources=[source], **kwargs)
            )
        self.updated_at = datetime.now(UTC)

    def add_image(
        self, image_url: str, source: DataSource = DataSource.WEB_CRAWL, **kwargs
    ) -> None:
        """Add an image reference to the profile."""
        existing = next((i for i in self.images if i.value == image_url), None)
        if existing:
            if source not in existing.sources:
                existing.sources.append(source)
            existing.last_seen = datetime.now(UTC)
        else:
            self.images.append(ImageReference(value=image_url, sources=[source], **kwargs))
        self.updated_at = datetime.now(UTC)

    def add_username(
        self, username: str, platform: str | None = None, source: DataSource = DataSource.USER_INPUT
    ) -> None:
        """Add a username to the profile."""
        existing = next((u for u in self.usernames if u.value.lower() == username.lower()), None)
        if existing:
            if platform and platform not in existing.platforms_found:
                existing.platforms_found.append(platform)
            if source not in existing.sources:
                existing.sources.append(source)
            existing.last_seen = datetime.now(UTC)
        else:
            self.usernames.append(
                UsernameInfo(
                    value=username, platforms_found=[platform] if platform else [], sources=[source]
                )
            )
        self.updated_at = datetime.now(UTC)

    def add_keyword(self, keyword: str) -> None:
        """Add a keyword for search optimization."""
        if keyword.lower() not in [k.lower() for k in self.keywords]:
            self.keywords.append(keyword)
            self.updated_at = datetime.now(UTC)

    def calculate_completeness(self) -> float:
        """Calculate profile completeness score."""
        score = 0.0
        weights = {
            "primary_name": 0.15,
            "date_of_birth": 0.10,
            "phones": 0.10,
            "emails": 0.10,
            "addresses": 0.10,
            "social_profiles": 0.15,
            "images": 0.10,
            "occupations": 0.10,
            "relationships": 0.05,
            "keywords": 0.05,
        }

        if self.primary_name:
            score += weights["primary_name"]
        if self.date_of_birth:
            score += weights["date_of_birth"]
        if self.phones:
            score += min(len(self.phones) * 0.05, weights["phones"])
        if self.emails:
            score += min(len(self.emails) * 0.05, weights["emails"])
        if self.addresses:
            score += min(len(self.addresses) * 0.05, weights["addresses"])
        if self.social_profiles:
            score += min(len(self.social_profiles) * 0.03, weights["social_profiles"])
        if self.images:
            score += min(len(self.images) * 0.03, weights["images"])
        if self.occupations:
            score += min(len(self.occupations) * 0.05, weights["occupations"])
        if self.relationships:
            score += min(len(self.relationships) * 0.02, weights["relationships"])
        if self.keywords:
            score += min(len(self.keywords) * 0.01, weights["keywords"])

        self.completeness_score = min(score, 1.0)
        return self.completeness_score

    def get_all_search_terms(self) -> set[str]:
        """Get all searchable terms from the profile."""
        terms = set()

        if self.primary_name:
            terms.add(self.primary_name.value)
            if self.primary_name.first_name:
                terms.add(self.primary_name.first_name)
            if self.primary_name.last_name:
                terms.add(self.primary_name.last_name)

        for name in self.known_names:
            terms.add(name.value)
            for alias in name.aliases:
                terms.add(alias)

        for phone in self.phones:
            terms.add(phone.value)
            if phone.formatted:
                terms.add(phone.formatted)

        for email in self.emails:
            terms.add(email.value)
            local_part = email.value.split("@")[0]
            terms.add(local_part)

        for username in self.usernames:
            terms.add(username.value)

        for addr in self.addresses:
            terms.add(addr.value)
            if addr.city:
                terms.add(addr.city)

        terms.update(self.keywords)

        return terms


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class CreateEntityRequest(BaseModel):
    """Request to create a new entity profile."""

    entity_type: EntityType = EntityType.PERSON
    investigation_id: str | None = None

    # Initial data
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: str | None = None
    phones: list[str] = Field(default_factory=list)
    emails: list[str] = Field(default_factory=list)
    addresses: list[str] = Field(default_factory=list)
    usernames: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    occupation: str | None = None
    location: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def require_minimum_data(self):
        """Ensure at least one identifier is provided."""
        has_data = any(
            [self.name, self.first_name, self.last_name, self.phones, self.emails, self.usernames]
        )
        if not has_data:
            raise ValueError(
                "At least one identifier (name, phone, email, or username) is required"
            )
        return self


class EntitySearchRequest(BaseModel):
    """Request to search for entities."""

    query: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    username: str | None = None
    investigation_id: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class EntitySummary(BaseModel):
    """Lightweight entity summary for listings."""

    entity_id: str
    entity_type: EntityType
    primary_name: str | None = None
    primary_email: str | None = None
    primary_phone: str | None = None
    risk_level: RiskLevel
    overall_confidence: ConfidenceLevel
    completeness_score: float
    social_profile_count: int = 0
    image_count: int = 0
    created_at: datetime
    updated_at: datetime
    investigation_id: str | None = None


class EntityMergeRequest(BaseModel):
    """Request to merge two entities."""

    primary_entity_id: str
    secondary_entity_id: str
    merge_strategy: str = "keep_both"  # keep_both, prefer_primary, prefer_newer
    notes: str | None = None


class EnrichEntityRequest(BaseModel):
    """Request to enrich an entity with new data."""

    entity_id: str
    data_type: str  # phone, email, address, social, image, etc.
    value: str
    source: DataSource = DataSource.USER_INPUT
    source_url: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)
