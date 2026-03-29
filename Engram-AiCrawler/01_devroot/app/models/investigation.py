"""Investigation (Case) data model for OSINT operations."""

from __future__ import annotations
import uuid
from datetime import datetime
from app._compat import UTC
from typing import Any

from app._compat import StrEnum

from pydantic import BaseModel, Field

class InvestigationStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    ARCHIVED = "archived"

class InvestigationPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class CreateInvestigationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    tags: list[str] = Field(default_factory=list)
    priority: InvestigationPriority = InvestigationPriority.MEDIUM

class UpdateInvestigationRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    status: InvestigationStatus | None = None
    tags: list[str] | None = None
    priority: InvestigationPriority | None = None

class Investigation(BaseModel):
    investigation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str | None = None
    status: InvestigationStatus = InvestigationStatus.ACTIVE
    priority: InvestigationPriority = InvestigationPriority.MEDIUM
    tags: list[str] = Field(default_factory=list)
    crawl_ids: list[str] = Field(default_factory=list)
    scan_ids: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    closed_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

class InvestigationSummary(BaseModel):
    investigation_id: str
    name: str
    status: InvestigationStatus
    priority: InvestigationPriority
    tags: list[str]
    crawl_count: int
    scan_count: int
    created_at: datetime
    updated_at: datetime
