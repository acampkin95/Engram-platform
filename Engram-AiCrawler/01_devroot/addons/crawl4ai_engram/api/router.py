"""FastAPI router exposing Engram integration endpoints."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


# ── request / response models ─────────────────────────────────────────────────


class StoreRequest(BaseModel):
    url: str
    content: str
    title: str = ""
    project: str = "crawl4ai-default"
    metadata: dict[str, Any] = Field(default_factory=dict)


class SearchRequest(BaseModel):
    query: str
    project: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=50)


class MatterCreateRequest(BaseModel):
    matter_id: str
    title: str
    description: str = ""
    lead_investigator: str = ""
    tags: list[str] = Field(default_factory=list)


class MatterIngestRequest(BaseModel):
    content: str
    source_url: str
    source_type: str = "WEB"
    metadata: dict[str, Any] = Field(default_factory=dict)


class MatterSearchRequest(BaseModel):
    query: str
    limit: int = Field(default=10, ge=1, le=50)


# ── helpers ───────────────────────────────────────────────────────────────────


def _get_client():
    get_client = None
    try:
        from crawl4ai_engram.client import get_client
    except ModuleNotFoundError:
        try:
            from client import get_client  # type: ignore[no-redef]
        except ModuleNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Engram client module could not be imported.",
            )
    client = get_client()
    if not client._cfg.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Engram integration is not enabled. Set ENGRAM_ENABLED=true and restart.",
        )
    return client


# ── status ────────────────────────────────────────────────────────────────────


@router.get("/status", summary="Engram integration status")
async def engram_status():
    """Returns whether Engram is enabled and reachable."""
    get_client = None
    try:
        from crawl4ai_engram.client import get_client
    except ModuleNotFoundError:
        try:
            from client import get_client  # type: ignore[no-redef]
        except ModuleNotFoundError:
            return {"enabled": False, "error": "Engram client module not available"}
    client = get_client()
    health = await client.health()
    return {
        "enabled": client._cfg.is_configured,
        "api_url": client._cfg.api_url if client._cfg.is_configured else None,
        "auto_store": client._cfg.auto_store,
        "health": health,
    }


# ── general memory ────────────────────────────────────────────────────────────


@router.post("/store", summary="Store a crawl result in Engram memory")
async def store_memory(req: StoreRequest):
    client = _get_client()
    result = await client.store_crawl_result(
        url=req.url,
        content=req.content,
        title=req.title,
        project=req.project,
        metadata=req.metadata,
    )
    if result is None:
        raise HTTPException(status_code=502, detail="Engram store failed — check API connectivity.")
    return result


@router.post("/search", summary="Semantic search across Engram memory")
async def search_memory(req: SearchRequest):
    client = _get_client()
    results = await client.search(req.query, project=req.project, limit=req.limit)
    return {"query": req.query, "total": len(results), "results": results}


# ── matters ───────────────────────────────────────────────────────────────────


@router.get("/matters", summary="List investigation matters")
async def list_matters():
    client = _get_client()
    matters = await client.list_matters()
    return {"total": len(matters), "matters": matters}


@router.post("/matters", summary="Create an investigation matter", status_code=201)
async def create_matter(req: MatterCreateRequest):
    client = _get_client()
    result = await client.create_matter(
        req.matter_id,
        req.title,
        description=req.description,
        lead_investigator=req.lead_investigator,
        tags=req.tags,
    )
    if result is None:
        raise HTTPException(status_code=502, detail="Failed to create matter in Engram.")
    return result


@router.post("/matters/{matter_id}/ingest", summary="Ingest evidence into a matter")
async def ingest_into_matter(matter_id: str, req: MatterIngestRequest):
    client = _get_client()
    result = await client.ingest_into_matter(
        matter_id,
        content=req.content,
        source_url=req.source_url,
        source_type=req.source_type,
        metadata=req.metadata,
    )
    if result is None:
        raise HTTPException(status_code=502, detail="Failed to ingest into Engram matter.")
    chunks = result if isinstance(result, list) else [result]
    return {"matter_id": matter_id, "chunks_stored": len(chunks)}


@router.post("/matters/{matter_id}/search", summary="Search within a matter's evidence")
async def search_matter(matter_id: str, req: MatterSearchRequest):
    client = _get_client()
    results = await client.search_matter(matter_id, req.query, limit=req.limit)
    return {"matter_id": matter_id, "query": req.query, "total": len(results), "results": results}
