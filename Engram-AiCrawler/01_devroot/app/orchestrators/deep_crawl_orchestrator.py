"""Deep Crawl Orchestrator — Entity-driven recursive OSINT crawling.

This orchestrator takes an EntityProfile and performs recursive crawling:
1. Generate search vectors from entity data (names, phones, emails, usernames, etc.)
2. Crawl each search vector across multiple platforms
3. Extract new entity data from crawl results (PII extraction)
4. Update entity profile with new data
5. Generate new search vectors from new data
6. Repeat until diminishing returns ordepth limit

The key difference from OSINTScanOrchestrator:
- OSINTScanOrchestrator: username → profiles → review → store → graph
- DeepCrawlOrchestrator: entity → search vectors → crawl → extract → update entity → repeat
"""

from __future__ import annotations
import asyncio
import logging
import os
from datetime import datetime
from app._compat import UTC

from app._compat import StrEnum

from typing import Any
from collections.abc import Callable, Coroutine
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models.entity import (
    EntityProfile,
    CreateEntityRequest,
    DataSource,
    AddressInfo,
    NameInfo,
)
from app.services.lm_studio_bridge import LMStudioBridge
from app.storage.chromadb_client import ChromaDBClient, get_chromadb_client
from app.pipelines.entity_enrichment import EntityEnrichmentPipeline
from app.osint.platform_crawler import PlatformCrawlRouter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class DeepCrawlStage(StrEnum):
    """Stages in the deep crawl pipeline."""

    INITIALIZING = "initializing"
    GENERATING_VECTORS = "generating_vectors"
    CRAWLING = "crawling"
    EXTRACTING = "extracting"
    ENRICHING = "enriching"
    DEDUPLICATING = "deduplicating"
    ITERATING = "iterating"
    COMPLETED = "completed"
    FAILED = "failed"


class SearchVector(BaseModel):
    """A search vector generated from entity data."""

    vector_id: str = Field(default_factory=lambda: str(uuid4()))
    query: str  # The actual search query
    vector_type: str  # name, email, phone, username, address, keyword, combination
    platforms: list[str] = Field(default_factory=list)  # Target platforms
    priority: int = Field(default=1, ge=1, le=10)  # Higher = more likely to yield results
    source_data: dict[str, Any] = Field(default_factory=dict)  # What entity data generated this
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CrawlIteration(BaseModel):
    """One iteration of the deep crawl."""

    iteration_id: str = Field(default_factory=lambda: str(uuid4()))
    iteration_number: int
    search_vectors: list[SearchVector] = Field(default_factory=list)
    urls_crawled: int = 0
    new_data_points: int = 0
    new_images: int = 0
    duplicate_data_points: int = 0
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    diminishing_returns: bool = False  # Less than 10% new data


class DeepCrawlRequest(BaseModel):
    """Request to start a deep crawl."""

    entity_id: str | None = None  # Existing entity to enrich
    create_entity: CreateEntityRequest | None = None  # Or create new

    # Crawl configuration
    max_iterations: int = Field(default=3, ge=1, le=10)
    max_urls_per_iteration: int = Field(default=50, ge=1, le=200)
    max_concurrent_crawls: int = Field(default=5, ge=1, le=20)

    # Platform targeting
    platforms: list[str] | None = None  # Specific platforms or all
    include_people_search: bool = True  # Whitepages, TruePeopleSearch, etc.
    include_social_media: bool = True
    include_public_records: bool = True
    include_image_search: bool = True
    include_dark_web: bool = False  # Requires Tor

    # Stopping conditions
    min_new_data_threshold: float = Field(default=0.1, ge=0.0, le=1.0)  # Stop if <10% new data
    max_time_minutes: int = Field(default=30, ge=5, le=120)

    # Investigation linkage
    investigation_id: str | None = None

    # Context
    query_context: str = ""  # Additional context for LLM


class DeepCrawlResult(BaseModel):
    """Result of a deep crawl operation."""

    crawl_id: str = Field(default_factory=lambda: str(uuid4()))
    entity: EntityProfile | None = None

    # Iteration tracking
    iterations: list[CrawlIteration] = Field(default_factory=list)
    total_iterations: int = 0
    final_iteration: CrawlIteration | None = None

    # Statistics
    total_urls_crawled: int = 0
    total_data_points_added: int = 0
    total_images_added: int = 0
    total_duplicates_skipped: int = 0

    # Final state
    stage: DeepCrawlStage = DeepCrawlStage.INITIALIZING
    stopped_reason: str | None = None  # max_iterations, diminishing_returns, max_time, etc.

    # Timestamps
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None

    # Summary
    summary: dict[str, Any] = Field(default_factory=dict)

    # Error handling
    error: str | None = None


class ExtractedData(BaseModel):
    """Data extracted from a crawl result."""

    extraction_id: str = Field(default_factory=lambda: str(uuid4()))
    source_url: str
    source_type: str  # social_media, people_search, public_records, web

    # Extracted entities
    names: list[str] = Field(default_factory=list)
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    addresses: list[str] = Field(default_factory=list)
    usernames: list[str] = Field(default_factory=list)
    urls: list[str] = Field(default_factory=list)

    # Images
    image_urls: list[str] = Field(default_factory=list)

    # Dates
    dates: list[str] = Field(default_factory=list)

    # Organizations
    organizations: list[str] = Field(default_factory=list)

    # Keywords
    keywords: list[str] = Field(default_factory=list)

    # Relationships mentioned
    relationships: list[dict[str, str]] = Field(default_factory=list)

    # Raw extraction
    raw_text: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


# Type alias for progress callback
ProgressCallback = Callable[[str, DeepCrawlStage, dict[str, Any]], Coroutine[Any, Any, None]]

# ---------------------------------------------------------------------------
# Search Vector Generator
# ---------------------------------------------------------------------------


class SearchVectorGenerator:
    """Generates search vectors from entity data using LM Studio."""

    # Platform categories with their search patterns
    PLATFORM_CATEGORIES = {
        "social_media": [
            "twitter",
            "linkedin",
            "facebook",
            "instagram",
            "tiktok",
            "reddit",
            "youtube",
            "pinterest",
            "snapchat",
            "mastodon",
            "threads",
            "tumblr",
            "vk",
            "discord",
        ],
        "people_search": [
            "whitepages",
            "truepeoplesearch",
            "fastpeoplesearch",
            "familytreenow",
            "spokeo",
            "beenverified",
            "peoplefinders",
            "intelius",
            "instantcheckmate",
        ],
        "public_records": [
            "court_records",
            "property_records",
            "business_registry",
            "voter_records",
            "marriage_records",
            "obituary",
        ],
        "professional": [
            "linkedin",
            "crunchbase",
            "bloomberg",
            "angelco",
            "glassdoor",
            "indeed",
            "ziprecruiter",
        ],
        "image_search": ["google_images", "tineye", "yandex_images", "bing_images", "pim_eye"],
        "email_phone": ["email_osint", "phone_lookup", "reverse_phone", "email_verification"],
        "dark_web": ["ahmia", "onion_search", "dark_forum"],
    }

    def __init__(self, lm_bridge: LMStudioBridge | None = None):
        self.lm_bridge = lm_bridge or LMStudioBridge(
            base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1"),
        )

    async def generate_vectors(
        self,
        entity: EntityProfile,
        platforms: list[str] | None = None,
        context: str = "",
        max_vectors: int = 50,
    ) -> list[SearchVector]:
        """Generate search vectors from entity data.

        Uses a combination of:
        1. Direct queries (name searches, email searches)
        2. LLM-generated optimized queries
        3. Platform-specific search patterns
        """
        vectors: list[SearchVector] = []

        # Get all searchable terms from entity
        search_terms = entity.get_all_search_terms()

        # 1. Name-based vectors (highest priority)
        if entity.primary_name:
            name_vectors = await self._generate_name_vectors(
                entity.primary_name, platforms, max_vectors // 4
            )
            vectors.extend(name_vectors)

        # 2. Email-based vectors
        for email_info in entity.emails[:3]:  # Top 3 emails
            email_vectors = await self._generate_email_vectors(
                email_info.value, platforms, max_vectors // 8
            )
            vectors.extend(email_vectors)

        # 3. Phone-based vectors
        for phone_info in entity.phones[:3]:  # Top 3 phones
            phone_vectors = await self._generate_phone_vectors(
                phone_info.value, platforms, max_vectors // 8
            )
            vectors.extend(phone_vectors)

        # 4. Username-based vectors
        for username_info in entity.usernames[:5]:  # Top 5 usernames
            username_vectors = await self._generate_username_vectors(
                username_info.value, platforms, max_vectors // 8
            )
            vectors.extend(username_vectors)

        # 5. Address-based vectors
        for addr_info in entity.addresses[:2]:  # Top 2 addresses
            addr_vectors = await self._generate_address_vectors(
                addr_info, platforms, max_vectors // 10
            )
            vectors.extend(addr_vectors)

        # 6. Keyword vectors (from occupation, interests, etc.)
        if entity.keywords:
            keyword_vectors = await self._generate_keyword_vectors(
                entity.keywords, platforms, max_vectors // 10
            )
            vectors.extend(keyword_vectors)

        # 7. LLM-generated combination queries
        if len(search_terms) > 2 and self.lm_bridge:
            llm_vectors = await self._generate_llm_vectors(
                entity, platforms, context, max_vectors // 5
            )
            vectors.extend(llm_vectors)

        # Sort by priority and limit
        vectors.sort(key=lambda v: v.priority, reverse=True)
        return vectors[:max_vectors]

    async def _generate_name_vectors(
        self, name: NameInfo, platforms: list[str] | None, max_vectors: int
    ) -> list[SearchVector]:
        """Generate search vectors for name queries."""
        vectors = []
        target_platforms = platforms or self.PLATFORM_CATEGORIES["social_media"]

        # Full name search
        if name.value:
            vectors.append(
                SearchVector(
                    query=f'"{name.value}"',
                    vector_type="name",
                    platforms=target_platforms,
                    priority=10,
                    source_data={"name": name.value},
                )
            )

        # First + Last name variations
        if name.first_name and name.last_name:
            vectors.append(
                SearchVector(
                    query=f"{name.first_name} {name.last_name}",
                    vector_type="name",
                    platforms=target_platforms,
                    priority=9,
                    source_data={"first_name": name.first_name, "last_name": name.last_name},
                )
            )

            # With location context if known
            # (would need address data from entity)

        # Nickname search
        if name.nickname:
            vectors.append(
                SearchVector(
                    query=name.nickname,
                    vector_type="name",
                    platforms=target_platforms,
                    priority=7,
                    source_data={"nickname": name.nickname},
                )
            )

        # Maiden name search (for background checks)
        if name.maiden_name:
            vectors.append(
                SearchVector(
                    query=f'"{name.maiden_name}"',
                    vector_type="name",
                    platforms=target_platforms,
                    priority=6,
                    source_data={"maiden_name": name.maiden_name},
                )
            )

        # Aliases
        for alias in name.aliases[:3]:
            vectors.append(
                SearchVector(
                    query=alias,
                    vector_type="alias",
                    platforms=target_platforms,
                    priority=5,
                    source_data={"alias": alias},
                )
            )

        return vectors[:max_vectors]

    async def _generate_email_vectors(
        self, email: str, platforms: list[str] | None, max_vectors: int
    ) -> list[SearchVector]:
        """Generate search vectors for email queries."""
        vectors = []
        people_platforms = platforms or self.PLATFORM_CATEGORIES["people_search"]
        social_platforms = platforms or self.PLATFORM_CATEGORIES["social_media"]

        # Direct email search
        vectors.append(
            SearchVector(
                query=f'"{email}"',
                vector_type="email",
                platforms=people_platforms,
                priority=10,
                source_data={"email": email},
            )
        )

        # Email on social media
        vectors.append(
            SearchVector(
                query=email,
                vector_type="email",
                platforms=social_platforms,
                priority=8,
                source_data={"email": email},
            )
        )

        # Local part (before @) as username search
        local_part = email.split("@")[0]
        vectors.append(
            SearchVector(
                query=local_part,
                vector_type="email_local",
                platforms=social_platforms,
                priority=7,
                source_data={"email": email, "local_part": local_part},
            )
        )

        # Domain search (for business context)
        domain = email.split("@")[1] if "@" in email else None
        if domain and domain not in ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]:
            vectors.append(
                SearchVector(
                    query=f"@{domain}",
                    vector_type="email_domain",
                    platforms=social_platforms,
                    priority=6,
                    source_data={"email": email, "domain": domain},
                )
            )

        return vectors[:max_vectors]

    async def _generate_phone_vectors(
        self, phone: str, platforms: list[str] | None, max_vectors: int
    ) -> list[SearchVector]:
        """Generate search vectors for phone queries."""
        vectors = []
        people_platforms = platforms or self.PLATFORM_CATEGORIES["people_search"]

        # Direct phone search
        vectors.append(
            SearchVector(
                query=phone,
                vector_type="phone",
                platforms=people_platforms,
                priority=10,
                source_data={"phone": phone},
            )
        )

        # Without formatting
        digits_only = "".join(c for c in phone if c.isdigit())
        if digits_only != phone:
            vectors.append(
                SearchVector(
                    query=digits_only,
                    vector_type="phone",
                    platforms=people_platforms,
                    priority=9,
                    source_data={"phone": phone, "digits": digits_only},
                )
            )

        return vectors[:max_vectors]

    async def _generate_username_vectors(
        self, username: str, platforms: list[str] | None, max_vectors: int
    ) -> list[SearchVector]:
        """Generate search vectors for username queries."""
        vectors = []
        social_platforms = platforms or self.PLATFORM_CATEGORIES["social_media"]

        # Direct username search
        vectors.append(
            SearchVector(
                query=username,
                vector_type="username",
                platforms=social_platforms,
                priority=9,
                source_data={"username": username},
            )
        )

        # Username variations
        variations = [
            username.lower(),
            username.replace("_", ""),
            username.replace("-", ""),
            username.replace(".", ""),
        ]
        for var in set(variations) - {username}:
            vectors.append(
                SearchVector(
                    query=var,
                    vector_type="username_variation",
                    platforms=social_platforms,
                    priority=7,
                    source_data={"username": username, "variation": var},
                )
            )

        return vectors[:max_vectors]

    async def _generate_address_vectors(
        self, address: AddressInfo, platforms: list[str] | None, max_vectors: int
    ) -> list[SearchVector]:
        """Generate search vectors for address queries."""
        vectors = []
        public_platforms = platforms or self.PLATFORM_CATEGORIES["public_records"]

        # Full address search (for property records)
        if address.value:
            vectors.append(
                SearchVector(
                    query=f'"{address.value}"',
                    vector_type="address",
                    platforms=public_platforms,
                    priority=8,
                    source_data={"address": address.value},
                )
            )

        # City + Name combination
        if address.city and hasattr(address, "_entity_name"):
            # Would need entity name context
            pass

        return vectors[:max_vectors]

    async def _generate_keyword_vectors(
        self, keywords: list[str], platforms: list[str] | None, max_vectors: int
    ) -> list[SearchVector]:
        """Generate search vectors for keyword queries."""
        vectors = []
        social_platforms = platforms or self.PLATFORM_CATEGORIES["social_media"]

        for keyword in keywords[:5]:
            vectors.append(
                SearchVector(
                    query=keyword,
                    vector_type="keyword",
                    platforms=social_platforms,
                    priority=4,
                    source_data={"keyword": keyword},
                )
            )

        return vectors[:max_vectors]

    async def _generate_llm_vectors(
        self, entity: EntityProfile, platforms: list[str] | None, context: str, max_vectors: int
    ) -> list[SearchVector]:
        """Use LM Studio to generate optimized search queries."""
        vectors = []

        # Build entity summary for LLM
        entity_summary = self._summarize_entity(entity)

        prompt = f"""You are an OSINT search expert. Given this entity profile, generate optimized search queries to find more information about this person.

ENTITY PROFILE:
{entity_summary}

CONTEXT: {context}

Generate {max_vectors} search queries in JSON format:
```json
[
  {{"query": "search query string", "platforms": ["platform1", "platform2"], "priority": 1-10, "reason": "why this query"}},
  ...
]

Focus on:
- People search sites (WhitePages, TruePeopleSearch, etc.)
- Social media platforms
- Professional networks
- Public records queries
- Google dork patterns

Generate queries that are likely to yield NEW information not already known."""
        try:
            response = await self.lm_bridge.chat_completion(
                messages=[{"role": "user", "content": prompt}], temperature=0.3
            )

            # Parse LLM response
            import json

            content = response.get("content", "[]")
            llm_queries = json.loads(content)

            for q in llm_queries[:max_vectors]:
                vectors.append(
                    SearchVector(
                        query=q.get("query", ""),
                        vector_type="llm_generated",
                        platforms=q.get("platforms", []),
                        priority=q.get("priority", 5),
                        source_data={"llm_reason": q.get("reason", "")},
                    )
                )
        except Exception as e:
            logger.warning(f"LLM vector generation failed: {e}")

        return vectors

    def _summarize_entity(self, entity: EntityProfile) -> str:
        """Create a text summary of the entity for LLM prompts."""
        parts = []

        if entity.primary_name:
            parts.append(f"Name: {entity.primary_name.value}")

        if entity.emails:
            emails = [e.value for e in entity.emails[:3]]
            parts.append(f"Emails: {', '.join(emails)}")

        if entity.phones:
            phones = [p.value for p in entity.phones[:3]]
            parts.append(f"Phones: {', '.join(phones)}")

        if entity.addresses:
            addrs = [a.value for a in entity.addresses[:2]]
            parts.append(f"Addresses: {', '.join(addrs)}")

        if entity.usernames:
            usernames = [u.value for u in entity.usernames[:5]]
            parts.append(f"Known usernames: {', '.join(usernames)}")

        if entity.occupations:
            occupations = [o.value for o in entity.occupations[:2]]
            parts.append(f"Occupation: {', '.join(occupations)}")

        if entity.keywords:
            parts.append(f"Keywords: {', '.join(entity.keywords[:5])}")

        return "\n".join(parts)


# ---------------------------------------------------------------------------
# Deep Crawl Orchestrator
# ---------------------------------------------------------------------------


class DeepCrawlOrchestrator:
    """Orchestrates recursive deep crawling based on entity data.

    Workflow:
    1. Initialize entity profile
    2. Generate search vectors from entity data
    3. Crawl each vector across platforms
    4. Extract PII from crawl results
    5. Update entity with new data
    6. Check for diminishing returns
    7. If new data > threshold, generate new vectors and repeat
    8. Store results and build knowledge graph
    """

    def __init__(
        self,
        lm_bridge: LMStudioBridge | None = None,
        chromadb_client: ChromaDBClient | None = None,
        on_progress: ProgressCallback | None = None,
    ):
        self.lm_bridge = lm_bridge or LMStudioBridge(
            base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1"),
        )
        self.chromadb = chromadb_client or get_chromadb_client()
        self._on_progress = on_progress
        self.vector_generator = SearchVectorGenerator(self.lm_bridge)
        self.enrichment_pipeline = EntityEnrichmentPipeline(
            lm_bridge=self.lm_bridge,
            use_llm=True,
        )
        self.crawl_router = PlatformCrawlRouter(max_concurrent=5)

    def _check_diminishing_returns(
        self,
        crawl_count: int,
        new_count: int,
        threshold: float,
        diminishing_count: int,
        iteration_num: int,
        iteration: CrawlIteration,
    ) -> tuple[bool, int]:
        if crawl_count <= 0:
            return False, diminishing_count
        new_ratio = new_count / crawl_count
        if new_ratio < threshold:
            diminishing_count += 1
            iteration.diminishing_returns = True
            logger.info(f"Iteration {iteration_num}: diminishing returns ({new_ratio:.1%} new)")
            return diminishing_count >= 2, diminishing_count
        return False, 0

    async def run_deep_crawl(self, request: DeepCrawlRequest) -> DeepCrawlResult:
        """Execute the deep crawl pipeline."""

        # Initialize result
        # entity will be set in Stage 1; use a sentinel cast to satisfy Pydantic
        result = DeepCrawlResult(
            entity=None,  # type: ignore[arg-type]  # set after _load_or_create_entity
            stage=DeepCrawlStage.INITIALIZING,
        )

        try:
            # ---- Stage 1: Initialize Entity ----
            await self._emit(result.crawl_id, DeepCrawlStage.INITIALIZING, {})
            await self._init_entity_stage(request, result)

            # ---- Main crawl loop ----
            iteration_num = 0
            diminishing_count = 0

            while iteration_num < request.max_iterations:
                iteration_num += 1

                # ---- Stage 2: Generate Search Vectors ----
                await self._emit(
                    result.crawl_id, DeepCrawlStage.GENERATING_VECTORS, {"iteration": iteration_num}
                )

                vectors = await self.vector_generator.generate_vectors(
                    entity=result.entity,
                    platforms=request.platforms,
                    context=request.query_context,
                    max_vectors=request.max_urls_per_iteration,
                )

                if not vectors:
                    logger.info("No more search vectors to crawl")
                    result.stopped_reason = "no_vectors"
                    break

                # ---- Stage 3: Crawl ----
                iteration = CrawlIteration(iteration_number=iteration_num, search_vectors=vectors)

                await self._emit(
                    result.crawl_id,
                    DeepCrawlStage.CRAWLING,
                    {"iteration": iteration_num, "vectors": len(vectors)},
                )

                crawl_results = await self.crawl_router.crawl_vectors(vectors)
                iteration.urls_crawled = len(crawl_results)
                result.total_urls_crawled += len(crawl_results)

                # ---- Stage 4: Extract ----
                await self._emit(
                    result.crawl_id,
                    DeepCrawlStage.EXTRACTING,
                    {"iteration": iteration_num, "results": len(crawl_results)},
                )

                extracted_data = await self.enrichment_pipeline.extract_pii(crawl_results)

                # ---- Stage 5: Enrich Entity ----
                await self._emit(
                    result.crawl_id, DeepCrawlStage.ENRICHING, {"iteration": iteration_num}
                )

                enrich_result = await self.enrichment_pipeline.enrich_entity(
                    result.entity, extracted_data
                )
                enrichment_stats = {
                    "new": enrich_result.new_data_points,
                    "duplicates": enrich_result.duplicate_data_points,
                    "images": enrich_result.new_images,
                }
                iteration.new_data_points = enrichment_stats["new"]
                iteration.duplicate_data_points = enrichment_stats["duplicates"]
                iteration.new_images = enrichment_stats["images"]

                result.total_data_points_added += enrichment_stats["new"]
                result.total_images_added += enrichment_stats["images"]
                result.total_duplicates_skipped += enrichment_stats["duplicates"]

                # ---- Stage 6: Check Diminishing Returns ----
                await self._emit(
                    result.crawl_id,
                    DeepCrawlStage.DEDUPLICATING,
                    {"new": enrichment_stats["new"], "duplicates": enrichment_stats["duplicates"]},
                )

                should_stop, diminishing_count = self._check_diminishing_returns(
                    len(crawl_results),
                    enrichment_stats["new"],
                    request.min_new_data_threshold,
                    diminishing_count,
                    iteration_num,
                    iteration,
                )
                if should_stop:
                    result.stopped_reason = "diminishing_returns"
                    break

                # Complete iteration
                iteration.completed_at = datetime.now(UTC)
                result.iterations.append(iteration)
                result.total_iterations = iteration_num

                # ---- Stage 7: Iterate (check time limit) ----
                elapsed_minutes = (datetime.now(UTC) - result.started_at).total_seconds() / 60
                if elapsed_minutes >= request.max_time_minutes:
                    result.stopped_reason = "max_time"
                    break

                await self._emit(
                    result.crawl_id,
                    DeepCrawlStage.ITERATING,
                    {
                        "iteration": iteration_num,
                        "total_data_points": result.total_data_points_added,
                    },
                )

            # ---- Stage 8: Complete ----
            result.entity.calculate_completeness()
            result.entity.last_crawled = datetime.now(UTC)
            result.entity.crawl_depth = result.total_iterations

            result.stage = DeepCrawlStage.COMPLETED
            result.completed_at = datetime.now(UTC)
            result.summary = self._build_summary(result)

            await self._emit(result.crawl_id, DeepCrawlStage.COMPLETED, result.summary)

        except Exception as exc:
            logger.error(f"Deep crawl {result.crawl_id} failed: {exc}", exc_info=True)
            result.stage = DeepCrawlStage.FAILED
            result.error = str(exc)
            result.completed_at = datetime.now(UTC)
            await self._emit(result.crawl_id, DeepCrawlStage.FAILED, {"error": str(exc)})

        return result

    # -- Entity Management --

    async def _init_entity_stage(
        self,
        request: DeepCrawlRequest,
        result: DeepCrawlResult,
    ) -> None:
        if request.entity_id:
            result.entity = await self._load_or_create_entity(request)
        elif request.create_entity:
            result.entity = self._create_entity_from_request(request.create_entity)
        else:
            raise ValueError("Either entity_id or create_entity is required")
        if request.investigation_id:
            result.entity.investigation_id = request.investigation_id

    async def _load_or_create_entity(self, request: DeepCrawlRequest) -> EntityProfile:
        """Load existing entity or create from request."""
        # In a full implementation, this would load from a database
        # For now, create from request if create_entity is provided
        if request.create_entity:
            return self._create_entity_from_request(request.create_entity)
        raise ValueError(f"Entity {request.entity_id} not found")

    def _create_entity_from_request(self, req: CreateEntityRequest) -> EntityProfile:
        """Create a new EntityProfile from a request."""
        entity = EntityProfile(entity_type=req.entity_type, investigation_id=req.investigation_id)

        # Set primary name
        if req.name or req.first_name or req.last_name:
            entity.primary_name = NameInfo(
                value=req.name or f"{req.first_name or ''} {req.last_name or ''}".strip(),
                first_name=req.first_name,
                last_name=req.last_name,
                sources=[DataSource.USER_INPUT],
            )

        # Add initial data
        for phone in req.phones:
            entity.add_phone(phone, DataSource.USER_INPUT)

        for email in req.emails:
            entity.add_email(email, DataSource.USER_INPUT)

        for addr in req.addresses:
            entity.add_address(addr, DataSource.USER_INPUT)

        for username in req.usernames:
            entity.add_username(username, source=DataSource.USER_INPUT)

        entity.keywords = req.keywords.copy()

        if req.occupation:
            from app.models.entity import EmploymentInfo

            entity.occupations.append(
                EmploymentInfo(value=req.occupation, sources=[DataSource.USER_INPUT])
            )

        if req.notes:
            entity.notes.append({"content": req.notes, "created_at": datetime.now(UTC).isoformat()})

        entity.calculate_completeness()
        return entity

    # -- Crawling --

    async def _crawl_vectors(
        self, vectors: list[SearchVector], max_concurrent: int
    ) -> list[dict[str, Any]]:
        """Crawl URLs from search vectors."""
        results = []
        semaphore = asyncio.Semaphore(max_concurrent)

        async def crawl_one(vector: SearchVector) -> dict[str, Any]:
            async with semaphore:
                try:
                    # Import crawl4ai
                    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

                    browser_config = BrowserConfig(headless=True)
                    run_config = CrawlerRunConfig(
                        check_robots_txt=True,
                        cache_mode=CacheMode.ENABLED,
                        word_count_threshold=50,
                        page_timeout=30000,
                    )

                    async with AsyncWebCrawler(config=browser_config) as crawler:
                        res = await crawler.arun(vector.query, config=run_config)

                        return {
                            "vector_id": vector.vector_id,
                            "query": vector.query,
                            "success": res.success,
                            "markdown": res.markdown if res.success else None,
                            "error": res.error_message if not res.success else None,
                        }
                except ImportError:
                    # crawl4ai not available - return stub
                    return {
                        "vector_id": vector.vector_id,
                        "query": vector.query,
                        "success": False,
                        "error": "crawl4ai not available",
                    }
                except Exception as e:
                    logger.warning(f"Crawl failed for {vector.query}: {e}")
                    return {
                        "vector_id": vector.vector_id,
                        "query": vector.query,
                        "success": False,
                        "error": str(e),
                    }

        tasks = [crawl_one(v) for v in vectors]
        results = await asyncio.gather(*tasks)
        return list(results)

    # -- Extraction --

    async def _extract_from_results(
        self, crawl_results: list[dict[str, Any]]
    ) -> list[ExtractedData]:
        """Extract PII from crawl results using LM Studio and pattern matching."""
        extracted = []

        for result in crawl_results:
            if not result.get("success") or not result.get("markdown"):
                continue

            markdown = result["markdown"]
            data = ExtractedData(source_url=result.get("query", ""), source_type="web")

            # Regex-based extraction
            import re

            # Emails
            email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
            data.emails = list(set(re.findall(email_pattern, markdown)))

            # Phone numbers (US format)
            phone_pattern = r"\b(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}\b"
            data.phones = list(set(re.findall(phone_pattern, markdown)))

            # URLs
            url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
            data.urls = list(set(re.findall(url_pattern, markdown)))

            # Image URLs
            img_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:jpg|jpeg|png|gif|webp)'
            data.image_urls = list(set(re.findall(img_pattern, markdown, re.IGNORECASE)))

            # Store raw text for LLM extraction
            data.raw_text = markdown[:5000]  # Limit size

            extracted.append(data)

        return extracted

    # -- Enrichment --

    def _enrich_entity(
        self, entity: EntityProfile, extracted_data: list[ExtractedData]
    ) -> dict[str, int]:
        """Enrich entity with extracted data. Returns stats."""
        stats = {"new": 0, "duplicates": 0, "images": 0}

        existing_emails = {e.value.lower() for e in entity.emails}
        existing_phones = {p.value for p in entity.phones}
        {a.value.lower() for a in entity.addresses}

        for data in extracted_data:
            source = DataSource.WEB_CRAWL
            source_url = data.source_url

            # Emails
            for email in data.emails:
                if email.lower() not in existing_emails:
                    entity.add_email(email, source, source_url)
                    stats["new"] += 1
                    existing_emails.add(email.lower())
                else:
                    stats["duplicates"] += 1

            # Phones
            for phone in data.phones:
                if phone not in existing_phones:
                    entity.add_phone(phone, source, source_url)
                    stats["new"] += 1
                    existing_phones.add(phone)
                else:
                    stats["duplicates"] += 1

            # Addresses (would need more sophisticated extraction)

            # Images
            for img_url in data.image_urls:
                entity.add_image(img_url, source, source_url=source_url)
                stats["images"] += 1

            # Keywords
            for keyword in data.keywords:
                entity.add_keyword(keyword)

        return stats

    # -- Progress --

    async def _emit(self, crawl_id: str, stage: DeepCrawlStage, data: dict[str, Any]) -> None:
        """Emit a progress event."""
        logger.info(f"Deep crawl {crawl_id} [{stage.value}]: {data}")
        if self._on_progress:
            try:
                await self._on_progress(crawl_id, stage, data)
            except Exception as exc:
                logger.warning(f"Progress callback failed: {exc}")

    # -- Summary --

    def _build_summary(self, result: DeepCrawlResult) -> dict[str, Any]:
        """Build a summary of the deep crawl result."""
        return {
            "crawl_id": result.crawl_id,
            "entity_id": result.entity.entity_id,
            "total_iterations": result.total_iterations,
            "stopped_reason": result.stopped_reason,
            "total_urls_crawled": result.total_urls_crawled,
            "total_data_points_added": result.total_data_points_added,
            "total_images_added": result.total_images_added,
            "total_duplicates_skipped": result.total_duplicates_skipped,
            "completeness_score": result.entity.completeness_score,
            "duration_seconds": (
                (result.completed_at or datetime.now(UTC)) - result.started_at
            ).total_seconds(),
        }
