"""ARQ async worker for background task processing.

Runs as a separate Supervisord process. Consumes jobs enqueued by the
FastAPI application and processes them using Crawl4AI's async crawler.

Architecture Decision: ADR-001 Section 4 — ARQ Task Queue

Usage (via Supervisord):
    python -m arq app.workers.arq_worker.WorkerSettings

Enqueue from FastAPI:
    from app.workers.arq_worker import enqueue_crawl
    job_id = await enqueue_crawl("https://example.com")
"""

from __future__ import annotations
import logging
import os
from typing import Any
from urllib.parse import urlparse

from arq import create_pool
from arq.connections import RedisSettings

logger = logging.getLogger(__name__)


def _get_redis_settings() -> RedisSettings:
    """Build ARQ RedisSettings from environment."""
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    parsed = urlparse(redis_url)
    return RedisSettings(
        host=parsed.hostname or "redis",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or 0),
        password=parsed.password,
    )


# ---------------------------------------------------------------------------
# Task functions
# ---------------------------------------------------------------------------


async def crawl_task(ctx: dict[str, Any], url: str, config: dict | None = None) -> dict:
    """Crawl a single URL in the background worker.

    Args:
        ctx: ARQ context dict (contains shared resources from startup).
        url: URL to crawl.
        config: Optional CrawlerRunConfig overrides as a dict.

    Returns:
        Dict with crawl results including url, success flag, and markdown.
    """
    from crawl4ai import CrawlerRunConfig

    crawler = ctx.get("crawler")
    if crawler is None:
        logger.error("Crawler not available in worker context")
        return {"url": url, "success": False, "error": "Crawler not initialized"}

    run_config = CrawlerRunConfig(**(config or {}))

    try:
        result = await crawler.arun(url, config=run_config)
        logger.info(f"Crawl completed: {url} (success={result.success})")

        # Publish event via event bus if available
        event_bus = ctx.get("event_bus")
        if event_bus is not None:
            event_type = "crawl.completed" if result.success else "crawl.failed"
            await event_bus.publish(
                event_type,
                {
                    "url": url,
                    "success": result.success,
                    "error": result.error_message if not result.success else None,
                },
            )

        return {
            "url": url,
            "success": result.success,
            "markdown": result.markdown if result.success else None,
            "error": result.error_message if not result.success else None,
        }
    except Exception as e:
        logger.exception(f"Crawl task failed for {url}: {e}")
        return {"url": url, "success": False, "error": str(e)}


async def extract_task(
    ctx: dict[str, Any],
    content: str,
    scan_id: str,
    source_url: str,
) -> dict:
    logger.info(f"Entity extraction for scan {scan_id} from {source_url}")
    try:
        from app.services.lm_studio_bridge import LMStudioBridge
        from app.pipelines.entity_enrichment import EntityEnrichmentPipeline

        bridge = LMStudioBridge()
        pipeline = EntityEnrichmentPipeline(bridge)
        pii = await pipeline.extract_pii(source_url, content)
        return {
            "scan_id": scan_id,
            "source_url": source_url,
            "entities": pii.model_dump(),
            "status": "completed",
        }
    except Exception as e:
        logger.exception(f"Entity extraction failed for scan {scan_id}: {e}")
        return {
            "scan_id": scan_id,
            "source_url": source_url,
            "entities": [],
            "status": "failed",
            "error": str(e),
        }


# ---------------------------------------------------------------------------
# Lifecycle hooks
# ---------------------------------------------------------------------------


async def startup(ctx: dict[str, Any]) -> None:
    """Initialize shared resources for the worker process.

    Creates a persistent AsyncWebCrawler instance and EventBus connection
    that are reused across all jobs in this worker.
    """
    from crawl4ai import AsyncWebCrawler, BrowserConfig
    from app.services.event_bus import EventBus

    logger.info("ARQ worker starting up...")

    browser_config = BrowserConfig(
        headless=True,
        text_mode=True,
        viewport_width=1920,
        viewport_height=1080,
    )

    crawler = AsyncWebCrawler(config=browser_config)
    await crawler.__aenter__()
    ctx["crawler"] = crawler

    event_bus = EventBus()
    await event_bus.connect()
    ctx["event_bus"] = event_bus

    logger.info("ARQ worker ready (crawler + event_bus initialized)")


async def shutdown(ctx: dict[str, Any]) -> None:
    """Clean up shared resources on worker shutdown."""
    logger.info("ARQ worker shutting down...")

    crawler = ctx.get("crawler")
    if crawler is not None:
        await crawler.__aexit__(None, None, None)

    event_bus = ctx.get("event_bus")
    if event_bus is not None:
        await event_bus.close()

    logger.info("ARQ worker shut down cleanly")


# ---------------------------------------------------------------------------
# Worker settings (entry point for `python -m arq`)
# ---------------------------------------------------------------------------


class WorkerSettings:
    """ARQ worker configuration.

    Run with: python -m arq app.workers.arq_worker.WorkerSettings
    """

    functions = [crawl_task, extract_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = _get_redis_settings()
    max_jobs = 10
    job_timeout = 300  # 5 minutes per job
    keep_result = 3600  # Keep results for 1 hour
    health_check_interval = 30  # seconds


# ---------------------------------------------------------------------------
# Enqueue helpers (called from FastAPI handlers)
# ---------------------------------------------------------------------------

_arq_pool = None


async def _get_pool():
    """Get or create the ARQ Redis connection pool."""
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(_get_redis_settings())
    return _arq_pool


async def enqueue_crawl(
    url: str,
    config: dict | None = None,
    job_timeout: int = 300,
) -> str | None:
    """Enqueue a crawl task from the FastAPI application.

    Args:
        url: URL to crawl.
        config: Optional CrawlerRunConfig overrides.
        job_timeout: Timeout in seconds for this specific job.

    Returns:
        Job ID string if enqueued successfully, None on failure.
    """
    try:
        pool = await _get_pool()
        job = await pool.enqueue_job(
            "crawl_task",
            url,
            config,
            _job_timeout=job_timeout,
        )
        logger.info(f"Enqueued crawl job {job.job_id} for {url}")
        return job.job_id
    except Exception as e:
        logger.error(f"Failed to enqueue crawl for {url}: {e}")
        return None


async def enqueue_extract(
    content: str,
    scan_id: str,
    source_url: str,
) -> str | None:
    """Enqueue an entity extraction task.

    Args:
        content: Markdown content to extract entities from.
        scan_id: Scan identifier.
        source_url: Source URL of the content.

    Returns:
        Job ID string if enqueued successfully, None on failure.
    """
    try:
        pool = await _get_pool()
        job = await pool.enqueue_job(
            "extract_task",
            content,
            scan_id,
            source_url,
        )
        logger.info(f"Enqueued extract job {job.job_id} for scan {scan_id}")
        return job.job_id
    except Exception as e:
        logger.error(f"Failed to enqueue extraction for scan {scan_id}: {e}")
        return None


async def close_arq_pool() -> None:
    """Close the ARQ connection pool."""
    global _arq_pool
    if _arq_pool is not None:
        await _arq_pool.close()
        _arq_pool = None
