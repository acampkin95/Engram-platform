"""
Pydantic models for all 13 AI Memory MCP tool inputs and outputs.

These models provide type safety and validation when calling tools via
MemoryMCPClient. All response models use extra="allow" to be forward-compatible
with server changes.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

MemoryTier = Literal[1, 2, 3]
MemoryType = Literal[
    "fact",
    "insight",
    "code",
    "conversation",
    "document",
    "preference",
    "error_solution",
    "workflow",
]

_lenient = ConfigDict(extra="allow", populate_by_name=True)


class MemoryRecord(BaseModel):
    """A single memory record returned by the server."""

    model_config = _lenient

    memory_id: str
    content: str
    summary: str | None = None
    tier: int
    memory_type: str
    source: str
    project_id: str | None = None
    user_id: str | None = None
    tenant_id: str
    importance: float
    confidence: float
    tags: list[str] = Field(default_factory=list)
    created_at: str
    score: float | None = None

    def to_context_line(self) -> str:
        """Format the record as a single context line suitable for LLM prompts.

        Example output::

            [T2|insight|0.87] User prefers concise responses without preamble.
        """
        score_part = f"|{self.score:.2f}" if self.score is not None else ""
        return f"[T{self.tier}|{self.memory_type}{score_part}] {self.content}"


class EntityRecord(BaseModel):
    """A knowledge graph entity."""

    model_config = _lenient

    entity_id: str
    name: str
    entity_type: str
    description: str | None = None
    project_id: str | None = None
    tenant_id: str
    aliases: list[str] = Field(default_factory=list)
    created_at: str


class RelationRecord(BaseModel):
    """A knowledge graph relation."""

    model_config = _lenient

    relation_id: str
    source_entity_id: str
    target_entity_id: str
    relation_type: str
    weight: float
    project_id: str | None = None
    tenant_id: str
    context: str | None = None
    created_at: str


# ---------------------------------------------------------------------------
# Typed input model (for batch_add_memories)
# ---------------------------------------------------------------------------


class AddMemoryInput(BaseModel):
    """Typed input for a single memory in a batch operation.

    Use with batch_add_memories::

        from memory_system.mcp import AddMemoryInput
        inputs = [
            AddMemoryInput(content="User prefers dark mode", tier=2, memory_type="preference"),
            AddMemoryInput(content="Project uses FastAPI", tier=1, project_id="my-project"),
        ]
        result = await client.batch_add_memories(
            [m.model_dump(exclude_none=True) for m in inputs]
        )
    """

    model_config = ConfigDict(extra="ignore")

    content: str = Field(..., description="The text content to store")
    tier: int = Field(
        default=1, ge=1, le=3, description="Storage tier (1=project, 2=user, 3=global)"
    )
    memory_type: str = Field(default="fact", description="Semantic category of the memory")
    project_id: str | None = Field(
        default=None, description="Project identifier (required for tier 1)"
    )
    user_id: str | None = Field(default=None, description="User identifier")
    tenant_id: str = Field(default="default", description="Multi-tenancy identifier")
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="Relevance score 0–1")
    tags: list[str] | None = Field(default=None, description="Optional tags for categorisation")


# ---------------------------------------------------------------------------
# Memory tool results
# ---------------------------------------------------------------------------


class AddMemoryResult(BaseModel):
    """Result of add_memory."""

    model_config = _lenient

    success: bool
    memory_id: str
    tier: int
    message: str


class SearchMemoryResult(BaseModel):
    """Result of search_memory."""

    model_config = _lenient

    results: list[MemoryRecord] = Field(default_factory=list)
    query: str
    total: int

    def texts(self) -> list[str]:
        """Return the content strings of all results.

        Example::

            hits = await client.search_memory("user preferences")
            for text in hits.texts():
                print(text)
        """
        return [r.content for r in self.results]

    def top(self, n: int) -> list[MemoryRecord]:
        """Return the top-n results (already sorted by score descending).

        Args:
            n: Maximum number of results to return.

        Returns:
            List of up to n MemoryRecord objects.
        """
        return self.results[:n]

    def to_context(self, *, separator: str = "\n") -> str:
        """Format all results as a single context string for LLM prompts.

        Args:
            separator: String inserted between records (default: newline).

        Returns:
            Concatenated context lines via MemoryRecord.to_context_line().
        """
        return separator.join(r.to_context_line() for r in self.results)


class GetMemoryResult(BaseModel):
    """Result of get_memory.

    On success: memory fields are populated (memory_id, content, tier, …).
    On failure: error and memory_id are set, all other fields are None.
    """

    model_config = _lenient

    # Success fields (present when memory is found)
    memory_id: str
    content: str | None = None
    summary: str | None = None
    tier: int | None = None
    memory_type: str | None = None
    source: str | None = None
    project_id: str | None = None
    user_id: str | None = None
    tenant_id: str | None = None
    importance: float | None = None
    confidence: float | None = None
    tags: list[str] = Field(default_factory=list)
    created_at: str | None = None
    score: float | None = None

    # Error field (present when memory is NOT found)
    error: str | None = None

    @property
    def found(self) -> bool:
        """True if the memory was found."""
        return self.error is None and self.content is not None


class DeleteMemoryResult(BaseModel):
    """Result of delete_memory."""

    model_config = _lenient

    success: bool
    memory_id: str
    message: str


class MemoryTierStats(BaseModel):
    """Per-tier memory counts."""

    model_config = _lenient

    project: int = 0
    general: int = 0
    global_: int = Field(default=0, alias="global")


class MemoryOverview(BaseModel):
    """Statistics overview returned by list_memories."""

    model_config = _lenient

    total: int
    by_tier: MemoryTierStats
    by_type: dict[str, int] = Field(default_factory=dict)
    average_importance: str  # The server returns a formatted string ("0.72")


class ListMemoriesResult(BaseModel):
    """Result of list_memories."""

    model_config = _lenient

    overview: MemoryOverview


class BatchAddMemoriesResult(BaseModel):
    """Result of batch_add_memories."""

    model_config = _lenient

    success: bool
    memory_ids: list[str] = Field(default_factory=list)
    failed: int
    total: int
    message: str


class BuildContextResult(BaseModel):
    """Result of build_context."""

    model_config = _lenient

    success: bool
    query: str
    context: str
    token_estimate: int
    message: str


class RagQueryResult(BaseModel):
    """Result of rag_query."""

    model_config = _lenient

    success: bool
    query: str
    mode: str
    synthesis_prompt: str
    source_count: int
    context: dict[str, Any] = Field(default_factory=dict)
    message: str


class ConsolidateMemoriesResult(BaseModel):
    """Result of consolidate_memories."""

    model_config = _lenient

    success: bool
    processed: int
    message: str


class CleanupExpiredResult(BaseModel):
    """Result of cleanup_expired."""

    model_config = _lenient

    success: bool
    removed: int
    message: str


# ---------------------------------------------------------------------------
# Entity / Knowledge Graph tool results
# ---------------------------------------------------------------------------


class AddEntityResult(BaseModel):
    """Result of add_entity."""

    model_config = _lenient

    success: bool
    entity_id: str
    message: str


class AddRelationResult(BaseModel):
    """Result of add_relation.

    On success: success=True, relation_id is set.
    On failure: success=False, error is set.
    """

    model_config = _lenient

    success: bool
    relation_id: str | None = None
    message: str | None = None
    error: str | None = None


class QueryGraphResult(BaseModel):
    """Result of query_graph.

    On success: root_entity and graph data are populated.
    On failure: success=False, error is set.
    """

    model_config = _lenient

    # Success fields
    root_entity: str | None = None
    root_entity_id: str | None = None
    entities: list[EntityRecord] = Field(default_factory=list)
    relations: list[RelationRecord] = Field(default_factory=list)
    depth: int | None = None

    # Error field
    success: bool = True
    error: str | None = None

    @property
    def found(self) -> bool:
        """True if the entity was found."""
        return self.success and self.error is None
