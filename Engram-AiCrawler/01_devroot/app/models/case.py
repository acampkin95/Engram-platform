"""Case Management data models — Phase 5.

A Case is the top-level container for a PI/OSINT investigation.  It extends
the lightweight Investigation model with:

  - Evidence items    (files, URLs, text notes, images, exports)
  - Timeline events   (chronological log of investigator actions)
  - Linked entities   (EntityProfile IDs resolved during the investigation)
  - Phase outputs     (scan IDs, deep-crawl IDs, fraud report IDs, image intel IDs)
  - Structured tags   (for search/filter in case management UI)
  - Audit trail       (who did what, when)
"""

from __future__ import annotations

import uuid
from datetime import datetime, UTC
from enum import Enum

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11"""

        def __new__(cls, value):
            obj = str.__new__(cls, value)
            obj._value_ = value
            return obj


from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class CaseStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    UNDER_REVIEW = "under_review"
    CLOSED = "closed"
    ARCHIVED = "archived"


class CasePriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class EvidenceType(StrEnum):
    URL = "url"
    TEXT_NOTE = "text_note"
    IMAGE = "image"
    DOCUMENT = "document"
    SCAN_RESULT = "scan_result"
    CRAWL_RESULT = "crawl_result"
    FRAUD_REPORT = "fraud_report"
    IMAGE_INTEL = "image_intel"
    RELATIONSHIP_GRAPH = "relationship_graph"
    EXTERNAL_FILE = "external_file"


class TimelineEventType(StrEnum):
    CASE_CREATED = "case_created"
    CASE_UPDATED = "case_updated"
    CASE_CLOSED = "case_closed"
    ENTITY_ADDED = "entity_added"
    EVIDENCE_ADDED = "evidence_added"
    EVIDENCE_REMOVED = "evidence_removed"
    SCAN_STARTED = "scan_started"
    SCAN_COMPLETED = "scan_completed"
    CRAWL_STARTED = "crawl_started"
    CRAWL_COMPLETED = "crawl_completed"
    FRAUD_ANALYSIS_RUN = "fraud_analysis_run"
    IMAGE_ANALYSIS_RUN = "image_analysis_run"
    NOTE_ADDED = "note_added"
    TAG_ADDED = "tag_added"
    STATUS_CHANGED = "status_changed"
    EXPORT_GENERATED = "export_generated"
    INVESTIGATOR_ASSIGNED = "investigator_assigned"


# ---------------------------------------------------------------------------
# Component models
# ---------------------------------------------------------------------------


class EvidenceItem(BaseModel):
    """A single piece of evidence attached to a case."""

    evidence_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    evidence_type: EvidenceType
    title: str
    description: str | None = None
    # Payload — one of these will be set depending on type
    url: str | None = None  # For URL / image / scan / crawl types
    text_content: str | None = None  # For text notes / extracted content
    file_path: str | None = None  # For uploaded documents / files
    reference_id: str | None = None  # scan_id / crawl_id / graph_id etc.
    # Metadata
    source: str | None = None  # Which platform / service produced this
    tags: list[str] = Field(default_factory=list)
    is_key_evidence: bool = False  # Flagged as particularly significant
    added_by: str | None = None  # Investigator handle
    added_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    metadata: dict[str, Any] = Field(default_factory=dict)


class TimelineEvent(BaseModel):
    """A single timestamped event in the case timeline."""

    event_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    event_type: TimelineEventType
    title: str
    detail: str | None = None
    actor: str | None = None  # Investigator / system
    reference_id: str | None = None  # Related evidence / entity / scan ID
    occurred_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    metadata: dict[str, Any] = Field(default_factory=dict)


class CaseNote(BaseModel):
    """Free-text investigator note attached to a case."""

    note_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    content: str
    author: str | None = None
    is_flagged: bool = False  # Highlight for report inclusion
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class CaseSubject(BaseModel):
    """A person / organisation that is the subject of this case."""

    subject_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    display_name: str
    entity_id: str | None = None  # Link to EntityProfile
    role: str = "subject"  # subject | associate | witness | suspect
    notes: str | None = None
    added_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


# ---------------------------------------------------------------------------
# Case — top-level model
# ---------------------------------------------------------------------------


class Case(BaseModel):
    """Full OSINT investigation case."""

    # Identity
    case_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    case_number: str | None = None  # Human-readable reference (e.g. "CASE-2026-001")
    title: str
    description: str | None = None
    case_type: str = "general"  # skip_trace | fraud | fake_identity | pi_general
    status: CaseStatus = CaseStatus.DRAFT
    priority: CasePriority = CasePriority.MEDIUM

    # People
    subjects: list[CaseSubject] = Field(default_factory=list)
    investigator: str | None = None
    client_reference: str | None = None  # PI client reference number

    # Tags & classification
    tags: list[str] = Field(default_factory=list)
    jurisdiction: str | None = None

    # Linked phase outputs
    investigation_ids: list[str] = Field(default_factory=list)  # Legacy investigation links
    scan_ids: list[str] = Field(default_factory=list)
    deep_crawl_ids: list[str] = Field(default_factory=list)
    image_intel_entity_ids: list[str] = Field(default_factory=list)
    fraud_graph_ids: list[str] = Field(default_factory=list)
    entity_ids: list[str] = Field(default_factory=list)  # EntityProfile IDs

    # Evidence & notes
    evidence: list[EvidenceItem] = Field(default_factory=list)
    notes: list[CaseNote] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list)

    # Risk summary (copied from Phase 4 at time of assessment)
    risk_level: str | None = None
    risk_score: float | None = None
    fraud_probability: float | None = None

    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    closed_at: str | None = None

    # Exports
    exports: list[dict[str, Any]] = Field(default_factory=list)  # Export manifests

    def touch(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.now(UTC).isoformat()

    def add_timeline_event(
        self,
        event_type: TimelineEventType,
        title: str,
        detail: str | None = None,
        actor: str | None = None,
        reference_id: str | None = None,
        **metadata: Any,
    ) -> TimelineEvent:
        evt = TimelineEvent(
            event_type=event_type,
            title=title,
            detail=detail,
            actor=actor,
            reference_id=reference_id,
            metadata=metadata,
        )
        self.timeline.append(evt)
        self.touch()
        return evt

    def add_evidence(self, item: EvidenceItem, actor: str | None = None) -> None:
        self.evidence.append(item)
        self.add_timeline_event(
            TimelineEventType.EVIDENCE_ADDED,
            title=f"Evidence added: {item.title}",
            detail=item.description,
            actor=actor,
            reference_id=item.evidence_id,
        )

    def add_note(self, content: str, author: str | None = None) -> CaseNote:
        note = CaseNote(content=content, author=author)
        self.notes.append(note)
        self.add_timeline_event(
            TimelineEventType.NOTE_ADDED,
            title="Note added",
            actor=author,
            reference_id=note.note_id,
        )
        return note


# ---------------------------------------------------------------------------
# Request / response helpers
# ---------------------------------------------------------------------------


class CreateCaseRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(None, max_length=4000)
    case_type: str = "general"
    priority: CasePriority = CasePriority.MEDIUM
    investigator: str | None = None
    client_reference: str | None = None
    jurisdiction: str | None = None
    tags: list[str] = Field(default_factory=list)


class UpdateCaseRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = Field(None, max_length=4000)
    status: CaseStatus | None = None
    priority: CasePriority | None = None
    investigator: str | None = None
    client_reference: str | None = None
    jurisdiction: str | None = None
    tags: list[str] | None = None
    risk_level: str | None = None
    risk_score: float | None = None
    fraud_probability: float | None = None


class CaseSummary(BaseModel):
    """Lightweight case listing row."""

    case_id: str
    case_number: str | None
    title: str
    case_type: str
    status: CaseStatus
    priority: CasePriority
    investigator: str | None
    subject_count: int
    evidence_count: int
    risk_level: str | None
    risk_score: float | None
    created_at: str
    updated_at: str
