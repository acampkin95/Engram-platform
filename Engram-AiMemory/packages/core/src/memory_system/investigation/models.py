"""Pydantic v2 models for the investigation system."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class MatterStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    ARCHIVED = "ARCHIVED"


class SourceType(StrEnum):
    PDF = "PDF"
    EMAIL = "EMAIL"
    CSV = "CSV"
    WEB = "WEB"
    MANUAL = "MANUAL"


class ReportType(StrEnum):
    ENTITY_SUMMARY = "ENTITY_SUMMARY"
    TIMELINE_SUMMARY = "TIMELINE_SUMMARY"
    CONTRADICTION_SUMMARY = "CONTRADICTION_SUMMARY"
    FULL = "FULL"


# ---------------------------------------------------------------------------
# Matter models
# ---------------------------------------------------------------------------


class MatterCreate(BaseModel):
    matter_id: str
    title: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    lead_investigator: str = ""


class MatterResponse(BaseModel):
    model_config = {"use_enum_values": True}

    matter_id: str
    title: str
    description: str
    status: MatterStatus
    created_at: datetime
    tags: list[str]
    lead_investigator: str
    id: str  # Weaviate UUID


# ---------------------------------------------------------------------------
# Evidence models
# ---------------------------------------------------------------------------


class EvidenceIngest(BaseModel):
    model_config = {"use_enum_values": True}

    matter_id: str
    content: str
    source_url: str = ""
    source_type: SourceType = SourceType.MANUAL
    metadata: dict[str, Any] = Field(default_factory=dict)
    page_number: int = 0
    message_id: str = ""


class EvidenceResponse(BaseModel):
    model_config = {"use_enum_values": True}

    id: str
    matter_id: str
    source_url: str
    source_type: SourceType
    chunk_index: int
    ingested_at: datetime


# ---------------------------------------------------------------------------
# Subject models
# ---------------------------------------------------------------------------


class SubjectPersonCreate(BaseModel):
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    matter_ids: list[str] = Field(default_factory=list)
    date_of_birth: date | None = None
    identifiers: dict[str, Any] = Field(default_factory=dict)
    notes: str = ""


class SubjectPersonResponse(BaseModel):
    id: str
    canonical_name: str
    aliases: list[str]
    matter_ids: list[str]
    created_at: datetime
    updated_at: datetime


class SubjectOrgCreate(BaseModel):
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    matter_ids: list[str] = Field(default_factory=list)
    registration_number: str = ""
    jurisdiction: str = ""
    org_type: str = ""
    identifiers: dict[str, Any] = Field(default_factory=dict)
    notes: str = ""


class SubjectOrgResponse(BaseModel):
    id: str
    canonical_name: str
    aliases: list[str]
    matter_ids: list[str]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Search models
# ---------------------------------------------------------------------------


class SearchRequest(BaseModel):
    model_config = {"use_enum_values": True}

    matter_id: str
    query: str
    limit: int = 10
    offset: int = 0
    source_types: list[SourceType] = Field(default_factory=list)


class SearchResponse(BaseModel):
    results: list[dict[str, Any]]
    total: int
    query: str
    matter_id: str
    limit: int = 10
    offset: int = 0


# ---------------------------------------------------------------------------
# Timeline models
# ---------------------------------------------------------------------------


class TimelineEventCreate(BaseModel):
    matter_id: str
    event_date: datetime
    event_description: str
    event_type: str = ""
    source_document_id: str = ""
    subjects: list[str] = Field(default_factory=list)
    confidence: float = 1.0


class TimelineEventResponse(BaseModel):
    id: str
    matter_id: str
    event_date: datetime
    event_description: str
    confidence: float


# ---------------------------------------------------------------------------
# Report model
# ---------------------------------------------------------------------------


class IntelligenceReportResponse(BaseModel):
    model_config = {"use_enum_values": True}

    id: str
    matter_id: str
    report_type: ReportType
    report_json: dict[str, Any]
    generated_at: datetime
    version: int


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

__all__ = [
    # Enums
    "MatterStatus",
    "SourceType",
    "ReportType",
    # Matter
    "MatterCreate",
    "MatterResponse",
    # Evidence
    "EvidenceIngest",
    "EvidenceResponse",
    # Subject
    "SubjectPersonCreate",
    "SubjectPersonResponse",
    "SubjectOrgCreate",
    "SubjectOrgResponse",
    # Search
    "SearchRequest",
    "SearchResponse",
    # Timeline
    "TimelineEventCreate",
    "TimelineEventResponse",
    # Report
    "IntelligenceReportResponse",
]
