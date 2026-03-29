from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl
from typing import Any
from datetime import datetime

from app._compat import StrEnum

class CrawlStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ExtractionType(StrEnum):
    LLM = "llm"
    CSS = "css"
    REGEX = "regex"
    COSINE = "cosine"

class CrawlRequest(BaseModel):
    url: HttpUrl
    extraction_type: ExtractionType = ExtractionType.CSS
    wait_for: str | None = None
    screenshot: bool = False
    pdf: bool = False
    remove_overlay: bool = True
    bypass_cache: bool = False
    word_count_threshold: int = Field(default=10, ge=0)
    exclude_external_links: bool = False
    exclude_social_media_links: bool = True
    extraction_schema: dict[str, Any] | None = None
    llm_instruction: str | None = None
    llm_provider: str | None = "openai/gpt-4o-mini"
    chunk_token_threshold: int = Field(default=4096, ge=512)
    overlap_rate: float = Field(default=0.1, ge=0.0, le=1.0)
    owner_id: str | None = None

class CrawlResponse(BaseModel):
    crawl_id: str
    url: str
    status: CrawlStatus | None = None
    created_at: datetime
    completed_at: datetime | None = None
    markdown: str | None = None
    html: str | None = None
    extracted_content: str | None = None
    links: list[str] | None = None
    media: dict[str, list[str]] | None = None
    screenshot: str | None = None
    pdf: str | None = None
    error_message: str | None = None
    metadata: dict[str, Any] | None = None

class BatchCrawlRequest(BaseModel):
    urls: list[HttpUrl] = Field(..., min_length=1, max_length=50)
    config: CrawlRequest | None = None
    max_concurrent: int = Field(default=5, ge=1, le=20)

class DeepCrawlRequest(BaseModel):
    start_url: HttpUrl
    max_depth: int = Field(default=3, ge=1, le=10)
    max_pages: int = Field(default=100, ge=1, le=1000)
    strategy: str = Field(default="bfs", pattern="^(bfs|dfs|best_first)$")
    allowed_domains: list[str] | None = None
    exclude_patterns: list[str] | None = None
    include_patterns: list[str] | None = None
    keyword_focus: list[str] | None = None

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    model: str | None = "default"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1)
    stream: bool = False

class ChatResponse(BaseModel):
    message_id: str
    role: str
    content: str
    model: str
    finish_reason: str | None = None
    usage: dict[str, int] | None = None
    created_at: datetime

class DataSetMetadata(BaseModel):
    data_set_id: str
    name: str
    description: str | None = None
    tier: str = Field(..., pattern="^(hot|warm|cold|archive)$")
    created_at: datetime
    updated_at: datetime
    size_bytes: int = Field(default=0, ge=0)
    file_count: int = Field(default=0, ge=0)
    tags: list[str] | None = None

class MigrateRequest(BaseModel):
    target_tier: str = Field(..., pattern="^(hot|warm|cold|archive)$")
