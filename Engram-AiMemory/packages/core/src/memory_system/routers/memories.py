import csv
import io
import json
import logging
from collections.abc import Iterator
from contextlib import suppress
from datetime import UTC, datetime
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from memory_system import MemoryTier, MemoryType, MemorySource
from memory_system.auth import require_auth
from memory_system.config import get_settings
from memory_system.routers import _state

logger = logging.getLogger(__name__)

_api_settings = get_settings()

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
except ImportError:
    limiter = None

memories_router = APIRouter(tags=["memories"])


def _tier_from_int(tier: int) -> MemoryTier:
    return {1: MemoryTier.PROJECT, 2: MemoryTier.GENERAL, 3: MemoryTier.GLOBAL}[tier]


def _type_from_str(type_str: str) -> MemoryType:
    try:
        return MemoryType(type_str.lower())
    except ValueError:
        return MemoryType.FACT


def _source_from_str(source_str: str) -> MemorySource:
    try:
        return MemorySource(source_str.lower())
    except ValueError:
        return MemorySource.AGENT


class AddMemoryRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Memory content")
    tier: int = Field(
        default=1, ge=1, le=3, description="Memory tier (1=Project, 2=General, 3=Global)"
    )
    memory_type: str = Field(default="fact", description="Type of memory")
    source: str = Field(default="agent", description="Source of memory")
    project_id: str | None = Field(default=None, description="Project ID for Tier 1")
    user_id: str | None = Field(default=None, description="User ID")
    tenant_id: str | None = Field(default=None, description="Tenant ID for multi-tenancy")
    session_id: str | None = Field(default=None, description="Session ID")
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="Importance score")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score")
    tags: list[str] = Field(default_factory=list, description="Tags for categorization")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    expires_in_days: int | None = Field(default=None, description="Days until expiration")


class AddMemoryResponse(BaseModel):
    memory_id: str
    tier: int
    created_at: datetime


class BatchAddRequest(BaseModel):
    memories: list[AddMemoryRequest] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of memories to add (max 100)",
    )


class BatchAddResponse(BaseModel):
    memory_ids: list[str] = Field(description="IDs of successfully inserted memories")
    failed: int = Field(description="Number of memories that failed to insert")
    total: int = Field(description="Total number of memories in the request")


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10000, description="Search query")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    tenant_id: str | None = Field(default=None, description="Filter by tenant")
    tags: list[str] | None = Field(default=None, description="Filter by tags")
    min_importance: float | None = Field(default=None, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)
    event_only: bool = Field(default=False, description="Only return event memories")
    start_date: str | None = Field(default=None, description="ISO format start date filter")
    end_date: str | None = Field(default=None, description="ISO format end date filter")


class SearchResult(BaseModel):
    memory_id: str
    content: str
    summary: str | None
    tier: int
    memory_type: str
    source: str
    project_id: str | None
    user_id: str | None
    tenant_id: str
    importance: float
    confidence: float
    tags: list[str]
    created_at: datetime
    score: float | None
    distance: float | None


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query: str
    total: int


class ListMemoriesRequest(BaseModel):
    tenant_id: str | None = Field(default=None, description="Filter by tenant")
    project_id: str | None = Field(default=None, description="Filter by project")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    limit: int = Field(default=50, ge=1, le=500, description="Max results")
    offset: int = Field(default=0, ge=0, description="Pagination offset")


class ListMemoriesResponse(BaseModel):
    memories: list[SearchResult]
    total: int
    limit: int
    offset: int


class MemoryResponse(BaseModel):
    memory_id: str
    content: str
    summary: str | None
    tier: int
    memory_type: str
    source: str
    project_id: str | None
    user_id: str | None
    tenant_id: str
    session_id: str | None
    importance: float
    confidence: float
    tags: list[str]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None


class StatsResponse(BaseModel):
    total_memories: int
    tier1_count: int
    tier2_count: int
    tier3_count: int
    by_type: dict[str, int]
    oldest_memory: datetime | None
    newest_memory: datetime | None
    avg_importance: float
    importance_distribution: dict[str, int] = Field(default_factory=dict)


class ContextRequest(BaseModel):
    query: str = Field(
        ..., min_length=1, max_length=10000, description="Query to build context for"
    )
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    session_id: str | None = Field(default=None, description="Session for context")
    max_tokens: int | None = Field(default=None, ge=100, le=32000, description="Token budget")


class ContextResponse(BaseModel):
    query: str
    context: str
    token_estimate: int


class RAGRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10000, description="Query for RAG")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    session_id: str | None = Field(default=None, description="Session for context")


class RAGResponse(BaseModel):
    query: str
    mode: str
    synthesis_prompt: str
    source_count: int
    context: dict[str, Any]


class BulkDeleteRequest(BaseModel):
    memory_ids: list[str] | None = Field(default=None, description="Specific IDs to delete")
    tier: int | None = Field(default=None, ge=1, le=3)
    project_id: str | None = None
    tenant_id: str | None = None
    max_delete: int = Field(default=100, ge=1, le=1000, description="Safety limit")


def _apply_rate_limit(router, limit_str: str):
    if limiter is None:
        return lambda f: f
    return limiter.limit(limit_str)


@memories_router.get("/stats", response_model=StatsResponse, dependencies=[Depends(require_auth)])
async def get_stats(tenant_id: str | None = None):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    stats = await _state.memory_system.get_stats(tenant_id)
    stats_dict = stats.model_dump()
    avg_imp = stats.avg_importance
    importance_distribution: dict[str, int] = {
        "low (0.0-0.3)": 0,
        "medium (0.3-0.7)": 0,
        "high (0.7-1.0)": 0,
    }
    if avg_imp < 0.3:
        importance_distribution["low (0.0-0.3)"] = stats.total_memories
    elif avg_imp < 0.7:
        importance_distribution["medium (0.3-0.7)"] = stats.total_memories
    else:
        importance_distribution["high (0.7-1.0)"] = stats.total_memories
    stats_dict["importance_distribution"] = importance_distribution
    return StatsResponse(**stats_dict)


@_apply_rate_limit(memories_router, f"{_api_settings.rate_limit_per_minute}/minute")
@memories_router.post(
    "/memories", response_model=AddMemoryResponse, dependencies=[Depends(require_auth)]
)
async def add_memory(request_obj: Request, request: AddMemoryRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    memory_id = await _state.memory_system.add(
        content=request.content,
        tier=_tier_from_int(request.tier),
        memory_type=_type_from_str(request.memory_type),
        source=_source_from_str(request.source),
        project_id=request.project_id,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
        session_id=request.session_id,
        importance=request.importance,
        confidence=request.confidence,
        tags=request.tags,
        metadata=request.metadata,
        expires_in_days=request.expires_in_days,
    )

    await _state.ws_manager.broadcast(
        {"type": "memory_added", "memory_id": str(memory_id), "tier": request.tier}
    )
    return AddMemoryResponse(
        memory_id=str(memory_id),
        tier=request.tier,
        created_at=datetime.now(UTC),
    )


@_apply_rate_limit(memories_router, f"{_api_settings.rate_limit_per_minute}/minute")
@memories_router.post(
    "/memories/batch", response_model=BatchAddResponse, dependencies=[Depends(require_auth)]
)
async def add_memories_batch(request_obj: Request, request: BatchAddRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    memories_data = []
    for mem_req in request.memories:
        memories_data.append(
            {
                "content": mem_req.content,
                "tier": _tier_from_int(mem_req.tier),
                "memory_type": _type_from_str(mem_req.memory_type),
                "source": _source_from_str(mem_req.source),
                "project_id": mem_req.project_id,
                "user_id": mem_req.user_id,
                "tenant_id": mem_req.tenant_id,
                "session_id": mem_req.session_id,
                "importance": mem_req.importance,
                "confidence": mem_req.confidence,
                "tags": mem_req.tags,
                "metadata": mem_req.metadata,
                "expires_in_days": mem_req.expires_in_days,
            }
        )

    successful_ids, failed_count = await _state.memory_system.add_batch(memories_data)

    return BatchAddResponse(
        memory_ids=[str(uid) for uid in successful_ids],
        failed=failed_count,
        total=len(request.memories),
    )


@_apply_rate_limit(memories_router, f"{_api_settings.rate_limit_per_minute}/minute")
@memories_router.post(
    "/memories/search", response_model=SearchResponse, dependencies=[Depends(require_auth)]
)
async def search_memories(request_obj: Request, request: SearchRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    tier = _tier_from_int(request.tier) if request.tier else None

    start_dt = None
    end_dt = None
    if request.start_date:
        with suppress(ValueError, TypeError):
            start_dt = datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
    if request.end_date:
        with suppress(ValueError, TypeError):
            end_dt = datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))

    results = await _state.memory_system.search(
        query=request.query,
        tier=tier,
        project_id=request.project_id,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
        tags=request.tags,
        min_importance=request.min_importance,
        limit=request.limit,
        event_only=request.event_only,
        start_date=start_dt,
        end_date=end_dt,
    )

    search_results = [
        SearchResult(
            memory_id=str(r.memory.id),
            content=r.memory.content,
            summary=r.memory.summary,
            tier=int(r.memory.tier),
            memory_type=r.memory.memory_type,
            source=r.memory.source,
            project_id=r.memory.project_id,
            user_id=r.memory.user_id,
            tenant_id=r.memory.tenant_id,
            importance=r.memory.importance,
            confidence=r.memory.confidence,
            tags=r.memory.tags,
            created_at=r.memory.created_at,
            score=r.score,
            distance=r.distance,
        )
        for r in results
    ]

    user_id_val = getattr(request_obj.state, "user_id", "unknown")
    _state.search_logs.append(
        {
            "timestamp": datetime.now(UTC).isoformat(),
            "query": request.query,
            "results_count": len(search_results),
            "tier": request.tier,
            "tenant_id": request.tenant_id or "default",
            "user_id": user_id_val,
        }
    )

    return SearchResponse(
        results=search_results,
        query=request.query,
        total=len(search_results),
    )


@memories_router.get(
    "/memories/list", response_model=ListMemoriesResponse, dependencies=[Depends(require_auth)]
)
async def list_memories(
    tenant_id: str | None = None,
    project_id: str | None = None,
    tier: int | None = Query(default=None, ge=1, le=3),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")
    tier_enum = _tier_from_int(tier) if tier else None
    mems, total_count = await _state.memory_system.list_memories(
        tier=tier_enum,
        project_id=project_id,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
    )
    results = [
        SearchResult(
            memory_id=str(m.id),
            content=m.content,
            summary=m.summary,
            tier=int(m.tier),
            memory_type=m.memory_type,
            source=m.source,
            project_id=m.project_id,
            user_id=m.user_id,
            tenant_id=m.tenant_id,
            importance=m.importance,
            confidence=m.confidence,
            tags=m.tags,
            created_at=m.created_at,
            score=None,
            distance=None,
        )
        for m in mems
    ]
    return ListMemoriesResponse(
        memories=results,
        total=total_count,
        limit=limit,
        offset=offset,
    )


@memories_router.get(
    "/memories/{memory_id}", response_model=MemoryResponse, dependencies=[Depends(require_auth)]
)
async def get_memory(
    memory_id: str,
    tier: int = Query(..., ge=1, le=3, description="Memory tier"),
    tenant_id: str | None = None,
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    mem = await _state.memory_system.get(
        memory_id=memory_id,
        tier=_tier_from_int(tier),
        tenant_id=tenant_id,
    )

    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")

    return MemoryResponse(
        memory_id=str(mem.id),
        content=mem.content,
        summary=mem.summary,
        tier=int(mem.tier),
        memory_type=mem.memory_type,
        source=mem.source,
        project_id=mem.project_id,
        user_id=mem.user_id,
        tenant_id=mem.tenant_id,
        session_id=mem.session_id,
        importance=mem.importance,
        confidence=mem.confidence,
        tags=mem.tags,
        metadata=mem.metadata,
        created_at=mem.created_at,
        updated_at=mem.updated_at,
        expires_at=mem.expires_at,
    )


@memories_router.delete("/memories/{memory_id}", dependencies=[Depends(require_auth)])
async def delete_memory(
    memory_id: str,
    tier: int = Query(..., ge=1, le=3, description="Memory tier"),
    tenant_id: str | None = None,
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    success = await _state.memory_system.delete(
        memory_id=memory_id,
        tier=_tier_from_int(tier),
        tenant_id=tenant_id,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Memory not found or deletion failed")

    await _state.ws_manager.broadcast({"type": "memory_deleted", "memory_id": memory_id})
    return {"status": "deleted", "memory_id": memory_id}


@memories_router.post(
    "/memories/context", response_model=ContextResponse, dependencies=[Depends(require_auth)]
)
async def build_context(request: ContextRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    tier = _tier_from_int(request.tier) if request.tier else None

    context_str = await _state.memory_system.build_context(
        query=request.query,
        tier=tier,
        project_id=request.project_id,
        user_id=request.user_id,
        session_id=request.session_id,
        max_tokens=request.max_tokens,
    )

    token_estimate = len(context_str) // 4

    return ContextResponse(
        query=request.query,
        context=context_str,
        token_estimate=token_estimate,
    )


@_apply_rate_limit(memories_router, f"{_api_settings.rate_limit_per_minute}/minute")
@memories_router.post(
    "/memories/rag", response_model=RAGResponse, dependencies=[Depends(require_auth)]
)
async def rag_query(request_obj: Request, request: RAGRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    result = await _state.memory_system.rag_query(
        query=request.query,
        project_id=request.project_id,
        user_id=request.user_id,
        session_id=request.session_id,
    )

    return RAGResponse(
        query=result["query"],
        mode=result["mode"],
        synthesis_prompt=result["synthesis_prompt"],
        source_count=result["source_count"],
        context=result["context"],
    )


@memories_router.post("/memories/consolidate", dependencies=[Depends(require_auth)])
async def consolidate_memories(
    project_id: str | None = None,
    tenant_id: str | None = None,
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    processed = await _state.memory_system.consolidate(project_id=project_id, tenant_id=tenant_id)
    return {"processed": processed}


@memories_router.post("/memories/cleanup", dependencies=[Depends(require_auth)])
async def cleanup_expired(tenant_id: str | None = None):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    removed = await _state.memory_system.cleanup_expired(tenant_id=tenant_id)
    return {"removed": removed}


@memories_router.post("/memories/decay", dependencies=[Depends(require_auth)])
async def run_decay(
    tenant_id: str | None = None,
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    processed = 0
    try:
        from memory_system.decay import MemoryDecay

        decay_calc = MemoryDecay(half_life_days=30)

        mems, total = await _state.memory_system.list_memories(tenant_id=tenant_id, limit=500)

        for mem in mems:
            try:
                new_decay = decay_calc.calculate_decay(
                    created_at=mem.created_at,
                    last_accessed=mem.last_accessed_at,
                    access_count=mem.access_count,
                )
                if new_decay != mem.decay_factor:
                    await _state.memory_system._weaviate.update_memory_fields(
                        memory_id=mem.id,
                        tier=mem.tier,
                        fields={"decay_factor": new_decay},
                        tenant_id=mem.tenant_id,
                    )
                    processed += 1
            except Exception as e:
                _state.console.print(f"[yellow]⚠ Decay calculation failed for {mem.id}: {e}[/yellow]")

        return {"processed": processed, "total_checked": len(mems)}
    except Exception as e:
        _state.console.print(f"[red]✗ Decay job failed: {e}[/red]")
        raise HTTPException(status_code=500, detail=f"Decay calculation failed: {str(e)}") from e


@_apply_rate_limit(memories_router, f"{_api_settings.rate_limit_per_minute}/minute")
@memories_router.get("/memories/export", dependencies=[Depends(require_auth)])
async def export_memories(
    request: Request,
    format: str = Query(default="jsonl", pattern="^(jsonl|csv)$"),
    tier: int | None = Query(default=None, ge=1, le=3),
    project_id: str | None = Query(default=None),
    tenant_id: str | None = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=10000),
    user_id: str = Depends(require_auth),
) -> StreamingResponse:
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="Memory system not initialized")

    results, _ = await _state.memory_system.list_memories(
        tier=MemoryTier(tier) if tier else None,
        project_id=project_id,
        tenant_id=tenant_id or _api_settings.default_tenant_id,
        limit=limit,
    )

    if format == "csv":

        def generate_csv() -> Iterator[str]:
            output = io.StringIO()
            writer = csv.DictWriter(
                output,
                fieldnames=[
                    "id",
                    "content",
                    "tier",
                    "memory_type",
                    "source",
                    "project_id",
                    "tenant_id",
                    "importance",
                    "confidence",
                    "tags",
                    "created_at",
                ],
            )
            writer.writeheader()
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)
            for mem in results:
                writer.writerow(
                    {
                        "id": str(mem.id),
                        "content": mem.content,
                        "tier": mem.tier.value if hasattr(mem.tier, "value") else mem.tier,
                        "memory_type": mem.memory_type.value
                        if hasattr(mem.memory_type, "value")
                        else mem.memory_type,
                        "source": mem.source.value if hasattr(mem.source, "value") else mem.source,
                        "project_id": mem.project_id or "",
                        "tenant_id": mem.tenant_id,
                        "importance": mem.importance,
                        "confidence": mem.confidence,
                        "tags": ",".join(mem.tags or []),
                        "created_at": mem.created_at.isoformat() if mem.created_at else "",
                    }
                )
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)

        return StreamingResponse(
            generate_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=memories.csv"},
        )

    def generate_jsonl() -> Iterator[str]:
        for mem in results:
            record = {
                "id": str(mem.id),
                "content": mem.content,
                "tier": mem.tier.value if hasattr(mem.tier, "value") else mem.tier,
                "memory_type": mem.memory_type.value
                if hasattr(mem.memory_type, "value")
                else mem.memory_type,
                "importance": mem.importance,
                "project_id": mem.project_id,
                "tenant_id": mem.tenant_id,
                "tags": mem.tags or [],
                "created_at": mem.created_at.isoformat() if mem.created_at else None,
            }
            yield json.dumps(record) + "\n"

    return StreamingResponse(
        generate_jsonl(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=memories.jsonl"},
    )


@_apply_rate_limit(memories_router, "10/minute")
@memories_router.delete("/memories/bulk", dependencies=[Depends(require_auth)])
async def bulk_delete_memories(
    request: Request,
    body: BulkDeleteRequest,
    user_id: str = Depends(require_auth),
) -> dict:
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="Memory system not initialized")

    deleted = 0
    failed = 0

    if body.memory_ids:
        for memory_id in body.memory_ids[: body.max_delete]:
            try:
                mem = await _state.memory_system.get(
                    memory_id,
                    tier=MemoryTier.WORKING,
                    tenant_id=body.tenant_id or _api_settings.default_tenant_id,
                )
                if mem is None:
                    failed += 1
                    continue
                success = await _state.memory_system.delete(
                    memory_id=memory_id,
                    tier=mem.tier,
                    tenant_id=body.tenant_id or _api_settings.default_tenant_id,
                )
                if success:
                    deleted += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
    else:
        results, _ = await _state.memory_system.list_memories(
            tier=MemoryTier(body.tier) if body.tier else None,
            project_id=body.project_id,
            tenant_id=body.tenant_id or _api_settings.default_tenant_id,
            limit=body.max_delete,
        )
        for mem in results:
            try:
                success = await _state.memory_system.delete(
                    memory_id=str(mem.id),
                    tier=mem.tier,
                    tenant_id=body.tenant_id or _api_settings.default_tenant_id,
                )
                if success:
                    deleted += 1
                else:
                    failed += 1
            except Exception:
                failed += 1

    return {"deleted": deleted, "failed": failed, "total_processed": deleted + failed}


@memories_router.websocket("/ws/events")
async def websocket_events(ws: WebSocket) -> None:
    await _state.ws_manager.connect(ws)
    try:
        await ws.send_json({"type": "connected", "message": "Listening for memory events"})
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        _state.ws_manager.disconnect(ws)


@memories_router.post("/memories/confidence-maintenance", dependencies=[Depends(require_auth)])
async def trigger_confidence_maintenance(tenant_id: str | None = None):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    if _state.scheduler:
        try:
            await _state.scheduler._job_confidence_maintenance()
            return {"status": "success", "message": "Confidence maintenance job triggered"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return {"status": "error", "message": "Scheduler not available"}
