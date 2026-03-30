"""Performance & Storage API — Phase 6.6.

Endpoints:
  GET  /api/performance/storage/stats      — Per-tier storage statistics
  GET  /api/performance/storage/artifacts  — List artifacts with filters
  POST /api/performance/storage/lifecycle  — Trigger manual lifecycle cycle
  POST /api/performance/storage/promote    — Manually promote an artifact
  DELETE /api/performance/storage/artifact/{id} — Delete an artifact

  GET  /api/performance/cache/stats        — OSINT Redis cache statistics
  POST /api/performance/cache/invalidate   — Invalidate entity cache entries

  GET  /api/performance/jobs               — List job queue entries
  GET  /api/performance/jobs/{job_id}      — Get specific job status
  POST /api/performance/jobs               — Enqueue a new job
  POST /api/performance/jobs/{job_id}/cancel — Cancel a pending job
  GET  /api/performance/jobs/stats         — Job queue statistics

  GET  /api/performance/chroma/stats       — ChromaDB collection statistics
  GET  /api/performance/chroma/health      — ChromaDB health check
  POST /api/performance/chroma/prune       — Prune oversized collection

  GET  /api/performance/governor/stats     — Concurrency governor statistics
  GET  /api/performance/health             — Aggregated health summary
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/performance", tags=["performance"])


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------


class LifecycleCycleResponse(BaseModel):
    transitions: dict[str, int]
    message: str = "Lifecycle cycle completed"


class PromoteArtifactRequest(BaseModel):
    artifact_id: str
    target_tier: str  # hot | warm | cold | archive


class InvalidateCacheRequest(BaseModel):
    entity_id: str


class EnqueueJobRequest(BaseModel):
    job_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=5, ge=1, le=10)
    created_by: str | None = None


class PruneCollectionRequest(BaseModel):
    collection_name: str
    max_documents: int = Field(default=10000, ge=100)


# ---------------------------------------------------------------------------
# Storage endpoints
# ---------------------------------------------------------------------------


@router.get("/storage/stats", status_code=200)
async def get_storage_stats() -> dict[str, Any]:
    """Return per-tier storage statistics."""
    try:
        from app.services.storage_optimizer import get_storage_optimizer

        return get_storage_optimizer().tier_stats()
    except Exception as exc:
        logger.error("Storage stats error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/storage/artifacts", status_code=200)
async def list_artifacts(
    tier: str | None = Query(None, description="Filter by tier: hot|warm|cold|archive"),
    artifact_type: str | None = Query(None, description="Filter by type"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """List stored artifacts with optional filters."""
    try:
        from app.services.storage_optimizer import get_storage_optimizer, StorageTier, ArtifactType

        opt = get_storage_optimizer()
        tier_enum = StorageTier(tier) if tier else None
        type_enum = ArtifactType(artifact_type) if artifact_type else None
        artifacts = opt.list_artifacts(
            tier=tier_enum, artifact_type=type_enum, limit=limit, offset=offset
        )
        return {"artifacts": artifacts, "count": len(artifacts), "offset": offset}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid tier or type: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/storage/lifecycle", status_code=201)
async def run_lifecycle_cycle() -> LifecycleCycleResponse:
    """Trigger a manual data lifecycle migration cycle."""
    try:
        from app.services.storage_optimizer import get_storage_optimizer

        transitions = get_storage_optimizer().run_lifecycle_cycle()
        return LifecycleCycleResponse(transitions=transitions)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/storage/promote", status_code=201)
async def promote_artifact(request: PromoteArtifactRequest) -> dict[str, Any]:
    """Manually move an artifact to a different storage tier."""
    try:
        from app.services.storage_optimizer import get_storage_optimizer, StorageTier

        tier = StorageTier(request.target_tier)
        ok = get_storage_optimizer().promote(request.artifact_id, tier)
        if not ok:
            raise HTTPException(status_code=404, detail=f"Artifact {request.artifact_id} not found")
        return {
            "success": True,
            "artifact_id": request.artifact_id,
            "new_tier": request.target_tier,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/storage/artifact/{artifact_id}", status_code=200)
async def delete_artifact(artifact_id: str) -> dict[str, Any]:
    """Delete an artifact from storage."""
    try:
        from app.services.storage_optimizer import get_storage_optimizer

        ok = get_storage_optimizer().delete_artifact(artifact_id)
        if not ok:
            raise HTTPException(status_code=404, detail=f"Artifact {artifact_id} not found")
        return {"success": True, "artifact_id": artifact_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Cache endpoints
# ---------------------------------------------------------------------------


@router.get("/cache/stats", status_code=200)
async def get_cache_stats() -> dict[str, Any]:
    """Return OSINT Redis cache statistics."""
    try:
        from app.services.storage_optimizer import get_osint_cache

        return await get_osint_cache().cache_stats()
    except Exception as exc:
        logger.error("Cache stats error: %s", exc)
        return {"error": str(exc), "status": "unavailable"}


@router.post("/cache/invalidate", status_code=201)
async def invalidate_entity_cache(request: InvalidateCacheRequest) -> dict[str, Any]:
    """Invalidate all cached data for an entity."""
    try:
        from app.services.storage_optimizer import get_osint_cache

        await get_osint_cache().invalidate_entity(request.entity_id)
        return {"success": True, "entity_id": request.entity_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Job queue endpoints
# ---------------------------------------------------------------------------


@router.get("/jobs", status_code=200)
async def list_jobs(
    status: str | None = Query(
        None, description="Filter by status: pending|running|completed|failed|cancelled"
    ),
    job_type: str | None = Query(None, description="Filter by job type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """List jobs in the OSINT job queue."""
    try:
        from app.services.job_queue import get_job_queue, JobStatus, JobType

        queue = get_job_queue()
        status_enum = JobStatus(status) if status else None
        type_enum = JobType(job_type) if job_type else None
        jobs = await queue.list_jobs(
            status=status_enum, job_type=type_enum, limit=limit, offset=offset
        )
        return {"jobs": [j.to_dict() for j in jobs], "count": len(jobs), "offset": offset}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/jobs/stats", status_code=200)
async def get_job_stats() -> dict[str, Any]:
    """Return job queue statistics."""
    try:
        from app.services.job_queue import get_job_queue

        return await get_job_queue().queue_stats()
    except Exception as exc:
        return {"error": str(exc)}


@router.get("/jobs/{job_id}", status_code=200)
async def get_job(job_id: str) -> dict[str, Any]:
    """Get status and result of a specific job."""
    try:
        from app.services.job_queue import get_job_queue

        job = await get_job_queue().get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        return job.to_dict()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/jobs", status_code=201)
async def enqueue_job(request: EnqueueJobRequest) -> dict[str, Any]:
    """Enqueue a new OSINT job. Returns job_id immediately."""
    try:
        from app.services.job_queue import ensure_queue_started, JobType

        try:
            job_type = JobType(request.job_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown job type: {request.job_type}")
        queue = await ensure_queue_started()
        job_id = await queue.enqueue(
            job_type=job_type,
            payload=request.payload,
            priority=request.priority,
            created_by=request.created_by,
        )
        return {"job_id": job_id, "status": "pending", "job_type": request.job_type}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/jobs/{job_id}/cancel", status_code=201)
async def cancel_job(job_id: str) -> dict[str, Any]:
    """Cancel a pending or running job."""
    try:
        from app.services.job_queue import get_job_queue

        ok = await get_job_queue().cancel_job(job_id)
        if not ok:
            raise HTTPException(
                status_code=409,
                detail=f"Job {job_id} cannot be cancelled (not found or already terminal)",
            )
        return {"success": True, "job_id": job_id, "status": "cancelled"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# ChromaDB endpoints
# ---------------------------------------------------------------------------


@router.get("/chroma/stats", status_code=200)
async def get_chroma_stats(
    collection: str | None = Query(None, description="Specific collection name, or omit for all"),
) -> dict[str, Any]:
    """Return ChromaDB collection statistics."""
    try:
        from app.services.chromadb_optimizer import get_collection_optimizer

        return get_collection_optimizer().collection_stats(collection_name=collection)
    except Exception as exc:
        return {"error": str(exc), "status": "unavailable"}


@router.get("/chroma/health", status_code=200)
async def chroma_health() -> dict[str, Any]:
    """Return ChromaDB health check."""
    try:
        from app.services.chromadb_optimizer import get_collection_optimizer

        return get_collection_optimizer().health_check()
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


@router.post("/chroma/prune", status_code=201)
async def prune_collection(request: PruneCollectionRequest) -> dict[str, Any]:
    """Prune a ChromaDB collection that has exceeded its document limit."""
    try:
        from app.services.chromadb_optimizer import get_collection_optimizer

        return get_collection_optimizer().prune_collection(
            collection_name=request.collection_name,
            max_documents=request.max_documents,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Concurrency governor endpoint
# ---------------------------------------------------------------------------


@router.get("/governor/stats", status_code=200)
async def get_governor_stats() -> dict[str, Any]:
    """Return concurrency governor statistics."""
    try:
        from app.services.concurrency_governor import get_concurrency_governor

        return get_concurrency_governor().stats()
    except Exception as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Aggregated health summary
# ---------------------------------------------------------------------------


@router.get("/health", status_code=200)
async def performance_health() -> dict[str, Any]:
    """Aggregated health summary for all Phase 6 services."""
    health: dict[str, Any] = {}

    # Storage
    try:
        from app.services.storage_optimizer import get_storage_optimizer

        stats = get_storage_optimizer().tier_stats()
        health["storage"] = {
            "status": "ok",
            "total_artifacts": stats.get("total", {}).get("artifact_count", 0),
            "total_mb": stats.get("total", {}).get("total_mb", 0),
        }
    except Exception as exc:
        health["storage"] = {"status": "error", "error": str(exc)}

    # Cache
    try:
        from app.services.storage_optimizer import get_osint_cache

        cache_stats = await get_osint_cache().cache_stats()
        health["cache"] = {
            "status": "ok" if "error" not in cache_stats else "degraded",
            "total_keys": cache_stats.get("total_osint_keys", 0),
        }
    except Exception as exc:
        health["cache"] = {"status": "error", "error": str(exc)}

    # Job queue
    try:
        from app.services.job_queue import get_job_queue

        q_stats = await get_job_queue().queue_stats()
        health["job_queue"] = {
            "status": "ok",
            "queue_depth": q_stats.get("queue_depth", 0),
            "workers_running": q_stats.get("workers_running", False),
            "total_jobs": q_stats.get("total_jobs", 0),
        }
    except Exception as exc:
        health["job_queue"] = {"status": "error", "error": str(exc)}

    # ChromaDB
    try:
        from app.services.chromadb_optimizer import get_collection_optimizer

        chroma = get_collection_optimizer().health_check()
        health["chromadb"] = {
            "status": chroma.get("status", "unknown"),
            "collections": chroma.get("collection_count", 0),
            "documents": chroma.get("total_documents", 0),
        }
    except Exception as exc:
        health["chromadb"] = {"status": "error", "error": str(exc)}

    # Concurrency
    try:
        from app.services.concurrency_governor import get_concurrency_governor

        gov = get_concurrency_governor().stats()
        health["concurrency"] = {
            "status": "ok",
            "active_scans": gov.get("active_osint_scans", 0),
            "active_crawls": gov.get("active_crawls", 0),
        }
    except Exception as exc:
        health["concurrency"] = {"status": "error", "error": str(exc)}

    # Overall status
    statuses = [v.get("status", "unknown") for v in health.values() if isinstance(v, dict)]
    if all(s == "ok" for s in statuses):
        overall = "healthy"
    elif any(s == "error" for s in statuses):
        overall = "degraded"
    else:
        overall = "partial"

    health["overall"] = overall
    return health
