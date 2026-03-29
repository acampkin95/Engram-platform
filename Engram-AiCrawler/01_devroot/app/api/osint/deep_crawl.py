"""Deep Crawl endpoints — POST /deep-crawl/start, GET /deep-crawl/{id}, GET /deep-crawl, GET /platforms/list."""
from __future__ import annotations
import logging
import os
from datetime import datetime
from app._compat import UTC
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.websocket.manager import manager
from app.services.job_store import get_job_store
from app.services.lm_studio_bridge import LMStudioBridge

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/osint", tags=["osint"])

_deep_crawl_store = get_job_store("deep_crawl_jobs")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_lm_bridge() -> LMStudioBridge:
    return LMStudioBridge(
        base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1"),
        model=os.getenv("LM_STUDIO_MODEL", "local-model"),
        timeout=int(os.getenv("LM_STUDIO_TIMEOUT", "60")),
        temperature=float(os.getenv("LM_STUDIO_TEMPERATURE", "0.7")),
    )


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class DeepCrawlStartRequest(BaseModel):
    """Request body for POST /api/osint/deep-crawl/start."""

    # Entity seed data (at least one required)
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    usernames: list[str] = Field(default_factory=list)
    addresses: list[str] = Field(default_factory=list)
    occupation: str | None = None
    keywords: list[str] = Field(default_factory=list)
    notes: str | None = None

    # Crawl configuration
    max_iterations: int = Field(default=3, ge=1, le=10)
    max_urls_per_iteration: int = Field(default=30, ge=1, le=100)
    max_concurrent_crawls: int = Field(default=5, ge=1, le=10)
    max_time_minutes: int = Field(default=30, ge=5, le=120)
    platforms: list[str] | None = None
    investigation_id: str | None = None
    query_context: str = ""


class DeepCrawlStatusResponse(BaseModel):
    crawl_id: str
    status: str  # running | completed | failed
    stage: str | None = None
    total_iterations: int = 0
    total_urls_crawled: int = 0
    total_data_points_added: int = 0
    total_images_added: int = 0
    stopped_reason: str | None = None
    error: str | None = None
    summary: dict[str, Any] = Field(default_factory=dict)
    entity_summary: dict[str, Any] | None = None
    started_at: str | None = None
    completed_at: str | None = None


# ---------------------------------------------------------------------------
# Deep Crawl endpoints
# ---------------------------------------------------------------------------


@router.post("/deep-crawl/start", status_code=202)
async def start_deep_crawl(
    request: DeepCrawlStartRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Start an entity-driven deep OSINT crawl in the background.

    The crawl recursively searches for information about the target entity
    using all known data points as search vectors across people-search sites,
    social media, public records, and general web.

    Returns a crawl_id to poll for status.
    """
    from app.models.entity import EntityType
    from app.models.entity import CreateEntityRequest as EntityCreateRequest
    from app.orchestrators.deep_crawl_orchestrator import (
        DeepCrawlOrchestrator,
        DeepCrawlRequest,
    )

    # Validate at least one seed
    has_seed = any(
        [
            request.name,
            request.first_name,
            request.last_name,
            request.emails,
            request.phones,
            request.usernames,
        ]
    )
    if not has_seed:
        raise HTTPException(
            status_code=422,
            detail="At least one seed field is required (name, email, phone, or username)",
        )

    # Build the entity create request
    entity_req = EntityCreateRequest(
        entity_type=EntityType.PERSON,
        name=request.name,
        first_name=request.first_name,
        last_name=request.last_name,
        emails=request.emails,
        phones=request.phones,
        usernames=request.usernames,
        addresses=request.addresses,
        occupation=request.occupation,
        keywords=request.keywords,
        notes=request.notes,
        investigation_id=request.investigation_id,
    )

    crawl_req = DeepCrawlRequest(
        create_entity=entity_req,
        max_iterations=request.max_iterations,
        max_urls_per_iteration=request.max_urls_per_iteration,
        max_concurrent_crawls=request.max_concurrent_crawls,
        max_time_minutes=request.max_time_minutes,
        platforms=request.platforms,
        investigation_id=request.investigation_id,
        query_context=request.query_context,
    )

    # Register job
    crawl_id = str(uuid4())
    initial_job = {
        "status": "running",
        "stage": "initializing",
        "crawl_id": crawl_id,
        "started_at": datetime.now(UTC).isoformat(),
        "result": None,
    }
    await _deep_crawl_store.set(crawl_id, initial_job)

    async def _run_crawl():
        try:
            lm_bridge = _get_lm_bridge()
            orchestrator = DeepCrawlOrchestrator(lm_bridge=lm_bridge)
            result = await orchestrator.run_deep_crawl(crawl_req)

            await _deep_crawl_store.update(
                crawl_id,
                {
                    "status": "completed" if result.stage.value == "completed" else "failed",
                    "result": result.model_dump() if hasattr(result, "model_dump") else result,
                    "completed_at": datetime.now(UTC).isoformat(),
                },
            )

            # Broadcast completion via WebSocket
            await manager.broadcast(
                {
                    "type": "deep_crawl_complete",
                    "crawl_id": crawl_id,
                    "summary": result.summary,
                }
            )
        except Exception as exc:
            logger.exception(f"Deep crawl {crawl_id} failed: {exc}")
            await _deep_crawl_store.update(
                crawl_id,
                {
                    "status": "failed",
                    "error": str(exc),
                    "completed_at": datetime.now(UTC).isoformat(),
                },
            )

    background_tasks.add_task(_run_crawl)

    return {
        "crawl_id": crawl_id,
        "status": "running",
        "message": "Deep crawl started. Poll /api/osint/deep-crawl/{crawl_id} for status.",
    }


@router.get("/deep-crawl/{crawl_id}")
async def get_deep_crawl_status(crawl_id: str) -> DeepCrawlStatusResponse:
    """Get the status and results of a running or completed deep crawl."""
    job = await _deep_crawl_store.get(crawl_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Crawl {crawl_id!r} not found")

    result_data = job.get("result")
    entity_summary = None
    if isinstance(result_data, dict) and result_data.get("entity"):
        entity = result_data["entity"]
        entity_summary = {
            "entity_id": entity.get("entity_id"),
            "name": entity.get("primary_name", {}).get("value")
            if isinstance(entity.get("primary_name"), dict)
            else entity.get("primary_name"),
            "emails": [e.get("value") for e in entity.get("emails", []) if isinstance(e, dict)],
            "phones": [p.get("value") for p in entity.get("phones", []) if isinstance(p, dict)],
            "addresses": [
                a.get("value") for a in entity.get("addresses", []) if isinstance(a, dict)
            ],
            "usernames": [
                u.get("value") for u in entity.get("usernames", []) if isinstance(u, dict)
            ],
            "social_profiles": len(entity.get("social_profiles", [])),
            "images": len(entity.get("images", [])),
            "completeness_score": entity.get("completeness_score"),
        }

    return DeepCrawlStatusResponse(
        crawl_id=crawl_id,
        status=job["status"],
        stage=result_data.get("stage") if isinstance(result_data, dict) else job.get("stage"),
        total_iterations=result_data.get("total_iterations", 0)
        if isinstance(result_data, dict)
        else 0,
        total_urls_crawled=result_data.get("total_urls_crawled", 0)
        if isinstance(result_data, dict)
        else 0,
        total_data_points_added=result_data.get("total_data_points_added", 0)
        if isinstance(result_data, dict)
        else 0,
        total_images_added=result_data.get("total_images_added", 0)
        if isinstance(result_data, dict)
        else 0,
        stopped_reason=result_data.get("stopped_reason") if isinstance(result_data, dict) else None,
        error=job.get("error"),
        summary=result_data.get("summary", {}) if isinstance(result_data, dict) else {},
        entity_summary=entity_summary,
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
    )


@router.get("/deep-crawl")
async def list_deep_crawls() -> list[dict[str, Any]]:
    """List all deep crawl jobs (running and completed)."""
    all_jobs = await _deep_crawl_store.values()
    return [
        {
            "crawl_id": job.get("crawl_id"),
            "status": job.get("status"),
            "started_at": job.get("started_at"),
            "completed_at": job.get("completed_at"),
            "stage": (
                job["result"].get("stage")
                if isinstance(job.get("result"), dict)
                else job.get("stage")
            ),
        }
        for job in all_jobs
    ]


@router.get("/platforms/list")
async def list_registered_platforms() -> list[dict[str, Any]]:
    """List all registered OSINT platforms with metadata."""
    from app.osint.platforms import get_registry

    registry = get_registry()
    return [
        {
            "id": p.id,
            "name": p.name,
            "category": p.category.value,
            "anti_bot_level": p.anti_bot_level.value,
            "requires_js": p.requires_js,
            "has_custom_adapter": p.has_custom_adapter,
            "yields": {
                "names": p.yields_names,
                "emails": p.yields_emails,
                "phones": p.yields_phones,
                "addresses": p.yields_addresses,
                "social_profiles": p.yields_social_profiles,
                "images": p.yields_images,
                "relationships": p.yields_relationships,
            },
            "rate_limit_delay": p.rate_limit_delay,
        }
        for p in registry.all()
    ]
