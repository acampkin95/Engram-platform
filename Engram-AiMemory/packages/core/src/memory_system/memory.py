"""
Memory data models and types.
"""

from __future__ import annotations

from datetime import UTC, datetime, timezone
from enum import Enum, StrEnum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class MemoryTier(int, Enum):
    """Memory tier levels."""

    PROJECT = 1  # Per-project isolated memory
    GENERAL = 2  # User-specific, cross-project memory
    GLOBAL = 3  # Shared bootstrap knowledge


class MemoryType(StrEnum):
    """Types of memory entries."""

    CONVERSATION = "conversation"
    DOCUMENT = "document"
    CODE = "code"
    INSIGHT = "insight"
    PREFERENCE = "preference"
    FACT = "fact"
    RELATIONSHIP = "relationship"
    ERROR_SOLUTION = "error_solution"
    WORKFLOW = "workflow"
    CONSOLIDATED = "consolidated"


class MemorySource(StrEnum):
    """Source of memory entry."""

    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"
    DOCUMENTATION = "documentation"
    EXTERNAL = "external"




class SourceType(StrEnum):
    AI_ASSISTANT = "ai_assistant"
    HUMAN_USER = "human_user"
    DOCUMENT_OCR = "document_ocr"
    API_INGESTION = "api_ingestion"
    SYSTEM_INFERENCE = "system_inference"


class ConfidenceFactors(BaseModel):
    """Individual components contributing to overall confidence score."""

    source_reliability: float = Field(ge=0.0, le=1.0, default=0.8)
    corroboration_score: float = Field(ge=0.0, le=1.0, default=0.0)
    temporal_freshness: float = Field(ge=0.0, le=1.0, default=1.0)
    semantic_coherence: float = Field(ge=0.0, le=1.0, default=1.0)
    user_feedback_score: float = Field(ge=0.0, le=1.0, default=0.5)


class MemoryModification(BaseModel):
    """Record of a modification to a memory."""

    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    modified_by: str
    modification_type: str
    previous_value: str | None = None
    new_value: str
    confidence_change: float | None = None
    reasoning: str | None = None


class ProvenanceRecord(BaseModel):
    """Track the origin and modification history of a memory."""

    origin: dict[str, Any] = Field(default_factory=dict)
    source_type: str = Field(default=SourceType.AI_ASSISTANT)
    source_identifier: str = Field(default="system")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    confidence_at_origin: float = Field(ge=0.0, le=1.0, default=0.5)
    raw_input: str | None = None



class TemporalResolution(StrEnum):
    EXACT = "exact"
    APPROXIMATE = "approximate"
    RELATIVE = "relative"
    UNKNOWN = "unknown"

class TemporalBounds(BaseModel):
    """Define the chronological bounds of an event memory."""
    start_time: datetime | None = None
    end_time: datetime | None = None
    resolution: str = Field(default=TemporalResolution.UNKNOWN)
    is_ongoing: bool = Field(default=False)
    relative_to: str | None = None  # ID of another memory this is relative to


class Memory(BaseModel):
    """A memory entry in the system."""

    id: UUID = Field(default_factory=uuid4, description="Unique memory ID")
    content: str = Field(..., min_length=1, description="Memory content")
    summary: str | None = Field(default=None, description="Optional summary")

    # Classification
    tier: MemoryTier = Field(default=MemoryTier.PROJECT, description="Memory tier")
    memory_type: MemoryType = Field(default=MemoryType.FACT, description="Type of memory")
    source: MemorySource = Field(default=MemorySource.AGENT, description="Source of memory")

    # Context
    project_id: str | None = Field(default=None, description="Project identifier for Tier 1")
    user_id: str | None = Field(default=None, description="User identifier")
    tenant_id: str = Field(default="default", description="Tenant identifier")
    session_id: str | None = Field(default=None, description="Session identifier")

    # Metadata
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="Importance score")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score")
    tags: list[str] = Field(default_factory=list, description="Tags for categorization")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    # Vector (populated after embedding)
    vector: list[float] | None = Field(default=None, description="Embedding vector")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = Field(default=None, description="Optional expiration")

    # Access tracking
    access_count: int = Field(default=0, ge=0, description="Number of times accessed in search")
    recency_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Recency decay score")

    # Embedding metadata
    embedding_model: str | None = Field(default=None, description="Model that generated the vector")
    embedding_dimension: int | None = Field(default=None, description="Vector dimension")
    last_accessed_at: datetime | None = Field(default=None, description="Last retrieval timestamp")
    decay_factor: float = Field(default=1.0, ge=0.0, le=1.0, description="Computed decay factor")
    canonical_id: str | None = Field(default=None, description="Points to canonical if this is a duplicate")
    is_canonical: bool = Field(default=True, description="True if this is the master version")
    rerank_score: float | None = Field(default=None, description="Reranker score (search results only)")

    # Relationships
    related_memory_ids: list[UUID] = Field(default_factory=list)
    parent_memory_id: UUID | None = Field(default=None)

    model_config = {"use_enum_values": True}



    # Advanced Integrity & Confidence Features
    overall_confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    confidence_factors: ConfidenceFactors = Field(default_factory=ConfidenceFactors)
    provenance: ProvenanceRecord = Field(default_factory=ProvenanceRecord)
    modification_history: list[MemoryModification] = Field(default_factory=list)
    
    # Contradiction tracking via Weaviate cross-references (stored as list of IDs initially)
    contradictions: list[str] = Field(default_factory=list)
    contradictions_resolved: bool = Field(default=False)
    is_deprecated: bool = Field(default=False)
    deprecated_by: str | None = None
    
    # Evidence tracking (cross-references)
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    contradicting_evidence_ids: list[str] = Field(default_factory=list)

    # Maintenance state
    last_contradiction_check: datetime | None = None
    last_confidence_update: datetime | None = None



    # Temporal & Event Modeling Features
    temporal_bounds: TemporalBounds | None = None
    is_event: bool = Field(default=False)
    cause_ids: list[str] = Field(default_factory=list)
    effect_ids: list[str] = Field(default_factory=list)


class MemorySearchResult(BaseModel):
    """A search result with relevance score."""

    memory: Memory
    score: float | None = Field(default=None, ge=0.0, description="Relevance score")
    distance: float | None = Field(default=None, description="Vector distance")
    similarity_score: float = Field(default=0.0, ge=0.0, le=1.0)
    recency_score: float = Field(default=0.0, ge=0.0, le=1.0)
    importance_score: float = Field(default=0.0, ge=0.0, le=1.0)
    composite_score: float = Field(default=0.0, ge=0.0)
    rerank_score: float | None = Field(default=None)
    rerank_position: int | None = Field(default=None)

class MemoryQuery(BaseModel):
    """Query parameters for memory search."""

    query: str = Field(..., min_length=1, description="Search query")
    tier: MemoryTier | None = Field(default=None, description="Filter by tier")
    memory_type: MemoryType | None = Field(default=None, description="Filter by type")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    tenant_id: str | None = Field(default=None, description="Filter by tenant")
    tags: list[str] | None = Field(default=None, description="Filter by tags")
    min_importance: float | None = Field(default=None, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    include_expired: bool = Field(default=False)
    # Temporal filters
    event_only: bool = Field(default=False)
    start_date: datetime | None = None
    end_date: datetime | None = None


class MemoryStats(BaseModel):
    """Statistics about stored memories."""

    total_memories: int = 0
    tier1_count: int = 0
    tier2_count: int = 0
    tier3_count: int = 0
    by_type: dict[str, int] = {}
    by_project: dict[str, int] = {}
    oldest_memory: datetime | None = None
    newest_memory: datetime | None = None
    avg_importance: float = 0.0


class MemoryAnalysis(BaseModel):
    """Analysis results for a memory from the self-management pipeline."""

    id: UUID = Field(default_factory=uuid4, description="Unique analysis ID")
    memory_id: UUID = Field(..., description="FK to the memory being analyzed")
    project_id: str = Field(default="default", description="Project context")
    tenant_id: str = Field(default="default", description="Tenant context")

    importance: float | None = Field(default=None, description="Auto-assigned importance")
    importance_reasoning: str | None = Field(
        default=None, description="LLM reasoning for importance"
    )

    contradicts: list[UUID] = Field(default_factory=list, description="Memory IDs this contradicts")
    similar_to: list[UUID] = Field(
        default_factory=list, description="Memory IDs this is similar to"
    )

    suggested_tags: list[str] = Field(default_factory=list, description="AI-suggested tags")

    analysis_method: str = Field(
        default="llm", description="How analysis was done: llm or heuristic"
    )

    analyzed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = {"use_enum_values": True}



class KnowledgeEntity(BaseModel):
    """An entity node in the knowledge graph."""

    id: UUID = Field(default_factory=uuid4, description="Unique entity ID")
    name: str = Field(..., min_length=1, description="Entity name")
    entity_type: str = Field(..., description="Type of entity (person, project, concept, tool, etc.)")
    description: str | None = Field(default=None, description="Optional description")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant identifier")
    aliases: list[str] = Field(default_factory=list, description="Alternative names")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = {"use_enum_values": True}


class KnowledgeRelation(BaseModel):
    """A directed relation edge between two knowledge graph entities."""

    id: UUID = Field(default_factory=uuid4, description="Unique relation ID")
    source_entity_id: UUID = Field(..., description="Source entity UUID (flat ID, not cross-reference)")
    target_entity_id: UUID = Field(..., description="Target entity UUID (flat ID, not cross-reference)")
    relation_type: str = Field(..., description="Relation type (works_on, depends_on, knows, uses, etc.)")
    weight: float = Field(default=1.0, ge=0.0, le=1.0, description="Relation strength (0-1)")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant identifier")
    context: str | None = Field(default=None, description="Optional context/description for the relation")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = {"use_enum_values": True}


class GraphQueryResult(BaseModel):
    """Result of a knowledge graph traversal query."""

    entity: KnowledgeEntity
    relations: list[KnowledgeRelation] = Field(default_factory=list)
    neighbors: list[KnowledgeEntity] = Field(default_factory=list)
    depth_reached: int = Field(default=0, ge=0, description="Actual traversal depth reached")


class MaintenanceTask(BaseModel):
    """A queued background maintenance task."""

    task_id: str = Field(default_factory=lambda: str(uuid4()))
    task_type: Literal[
        "summarize", "score_importance", "detect_contradictions",
        "consolidate", "extract_entities", "decay_update"
    ]
    memory_ids: list[str] = Field(default_factory=list)
    priority: int = Field(default=5, ge=1, le=10)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    status: Literal["pending", "running", "done", "failed"] = "pending"
    error: str | None = None
    model_config = {"use_enum_values": True}
