"""
Extraction API endpoints.

Provides:
- POST /api/darkweb/extract - Extract content from URL
- GET /api/darkweb/extract/status/{id} - Get extraction status
"""

import logging
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from crawl4ai_darkweb_osint.config import get_config
from crawl4ai_darkweb_osint.extraction.onion_strategy import (
    OnionExtractionStrategy,
)
from crawl4ai_darkweb_osint.extraction.tor_config import (
    create_tor_browser_config,
    create_tor_crawler_config,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response Models
class ExtractRequest(BaseModel):
    """Request model for extraction."""

    url: str = Field(..., description="URL to extract from")
    wait_for: Optional[str] = Field(
        default=None, description="CSS selector to wait for"
    )
    js_code: Optional[str] = Field(default=None, description="JavaScript to execute")
    screenshot: bool = Field(default=False, description="Take screenshot")
    pdf: bool = Field(default=False, description="Generate PDF")
    max_content_length: int = Field(default=100000, description="Max content length")


class ExtractedContent(BaseModel):
    """Extracted content model."""

    title: str
    content: str
    markdown: str
    links: List[str]
    metadata: dict


class ExtractResponse(BaseModel):
    """Response model for extraction."""

    success: bool
    url: str
    content: Optional[ExtractedContent] = None
    error: Optional[str] = None
    extraction_time: float
    timestamp: str


class ExtractStatusResponse(BaseModel):
    """Response model for extraction status."""

    id: str
    status: str
    progress: float
    result: Optional[ExtractResponse] = None
    error: Optional[str] = None


class BatchExtractRequest(BaseModel):
    """Request model for batch extraction."""

    urls: List[str] = Field(..., description="URLs to extract", max_length=10)
    max_concurrent: int = Field(default=3, description="Max concurrent extractions")


class BatchExtractResponse(BaseModel):
    """Response model for batch extraction."""

    job_id: str
    total_urls: int
    completed: int
    results: List[ExtractResponse]


# Background task storage
_extraction_tasks: dict = {}


@router.post("/extract", response_model=ExtractResponse)
async def extract_content(request: ExtractRequest) -> ExtractResponse:
    """
    Extract content from a URL via Tor.

    Supports both .onion and regular URLs.
    Uses Tor SOCKS5 proxy for all requests.
    """
    config = get_config()

    # Create extraction config
    browser_config = create_tor_browser_config(
        tor_host=config.tor.host,
        tor_port=config.tor.port,
        page_timeout=config.extraction.page_timeout,
        disable_images=not request.screenshot,
    )

    crawler_config = create_tor_crawler_config(
        wait_for=request.wait_for or config.extraction.wait_for_selector,
        screenshot=request.screenshot,
        pdf=request.pdf,
        excluded_tags=config.extraction.excluded_tags,
    )

    # Execute extraction
    strategy = OnionExtractionStrategy(
        browser_config=browser_config,
        crawler_config=crawler_config,
    )

    try:
        result = await strategy.extract(
            url=request.url,
            wait_for=request.wait_for,
            js_code=request.js_code,
        )

        if result.success:
            # Truncate content if needed
            content = result.content
            if len(content) > request.max_content_length:
                content = content[: request.max_content_length] + "..."

            return ExtractResponse(
                success=True,
                url=result.url,
                content=ExtractedContent(
                    title=result.title,
                    content=content,
                    markdown=result.markdown[: request.max_content_length]
                    if result.markdown
                    else "",
                    links=result.links[:50],  # Limit links
                    metadata=result.metadata,
                ),
                extraction_time=result.extraction_time,
                timestamp=datetime.utcnow().isoformat(),
            )
        else:
            return ExtractResponse(
                success=False,
                url=request.url,
                error=result.error or "Extraction failed",
                extraction_time=result.extraction_time,
                timestamp=datetime.utcnow().isoformat(),
            )

    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        await strategy.close()


@router.post("/extract/batch", response_model=BatchExtractResponse)
async def batch_extract(
    request: BatchExtractRequest,
    background_tasks: BackgroundTasks,
) -> BatchExtractResponse:
    """
    Extract content from multiple URLs in batch.

    Processes URLs concurrently with configurable parallelism.
    """
    job_id = str(uuid.uuid4())

    # Initialize job
    _extraction_tasks[job_id] = {
        "status": "pending",
        "total": len(request.urls),
        "completed": 0,
        "results": [],
    }

    # Create extraction strategy
    config = get_config()
    strategy = OnionExtractionStrategy()

    try:
        results = await strategy.extract_many(
            urls=request.urls,
            max_concurrent=request.max_concurrent,
        )

        # Convert results
        extract_results = []
        for result in results:
            extract_results.append(
                ExtractResponse(
                    success=result.success,
                    url=result.url,
                    content=ExtractedContent(
                        title=result.title,
                        content=result.content[:100000] if result.content else "",
                        markdown=result.markdown[:100000] if result.markdown else "",
                        links=result.links[:50],
                        metadata=result.metadata,
                    )
                    if result.success
                    else None,
                    error=result.error,
                    extraction_time=result.extraction_time,
                    timestamp=datetime.utcnow().isoformat(),
                )
            )

        return BatchExtractResponse(
            job_id=job_id,
            total_urls=len(request.urls),
            completed=len(extract_results),
            results=extract_results,
        )

    finally:
        await strategy.close()


@router.get("/extract/status/{job_id}", response_model=ExtractStatusResponse)
async def get_extract_status(job_id: str) -> ExtractStatusResponse:
    """
    Get status of a batch extraction job.
    """
    if job_id not in _extraction_tasks:
        raise HTTPException(status_code=404, detail="Job not found")

    task = _extraction_tasks[job_id]

    return ExtractStatusResponse(
        id=job_id,
        status=task["status"],
        progress=task["completed"] / task["total"] if task["total"] > 0 else 0,
        result=task.get("result"),
        error=task.get("error"),
    )


@router.get("/extract/health")
async def extraction_health() -> dict:
    """Check extraction module health."""
    config = get_config()

    return {
        "status": "healthy",
        "tor_proxy": f"{config.tor.host}:{config.tor.port}",
        "page_timeout": config.extraction.page_timeout,
        "js_rendering": config.extraction.js_rendering,
    }
