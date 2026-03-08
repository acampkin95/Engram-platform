"""Case Management API — Phase 5."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.models.case import (
    Case,
    CaseNote,
    CasePriority,
    CaseSummary,
    CaseStatus,
    CaseSubject,
    CreateCaseRequest,
    EvidenceItem,
    EvidenceType,
    TimelineEvent,
    TimelineEventType,
    UpdateCaseRequest,
)
from app.services.case_service import (
    CaseExporter,
    TimelineQuery,
    get_case_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cases", tags=["cases"])

_exporter = CaseExporter()


# ---------------------------------------------------------------------------
# Request helpers
# ---------------------------------------------------------------------------


class AddEvidenceRequest(BaseModel):
    evidence_type: EvidenceType
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(None, max_length=2000)
    url: str | None = None
    text_content: str | None = None
    file_path: str | None = None
    reference_id: str | None = None
    source: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_key_evidence: bool = False
    added_by: str | None = None


class AddNoteRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    author: str | None = None
    is_flagged: bool = False


class AddSubjectRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=300)
    entity_id: str | None = None
    role: str = "subject"
    notes: str | None = None


class LinkRequest(BaseModel):
    """Generic ID linkage request."""

    id: str = Field(..., min_length=1)
    actor: str | None = None


class LinkFraudRequest(BaseModel):
    graph_id: str
    risk_level: str | None = None
    risk_score: float | None = Field(None, ge=0.0, le=1.0)
    actor: str | None = None


class TimelineFilterRequest(BaseModel):
    event_types: list[TimelineEventType] | None = None
    actor: str | None = None
    since: str | None = None
    until: str | None = None
    search: str | None = None


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=Case, status_code=201)
async def create_case(request: CreateCaseRequest, actor: str | None = Query(None)) -> Case:
    """Create a new OSINT investigation case."""
    svc = get_case_service()
    return svc.create(request, actor=actor)


@router.get("/", response_model=list[CaseSummary])
async def list_cases(
    status: CaseStatus | None = None,
    priority: CasePriority | None = None,
    case_type: str | None = None,
    investigator: str | None = None,
    tag: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[CaseSummary]:
    """List cases with optional filtering."""
    svc = get_case_service()
    return svc.list_all(
        status=status,
        priority=priority,
        case_type=case_type,
        investigator=investigator,
        tag=tag,
        limit=limit,
        offset=offset,
    )


@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: str) -> Case:
    """Get full case details."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


@router.put("/{case_id}", response_model=Case)
async def update_case(
    case_id: str,
    request: UpdateCaseRequest,
    actor: str | None = Query(None),
) -> Case:
    """Update case metadata (title, status, priority, etc.)."""
    svc = get_case_service()
    case = svc.update(case_id, request, actor=actor)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


@router.delete("/{case_id}")
async def delete_case(case_id: str) -> dict[str, Any]:
    """Permanently delete a case and all its data."""
    svc = get_case_service()
    if not svc.delete(case_id):
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return {"case_id": case_id, "deleted": True}


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------


@router.post("/{case_id}/subjects", response_model=Case)
async def add_subject(
    case_id: str,
    request: AddSubjectRequest,
    actor: str | None = Query(None),
) -> Case:
    """Add a subject (person / organisation) to a case."""
    svc = get_case_service()
    subject = CaseSubject(
        display_name=request.display_name,
        entity_id=request.entity_id,
        role=request.role,
        notes=request.notes,
    )
    case = svc.add_subject(case_id, subject, actor=actor)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


@router.post("/{case_id}/evidence", response_model=Case)
async def add_evidence(
    case_id: str,
    request: AddEvidenceRequest,
    actor: str | None = Query(None),
) -> Case:
    """Attach an evidence item to a case."""
    svc = get_case_service()
    item = EvidenceItem(
        evidence_type=request.evidence_type,
        title=request.title,
        description=request.description,
        url=request.url,
        text_content=request.text_content,
        file_path=request.file_path,
        reference_id=request.reference_id,
        source=request.source,
        tags=request.tags,
        is_key_evidence=request.is_key_evidence,
        added_by=request.added_by or actor,
    )
    case = svc.add_evidence(case_id, item, actor=actor)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


@router.delete("/{case_id}/evidence/{evidence_id}", response_model=Case)
async def remove_evidence(
    case_id: str,
    evidence_id: str,
    actor: str | None = Query(None),
) -> Case:
    """Remove an evidence item from a case."""
    svc = get_case_service()
    case = svc.remove_evidence(case_id, evidence_id, actor=actor)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------


@router.post("/{case_id}/notes", response_model=Case)
async def add_note(
    case_id: str,
    request: AddNoteRequest,
) -> Case:
    """Add an investigator note to a case."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    note = CaseNote(
        content=request.content,
        author=request.author,
        is_flagged=request.is_flagged,
    )
    case.notes.append(note)
    case.add_timeline_event(
        TimelineEventType.NOTE_ADDED,
        title="Note added",
        actor=request.author,
        reference_id=note.note_id,
    )
    # persist
    svc._write(case)  # noqa: SLF001
    return case


# ---------------------------------------------------------------------------
# Phase linkage
# ---------------------------------------------------------------------------


@router.post("/{case_id}/link/scan", response_model=Case)
async def link_scan(case_id: str, req: LinkRequest) -> Case:
    """Link an OSINT scan result to this case."""
    svc = get_case_service()
    case = svc.link_scan(case_id, req.id, actor=req.actor)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


@router.post("/{case_id}/link/crawl", response_model=Case)
async def link_crawl(case_id: str, req: LinkRequest) -> Case:
    """Link a deep-crawl job to this case."""
    svc = get_case_service()
    case = svc.link_deep_crawl(case_id, req.id, actor=req.actor)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


@router.post("/{case_id}/link/fraud-graph", response_model=Case)
async def link_fraud_graph(case_id: str, req: LinkFraudRequest) -> Case:
    """Link a fraud analysis graph (and optional risk level/score) to this case."""
    svc = get_case_service()
    case = svc.link_fraud_graph(
        case_id,
        req.graph_id,
        risk_level=req.risk_level,
        risk_score=req.risk_score,
        actor=req.actor,
    )
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


@router.post("/{case_id}/link/image-intel", response_model=Case)
async def link_image_intel(case_id: str, req: LinkRequest) -> Case:
    """Link an image intelligence entity to this case."""
    svc = get_case_service()
    case = svc.link_image_intel(case_id, req.id, actor=req.actor)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------


@router.get("/{case_id}/timeline", response_model=list[TimelineEvent])
async def get_timeline(
    case_id: str,
    search: str | None = None,
    actor: str | None = None,
    since: str | None = None,
    until: str | None = None,
) -> list[TimelineEvent]:
    """Get the case timeline, with optional filtering."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return TimelineQuery.filter(
        case.timeline,
        actor=actor,
        since=since,
        until=until,
        search=search,
    )


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------


@router.get("/{case_id}/export/json")
async def export_json(case_id: str) -> Response:
    """Export the full case as a JSON bundle."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    data = _exporter.export_json(case)
    filename = f"case_{case.case_number or case_id}.json".replace(" ", "_")
    return Response(
        content=data,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{case_id}/export/csv/timeline")
async def export_csv_timeline(case_id: str) -> Response:
    """Export the case timeline as a CSV file."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    data = _exporter.export_csv_timeline(case)
    filename = f"timeline_{case.case_number or case_id}.csv".replace(" ", "_")
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{case_id}/export/csv/evidence")
async def export_csv_evidence(case_id: str) -> Response:
    """Export the evidence list as a CSV file."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    data = _exporter.export_csv_evidence(case)
    filename = f"evidence_{case.case_number or case_id}.csv".replace(" ", "_")
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{case_id}/export/html")
async def export_html(case_id: str) -> Response:
    """Export a formatted HTML case report (print-to-PDF in browser)."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    data = _exporter.export_html(case)
    filename = f"report_{case.case_number or case_id}.html".replace(" ", "_")
    return Response(
        content=data,
        media_type="text/html",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{case_id}/export/text")
async def export_text(case_id: str) -> Response:
    """Export a plain-text one-page case summary."""
    svc = get_case_service()
    case = svc.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    data = _exporter.export_summary_text(case)
    filename = f"summary_{case.case_number or case_id}.txt".replace(" ", "_")
    return Response(
        content=data,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
