"""
Discovery API endpoints.

Provides:
- POST /api/darkweb/discover - Search dark web
- GET /api/darkweb/engines/status - Get engine status
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from crawl4ai_darkweb_osint.config import get_config
from crawl4ai_darkweb_osint.discovery.search import (
    DarkWebDiscoveryEngine,
    SEARCH_ENGINES,
    SearchEngineStatus,
)
from crawl4ai_darkweb_osint.discovery.query_refine import QueryRefiner
from crawl4ai_darkweb_osint.discovery.dedup import deduplicate_results

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response Models
class DiscoverRequest(BaseModel):
    """Request model for discovery search."""

    query: str = Field(..., description="Search query", min_length=1, max_length=500)
    engines: Optional[list[str]] = Field(
        default=None,
        description="List of engines to use (default: all configured)",
    )
    max_results: int = Field(default=50, description="Max results per engine", ge=1, le=100)
    refine_query: bool = Field(default=True, description="Use LLM to refine query")
    deduplicate: bool = Field(default=True, description="Remove duplicate results")


class SearchHit(BaseModel):
    """Single search result."""

    url: str
    title: str
    description: str
    engine: str
    rank: int
    is_onion: bool
    timestamp: str


class DiscoverResponse(BaseModel):
    """Response model for discovery search."""

    success: bool
    query: str
    refined_query: Optional[str] = None
    alternatives: list[str] = []
    results: list[SearchHit]
    total_results: int
    engines_used: list[str]
    dedup_stats: Optional[dict] = None
    timestamp: str


class EngineInfo(BaseModel):
    """Information about a search engine."""

    name: str
    display_name: str
    status: str
    requires_onion: bool


class EnginesStatusResponse(BaseModel):
    """Response model for engine status."""

    engines: list[EngineInfo]
    total: int
    available: int


# Background task storage (in-memory for now)
_discovery_tasks: dict = {}


@router.post("/discover", response_model=DiscoverResponse)
async def discover(
    request: DiscoverRequest,
    background_tasks: BackgroundTasks,
) -> DiscoverResponse:
    """
    Search the dark web across multiple engines.

    Uses Tor SOCKS5 proxy for all requests to .onion sites.
    Optionally refines query with LLM and deduplicates results.
    """
    config = get_config()

    # Validate engines
    available_engines = list(SEARCH_ENGINES.keys())
    if request.engines:
        invalid = set(request.engines) - set(available_engines)
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid engines: {invalid}. Available: {available_engines}",
            )

    # Initialize
    engine = DarkWebDiscoveryEngine(
        config=config.discovery,
        engines=request.engines,
    )

    query = request.query
    refined_query = None
    alternatives = []

    # Refine query if requested
    if request.refine_query:
        try:
            refiner = QueryRefiner(config=config.llm)
            refined = await refiner.refine(query)
            query = refined.refined
            refined_query = refined.refined
            alternatives = refined.alternatives
            await refiner.close()
        except Exception as e:
            logger.warning(f"Query refinement failed: {e}")

    # Perform search
    try:
        results = await engine.search(
            query=query,
            engines=request.engines,
            max_results=request.max_results,
        )
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    # Deduplicate if requested
    dedup_stats = None
    if request.deduplicate:
        results, stats = deduplicate_results(
            results,
            threshold=config.discovery.dedup_threshold,
        )
        dedup_stats = {
            "total_input": stats.total_input,
            "duplicates_found": stats.duplicates_found,
            "unique_output": stats.unique_output,
            "sources": stats.duplicate_sources,
        }

    # Convert to response format
    hits = [
        SearchHit(
            url=r.url,
            title=r.title,
            description=r.description,
            engine=r.engine,
            rank=r.rank,
            is_onion=r.is_onion(),
            timestamp=r.timestamp.isoformat(),
        )
        for r in results
    ]

    return DiscoverResponse(
        success=True,
        query=request.query,
        refined_query=refined_query,
        alternatives=alternatives,
        results=hits,
        total_results=len(hits),
        engines_used=request.engines or config.discovery.engines,
        dedup_stats=dedup_stats,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/engines/status", response_model=EnginesStatusResponse)
async def get_engines_status() -> EnginesStatusResponse:
    """
    Get status of all configured dark web search engines.

    Returns availability and configuration info for each engine.
    """
    config = get_config()
    engine = DarkWebDiscoveryEngine(config=config.discovery)

    status_data = engine.get_engine_status()

    engines = [
        EngineInfo(
            name=name,
            display_name=info["display_name"],
            status=info["status"],
            requires_onion=info["requires_onion"],
        )
        for name, info in status_data.items()
    ]

    available = sum(1 for e in engines if e.status == SearchEngineStatus.AVAILABLE.value)

    return EnginesStatusResponse(
        engines=engines,
        total=len(engines),
        available=available,
    )


@router.get("/engines/list")
async def list_engines() -> dict:
    """
    List all available search engines with their details.
    """
    engines = []

    for name, engine in SEARCH_ENGINES.items():
        engines.append(
            {
                "name": name,
                "display_name": engine.display_name,
                "requires_onion": engine.requires_onion,
                "search_url_template": engine.search_url,
            }
        )

    return {
        "total": len(engines),
        "engines": engines,
    }


# Health check endpoint
@router.get("/health")
async def discovery_health() -> dict:
    """Check discovery module health."""
    config = get_config()

    return {
        "status": "healthy",
        "configured_engines": len(config.discovery.engines),
        "parallel_engines": config.discovery.parallel_engines,
        "dedup_enabled": config.discovery.dedup_enabled,
    }
