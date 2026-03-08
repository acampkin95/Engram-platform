import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.rag import (
    ChunkingConfig,
    RAGPipelineConfig,
    RAGProcessRequest,
    RAGProcessStatus,
)
from app.services.rag_service import (
    chunk_content,
    get_default_config,
    get_job_status,
    process_pipeline,
    set_default_config,
)
from app.services.job_store import get_job_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["rag"])


class PreviewChunkingRequest(BaseModel):
    content: str = Field(..., min_length=1)
    config: ChunkingConfig = Field(default_factory=ChunkingConfig)


@router.get("/config")
async def get_config() -> dict[str, Any]:
    config = get_default_config()
    return config.model_dump()


@router.put("/config")
async def update_config(config: RAGPipelineConfig) -> dict[str, Any]:
    updated = set_default_config(config)
    return updated.model_dump()


@router.post("/preview-chunking")
async def preview_chunking(
    request: PreviewChunkingRequest,
) -> dict[str, Any]:
    chunks = chunk_content(request.content, request.config)
    return {"chunks": [c.model_dump() for c in chunks], "total": len(chunks)}


@router.post("/process")
async def start_processing(request: RAGProcessRequest) -> dict[str, str]:
    content = request.raw_content
    if content is None:
        if request.crawl_result_id is None:
            raise HTTPException(
                status_code=400,
                detail="Either raw_content or crawl_result_id must be provided",
            )
        crawl_store = get_job_store("crawl_jobs")
        job = await crawl_store.get(request.crawl_result_id)
        if not job:
            raise HTTPException(
                status_code=404,
                detail=f"Crawl job '{request.crawl_result_id}' not found",
            )
        content = job.get("markdown") or job.get("extracted_content") or ""
        if not content.strip():
            raise HTTPException(
                status_code=422,
                detail=f"Crawl job '{request.crawl_result_id}' has no extractable content",
            )
    if not content.strip():
        raise HTTPException(status_code=400, detail="Content must not be empty")

    job_id = process_pipeline(content, request.config)
    return {"job_id": job_id, "status": "accepted"}


@router.get("/status/{job_id}")
async def get_processing_status(job_id: str) -> RAGProcessStatus:
    job = get_job_status(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job
