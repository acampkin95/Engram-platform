from __future__ import annotations

import asyncio
import logging
import re
import threading
import uuid

from app.models.rag import (
    ChunkingConfig,
    ChunkingStrategy,
    ChunkPreview,
    ProcessingStage,
    ProcessingStatus,
    RAGPipelineConfig,
    RAGProcessStatus,
)
from app.storage.chromadb_client import get_chromadb_client
from app.services.job_store import get_job_store

logger = logging.getLogger(__name__)

_rag_store = get_job_store("rag_jobs")
_default_config: RAGPipelineConfig | None = None
_lock = threading.Lock()


def estimate_tokens(text: str) -> int:
    return len(text) // 4


def chunk_content(text: str, config: ChunkingConfig) -> list[ChunkPreview]:
    if config.strategy == ChunkingStrategy.FIXED_TOKEN:
        return _chunk_fixed_token(text, config)
    if config.strategy == ChunkingStrategy.SENTENCE:
        return _chunk_sentence(text, config)
    if config.strategy == ChunkingStrategy.REGEX:
        return _chunk_regex(text, config)
    if config.strategy == ChunkingStrategy.TOPIC:
        return _chunk_topic(text, config)
    return _chunk_fixed_token(text, config)


def _chunk_fixed_token(text: str, config: ChunkingConfig) -> list[ChunkPreview]:
    chunk_chars = config.chunk_size * 4
    overlap_chars = int(chunk_chars * config.overlap_rate)
    chunks: list[ChunkPreview] = []
    start = 0
    number = 1

    while start < len(text):
        end = min(start + chunk_chars, len(text))
        segment = text[start:end]
        tokens = estimate_tokens(segment)

        if tokens >= config.word_count_threshold or end == len(text):
            chunks.append(
                ChunkPreview(
                    chunk_number=number,
                    content=segment,
                    token_count=tokens,
                    start_offset=start,
                    end_offset=end,
                )
            )
            number += 1

        if end >= len(text):
            break
        start = end - overlap_chars

    return chunks


def _chunk_sentence(text: str, config: ChunkingConfig) -> list[ChunkPreview]:
    boundaries = list(re.finditer(r"(?<=[.!?])\s+", text))
    if not boundaries:
        return [
            ChunkPreview(
                chunk_number=1,
                content=text,
                token_count=estimate_tokens(text),
                start_offset=0,
                end_offset=len(text),
            )
        ]

    target_chars = config.chunk_size * 4
    chunks: list[ChunkPreview] = []
    number = 1
    start = 0

    for match in boundaries:
        end = match.end()
        if end - start >= target_chars:
            segment = text[start:end].strip()
            if segment:
                chunks.append(
                    ChunkPreview(
                        chunk_number=number,
                        content=segment,
                        token_count=estimate_tokens(segment),
                        start_offset=start,
                        end_offset=end,
                    )
                )
                number += 1
            start = end

    if start < len(text):
        segment = text[start:].strip()
        if segment:
            chunks.append(
                ChunkPreview(
                    chunk_number=number,
                    content=segment,
                    token_count=estimate_tokens(segment),
                    start_offset=start,
                    end_offset=len(text),
                )
            )

    return chunks


def _chunk_regex(text: str, config: ChunkingConfig) -> list[ChunkPreview]:
    parts = re.split(r"\n\n+", text)
    chunks: list[ChunkPreview] = []
    number = 1
    offset = 0

    for part in parts:
        stripped = part.strip()
        if not stripped:
            offset += len(part) + 2
            continue

        start = text.find(stripped, offset)
        if start == -1:
            start = offset
        end = start + len(stripped)
        tokens = estimate_tokens(stripped)

        if tokens >= config.word_count_threshold:
            chunks.append(
                ChunkPreview(
                    chunk_number=number,
                    content=stripped,
                    token_count=tokens,
                    start_offset=start,
                    end_offset=end,
                )
            )
            number += 1
        offset = end

    return chunks


def _chunk_topic(text: str, config: ChunkingConfig) -> list[ChunkPreview]:
    heading_pattern = re.compile(r"^#{1,6}\s+", re.MULTILINE)
    matches = list(heading_pattern.finditer(text))
    if not matches:
        return _chunk_fixed_token(text, config)

    chunks: list[ChunkPreview] = []
    number = 1

    if matches[0].start() > 0:
        segment = text[: matches[0].start()].strip()
        if segment and estimate_tokens(segment) >= config.word_count_threshold:
            chunks.append(
                ChunkPreview(
                    chunk_number=number,
                    content=segment,
                    token_count=estimate_tokens(segment),
                    start_offset=0,
                    end_offset=matches[0].start(),
                )
            )
            number += 1

    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        segment = text[start:end].strip()
        if segment:
            chunks.append(
                ChunkPreview(
                    chunk_number=number,
                    content=segment,
                    token_count=estimate_tokens(segment),
                    start_offset=start,
                    end_offset=end,
                )
            )
            number += 1

    return chunks


def get_default_config() -> RAGPipelineConfig:
    global _default_config
    if _default_config is None:
        _default_config = RAGPipelineConfig()
    return _default_config


def set_default_config(config: RAGPipelineConfig) -> RAGPipelineConfig:
    global _default_config
    _default_config = config
    return _default_config


def get_job_status(job_id: str) -> RAGProcessStatus | None:
    """Return the job status from Redis store (via asyncio.run) or in-memory fallback."""
    try:
        data = asyncio.run(_rag_store.get(job_id))
        if data is not None:
            return RAGProcessStatus(**data)
    except RuntimeError:
        # Already inside a running event loop — use in-memory fallback
        raw = _rag_store._fallback.get(job_id)
        if raw is not None:
            return RAGProcessStatus(**raw) if isinstance(raw, dict) else raw
    return None


def process_pipeline(content: str, config: RAGPipelineConfig) -> str:
    job_id = str(uuid.uuid4())
    job = RAGProcessStatus(job_id=job_id)
    job_dict = job.model_dump()
    # Persist initial state
    try:
        asyncio.run(_rag_store.set(job_id, job_dict))
    except RuntimeError:
        _rag_store._fallback[job_id] = job_dict

    thread = threading.Thread(
        target=_run_pipeline,
        args=(job_id, content, config),
        daemon=True,
    )
    thread.start()
    return job_id


def _run_pipeline(job_id: str, content: str, config: RAGPipelineConfig) -> None:
    # Load job from in-memory fallback (thread can't await)
    raw = _rag_store._fallback.get(job_id)
    job = RAGProcessStatus(**raw) if isinstance(raw, dict) else None
    if job is None:
        return
    try:
        with _lock:
            job.status = ProcessingStatus.PROCESSING
            job.stage = ProcessingStage.CHUNKING
            job.progress = 10
            _rag_store._fallback[job_id] = job.model_dump()

        chunks = chunk_content(content, config.chunking)

        with _lock:
            job.chunks_total = len(chunks)
            job.stage = ProcessingStage.EMBEDDING
            job.progress = 40
            _rag_store._fallback[job_id] = job.model_dump()

        client = get_chromadb_client()
        documents = [c.content for c in chunks]
        metadatas = [
            {
                "chunk_number": c.chunk_number,
                "token_count": c.token_count,
                "start_offset": c.start_offset,
                "end_offset": c.end_offset,
            }
            for c in chunks
        ]

        with _lock:
            job.stage = ProcessingStage.STORING
            job.progress = 60
            _rag_store._fallback[job_id] = job.model_dump()

        batch_size = config.embedding.batch_size
        stored = 0
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i : i + batch_size]
            batch_meta = metadatas[i : i + batch_size]
            client.add_documents(
                collection_name=config.target_collection,
                documents=batch_docs,
                metadatas=batch_meta,
            )
            stored += len(batch_docs)
            with _lock:
                job.chunks_stored = stored
                pct = 60 + int(40 * stored / len(documents))
                job.progress = min(pct, 100)
                _rag_store._fallback[job_id] = job.model_dump()

        with _lock:
            job.status = ProcessingStatus.COMPLETED
            job.progress = 100
            _rag_store._fallback[job_id] = job.model_dump()
        try:
            asyncio.run(_rag_store.set(job_id, job.model_dump()))
        except RuntimeError:
            pass  # Already persisted to in-memory fallback

        logger.info(f"RAG pipeline {job_id} completed: {stored} chunks stored")

    except Exception as e:
        logger.error(f"RAG pipeline {job_id} failed: {e}")
        with _lock:
            job.status = ProcessingStatus.FAILED
            job.error_message = str(e)
            _rag_store._fallback[job_id] = job.model_dump()
        try:
            asyncio.run(_rag_store.set(job_id, job.model_dump()))
        except RuntimeError:
            pass  # Already persisted to in-memory fallback
