from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter

from app.services.job_store import get_job_store
from app.api.data import data_sets
from app.models.crawl import CrawlStatus
from app.models.investigation import InvestigationStatus
from app.services.investigation_service import get_investigation_service
from app.storage.chromadb_client import get_chromadb_client
from app.services.cache import get_cache_client

try:
    import psutil as _psutil
except ImportError:
    _psutil = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stats", tags=["stats"])

_crawl_store = get_job_store("crawl_jobs")


@router.get("/dashboard")
async def get_dashboard_stats() -> dict:
    active_statuses = {CrawlStatus.PENDING, CrawlStatus.RUNNING}

    crawl_values = list(await _crawl_store.values())
    crawl_stats = {
        "total": len(crawl_values),
        "active": sum(1 for j in crawl_values if j["status"] in active_statuses),
        "completed": sum(1 for j in crawl_values if j["status"] == CrawlStatus.COMPLETED),
        "failed": sum(1 for j in crawl_values if j["status"] == CrawlStatus.FAILED),
        "cancelled": sum(1 for j in crawl_values if j["status"] == CrawlStatus.CANCELLED),
    }

    ds_values = list(data_sets.values())
    data_set_stats = {
        "total": len(ds_values),
        "total_size_bytes": sum(s["size_bytes"] for s in ds_values),
        "total_files": sum(s["file_count"] for s in ds_values),
    }

    storage_stats = {"collections": 0, "total_documents": 0}
    try:
        chroma = get_chromadb_client()
        collection_names = chroma.list_collections()
        total_docs = sum(chroma.count(name) for name in collection_names)
        storage_stats = {
            "collections": len(collection_names),
            "total_documents": total_docs,
        }
    except Exception as exc:
        logger.warning("ChromaDB stats unavailable: %s", exc)

    svc = get_investigation_service()
    all_investigations = svc.list_all(limit=10_000)
    investigation_stats = {
        "total": len(all_investigations),
        "active": sum(1 for i in all_investigations if i.status == InvestigationStatus.ACTIVE),
    }

    return {
        "crawls": crawl_stats,
        "data_sets": data_set_stats,
        "storage": storage_stats,
        "investigations": investigation_stats,
    }


async def _redis_status() -> str:
    try:
        client = await get_cache_client()
        import asyncio

        ping_coro = client.ping()
        if asyncio.iscoroutine(ping_coro):
            await ping_coro  # pyright: ignore[reportGeneralTypeIssues]
        return "connected"
    except Exception:
        return "disconnected"


async def _lm_studio_status() -> str:
    lm_url = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")
    models_url = lm_url.rstrip("/") + "/models"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(models_url)
            return "connected" if response.status_code < 500 else "disconnected"
    except Exception:
        return "disconnected"


def _scheduler_status() -> str:
    try:
        from app.services.scheduler_service import get_scheduler

        scheduler = get_scheduler()
        return "running" if scheduler.running else "stopped"
    except Exception:
        return "stopped"


@router.get("/system")
async def get_system_stats() -> dict:
    memory_percent: float = 0.0
    disk_percent: float = 0.0

    if _psutil is not None:
        try:
            memory_percent = float(_psutil.virtual_memory().percent)
            disk_percent = float(_psutil.disk_usage("/").percent)
        except Exception as exc:
            logger.warning("psutil stats unavailable: %s", exc)

    redis_status = await _redis_status()
    lm_studio = await _lm_studio_status()
    scheduler = _scheduler_status()

    return {
        "memory_percent": memory_percent,
        "disk_percent": disk_percent,
        "redis": redis_status,
        "lm_studio": lm_studio,
        "scheduler": scheduler,
    }


@router.get("/scheduler")
async def get_scheduler_stats() -> dict:
    try:
        from app.services.scheduler_service import get_scheduler

        scheduler = get_scheduler()
        jobs = scheduler.get_jobs()
        next_run: str | None = None
        if jobs:
            run_times = [j.next_run_time for j in jobs if j.next_run_time is not None]
            if run_times:
                next_run = min(run_times).isoformat()
        return {
            "status": "running" if scheduler.running else "stopped",
            "jobs_count": len(jobs),
            "next_run": next_run,
        }
    except Exception as exc:
        logger.warning("Scheduler stats unavailable: %s", exc)
        return {"status": "stopped", "jobs_count": 0, "next_run": None}
