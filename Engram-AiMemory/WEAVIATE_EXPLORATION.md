# Weaviate Integration Exploration — Engram-AiMemory

**Generated:** 2026-03-14  
**Scope:** Comprehensive mapping of Weaviate client, schema, operations, and test coverage

---

## 1. KEY FILES & PURPOSES

### Core Weaviate Client
| File | LOC | Purpose |
|------|-----|---------|
| `packages/core/src/memory_system/client.py` | 1243 | **Main WeaviateMemoryClient** — 3-tier memory schema, CRUD, search, tenant mgmt |
| `packages/core/src/memory_system/update_weaviate_schema.py` | ~150 | Schema migration script (destructive clean migration) |
| `packages/core/src/memory_system/config.py` | ~300 | Settings validation, collection name constants, Weaviate URL parsing |

### Investigation Module (Multi-Tenant)
| File | LOC | Purpose |
|------|-----|---------|
| `packages/core/src/memory_system/investigation/matter_client.py` | 268 | **MatterClient** — atomic matter/case lifecycle, tenant creation with rollback |
| `packages/core/src/memory_system/investigation/evidence_client.py` | 347 | **EvidenceClient** — document ingestion, chunking, semantic search |
| `packages/core/src/memory_system/investigation/registry_client.py` | 356 | **GlobalRegistryClient** — SubjectPerson/SubjectOrganisation (no multi-tenancy) |
| `packages/core/src/memory_system/investigation/schemas.py` | 412 | Schema definitions for 6 investigation collections |

### Test Files
| File | LOC | Type | Coverage |
|------|-----|------|----------|
| `packages/core/tests/test_weaviate_unit.py` | 349 | Unit (mocked) | 7 test classes, initialization/schema/CRUD/search/batch/error/tenant |
| `packages/core/tests/test_weaviate_live.py` | 358 | Integration (live) | 6 test classes, connection/schema/CRUD/search/health/errors |
| `packages/core/tests/test_weaviate_performance.py` | 252 | Performance | Benchmarks for bulk operations |

---

## 2. MAIN CLASSES & METHODS

### WeaviateMemoryClient (1243 LOC)

**Initialization & Connection:**
- `__init__(settings: Settings | None = None)` — Initialize with optional settings
- `async connect()` — Connect to Weaviate with retry logic (3 attempts, exponential backoff)
- `async close()` — Close connection
- `is_connected() -> bool` — Check connection status
- `@property client -> WeaviateClient` — Get underlying client (raises if not connected)

**Schema Management:**
- `async _ensure_schemas()` — Create 5 collections if missing (3 tiers + entity + relation)
- `async _drop_all_collections()` — Destructive: drop all managed collections
- `async _ensure_memory_tenant(tenant_id, collection_name)` — Create tenant in collection
- `async _ensure_graph_tenant(tenant_id)` — Create tenant in entity/relation collections

**Memory CRUD (3-Tier System):**
- `async add_memory(memory: Memory) -> UUID` — Insert memory with vector
- `async get_memory(memory_id: UUID, tier: MemoryTier, tenant_id: str | None) -> Memory | None`
- `async list_memories(tier: MemoryTier, tenant_id: str | None, limit: int, offset: int) -> list[Memory]`
- `async delete_memory(memory_id: UUID, tier: MemoryTier, tenant_id: str | None) -> bool`
- `async add_memories_batch(memories: list[Memory]) -> tuple[list[UUID], list]` — Bulk insert

**Search & Query:**
- `async search(query: MemoryQuery) -> MemorySearchResult` — Hybrid search (BM25 + vector)
- `async find_similar_memories_by_vector(vector, tier, tenant_id, project_id, threshold, limit) -> list[Memory]`
- `async find_consolidation_candidates(tier, tenant_id, project_id, limit, hours_back) -> list[Memory]`

**Graph Operations (Entity/Relation):**
- `async add_entity(entity: KnowledgeEntity) -> UUID`
- `async get_entity(entity_id: UUID, tenant_id: str | None) -> KnowledgeEntity | None`
- `async find_entity_by_name(name: str, tenant_id: str | None) -> KnowledgeEntity | None`
- `async list_entities(tenant_id: str | None, limit: int) -> list[KnowledgeEntity]`
- `async add_relation(relation: KnowledgeRelation) -> UUID`
- `async query_graph(entity_id: UUID, tenant_id: str | None, depth: int) -> GraphQueryResult`
- `async delete_entity(entity_id: UUID, tenant_id: str | None) -> bool`

**Maintenance & Analytics:**
- `async get_stats(tenant_id: str | None) -> MemoryStats` — Collection statistics
- `async increment_access_count(memory_id: UUID, tier: MemoryTier, tenant_id: str | None)`
- `async update_memory_fields(memory_id: UUID, tier: MemoryTier, updates: dict, tenant_id: str | None)`
- `async update_memory_metadata(memory_id: UUID, tier: MemoryTier, metadata: dict, tenant_id: str | None)`
- `async delete_expired_memories(tier: MemoryTier, tenant_id: str | None) -> int`

**Tenant Management:**
- `async create_tenant(tenant_id: str) -> bool` — Create tenant across all collections
- `async list_tenants() -> list[str]` — List all active tenants

**Internal Helpers:**
- `_memory_to_properties(memory: Memory) -> dict` — Convert Memory object to Weaviate properties
- `_obj_to_memory(obj, tier: MemoryTier) -> Memory` — Convert Weaviate object back to Memory
- `_parse_json_field(props: dict, key: str, default) -> dict | list` — Safe JSON parsing
- `_get_graph_collection(collection_name, tenant_id) -> Collection`

---

### MatterClient (268 LOC)

**Lifecycle Management:**
- `async create_matter(matter: MatterCreate) -> MatterResponse` — Atomic creation with tenant rollback
- `async get_matter(matter_id: str) -> MatterResponse | None`
- `async list_matters(status: MatterStatus | None) -> list[MatterResponse]`
- `async update_matter_status(matter_id: str, status: MatterStatus) -> MatterResponse`
- `async delete_matter(matter_id: str) -> bool`

**Tenant Management:**
- `_create_tenants_atomic(matter_id: str)` — Create tenant in 4 collections with rollback on failure
- `ensure_tenant_active(matter_id: str, collection_name: str)` — Ensure tenant is HOT

**Conversion:**
- `_obj_to_matter_response(obj) -> MatterResponse`

---

### EvidenceClient (347 LOC)

**Document Ingestion:**
- `async ingest_document(ingest: EvidenceIngest) -> list[EvidenceResponse]` — Chunk & insert document
- `async delete_document(matter_id: str, document_hash: str) -> int` — Delete all chunks

**Search:**
- `async search_evidence(search: SearchRequest) -> SearchResponse` — Semantic search across documents

**Retrieval:**
- `async get_document_chunks(matter_id, document_hash, chunk_index, limit) -> list[EvidenceResponse]`

**Internal:**
- `_split_content(content: str) -> list[str]` — Chunk document (configurable size)
- `async _document_exists(matter_id, document_hash) -> bool` — Check for duplicates

---

### GlobalRegistryClient (356 LOC)

**Person Management:**
- `async upsert_person(person: SubjectPersonCreate) -> SubjectPersonResponse` — Insert or update with dedup
- `async get_person(person_id: str) -> SubjectPersonResponse | None`
- `async list_persons(limit: int) -> list[SubjectPersonResponse]`
- `async delete_person(person_id: str) -> bool`

**Organisation Management:**
- `async upsert_organisation(org: SubjectOrgCreate) -> SubjectOrgResponse` — Insert or update with dedup
- `async get_organisation(org_id: str) -> SubjectOrgResponse | None`
- `async list_organisations(limit: int) -> list[SubjectOrgResponse]`
- `async delete_organisation(org_id: str) -> bool`

**Deduplication:**
- Uses `near_text` with certainty threshold (0.95) on canonical names
- Merges matter_ids and aliases on match

---

## 3. WEAVIATE SCHEMA STRUCTURE

### Memory Tiers (3 Collections)

**Collections:**
- `Tier1Memory` — Project-specific context
- `Tier2Memory` — Workspace-wide knowledge
- `Tier3Memory` — Universal system facts

**Common Properties (all tiers):**

| Property | Type | Filterable | Purpose |
|----------|------|-----------|---------|
| `content` | TEXT | — | Main memory content |
| `summary` | TEXT | — | Brief summary |
| `memory_type` | TEXT | ✓ | FACT, CONTEXT, INSIGHT, etc. |
| `source` | TEXT | — | Origin (URL, document, etc.) |
| `project_id` | TEXT | ✓ | Project scope |
| `user_id` | TEXT | ✓ | Creator/owner |
| `tenant_id` | TEXT | ✓ | Multi-tenant isolation |
| `session_id` | TEXT | — | Session context |
| `importance` | NUMBER | ✓ | 0.0–1.0 relevance score |
| `confidence` | NUMBER | ✓ | 0.0–1.0 certainty |
| `tags` | TEXT_ARRAY | ✓ | Categorical tags |
| `metadata` | TEXT | — | JSON stringified extra data |
| `created_at` | DATE | ✓ | Creation timestamp |
| `updated_at` | DATE | ✓ | Last update |
| `expires_at` | DATE | ✓ | Expiration (TTL) |
| `related_memory_ids` | TEXT_ARRAY | — | Cross-references |
| `parent_memory_id` | TEXT | ✓ | Hierarchical parent |
| `embedding_model` | TEXT | — | Model used for vector |
| `embedding_dimension` | INT | — | Vector dimensionality |
| `embedding_updated_at` | DATE | — | When vector was computed |
| `access_count` | INT | ✓ | Usage frequency |
| `last_accessed_at` | DATE | ✓ | Last read timestamp |
| `decay_factor` | NUMBER | — | Relevance decay multiplier |
| `canonical_id` | TEXT | ✓ | Deduplication reference |
| `is_canonical` | BOOL | ✓ | Is this the canonical version? |
| **Advanced Integrity** | | | |
| `overall_confidence` | NUMBER | ✓ | Aggregate confidence score |
| `confidence_factors` | TEXT | — | JSON: {source, recency, corroboration} |
| `provenance` | TEXT | — | JSON: {source, chain_of_custody} |
| `modification_history` | TEXT | — | JSON: [{timestamp, user, change}] |
| `contradictions` | TEXT_ARRAY | ✓ | IDs of contradicting memories |
| `contradictions_resolved` | BOOL | ✓ | Has contradiction been resolved? |
| `is_deprecated` | BOOL | ✓ | Marked as obsolete? |
| `deprecated_by` | TEXT | ✓ | ID of replacement memory |
| `supporting_evidence_ids` | TEXT_ARRAY | — | IDs of corroborating evidence |
| `contradicting_evidence_ids` | TEXT_ARRAY | — | IDs of conflicting evidence |
| `last_contradiction_check` | DATE | ✓ | When contradiction check ran |
| `last_confidence_update` | DATE | ✓ | When confidence was recalculated |

**Vectorizer:** text2vec_ollama (configurable model, default: mxbai-embed-large)

---

### Graph Collections (2 Collections)

**Entity Collection:**
- `name` (TEXT, vectorized) — Entity name
- `entity_type` (TEXT, filterable) — PERSON, ORGANIZATION, LOCATION, etc.
- `description` (TEXT) — Entity description
- `properties` (TEXT) — JSON stringified attributes
- `created_at` (DATE, filterable)
- `updated_at` (DATE, filterable)

**Relation Collection:**
- `source_entity_id` (TEXT, filterable) — From entity UUID
- `target_entity_id` (TEXT, filterable) — To entity UUID
- `relation_type` (TEXT, filterable) — KNOWS, WORKS_FOR, OWNS, etc.
- `confidence` (NUMBER, filterable) — 0.0–1.0
- `properties` (TEXT) — JSON stringified metadata
- `created_at` (DATE, filterable)

---

### Investigation Collections (6 Collections)

#### Multi-Tenant (4 collections, auto_tenant_creation=False)

**InvestigationMatter:**
- `matter_id` (TEXT) — Unique case identifier
- `title` (TEXT, vectorized) — Case title
- `description` (TEXT, vectorized) — Case description
- `status` (TEXT) — ACTIVE, CLOSED, ARCHIVED
- `created_at` (DATE)
- `tags` (TEXT_ARRAY)
- `lead_investigator` (TEXT)

**EvidenceDocument:**
- `matter_id` (TEXT) — Parent matter
- `source_url` (TEXT) — Document source
- `source_type` (TEXT) — PDF, EMAIL, WEB, etc.
- `content` (TEXT, vectorized) — Chunk content
- `chunk_index` (INT) — Position in document
- `total_chunks` (INT) — Total chunks for document
- `document_hash` (TEXT) — SHA256 for dedup
- `ingested_at` (DATE)
- `metadata` (TEXT) — JSON stringified
- `page_number` (INT) — For PDFs
- `message_id` (TEXT) — For emails

**TimelineEvent:**
- `matter_id` (TEXT) — Parent matter
- `event_date` (DATE) — When event occurred
- `event_description` (TEXT, vectorized) — What happened
- `event_type` (TEXT) — COMMUNICATION, TRANSACTION, MEETING, etc.
- `participants` (TEXT_ARRAY) — Involved persons/orgs
- `source_document_id` (TEXT) — Evidence reference
- `confidence` (NUMBER) — Extraction confidence
- `metadata` (TEXT) — JSON stringified

**IntelligenceReport:**
- `matter_id` (TEXT) — Parent matter
- `report_type` (TEXT) — SUMMARY, ANALYSIS, RECOMMENDATION
- `title` (TEXT) — Report title
- `content` (TEXT) — Report body (NOT vectorized)
- `generated_at` (DATE)
- `generated_by` (TEXT) — AI model or analyst
- `metadata` (TEXT) — JSON stringified

#### Global / No Multi-Tenancy (2 collections)

**SubjectPerson:**
- `canonical_name` (TEXT, vectorized) — Primary name
- `aliases` (TEXT_ARRAY) — Alternative names
- `matter_ids` (TEXT_ARRAY) — Cases involved in
- `date_of_birth` (DATE) — DOB
- `identifiers` (TEXT) — JSON: {passport, ssn, etc.}
- `notes` (TEXT) — Free-form notes
- `created_at` (DATE)
- `updated_at` (DATE)

**SubjectOrganisation:**
- `canonical_name` (TEXT, vectorized) — Primary name
- `aliases` (TEXT_ARRAY) — Alternative names
- `matter_ids` (TEXT_ARRAY) — Cases involved in
- `org_type` (TEXT) — COMPANY, NGO, GOVERNMENT, etc.
- `identifiers` (TEXT) — JSON: {abn, acn, etc.}
- `notes` (TEXT) — Free-form notes
- `created_at` (DATE)
- `updated_at` (DATE)

---

## 4. EXISTING TEST PATTERNS

### Unit Tests (test_weaviate_unit.py — 349 LOC)

**7 Test Classes:**

1. **TestWeaviateMemoryClientInitialization** (5 tests)
   - Client initialization with/without settings
   - Tier collection mapping
   - Client property raises when not connected

2. **TestWeaviateMemoryClientSchema** (3 tests)
   - `_ensure_schemas` creates missing collections
   - `_ensure_schemas` skips existing collections
   - `_drop_all_collections` deletes all managed collections

3. **TestWeaviateMemoryClientMemoryOperations** (3 tests)
   - `add_memory` inserts data
   - `update_memory` updates data
   - `delete_memory` deletes by UUID

4. **TestWeaviateMemoryClientSearch** (incomplete in output)
   - Search operations (BM25 + vector)

5. **TestWeaviateMemoryClientBatchOperations**
   - Batch insert operations

6. **TestWeaviateMemoryClientErrorHandling**
   - Error scenarios and recovery

7. **TestWeaviateMemoryClientTenantSupport**
   - Multi-tenant operations

**Mocking Strategy:**
- `MagicMock` for Weaviate client
- `AsyncMock` for async operations
- `patch` for dependency injection
- Settings mocked with `MagicMock(spec=Settings)`

---

### Live Integration Tests (test_weaviate_live.py — 358 LOC)

**6 Test Classes:**

1. **TestWeaviateConnection** (2 tests)
   - Connection to live Weaviate instance
   - Metadata retrieval

2. **TestWeaviateSchemaOperations** (5 tests)
   - Schema creation
   - Collection existence checks
   - Property validation

3. **TestWeaviateMemoryCRUD** (5 tests)
   - Insert memory with vector
   - Retrieve memory
   - Update memory
   - Delete memory
   - List memories

4. **TestWeaviateSearchOperations** (5 tests)
   - BM25 search
   - Vector search
   - Hybrid search
   - Filter queries

5. **TestWeaviateHealthChecks** (2 tests)
   - `/health` endpoint
   - `/livez` endpoint

6. **TestWeaviateErrorScenarios** (3 tests)
   - Connection failures
   - Invalid queries
   - Timeout handling

**Fixtures:**
- `live_client` — Connected WeaviateMemoryClient
- `test_memory` — Sample Memory object
- `test_vector` — Sample embedding vector

---

### Performance Tests (test_weaviate_performance.py — 252 LOC)

**Benchmarks:**
- Bulk insert (1000 memories)
- Batch search (100 queries)
- Vector similarity search
- Tenant creation overhead

---

## 5. CRITICAL GAPS & TESTING NEEDS

### Coverage Gaps

| Component | Current | Target | Gap |
|-----------|---------|--------|-----|
| WeaviateMemoryClient | ~60% | 95% | Graph ops, tenant mgmt, edge cases |
| MatterClient | ~40% | 90% | Atomic rollback, error scenarios |
| EvidenceClient | ~50% | 90% | Chunking edge cases, dedup logic |
| GlobalRegistryClient | ~30% | 85% | Upsert dedup, search ranking |

### Missing Test Scenarios

1. **Concurrent Operations**
   - Parallel memory inserts
   - Race conditions in tenant creation
   - Concurrent search + update

2. **Error Recovery**
   - Weaviate connection loss mid-operation
   - Partial batch failures
   - Tenant creation rollback verification

3. **Schema Evolution**
   - Property addition without data loss
   - Collection migration
   - Backward compatibility

4. **Multi-Tenancy Edge Cases**
   - Tenant isolation verification
   - Cross-tenant query prevention
   - Tenant deletion cascade

5. **Search Quality**
   - Vector similarity threshold tuning
   - BM25 ranking validation
   - Deduplication accuracy (GlobalRegistryClient)

6. **Performance Regression**
   - Bulk operation latency
   - Memory consumption under load
   - Query timeout handling

---

## 6. QUICK REFERENCE: TIER COLLECTIONS MAP

```python
TIER_COLLECTIONS = {
    MemoryTier.PROJECT: "Tier1Memory",      # Project-specific
    MemoryTier.GENERAL: "Tier2Memory",      # Workspace-wide
    MemoryTier.GLOBAL: "Tier3Memory",       # Universal
}

GRAPH_COLLECTIONS = {
    "entities": "KnowledgeEntity",
    "relations": "KnowledgeRelation",
}

INVESTIGATION_COLLECTIONS = {
    "matter": "InvestigationMatter",
    "evidence": "EvidenceDocument",
    "timeline": "TimelineEvent",
    "report": "IntelligenceReport",
    "person": "SubjectPerson",
    "organisation": "SubjectOrganisation",
}
```

---

## 7. NEXT STEPS FOR TESTING

1. **Expand unit tests** to cover all 40+ methods in WeaviateMemoryClient
2. **Add concurrent operation tests** (asyncio.gather patterns)
3. **Implement schema migration tests** (CLEAN_SCHEMA_MIGRATION flow)
4. **Test investigation module** (MatterClient, EvidenceClient, GlobalRegistryClient)
5. **Add performance regression suite** (baseline + threshold checks)
6. **Verify multi-tenancy isolation** (cross-tenant query prevention)
7. **Test error recovery** (connection loss, partial failures, rollback)

