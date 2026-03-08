from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.investigation import (
    Investigation,
    InvestigationStatus,
    InvestigationPriority,
    CreateInvestigationRequest,
    UpdateInvestigationRequest,
    InvestigationSummary,
)
from app.services.investigation_service import get_investigation_service

router = APIRouter(prefix="/api/investigations", tags=["investigations"])


@router.post("/", response_model=Investigation, status_code=201)
async def create_investigation(request: CreateInvestigationRequest) -> Investigation:
    service = get_investigation_service()
    return service.create(request)


@router.get("/", response_model=list[InvestigationSummary])
async def list_investigations(
    status: InvestigationStatus | None = None,
    priority: InvestigationPriority | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[InvestigationSummary]:
    service = get_investigation_service()
    investigations = service.list_all(status=status, priority=priority, limit=limit, offset=offset)
    summaries = []
    for inv in investigations:
        summary = service.get_summary(inv.investigation_id)
        if summary:
            summaries.append(summary)
    return summaries


@router.get("/{investigation_id}", response_model=Investigation)
async def get_investigation(investigation_id: str) -> Investigation:
    service = get_investigation_service()
    inv = service.get(investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv


@router.put("/{investigation_id}", response_model=Investigation)
async def update_investigation(
    investigation_id: str, request: UpdateInvestigationRequest
) -> Investigation:
    service = get_investigation_service()
    inv = service.update(investigation_id, request)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv


@router.delete("/{investigation_id}")
async def delete_investigation(investigation_id: str) -> dict:
    service = get_investigation_service()
    if not service.delete(investigation_id):
        raise HTTPException(status_code=404, detail="Investigation not found")
    return {"message": f"Investigation {investigation_id} deleted"}


@router.post("/{investigation_id}/crawls/{crawl_id}", response_model=Investigation)
async def link_crawl_to_investigation(investigation_id: str, crawl_id: str) -> Investigation:
    service = get_investigation_service()
    inv = service.add_crawl(investigation_id, crawl_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv


@router.post("/{investigation_id}/scans/{scan_id}", response_model=Investigation)
async def link_scan_to_investigation(investigation_id: str, scan_id: str) -> Investigation:
    service = get_investigation_service()
    inv = service.add_scan(investigation_id, scan_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv
