from __future__ import annotations

import uuid
import hashlib
from datetime import datetime, UTC
from fastapi import Request, APIRouter, HTTPException, BackgroundTasks
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from app.models.crawl import (
    CrawlRequest,
    CrawlResponse,
    BatchCrawlRequest,
    DeepCrawlRequest,
    CrawlStatus,
)
from app.websocket.manager import manager
from app.config import get_clerk_config
from app.middleware.auth import verify_jwt_token
from app.models.auth import AuthenticatedUser
from app.core.security import validate_url
from app.services.cache import get_crawl_result, set_crawl_result
from app.services.job_store import get_job_store

router = APIRouter(prefix="/api/crawl", tags=["crawl"])
_crawl_store = get_job_store("crawl_jobs")


def utc_now():
    return datetime.now(UTC)


async def execute_crawl(crawl_id: str, request: CrawlRequest):
    try:
        if not request.bypass_cache:
            cached = await get_crawl_result(str(request.url))
            if cached:
                job = await _crawl_store.get(crawl_id) or {}
                job.update(cached)
                job["status"] = CrawlStatus.COMPLETED
                job["completed_at"] = utc_now()
                job.setdefault("metadata", {})["cache_hit"] = True
                await _crawl_store.set(crawl_id, job)
                await manager.send_crawl_update(crawl_id, "completed", {"cache_hit": True})
                return

        await _crawl_store.update(crawl_id, {"status": CrawlStatus.RUNNING})
        await manager.send_crawl_update(crawl_id, "running", {"url": str(request.url)})

        browser_config = BrowserConfig(
            headless=True,
            viewport_width=1920,
            viewport_height=1080,
        )

        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS if request.bypass_cache else CacheMode.ENABLED,
            wait_for=request.wait_for,
            screenshot=request.screenshot,
            pdf=request.pdf,
            word_count_threshold=request.word_count_threshold,
            exclude_external_links=request.exclude_external_links,
            exclude_social_media_links=request.exclude_social_media_links,
        )

        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(str(request.url), config=run_config)

            if result.success:
                content_hash = hashlib.sha256((result.markdown or "").encode("utf-8")).hexdigest()
                metadata = {
                    "word_count": len(result.markdown.split()) if result.markdown else 0,
                    "title": result.metadata.get("title", "") if result.metadata else "",
                    "content_hash": content_hash,
                    "hashed_at": utc_now().isoformat(),
                }
                job_update = {
                    "status": CrawlStatus.COMPLETED,
                    "completed_at": utc_now(),
                    "markdown": result.markdown,
                    "html": result.html,
                    "extracted_content": result.extracted_content,
                    "links": result.links.get("internal", []) if result.links else [],
                    "media": result.media if result.media else {},
                    "screenshot": result.screenshot,
                    "pdf": result.pdf,
                    "metadata": metadata,
                }
                await _crawl_store.update(crawl_id, job_update)

                await set_crawl_result(
                    str(request.url),
                    {
                        "markdown": result.markdown,
                        "html": result.html,
                        "extracted_content": result.extracted_content,
                        "links": job_update["links"],
                        "media": job_update["media"],
                        "metadata": metadata,
                    },
                )

                await manager.send_crawl_update(
                    crawl_id,
                    "completed",
                    {"word_count": metadata["word_count"]},
                )
            else:
                await _crawl_store.update(
                    crawl_id,
                    {
                        "status": CrawlStatus.FAILED,
                        "error_message": result.error_message or "Unknown error",
                        "completed_at": utc_now(),
                    },
                )

                await manager.send_crawl_update(
                    crawl_id,
                    "failed",
                    {"error": result.error_message or "Unknown error"},
                )

    except Exception as e:
        await _crawl_store.update(
            crawl_id,
            {
                "status": CrawlStatus.FAILED,
                "error_message": str(e),
                "completed_at": utc_now(),
            },
        )

        await manager.send_crawl_update(crawl_id, "failed", {"error": str(e)})


@router.post("/start", response_model=CrawlResponse, status_code=202)
async def start_crawl(
    request: CrawlRequest, background_tasks: BackgroundTasks, http_request: Request
):
    """
    Start a new crawl job.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    This endpoint is protected for modification operations.
    """
    try:
        await validate_url(str(request.url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"URL validation failed: {e}")

    user: AuthenticatedUser | None = None
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
            http_request.state.user = user
        else:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
    if user:
        http_request.state.user_id = user.user_id

    crawl_id = str(uuid.uuid4())
    initial_job = {
        "crawl_id": crawl_id,
        "url": str(request.url),
        "status": CrawlStatus.PENDING,
        "created_at": utc_now(),
        "completed_at": None,
        "markdown": None,
        "html": None,
        "extracted_content": None,
        "links": None,
        "media": None,
        "screenshot": None,
        "pdf": None,
        "error_message": None,
        "metadata": {"owner_id": getattr(http_request.state, "user_id", None)},
    }
    await _crawl_store.set(crawl_id, initial_job)

    background_tasks.add_task(execute_crawl, crawl_id, request)
    await manager.send_crawl_update(crawl_id, "pending", {"url": str(request.url)})

    return CrawlResponse(**initial_job)


@router.post("/batch", response_model=list[CrawlResponse])
async def batch_crawl(
    request: BatchCrawlRequest, background_tasks: BackgroundTasks, http_request: Request
):
    """
    Batch crawl multiple URLs.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    This endpoint is protected for modification operations.
    """
    user: AuthenticatedUser | None = None
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
            http_request.state.user = user
        else:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    results = []
    for url in request.urls:
        crawl_request = (request.config or CrawlRequest(url=url)).model_copy(update={"url": url})
        result = await start_crawl(crawl_request, background_tasks, http_request)
        results.append(result)

    return results


@router.get("/status/{crawl_id}", response_model=CrawlResponse)
async def get_crawl_status(crawl_id: str):
    if not await _crawl_store.contains(crawl_id):
        raise HTTPException(status_code=404, detail="Crawl job not found")

    job = await _crawl_store.get(crawl_id)
    return CrawlResponse(**job)


@router.get("/list", response_model=list[CrawlResponse])
async def list_crawls(status: CrawlStatus | None = None, limit: int = 100):
    crawls = await _crawl_store.values()

    if status:
        crawls = [c for c in crawls if c["status"] == status]

    crawls = sorted(crawls, key=lambda x: x["created_at"], reverse=True)
    crawls = crawls[:limit]

    return [CrawlResponse(**c) for c in crawls]


@router.post("/cancel/{crawl_id}")
async def cancel_crawl(crawl_id: str):
    if not await _crawl_store.contains(crawl_id):
        raise HTTPException(status_code=404, detail="Crawl job not found")

    await _crawl_store.update(
        crawl_id,
        {
            "status": CrawlStatus.CANCELLED,
            "completed_at": utc_now(),
        },
    )

    await manager.send_crawl_update(crawl_id, "cancelled", {})

    return {"message": f"Crawl job {crawl_id} cancelled"}


@router.delete("/{crawl_id}")
async def delete_crawl(crawl_id: str, http_request: Request):
    """
    Delete a crawl job.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    Users can only delete their own crawl jobs unless they are admins.
    """
    config = get_clerk_config()
    user_id: str | None = None

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
            user_id = user.user_id
        else:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if not await _crawl_store.contains(crawl_id):
        raise HTTPException(status_code=404, detail="Crawl job not found")

    job = await _crawl_store.get(crawl_id)
    owner_id = (job or {}).get("metadata", {}).get("owner_id")
    if user_id and owner_id and owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this crawl job")

    await _crawl_store.delete(crawl_id)
    return {"message": f"Crawl job {crawl_id} deleted"}


@router.post("/deep")
async def deep_crawl(
    request: DeepCrawlRequest, background_tasks: BackgroundTasks, http_request: Request
):
    """
    Start a deep crawl with controlled depth.

    Authentication: Admin only if AUTH_ENABLED is true.
    This endpoint requires elevated privileges due to resource intensity.
    """
    try:
        await validate_url(str(request.start_url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"URL validation failed: {e}")

    config = get_clerk_config()
    user: AuthenticatedUser | None = None

    if config.auth_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
        else:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Admin access required for deep crawl",
            )

    crawl_id = str(uuid.uuid4())

    crawl_id = str(uuid.uuid4())
    initial_job = {
        "crawl_id": crawl_id,
        "url": str(request.start_url),
        "status": CrawlStatus.PENDING,
        "created_at": utc_now(),
        "completed_at": None,
        "markdown": None,
        "html": None,
        "extracted_content": None,
        "links": None,
        "media": None,
        "screenshot": None,
        "pdf": None,
        "error_message": None,
        "metadata": {"deep_crawl": True, "max_depth": request.max_depth},
    }
    await _crawl_store.set(crawl_id, initial_job)

    background_tasks.add_task(execute_crawl, crawl_id, CrawlRequest(url=request.start_url))
    await manager.send_crawl_update(
        crawl_id,
        "pending",
        {
            "url": str(request.start_url),
            "deep_crawl": True,
        },
    )

    return {"crawl_id": crawl_id, "message": "Deep crawl started"}
