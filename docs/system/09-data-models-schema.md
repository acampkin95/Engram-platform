# 09 - Data Models and Schema Reference

> Engram Platform -- complete data model and storage schema reference.
> Last updated: 2026-03-31

---

## Table of Contents

1. [Weaviate Collections](#1-weaviate-collections)
2. [Redis Key Patterns](#2-redis-key-patterns)
3. [Core Data Models](#3-core-data-models)
4. [Investigation Models](#4-investigation-models)
5. [Admin Models](#5-admin-models)
6. [Configuration Model](#6-configuration-model)

---

## 1. Weaviate Collections

Weaviate is the primary vector database. All memory collections use multi-tenancy for data isolation.

### Memory Collections

Collection names are defined in `Engram-AiMemory/packages/core/src/memory_system/config.py`:

| Collection | Constant | Purpose |
|---|---|---|
| `MemoryProject` | `TIER1_COLLECTION` | Tier 1: Per-project isolated memory |
| `MemoryGeneral` | `TIER2_COLLECTION` | Tier 2: User-specific, cross-project memory |
| `MemoryGlobal` | `TIER3_COLLECTION` | Tier 3: Shared bootstrap knowledge |
| `MemoryEntity` | `ENTITY_COLLECTION` | Knowledge graph entity nodes |
| `MemoryRelation` | `RELATION_COLLECTION` | Knowledge graph relation edges |
| `MemoryAnalysis` | `ANALYSIS_COLLECTION` | Memory self-management analysis results |

**Memory collection properties** (all three tier collections share the same schema):

| Property | Weaviate Type | Description |
|---|---|---|
| `content` | text | Memory content (vectorized) |
| `summary` | text | Optional summary |
| `memory_type` | text | fact, insight, code, conversation, etc. |
| `source` | text | user, agent, system, documentation, external |
| `project_id` | text | Project scope identifier |
| `user_id` | text | User identifier |
| `tenant_id` | text | Multi-tenancy identifier |
| `session_id` | text | Session identifier |
| `importance` | number | 0.0 to 1.0 |
| `confidence` | number | 0.0 to 1.0 |
| `tags` | text[] | Categorization tags |
| `metadata` | text (JSON) | Serialized additional metadata |
| `access_count` | int | Number of times accessed in search |
| `recency_score` | number | 0.0 to 1.0, computed decay score |
| `decay_factor` | number | 0.0 to 2.0, combined decay factor |
| `embedding_model` | text | Model that generated the vector |
| `embedding_dimension` | int | Vector dimension |
| `last_accessed_at` | date | Last retrieval timestamp |
| `canonical_id` | text | Points to canonical if duplicate |
| `is_canonical` | boolean | True if master version |
| `overall_confidence` | number | 0.0 to 1.0, advanced confidence |
| `is_deprecated` | boolean | Whether superseded |
| `deprecated_by` | text | UUID of replacement memory |
| `is_event` | boolean | Whether this is a temporal event |
| `created_at` | date | Creation timestamp |
| `updated_at` | date | Last update timestamp |
| `expires_at` | date | Optional expiration timestamp |

**Entity collection properties** (`MemoryEntity`):

| Property | Weaviate Type | Description |
|---|---|---|
| `name` | text | Entity name (vectorized) |
| `entity_type` | text | person, project, concept, tool, etc. |
| `description` | text | Optional description |
| `project_id` | text | Project scope |
| `tenant_id` | text | Tenant identifier |
| `aliases` | text[] | Alternative names |
| `metadata` | text (JSON) | Serialized additional metadata |
| `created_at` | date | Creation timestamp |
| `updated_at` | date | Last update timestamp |

**Relation collection properties** (`MemoryRelation`):

| Property | Weaviate Type | Description |
|---|---|---|
| `source_entity_id` | text (UUID) | Source entity UUID |
| `target_entity_id` | text (UUID) | Target entity UUID |
| `relation_type` | text | works_on, depends_on, knows, uses, etc. |
| `weight` | number | 0.0 to 1.0, relation strength |
| `project_id` | text | Project scope |
| `tenant_id` | text | Tenant identifier |
| `context` | text | Optional relation context |
| `created_at` | date | Creation timestamp |

### Investigation Collections

| Collection | Constant | Purpose |
|---|---|---|
| `InvestigationMatter` | `INVESTIGATION_MATTER` | Matter metadata (per-tenant) |
| `EvidenceDocument` | `EVIDENCE_DOCUMENT` | Chunked evidence documents (per-tenant) |
| `TimelineEvent` | `TIMELINE_EVENT` | Temporal events (per-tenant) |
| `IntelligenceReport` | `INTELLIGENCE_REPORT` | Generated reports (per-tenant) |
| `SubjectPerson` | `SUBJECT_PERSON` | Global person registry |
| `SubjectOrganisation` | `SUBJECT_ORGANISATION` | Global organisation registry |

Each investigation matter creates its own Weaviate tenant, providing complete data isolation between matters.

---

## 2. Redis Key Patterns

Redis is used for caching, API key storage, and audit logging. Key patterns are defined in `cache.py`, `key_manager.py`, and `audit.py`.

### Cache Keys

Defined in `RedisCache` class (`cache.py`):

| Prefix | Pattern | TTL | Description |
|---|---|---|---|
| `emb:` | `emb:{text_hash}` | 7 days | Cached embedding vectors |
| `search:` | `search:{query_hash}` | 1 hour | Cached search results |
| `search:` | `search:proj:{project_id}:idx` | 1 hour | Project-scoped search index |
| `mem:` | `mem:{tier}:{memory_id}` | 24 hours | Individual memory cache |
| `sess:` | `sess:{session_id}` | 4 hours | Session memory ID lists |
| `stats:` | `stats:{tenant_id}` | 5 minutes | Tenant stats cache |

### API Key Storage

Defined in `KeyManager` class (`key_manager.py`):

| Key | Type | Description |
|---|---|---|
| `engram:api_keys:{key_id}` | Hash | API key metadata (id, name, key_hash, prefix, status, etc.) |
| `engram:api_keys:index` | Set | Index of all key IDs for enumeration |

Key ID format: `ek_` prefix followed by 16 hex characters (e.g., `ek_a1b2c3d4e5f6a7b8`).

### Audit Log

Defined in `AuditLogger` class (`audit.py`):

| Key | Type | Max Entries | Description |
|---|---|---|---|
| `engram:audit_log` | Stream | 10,000 | Redis Stream of API request audit entries |

---

## 3. Core Data Models

All models are defined in `Engram-AiMemory/packages/core/src/memory_system/memory.py` using Pydantic v2.

### Memory

The central data model. Source: `memory.py` class `Memory`.

```python
class Memory(BaseModel):
    # Identity
    id: UUID                          # default: uuid4()
    content: str                      # min_length=1, the memory text
    summary: str | None               # optional summary

    # Classification
    tier: MemoryTier                  # PROJECT (1), GENERAL (2), GLOBAL (3)
    memory_type: MemoryType           # fact, insight, code, conversation, etc.
    source: MemorySource              # user, agent, system, documentation, external

    # Context
    project_id: str | None            # project scope for Tier 1
    user_id: str | None               # user identifier
    tenant_id: str                    # default: "default"
    session_id: str | None            # session identifier

    # Scoring
    importance: float                 # 0.0 to 1.0, default: 0.5
    confidence: float                 # 0.0 to 1.0, default: 1.0
    tags: list[str]                   # categorization tags
    metadata: dict[str, Any]          # arbitrary metadata

    # Vector
    vector: list[float] | None        # embedding vector (populated after embed)

    # Timestamps
    created_at: datetime              # UTC creation time
    updated_at: datetime              # UTC last update
    expires_at: datetime | None       # optional TTL

    # Access tracking
    access_count: int                 # times accessed in search, default: 0
    recency_score: float              # 0.0-1.0, decay score, default: 1.0

    # Embedding metadata
    embedding_model: str | None       # model name that generated vector
    embedding_dimension: int | None   # vector dimension
    last_accessed_at: datetime | None # last retrieval timestamp
    decay_factor: float               # 0.0-2.0, combined decay, default: 1.0

    # Deduplication
    canonical_id: str | None          # points to canonical if duplicate
    is_canonical: bool                # True if master version, default: True
    rerank_score: float | None        # reranker score (search only)

    # Relationships
    related_memory_ids: list[UUID]    # related memory IDs
    parent_memory_id: UUID | None     # parent memory ID

    # Advanced confidence
    overall_confidence: float         # 0.0-1.0, default: 0.5
    confidence_factors: ConfidenceFactors  # component scores
    provenance: ProvenanceRecord      # origin tracking
    modification_history: list[MemoryModification]  # change log

    # Contradiction tracking
    contradictions: list[str]         # IDs of contradicting memories
    contradictions_resolved: bool     # default: False
    is_deprecated: bool               # default: False
    deprecated_by: str | None         # UUID of replacement

    # Evidence tracking
    supporting_evidence_ids: list[str]
    contradicting_evidence_ids: list[str]

    # Maintenance state
    last_contradiction_check: datetime | None
    last_confidence_update: datetime | None

    # Temporal modeling
    temporal_bounds: TemporalBounds | None
    is_event: bool                    # default: False
    cause_ids: list[str]              # causal predecessors
    effect_ids: list[str]             # causal successors
```

**Example (JSON)**:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "content": "The Memory API uses Weaviate 1.27 with multi-tenancy enabled for data isolation.",
  "summary": null,
  "tier": 1,
  "memory_type": "fact",
  "source": "agent",
  "project_id": "engram-platform",
  "user_id": "user-123",
  "tenant_id": "default",
  "session_id": "sess-abc",
  "importance": 0.8,
  "confidence": 1.0,
  "tags": ["architecture", "weaviate"],
  "metadata": { "context": "architecture review" },
  "vector": null,
  "created_at": "2026-03-31T14:22:00Z",
  "updated_at": "2026-03-31T14:22:00Z",
  "expires_at": null,
  "access_count": 5,
  "recency_score": 0.95,
  "embedding_model": "nomic-embed-text-v1.5",
  "embedding_dimension": 768,
  "last_accessed_at": "2026-03-31T12:00:00Z",
  "decay_factor": 1.3,
  "canonical_id": null,
  "is_canonical": true,
  "rerank_score": null,
  "related_memory_ids": [],
  "parent_memory_id": null,
  "overall_confidence": 0.8,
  "confidence_factors": {
    "source_reliability": 0.8,
    "corroboration_score": 0.5,
    "temporal_freshness": 1.0,
    "semantic_coherence": 1.0,
    "user_feedback_score": 0.5
  },
  "provenance": {
    "origin": {},
    "source_type": "ai_assistant",
    "source_identifier": "system",
    "timestamp": "2026-03-31T14:22:00Z",
    "confidence_at_origin": 0.5,
    "raw_input": null
  },
  "modification_history": [],
  "contradictions": [],
  "contradictions_resolved": false,
  "is_deprecated": false,
  "deprecated_by": null,
  "supporting_evidence_ids": [],
  "contradicting_evidence_ids": [],
  "last_contradiction_check": null,
  "last_confidence_update": null,
  "temporal_bounds": null,
  "is_event": false,
  "cause_ids": [],
  "effect_ids": []
}
```

### Enums

#### MemoryTier

```python
class MemoryTier(int, Enum):
    PROJECT = 1   # Per-project isolated memory
    GENERAL = 2   # User-specific, cross-project
    GLOBAL = 3    # Shared bootstrap knowledge
```

#### MemoryType

```python
class MemoryType(StrEnum):
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
```

#### MemorySource

```python
class MemorySource(StrEnum):
    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"
    DOCUMENTATION = "documentation"
    EXTERNAL = "external"
```

#### SourceType (Provenance)

```python
class SourceType(StrEnum):
    AI_ASSISTANT = "ai_assistant"
    HUMAN_USER = "human_user"
    DOCUMENT_OCR = "document_ocr"
    API_INGESTION = "api_ingestion"
    SYSTEM_INFERENCE = "system_inference"
```

### ConfidenceFactors

Component scores contributing to overall confidence. Source: `memory.py` class `ConfidenceFactors`.

```python
class ConfidenceFactors(BaseModel):
    source_reliability: float     # 0.0-1.0, default: 0.8
    corroboration_score: float    # 0.0-1.0, default: 0.0
    temporal_freshness: float     # 0.0-1.0, default: 1.0
    semantic_coherence: float     # 0.0-1.0, default: 1.0
    user_feedback_score: float    # 0.0-1.0, default: 0.5
```

### ProvenanceRecord

Origin and modification history tracker. Source: `memory.py` class `ProvenanceRecord`.

```python
class ProvenanceRecord(BaseModel):
    origin: dict[str, Any]        # arbitrary origin metadata
    source_type: str              # SourceType enum value
    source_identifier: str        # default: "system"
    timestamp: datetime           # creation timestamp
    confidence_at_origin: float   # 0.0-1.0, default: 0.5
    raw_input: str | None         # original input text
```

### MemoryModification

Record of a modification to a memory. Source: `memory.py` class `MemoryModification`.

```python
class MemoryModification(BaseModel):
    timestamp: datetime           # when the modification occurred
    modified_by: str              # who/what modified it
    modification_type: str        # type of modification
    previous_value: str | None    # before value
    new_value: str                # after value
    confidence_change: float | None  # how confidence changed
    reasoning: str | None         # why the modification was made
```

**Example**:

```json
{
  "timestamp": "2026-03-31T15:00:00Z",
  "modified_by": "consolidation_worker",
  "modification_type": "merge",
  "previous_value": "Original content text",
  "new_value": "Merged and consolidated content",
  "confidence_change": 0.1,
  "reasoning": "Merged with 2 similar memories for deduplication"
}
```

### TemporalBounds

Chronological bounds for event memories. Source: `memory.py` class `TemporalBounds`.

```python
class TemporalBounds(BaseModel):
    start_time: datetime | None    # event start
    end_time: datetime | None      # event end
    resolution: str                # exact, approximate, relative, unknown
    is_ongoing: bool               # default: False
    relative_to: str | None        # ID of reference memory
```

### KnowledgeEntity

Knowledge graph entity node. Source: `memory.py` class `KnowledgeEntity`.

```python
class KnowledgeEntity(BaseModel):
    id: UUID                       # default: uuid4()
    name: str                      # min_length=1, entity name
    entity_type: str               # person, project, concept, tool, etc.
    description: str | None        # optional description
    project_id: str | None         # project scope
    tenant_id: str                 # default: "default"
    aliases: list[str]             # alternative names
    metadata: dict[str, Any]       # additional metadata
    created_at: datetime           # creation timestamp
    updated_at: datetime           # last update timestamp
```

**Example**:

```json
{
  "id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
  "name": "Weaviate",
  "entity_type": "tool",
  "description": "Vector database for memory storage with multi-tenancy",
  "project_id": "engram-platform",
  "tenant_id": "default",
  "aliases": ["weaviate-db", "weaviate-vector-db"],
  "metadata": { "version": "1.27.0", "url": "http://localhost:8080" },
  "created_at": "2026-03-31T14:22:00Z",
  "updated_at": "2026-03-31T14:22:00Z"
}
```

### KnowledgeRelation

Directed relation edge between entities. Source: `memory.py` class `KnowledgeRelation`.

```python
class KnowledgeRelation(BaseModel):
    id: UUID                       # default: uuid4()
    source_entity_id: UUID         # source entity UUID
    target_entity_id: UUID         # target entity UUID
    relation_type: str             # works_on, depends_on, knows, uses, etc.
    weight: float                  # 0.0-1.0, default: 1.0
    project_id: str | None         # project scope
    tenant_id: str                 # default: "default"
    context: str | None            # optional description
    created_at: datetime           # creation timestamp
```

**Example**:

```json
{
  "id": "r1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "source_entity_id": "e1f2a3b4-...",
  "target_entity_id": "f2a3b4c5-...",
  "relation_type": "depends_on",
  "weight": 0.9,
  "project_id": "engram-platform",
  "tenant_id": "default",
  "context": "Memory API requires Weaviate for vector storage",
  "created_at": "2026-03-31T14:22:00Z"
}
```

### GraphQueryResult

Result of a knowledge graph BFS traversal. Source: `memory.py` class `GraphQueryResult`.

```python
class GraphQueryResult(BaseModel):
    entity: KnowledgeEntity        # root entity
    relations: list[KnowledgeRelation]  # discovered relations
    neighbors: list[KnowledgeEntity]    # discovered neighbor entities
    depth_reached: int             # actual traversal depth (0+)
```

### MemorySearchResult

A search result with composite scoring. Source: `memory.py` class `MemorySearchResult`.

```python
class MemorySearchResult(BaseModel):
    memory: Memory                 # the matched memory
    score: float | None            # relevance score
    distance: float | None         # vector distance
    similarity_score: float        # 0.0-1.0
    recency_score: float           # 0.0-1.0
    importance_score: float        # 0.0-1.0
    composite_score: float         # weighted combination
    rerank_score: float | None     # cross-encoder rerank score
    rerank_position: int | None    # position after reranking
```

### MemoryStats

System statistics. Source: `memory.py` class `MemoryStats`.

```python
class MemoryStats(BaseModel):
    total_memories: int            # default: 0
    tier1_count: int               # default: 0
    tier2_count: int               # default: 0
    tier3_count: int               # default: 0
    by_type: dict[str, int]        # count per memory type
    by_project: dict[str, int]     # count per project
    oldest_memory: datetime | None
    newest_memory: datetime | None
    avg_importance: float          # default: 0.0
```

### MemoryAnalysis

Self-management analysis result. Source: `memory.py` class `MemoryAnalysis`.

```python
class MemoryAnalysis(BaseModel):
    id: UUID                       # analysis ID
    memory_id: UUID                # FK to analyzed memory
    project_id: str                # default: "default"
    tenant_id: str                 # default: "default"
    importance: float | None       # auto-assigned importance
    importance_reasoning: str | None  # LLM reasoning
    contradicts: list[UUID]        # memory IDs this contradicts
    similar_to: list[UUID]         # memory IDs this resembles
    suggested_tags: list[str]      # AI-suggested tags
    analysis_method: str           # "llm" or "heuristic"
    analyzed_at: datetime          # analysis timestamp
```

### MaintenanceTask

Background maintenance task. Source: `memory.py` class `MaintenanceTask`.

```python
class MaintenanceTask(BaseModel):
    task_id: str                   # UUID string
    task_type: Literal[
        "summarize",
        "score_importance",
        "detect_contradictions",
        "consolidate",
        "extract_entities",
        "decay_update",
    ]
    memory_ids: list[str]          # target memory IDs
    priority: int                  # 1-10, default: 5
    created_at: datetime
    status: Literal["pending", "running", "done", "failed"]
    error: str | None
```

---

## 4. Investigation Models

All investigation models are defined in `Engram-AiMemory/packages/core/src/memory_system/investigation/models.py`.

### MatterCreate (Request)

```python
class MatterCreate(BaseModel):
    matter_id: str                 # unique identifier (e.g., "CASE-2026-001")
    title: str                     # human-readable title
    description: str               # default: ""
    tags: list[str]                # default: []
    lead_investigator: str         # default: ""
```

### MatterResponse

```python
class MatterResponse(BaseModel):
    matter_id: str
    title: str
    description: str
    status: MatterStatus           # ACTIVE, CLOSED, ARCHIVED
    created_at: datetime
    tags: list[str]
    lead_investigator: str
    id: str                        # Weaviate UUID
```

**Example**:

```json
{
  "matter_id": "CASE-2026-001",
  "title": "Infrastructure Audit Q1",
  "description": "Review of production infrastructure",
  "status": "ACTIVE",
  "created_at": "2026-03-31T14:22:00Z",
  "tags": ["audit", "infrastructure"],
  "lead_investigator": "admin",
  "id": "weaviate-uuid-here"
}
```

### MatterStatus (Enum)

```python
class MatterStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    ARCHIVED = "ARCHIVED"
```

### EvidenceIngest (Request)

```python
class EvidenceIngest(BaseModel):
    matter_id: str
    content: str                   # document content
    source_url: str                # default: ""
    source_type: SourceType        # PDF, EMAIL, CSV, WEB, MANUAL
    metadata: dict[str, Any]       # default: {}
    page_number: int               # default: 0
    message_id: str                # default: ""
```

### EvidenceResponse

```python
class EvidenceResponse(BaseModel):
    id: str                        # chunk UUID
    matter_id: str
    source_url: str
    source_type: SourceType
    chunk_index: int
    ingested_at: datetime
```

### SourceType (Investigation)

```python
class SourceType(StrEnum):
    PDF = "PDF"
    EMAIL = "EMAIL"
    CSV = "CSV"
    WEB = "WEB"
    MANUAL = "MANUAL"
```

### SubjectPersonCreate (Request)

```python
class SubjectPersonCreate(BaseModel):
    canonical_name: str
    aliases: list[str]             # default: []
    matter_ids: list[str]          # default: []
    date_of_birth: date | None     # default: None
    identifiers: dict[str, Any]    # default: {}
    notes: str                     # default: ""
```

### SubjectPersonResponse

```python
class SubjectPersonResponse(BaseModel):
    id: str
    canonical_name: str
    aliases: list[str]
    matter_ids: list[str]
    created_at: datetime
    updated_at: datetime
```

### SubjectOrgCreate (Request)

```python
class SubjectOrgCreate(BaseModel):
    canonical_name: str
    aliases: list[str]             # default: []
    matter_ids: list[str]          # default: []
    registration_number: str       # default: ""
    jurisdiction: str              # default: ""
    org_type: str                  # default: ""
    identifiers: dict[str, Any]    # default: {}
    notes: str                     # default: ""
```

### SubjectOrgResponse

```python
class SubjectOrgResponse(BaseModel):
    id: str
    canonical_name: str
    aliases: list[str]
    matter_ids: list[str]
    created_at: datetime
    updated_at: datetime
```

### TimelineEventCreate (Request)

```python
class TimelineEventCreate(BaseModel):
    matter_id: str
    event_date: datetime
    event_description: str
    event_type: str                # default: ""
    source_document_id: str        # default: ""
    subjects: list[str]            # default: []
    confidence: float              # default: 1.0
```

### TimelineEventResponse

```python
class TimelineEventResponse(BaseModel):
    id: str
    matter_id: str
    event_date: datetime
    event_description: str
    confidence: float
```

### IntelligenceReportResponse

```python
class IntelligenceReportResponse(BaseModel):
    id: str
    matter_id: str
    report_type: ReportType        # ENTITY_SUMMARY, TIMELINE_SUMMARY, CONTRADICTION_SUMMARY, FULL
    report_json: dict[str, Any]
    generated_at: datetime
    version: int
```

### ReportType (Enum)

```python
class ReportType(StrEnum):
    ENTITY_SUMMARY = "ENTITY_SUMMARY"
    TIMELINE_SUMMARY = "TIMELINE_SUMMARY"
    CONTRADICTION_SUMMARY = "CONTRADICTION_SUMMARY"
    FULL = "FULL"
```

---

## 5. Admin Models

### API Key (Redis Hash)

Stored at `engram:api_keys:{key_id}`. Defined in `key_manager.py`.

| Field | Type | Description |
|---|---|---|
| `id` | string | Key ID (format: `ek_` + 16 hex chars) |
| `name` | string | Human-readable name (max 100 chars) |
| `key_hash` | string | SHA-256 hash of the raw key (never exposed via API) |
| `prefix` | string | Masked key preview: first 8 chars + `...` + last 4 chars |
| `created_at` | string (ISO) | Creation timestamp |
| `created_by` | string | Who created the key (e.g., `"admin"`, `"system (env migration)"`) |
| `last_used_at` | string (ISO) | Last usage timestamp (empty if never used) |
| `status` | string | `"active"` or `"revoked"` |
| `request_count` | string (int) | Total requests made with this key |
| `source` | string | `"api"` (created via endpoint) or `"env"` (migrated from env var) |

**Example (as stored in Redis)**:

```
HGETALL engram:api_keys:ek_a1b2c3d4e5f6a7b8
 1) "id"
 2) "ek_a1b2c3d4e5f6a7b8"
 3) "name"
 4) "Production MCP Server"
 5) "key_hash"
 6) "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 7) "prefix"
 8) "AbCdEfGh...wxYz"
 9) "created_at"
10) "2026-03-20T10:00:00+00:00"
11) "created_by"
12) "admin"
13) "last_used_at"
14) "2026-03-31T14:00:00+00:00"
15) "status"
16) "active"
17) "request_count"
18) "1542"
19) "source"
20) "api"
```

### Audit Log Entry (Redis Stream)

Stored in the `engram:audit_log` Redis Stream. Defined in `audit.py`.

| Field | Type | Description |
|---|---|---|
| `timestamp` | string (ISO) | When the request occurred |
| `key_id` | string | API key ID (if identified) |
| `key_name` | string | API key name (if identified) |
| `identity` | string | Auth identity (e.g., `"apikey:AbCd..."`, `"jwt"`) |
| `method` | string | HTTP method (GET, POST, DELETE, etc.) |
| `path` | string | Request path (e.g., `/memories/search`) |
| `status_code` | string (int) | HTTP response status code |
| `ip` | string | Client IP address |
| `latency_ms` | string (float) | Request latency in milliseconds |
| `tenant_id` | string | Tenant context (default: `"default"`) |

**Example (Redis Stream entry)**:

```
XREVRANGE engram:audit_log + - COUNT 1
1) 1) "1711900920000-0"
   2)  1) "timestamp"
       2) "2026-03-31T14:22:00+00:00"
       3) "key_id"
       4) ""
       5) "key_name"
       6) ""
       7) "identity"
       8) "apikey:AbCd..."
       9) "method"
      10) "POST"
      11) "path"
      12) "/memories"
      13) "status_code"
      14) "200"
      15) "ip"
      16) "127.0.0.1"
      17) "latency_ms"
      18) "12.5"
      19) "tenant_id"
      20) "default"
```

Stream is capped at `MAX_ENTRIES = 10000` with approximate trimming.

---

## 6. Configuration Model

The `Settings` class in `config.py` loads all configuration from environment variables using pydantic-settings.

### Weaviate Configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `WEAVIATE_URL` | string | `http://localhost:8080` | Weaviate HTTP URL |
| `WEAVIATE_GRPC_URL` | string | `http://localhost:50051` | Weaviate gRPC URL |
| `WEAVIATE_API_KEY` | string | null | Weaviate API key |

### Redis Configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `REDIS_URL` | string | `redis://localhost:6379` | Redis connection URL |
| `REDIS_PASSWORD` | string | null | Redis password |

### Embedding Configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `EMBEDDING_PROVIDER` | string | `nomic` | openai, local, ollama, nomic, deepinfra |
| `OPENAI_API_KEY` | string | null | OpenAI API key |
| `OPENAI_BASE_URL` | string | null | OpenAI-compatible base URL |
| `EMBEDDING_MODEL` | string | `text-embedding-3-small` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | int | 768 | Vector dimensions (128-4096) |

### LLM Configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | string | `openai` | openai, anthropic, local, deepinfra |
| `LLM_MODEL` | string | `gpt-4o-mini` | LLM model name |

### Consolidation

| Variable | Type | Default | Description |
|---|---|---|---|
| `CONSOLIDATION_MIN_GROUP_SIZE` | int | 3 | Min memories in group to consolidate |
| `CONSOLIDATION_HOURS_BACK` | int | 48 | Hours back to search for candidates |
| `CONSOLIDATION_CONFIDENCE` | float | 0.7 | Confidence for consolidated memories |

### RAG Configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `RAG_MAX_CONTEXT_TOKENS` | int | 4000 | Max tokens for RAG context |
| `RAG_DEFAULT_LIMIT` | int | 5 | Default memories for RAG retrieval (1-50) |
| `RAG_SYNTHESIS_PROMPT` | string | *(see source)* | Default synthesis prompt |

### Memory Configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `DEFAULT_MEMORY_TIER` | int | 1 | Default tier (1-3) |
| `MAX_MEMORY_SIZE_MB` | int | 100 | Max memory size per project |
| `MEMORY_RETENTION_DAYS` | int | 90 | Retention period |

### Search Scoring

| Variable | Type | Default | Description |
|---|---|---|---|
| `SEARCH_SIMILARITY_WEIGHT` | float | 0.4 | Similarity weight (sum must = 1.0) |
| `SEARCH_RECENCY_WEIGHT` | float | 0.3 | Recency weight |
| `SEARCH_IMPORTANCE_WEIGHT` | float | 0.3 | Importance weight |

### Decay

| Variable | Type | Default | Description |
|---|---|---|---|
| `DECAY_HALF_LIFE_DAYS` | float | 30.0 | Days until importance halves |
| `DECAY_ACCESS_BOOST` | float | 0.1 | Importance boost per access |
| `DECAY_MIN_IMPORTANCE` | float | 0.1 | Minimum importance floor |

### Retrieval

| Variable | Type | Default | Description |
|---|---|---|---|
| `SEARCH_RETRIEVAL_MODE` | string | `vector` | `vector` or `hybrid` |
| `HYBRID_ALPHA` | float | 0.7 | Hybrid alpha: 0=keyword, 1=vector |
| `RERANKER_ENABLED` | bool | false | Enable cross-encoder reranking |
| `RERANKER_MODEL` | string | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Reranker model |
| `RERANKER_TOP_K` | int | 20 | Candidates before reranking (1-100) |

### Ollama / LM Studio

| Variable | Type | Default | Description |
|---|---|---|---|
| `LM_STUDIO_URL` | string | null | LM Studio API URL |
| `OLLAMA_HOST` | string | null | Ollama API host |
| `OLLAMA_MAINTENANCE_MODEL` | string | `liquid/lfm2.5:1.2b` | Summarization model |
| `OLLAMA_CLASSIFIER_MODEL` | string | `qwen2.5:0.5b-instruct` | Scoring model |
| `OLLAMA_REQUEST_TIMEOUT` | int | 30 | Request timeout (seconds) |

### DeepInfra

| Variable | Type | Default | Description |
|---|---|---|---|
| `DEEPINFRA_API_KEY` | string | null | DeepInfra API key |
| `DEEPINFRA_CHAT_MODEL` | string | `meta-llama/Meta-Llama-3.1-8B-Instruct` | Chat model |
| `DEEPINFRA_EMBED_MODEL` | string | `BAAI/bge-m3` | Embedding model (768d) |

### Feature Flags

| Variable | Type | Default | Description |
|---|---|---|---|
| `AUTO_IMPORTANCE_ENABLED` | bool | false | LLM auto-importance scoring on add |
| `AUTO_IMPORTANCE_THRESHOLD` | float | 0.7 | Min auto-importance to apply |
| `CONTRADICTION_DETECTION_ENABLED` | bool | false | Detect contradictions on add |
| `CONTRADICTION_ACTION` | string | `flag` | flag, merge, or reject |
| `DEDUPLICATION_ENABLED` | bool | false | Semantic deduplication on add |
| `DEDUPLICATION_THRESHOLD` | float | 0.92 | Similarity threshold |
| `DEDUPLICATION_ACTION` | string | `skip` | skip, update, or merge |

### Multi-tenancy

| Variable | Type | Default | Description |
|---|---|---|---|
| `MULTI_TENANCY_ENABLED` | bool | true | Enable Weaviate multi-tenancy |
| `DEFAULT_TENANT_ID` | string | `default` | Default tenant identifier |
| `CLEAN_SCHEMA_MIGRATION` | bool | false | Drop and recreate all collections (destructive) |

### Security

| Variable | Type | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | string | **required** | JWT secret key (generate: `openssl rand -hex 32`) |
| `JWT_EXPIRE_HOURS` | int | 24 | JWT token expiry (hours) |
| `API_KEYS` | string | `""` | Comma-separated API keys (migrated to Redis on startup) |
| `ADMIN_USERNAME` | string | `admin` | Dashboard admin username |
| `ADMIN_PASSWORD_HASH` | string | null | bcrypt hash (null = login disabled) |
| `RATE_LIMIT_PER_MINUTE` | int | 100 | Requests per minute per IP |

### CORS

| Variable | Type | Default | Description |
|---|---|---|---|
| `CORS_ORIGINS` | string | `http://localhost:3001` | Comma-separated allowed origins |

### Logging

| Variable | Type | Default | Description |
|---|---|---|---|
| `LOG_LEVEL` | string | `INFO` | DEBUG, INFO, WARNING, ERROR |
| `LOG_FORMAT` | string | `json` | json or text |

---

*Document 09 of the Engram Platform System Documentation.*
