from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

class ChunkingStrategy(StrEnum):
    TOPIC = "topic"
    REGEX = "regex"
    SENTENCE = "sentence"
    FIXED_TOKEN = "fixed_token"

class ProcessingStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ProcessingStage(StrEnum):
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    STORING = "storing"

class ChunkingConfig(BaseModel):
    strategy: ChunkingStrategy = ChunkingStrategy.FIXED_TOKEN
    chunk_size: int = Field(default=1024, ge=256, le=4096)
    overlap_rate: float = Field(default=0.1, ge=0.0, le=0.5)
    word_count_threshold: int = Field(default=50, ge=0)

class EmbeddingConfig(BaseModel):
    model_name: str = Field(default="all-MiniLM-L6-v2")
    batch_size: int = Field(default=32, ge=1, le=256)
    dimensions: int = Field(default=384, ge=1)

class RAGPipelineConfig(BaseModel):
    chunking: ChunkingConfig = Field(default_factory=ChunkingConfig)
    embedding: EmbeddingConfig = Field(default_factory=EmbeddingConfig)
    target_collection: str = Field(default="rag_default", min_length=1, max_length=128)

class ChunkPreview(BaseModel):
    chunk_number: int
    content: str
    token_count: int
    start_offset: int
    end_offset: int

class RAGProcessRequest(BaseModel):
    crawl_result_id: str | None = None
    raw_content: str | None = None
    config: RAGPipelineConfig = Field(default_factory=RAGPipelineConfig)

class RAGProcessStatus(BaseModel):
    job_id: str
    status: ProcessingStatus = ProcessingStatus.PENDING
    progress: int = Field(default=0, ge=0, le=100)
    stage: ProcessingStage | None = None
    error_message: str | None = None
    chunks_total: int = 0
    chunks_stored: int = 0
