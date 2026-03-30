"""Full OSINT Scan Pipeline endpoints — POST /scan, /scan/sync, GET /scan/list, /scan/{id}, /scan/{id}/export."""
from __future__ import annotations
import csv
import io
import json
import logging
import os
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.orchestrators.osint_scan_orchestrator import (
    OSINTScanOrchestrator,
    ScanRequest,
    ScanStage,
)
from app.services.lm_studio_bridge import LMStudioBridge, LMStudioError
from app.core.exceptions import ExternalServiceError
from app.websocket.manager import manager
from app.services.job_store import get_job_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/osint", tags=["osint"])

_scan_store = get_job_store("scan_results")


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
# Request models
# ---------------------------------------------------------------------------


class FullScanRequest(BaseModel):
    """Request body for the end-to-end OSINT scan pipeline."""

    username: str = Field(..., min_length=1, max_length=256)
    platforms: list[str] | None = None
    max_concurrent_crawls: int = Field(default=5, ge=1, le=20)
    query_context: str = ""
    reference_photo_labels: list[str] | None = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _ws_progress_callback(scan_id: str, stage: ScanStage, data: dict[str, Any]) -> None:
    """Forward pipeline progress to WebSocket subscribers."""
    await manager.send_osint_scan_update(scan_id, stage.value, data)


async def _run_scan_background(request: ScanRequest) -> None:
    """Execute scan in background and store result."""
    bridge = _get_lm_bridge()
    orchestrator = OSINTScanOrchestrator(
        lm_bridge=bridge,
        on_progress=_ws_progress_callback,
    )
    result = await orchestrator.run_scan(request)
    await _scan_store.set(result.scan_id, result.model_dump())


# ---------------------------------------------------------------------------
# Scan endpoints
# ---------------------------------------------------------------------------


@router.post("/scan", response_model=dict[str, Any], status_code=201)
async def start_osint_scan(
    request: FullScanRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Launch a full OSINT scan pipeline (runs in background).

    Pipeline stages:
    1. Alias discovery — generate profile URLs
    2. Crawling — crawl each profile URL
    3. Reviewing — LLM relevance scoring
    4. Storing — persist kept results in ChromaDB
    5. Knowledge graph — extract entities and relationships

    Subscribe to WebSocket topic ``osint_scan:{scan_id}`` for real-time updates.
    """
    scan_id = str(uuid.uuid4())
    scan_request = ScanRequest(
        scan_id=scan_id,
        username=request.username,
        platforms=request.platforms,
        max_concurrent_crawls=request.max_concurrent_crawls,
        query_context=request.query_context,
        reference_photo_labels=request.reference_photo_labels,
    )

    bridge = _get_lm_bridge()
    orchestrator = OSINTScanOrchestrator(
        lm_bridge=bridge,
        on_progress=_ws_progress_callback,
    )

    # Start the scan as a background task
    background_tasks.add_task(orchestrator.run_scan, scan_request)

    return {
        "status": "accepted",
        "message": f"OSINT scan started for '{request.username}'",
        "websocket_topic": f"osint_scan:{scan_id}",
        "note": "Subscribe to WebSocket for real-time updates. Use GET /api/osint/scan/list to check results.",
    }


@router.post("/scan/sync", response_model=dict[str, Any], status_code=201)
async def run_osint_scan_sync(request: FullScanRequest) -> dict[str, Any]:
    """Execute a full OSINT scan pipeline synchronously (waits for completion).

    Use this for smaller scans or when you need the result immediately.
    For large scans, use POST /api/osint/scan instead.
    """
    try:
        scan_request = ScanRequest(
            username=request.username,
            platforms=request.platforms,
            max_concurrent_crawls=request.max_concurrent_crawls,
            query_context=request.query_context,
            reference_photo_labels=request.reference_photo_labels,
        )

        bridge = _get_lm_bridge()
        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            on_progress=_ws_progress_callback,
        )
        result = await orchestrator.run_scan(scan_request)
        await _scan_store.set(result.scan_id, result.model_dump())

        return result.model_dump()
    except (LMStudioError, ExternalServiceError) as e:
        raise HTTPException(status_code=502, detail=f"LM Studio error: {e}")
    except Exception as e:
        logger.exception(f"OSINT scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {e}")


@router.get("/scan/list", status_code=200)
async def list_scan_results() -> dict[str, Any]:
    """List all completed scan results."""
    scans_raw = await _scan_store.values()
    return {
        "scans": [
            {
                "scan_id": r.get("scan_id"),
                "username": r.get("username"),
                "stage": r.get("stage"),
                "started_at": r.get("started_at"),
                "completed_at": r.get("completed_at"),
                "summary": r.get("summary"),
            }
            for r in scans_raw
        ],
        "count": len(scans_raw),
    }


@router.get("/scan/{scan_id}", status_code=200)
async def get_scan_result(scan_id: str) -> dict[str, Any]:
    """Get a specific scan result by ID."""
    data = await _scan_store.get(scan_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")
    return data


def _export_as_json(data: dict[str, Any], include_set: set[str], filename: str) -> Response:
    if "aliases" not in include_set:
        data.pop("profile_urls", None)
    if "metadata" not in include_set:
        data.pop("review", None)
        data.pop("summary", None)
        data.pop("stored_document_ids", None)
    kg = data.get("knowledge_graph")
    if isinstance(kg, dict):
        if "entities" not in include_set:
            kg.pop("entities", None)
        if "relationships" not in include_set:
            kg.pop("relationships", None)
    return Response(
        content=json.dumps(data, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _write_csv_rows(
    writer: Any,
    data: dict[str, Any],
    base: list[Any],
    include_set: set[str],
) -> None:
    if "aliases" in include_set:
        for pu in data.get("profile_urls", []):
            writer.writerow(
                ["profile_url"] + base
                + [pu.get("platform", ""), pu.get("url", ""), "", "", "", "", "", "", "", ""]
            )
    for cr in data.get("crawl_results", []):
        writer.writerow(
            ["crawl_result"] + base
            + ["", cr.get("url", ""), cr.get("success", ""), cr.get("word_count", ""), "", "", "", "", "", ""]
        )
    kg_data = data.get("knowledge_graph") or {}
    if "entities" in include_set:
        for entity in kg_data.get("entities", []):
            writer.writerow(
                ["entity"] + base
                + ["", "", "", "", entity.get("name", ""), entity.get("entity_type", ""), "", "", "", ""]
            )
    if "relationships" in include_set:
        for rel in kg_data.get("relationships", []):
            writer.writerow(
                ["relationship"] + base
                + ["", "", "", "", "", "", rel.get("source_id", ""), rel.get("target_id", ""),
                   rel.get("relation_type", ""), rel.get("confidence", "")]
            )
    if "metadata" in include_set:
        review = data.get("review") or {}
        summary_str = (
            f"kept:{review.get('kept', 0)},"
            f"deranked:{review.get('deranked', 0)},"
            f"archived:{review.get('archived', 0)},"
            f"avg_relevance:{review.get('average_relevance', 0)}"
        )
        writer.writerow(["metadata"] + base + ["", "", "", "", summary_str, "", "", "", "", ""])


def _export_as_csv(data: dict[str, Any], include_set: set[str], filename: str) -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    base = [
        data.get("scan_id", ""),
        data.get("username", ""),
        data.get("stage", ""),
        data.get("started_at", ""),
        data.get("completed_at", ""),
    ]
    writer.writerow([
        "type", "scan_id", "username", "stage", "started_at", "completed_at",
        "platform", "url", "crawl_success", "word_count",
        "entity_name", "entity_type", "rel_source", "rel_target", "rel_type", "rel_confidence",
    ])
    _write_csv_rows(writer, data, base, include_set)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/scan/{scan_id}/export", status_code=200)
async def export_scan_result(
    scan_id: str,
    fmt: str = Query(default="json", alias="format", pattern="^(json|csv)$"),
    include: str = Query(default="aliases,entities,relationships,metadata"),
) -> Response:
    data = await _scan_store.get(scan_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")

    include_set = {s.strip() for s in include.split(",")}
    result_username = data.get("username", "unknown")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in result_username)
    filename = f"osint-{safe_name}-{scan_id[:8]}.{fmt}"

    if fmt == "json":
        return _export_as_json(data, include_set, filename)
    return _export_as_csv(data, include_set, filename)
