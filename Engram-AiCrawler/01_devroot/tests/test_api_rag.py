"""
Tests for app/api/rag.py — targets 70%+ coverage.

Strategy:
- Minimal FastAPI app with only the rag router
- Patches service functions: chunk_content, get_default_config, get_job_status,
  process_pipeline, set_default_config, get_job_store
- Tests all endpoints: GET /config, PUT /config, POST /preview-chunking,
  POST /process, GET /status/{job_id}
- Covers happy paths AND error paths (400, 404, 422)
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.api.rag import router
from app.middleware import rate_limit as _rl_module
from app.models.rag import (
    ChunkingConfig,
    ChunkingStrategy,
    ChunkPreview,
    EmbeddingConfig,
    ProcessingStatus,
    ProcessingStage,
    RAGPipelineConfig,
    RAGProcessStatus,
)

# ── Minimal app ────────────────────────────────────────────────────────────────
app = FastAPI()
app.include_router(router)
client = TestClient(app, raise_server_exceptions=True)


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_get_redis():
    with patch("app.services.job_store._get_redis", new=AsyncMock(return_value=None)):
        yield


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_config(**kwargs) -> RAGPipelineConfig:
    defaults: dict = {
        "chunking": ChunkingConfig(),
        "embedding": EmbeddingConfig(),
        "target_collection": "rag_default",
    }
    defaults.update(kwargs)
    return RAGPipelineConfig(**defaults)


def _make_chunk(n: int = 1, content: str = "hello world") -> ChunkPreview:
    return ChunkPreview(
        chunk_number=n,
        content=content,
        token_count=len(content) // 4,
        start_offset=0,
        end_offset=len(content),
    )


def _make_status(
    job_id: str = "job-001",
    status: ProcessingStatus = ProcessingStatus.PENDING,
    stage: ProcessingStage | None = None,
    progress: int = 0,
) -> RAGProcessStatus:
    return RAGProcessStatus(
        job_id=job_id,
        status=status,
        stage=stage,
        progress=progress,
    )


# ── GET /config ────────────────────────────────────────────────────────────────


class TestGetConfig:
    def test_get_config_returns_200(self):
        cfg = _make_config()
        with patch("app.api.rag.get_default_config", return_value=cfg):
            resp = client.get("/api/rag/config")
        assert resp.status_code == 200

    def test_get_config_returns_dict(self):
        cfg = _make_config()
        with patch("app.api.rag.get_default_config", return_value=cfg):
            resp = client.get("/api/rag/config")
        data = resp.json()
        assert "chunking" in data
        assert "embedding" in data
        assert "target_collection" in data

    def test_get_config_target_collection(self):
        cfg = _make_config(target_collection="my_collection")
        with patch("app.api.rag.get_default_config", return_value=cfg):
            resp = client.get("/api/rag/config")
        assert resp.json()["target_collection"] == "my_collection"


# ── PUT /config ────────────────────────────────────────────────────────────────


class TestUpdateConfig:
    def test_update_config_returns_200(self):
        cfg = _make_config(target_collection="updated_collection")
        with patch("app.api.rag.set_default_config", return_value=cfg):
            resp = client.put(
                "/api/rag/config",
                json={
                    "chunking": {
                        "strategy": "fixed_token",
                        "chunk_size": 512,
                        "overlap_rate": 0.1,
                        "word_count_threshold": 50,
                    },
                    "embedding": {
                        "model_name": "all-MiniLM-L6-v2",
                        "batch_size": 32,
                        "dimensions": 384,
                    },
                    "target_collection": "updated_collection",
                },
            )
        assert resp.status_code == 200

    def test_update_config_calls_set_default_config(self):
        cfg = _make_config()
        with patch("app.api.rag.set_default_config", return_value=cfg) as mock_set:
            client.put(
                "/api/rag/config",
                json={
                    "chunking": {
                        "strategy": "fixed_token",
                        "chunk_size": 512,
                        "overlap_rate": 0.1,
                        "word_count_threshold": 50,
                    },
                    "embedding": {
                        "model_name": "all-MiniLM-L6-v2",
                        "batch_size": 32,
                        "dimensions": 384,
                    },
                    "target_collection": "rag_default",
                },
            )
        mock_set.assert_called_once()

    def test_update_config_returns_updated_values(self):
        cfg = _make_config(target_collection="new_col")
        with patch("app.api.rag.set_default_config", return_value=cfg):
            resp = client.put(
                "/api/rag/config",
                json={
                    "chunking": {
                        "strategy": "fixed_token",
                        "chunk_size": 512,
                        "overlap_rate": 0.1,
                        "word_count_threshold": 50,
                    },
                    "embedding": {
                        "model_name": "all-MiniLM-L6-v2",
                        "batch_size": 32,
                        "dimensions": 384,
                    },
                    "target_collection": "new_col",
                },
            )
        assert resp.json()["target_collection"] == "new_col"

    def test_update_config_invalid_payload_returns_422(self):
        with patch("app.api.rag.set_default_config", return_value=_make_config()):
            resp = client.put("/api/rag/config", json={"target_collection": ""})
        assert resp.status_code == 422


# ── POST /preview-chunking ─────────────────────────────────────────────────────


class TestPreviewChunking:
    def test_preview_returns_200(self):
        chunks = [_make_chunk(1, "hello world chunk one"), _make_chunk(2, "chunk two")]
        with patch("app.api.rag.chunk_content", return_value=chunks):
            resp = client.post(
                "/api/rag/preview-chunking",
                json={"content": "hello world chunk one chunk two"},
            )
        assert resp.status_code == 200

    def test_preview_returns_chunks_and_total(self):
        chunks = [_make_chunk(1, "hello world")]
        with patch("app.api.rag.chunk_content", return_value=chunks):
            resp = client.post(
                "/api/rag/preview-chunking",
                json={"content": "hello world"},
            )
        data = resp.json()
        assert "chunks" in data
        assert "total" in data
        assert data["total"] == 1
        assert len(data["chunks"]) == 1

    def test_preview_empty_chunks(self):
        with patch("app.api.rag.chunk_content", return_value=[]):
            resp = client.post(
                "/api/rag/preview-chunking",
                json={"content": "short"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["chunks"] == []

    def test_preview_missing_content_returns_422(self):
        resp = client.post("/api/rag/preview-chunking", json={})
        assert resp.status_code == 422

    def test_preview_empty_string_content_returns_422(self):
        # min_length=1 on content field
        resp = client.post("/api/rag/preview-chunking", json={"content": ""})
        assert resp.status_code == 422

    def test_preview_with_custom_config(self):
        chunks = [_make_chunk(1, "data")]
        with patch("app.api.rag.chunk_content", return_value=chunks) as mock_chunk:
            resp = client.post(
                "/api/rag/preview-chunking",
                json={
                    "content": "some text data",
                    "config": {
                        "strategy": "sentence",
                        "chunk_size": 512,
                        "overlap_rate": 0.2,
                        "word_count_threshold": 10,
                    },
                },
            )
        assert resp.status_code == 200
        # Verify the config was passed through
        call_args = mock_chunk.call_args
        assert call_args[0][0] == "some text data"
        passed_config = call_args[0][1]
        assert passed_config.strategy == ChunkingStrategy.SENTENCE


# ── POST /process ──────────────────────────────────────────────────────────────


class TestStartProcessing:
    def test_process_with_raw_content_returns_202(self):
        with patch("app.api.rag.process_pipeline", return_value="job-abc"):
            resp = client.post(
                "/api/rag/process",
                json={"raw_content": "This is the content to process and embed."},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == "job-abc"
        assert data["status"] == "accepted"

    def test_process_calls_process_pipeline(self):
        with patch("app.api.rag.process_pipeline", return_value="job-xyz") as mock_pp:
            client.post(
                "/api/rag/process",
                json={"raw_content": "Content to process."},
            )
        mock_pp.assert_called_once()

    def test_process_no_content_no_crawl_id_returns_400(self):
        resp = client.post("/api/rag/process", json={})
        assert resp.status_code == 400
        assert "raw_content" in resp.json()["detail"] or "crawl_result_id" in resp.json()["detail"]

    def test_process_with_crawl_result_id_found(self):
        """When crawl_result_id is given and job exists with markdown content."""
        mock_store = MagicMock()
        mock_store.get = AsyncMock(return_value={"markdown": "Crawled markdown content here."})

        with patch("app.api.rag.get_job_store", return_value=mock_store), patch(
            "app.api.rag.process_pipeline", return_value="job-crawl"
        ):
            resp = client.post(
                "/api/rag/process",
                json={"crawl_result_id": "crawl-123"},
            )
        assert resp.status_code == 200
        assert resp.json()["job_id"] == "job-crawl"

    def test_process_with_crawl_result_id_not_found_returns_404(self):
        mock_store = MagicMock()
        mock_store.get = AsyncMock(return_value=None)

        with patch("app.api.rag.get_job_store", return_value=mock_store):
            resp = client.post(
                "/api/rag/process",
                json={"crawl_result_id": "nonexistent-crawl"},
            )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_process_with_crawl_result_id_no_content_returns_422(self):
        """Crawl job exists but has no extractable content."""
        mock_store = MagicMock()
        mock_store.get = AsyncMock(return_value={"markdown": "", "extracted_content": None})

        with patch("app.api.rag.get_job_store", return_value=mock_store):
            resp = client.post(
                "/api/rag/process",
                json={"crawl_result_id": "crawl-empty"},
            )
        assert resp.status_code == 422
        assert "no extractable content" in resp.json()["detail"].lower()

    def test_process_raw_content_whitespace_only_returns_400(self):
        """raw_content present but only whitespace."""
        with patch("app.api.rag.process_pipeline", return_value="job-x"):
            resp = client.post(
                "/api/rag/process",
                json={"raw_content": "   "},
            )
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"].lower()

    def test_process_with_extracted_content_fallback(self):
        """Crawl job has no markdown but has extracted_content."""
        mock_store = MagicMock()
        mock_store.get = AsyncMock(
            return_value={
                "markdown": None,
                "extracted_content": "Some extracted content from crawl.",
            }
        )

        with patch("app.api.rag.get_job_store", return_value=mock_store), patch(
            "app.api.rag.process_pipeline", return_value="job-extracted"
        ):
            resp = client.post(
                "/api/rag/process",
                json={"crawl_result_id": "crawl-456"},
            )
        assert resp.status_code == 200
        assert resp.json()["job_id"] == "job-extracted"


# ── GET /status/{job_id} ───────────────────────────────────────────────────────


class TestGetProcessingStatus:
    def test_status_existing_job_returns_200(self):
        job = _make_status(job_id="job-001", status=ProcessingStatus.PROCESSING, progress=40)
        with patch("app.api.rag.get_job_status", return_value=job):
            resp = client.get("/api/rag/status/job-001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == "job-001"
        assert data["status"] == "processing"
        assert data["progress"] == 40

    def test_status_missing_job_returns_404(self):
        with patch("app.api.rag.get_job_status", return_value=None):
            resp = client.get("/api/rag/status/nonexistent")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_status_completed_job(self):
        job = _make_status(
            job_id="job-done",
            status=ProcessingStatus.COMPLETED,
            progress=100,
        )
        with patch("app.api.rag.get_job_status", return_value=job):
            resp = client.get("/api/rag/status/job-done")
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"
        assert resp.json()["progress"] == 100

    def test_status_failed_job(self):
        job = _make_status(job_id="job-fail", status=ProcessingStatus.FAILED)
        job.error_message = "Something went wrong"
        with patch("app.api.rag.get_job_status", return_value=job):
            resp = client.get("/api/rag/status/job-fail")
        assert resp.status_code == 200
        assert resp.json()["status"] == "failed"

    def test_status_pending_job(self):
        job = _make_status(job_id="job-pending", status=ProcessingStatus.PENDING)
        with patch("app.api.rag.get_job_status", return_value=job):
            resp = client.get("/api/rag/status/job-pending")
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"
