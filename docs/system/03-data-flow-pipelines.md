# Engram Platform — Data Flow Pipelines

**Version**: 1.1.0
**Last Updated**: 2026-03-31
**Status**: Production

---

## Pipeline 1: Memory Lifecycle

The core data pipeline for storing and retrieving AI memories across three tiers.

### 1.1 Write Path (Memory Creation)

```
Client (API/MCP/Frontend)
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 1: Input Validation                                    │
│ Endpoint: POST /memories                                     │
│ Server: Memory API (engram-memory-api:8000)                  │
│                                                              │
│ Input:  JSON body with content, tier (1-3), memory_type,     │
│         importance (0.0-1.0), tags[], project_id, tenant_id  │
│ Output: Validated Pydantic model                             │
│ Auth:   JWT token or API key (require_auth dependency)       │
│ Rate:   slowapi rate limiter + Nginx 60r/s zone              │
│ Failure: 401 Unauthorized, 422 Validation Error, 429 Rate    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 2: Embedding Generation                                │
│ Module: memory_system/embeddings.py                          │
│ Class:  Provider-specific (configured via EMBEDDING_PROVIDER)│
│                                                              │
│ Providers:                                                   │
│   - DeepInfra: bge-base-en-v1.5, 768 dimensions             │
│     API: https://api.deepinfra.com/v1/openai                 │
│   - OpenAI: text-embedding-3-small, 1536 dimensions          │
│   - Nomic: nomic-embed-text-v1.5, 768 dimensions (local)    │
│     Matryoshka support, task prefixes (search_document:)     │
│   - Ollama: local model via /api/embeddings                  │
│                                                              │
│ Input:  Raw text content string                              │
│ Output: Float vector [768 or 1536 dimensions]                │
│ Cache:  Redis key prefix "emb:" with 7-day TTL               │
│ Failure: Provider timeout → retry with backoff               │
│          Provider down → error returned to client             │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3: Weaviate Storage                                    │
│ Module: memory_system/client.py (WeaviateMemoryClient)       │
│ Server: engram-weaviate:8080 (HTTP) / :50051 (gRPC)          │
│                                                              │
│ Input:  Memory object + embedding vector                     │
│ Output: UUID of stored memory object                         │
│ Schema: Multi-tenant Weaviate collection                     │
│         Tenant scoping: tenant_id (default: "default")       │
│         Class per tier: MemoryTier1, MemoryTier2, MemoryTier3│
│ Properties stored: content, summary, memory_type, importance,│
│   tags, project_id, user_id, source, decay_factor,           │
│   access_count, created_at, last_accessed, confidence,       │
│   metadata (JSON)                                            │
│ Failure: Weaviate down → 503 to client                       │
│          Schema mismatch → auto-migration or error            │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 4: Cache Update                                        │
│ Module: memory_system/cache.py (RedisCache)                  │
│ Server: engram-memory-redis:6379                             │
│                                                              │
│ Actions:                                                     │
│   - Store memory at key "mem:{memory_id}" (TTL: 24 hours)   │
│   - Invalidate related search cache keys "search:*"          │
│   - Store embedding at key "emb:{content_hash}" (TTL: 7 days)│
│ Failure: Redis down → degraded mode (no cache, still works)  │
│          Silent failure: log warning, continue                │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Read Path (Memory Search)

```
Client (API/MCP/Frontend)
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 1: Query Reception                                     │
│ Endpoint: POST /search                                       │
│ Server: Memory API (engram-memory-api:8000)                  │
│                                                              │
│ Input:  query string, tier filter, project_id, tenant_id,    │
│         limit (default 10), memory_type filter               │
│ Output: Validated MemoryQuery model                          │
│ Auth:   JWT token or API key                                 │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 2: Cache Check                                         │
│ Module: memory_system/cache.py                               │
│                                                              │
│ Key:    "search:{hash(query+filters)}"                       │
│ TTL:    1 hour                                               │
│ Hit:    Return cached results directly (skip stages 3-5)     │
│ Miss:   Continue to embedding stage                          │
│ Failure: Redis down → treat as cache miss, continue          │
└──────────────────────┬───────────────────────────────────────┘
                       │ (cache miss)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3: Query Embedding                                     │
│ Module: memory_system/embeddings.py                          │
│                                                              │
│ Input:  Query string                                         │
│ Output: Query vector [768 or 1536 dimensions]                │
│ Note:   Nomic provider uses "search_query:" task prefix      │
│         (vs "search_document:" for storage)                  │
│ Cache:  Check "emb:{hash(query)}" first                      │
│ Failure: Same as write path embedding failures               │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 4: Vector Search                                       │
│ Module: memory_system/client.py                              │
│ Server: engram-weaviate:8080                                 │
│                                                              │
│ Operation: nearVector search within tenant-scoped collection │
│ Filters:  tier, project_id, memory_type                      │
│ Limit:    Client-specified (default 10, max via config)      │
│ Returns:  Memory objects with similarity scores              │
│ Failure:  Weaviate timeout (60s max) → 504 to client         │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 5: Decay Reranking                                     │
│ Module: memory_system/decay.py (MemoryDecay, MemoryReranker) │
│                                                              │
│ Formula: recency = 2^(-age_days / half_life_days)            │
│ Default half-life: 7 days                                    │
│ Access boost: min(2.0, 1.0 + access_count * 0.1)            │
│ Combined: decay_factor = max(0.1, recency * access_boost)    │
│                                                              │
│ Input:  Raw search results with similarity scores            │
│ Output: Reranked results with combined score                 │
│         (similarity * decay_factor * importance)             │
│ Optional: BGE reranker cross-encoder (BAAI/bge-reranker-base)│
│           278M params, lazy-loaded                           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 6: Cache Store & Response                              │
│                                                              │
│ Cache:  Store results at "search:{hash}" with 1-hour TTL     │
│ Output: JSON array of MemorySearchResult objects             │
│         Each: memory_id, content, score, tier, memory_type,  │
│         importance, tags, created_at, decay_factor           │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 RAG Query Path

```
Client
    │
    ▼
POST /rag (query, tier, project_id, limit)
    │
    ▼
MemoryRAG.generate_with_context()
    │
    ├─► Search (stages 1-6 above, default limit: 5)
    │
    ▼
ContextBuilder.compress_memory() for each result
    │
    ▼
Return {
    query, mode: "context_only",
    individual_insights: [{memory_id, content, compressed, score, tier, memory_type}],
    source_count
}
```

RAG max context window: 4,000 tokens (configurable via `rag_max_context_tokens`). Default retrieval limit: 5 memories (configurable via `rag_default_limit`, range 1-50).

### 1.4 Memory Consolidation

```
Trigger: Background scheduler or manual POST /consolidate
    │
    ▼
Search for related memories within last 48 hours
(consolidation_hours_back setting)
    │
    ▼
Group by semantic similarity
(minimum group size: 3, via consolidation_min_group_size)
    │
    ▼
Merge groups into consolidated summaries
(confidence: 0.7, via consolidation_confidence)
    │
    ▼
Store consolidated memory, mark originals as consolidated
```

### 1.5 Memory Decay Maintenance

```
Trigger: Periodic scheduler (_scheduler in api.py)
    │
    ▼
For each memory in Weaviate:
    │
    ├─► Calculate recency: 2^(-age_days / 7)
    ├─► Calculate access_boost: min(2.0, 1.0 + access_count * 0.1)
    ├─► Combined decay_factor: max(0.1, recency * access_boost)
    │
    ▼
Update decay_factor in Weaviate
    │
    ▼
Memories with decay_factor ≤ min_importance (0.1) are candidates
for cleanup/archival
```

---

## Pipeline 2: OSINT Crawler

The five-stage OSINT intelligence gathering pipeline.

### 2.1 Full Pipeline Flow

```
┌──────────────────────────────────────────────────────────────┐
│ STAGE 1: Alias Discovery                                     │
│ Server: Crawler API (engram-crawler-api:11235)               │
│                                                              │
│ Input:  Target username/handle                               │
│ Output: List of discovered aliases across 8 platforms        │
│ Platforms: Social media, forums, code repositories           │
│ Method:  HTTP requests to platform-specific APIs/pages       │
│ Failure: Individual platform timeout → skip, continue others │
│          All platforms fail → empty alias list, proceed       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 2: Web Crawl                                           │
│ Engine: Crawl4AI 0.5.0 with headless Chromium                │
│                                                              │
│ Input:  URLs derived from discovered aliases                 │
│ Output: Raw HTML content, extracted text, metadata           │
│ Config:                                                      │
│   - Viewport: 1920x1080                                      │
│   - Page timeout: 60,000 ms                                  │
│   - Word count threshold: 50 (skip pages below this)         │
│   - Cache mode: aggressive                                   │
│   - Shared memory: 2 GB (for Chromium)                       │
│ Progress: WebSocket broadcast to connected clients at /ws    │
│ Failure: Page timeout → skip page, continue crawl            │
│          Chromium crash → restart via supervisord             │
│          Out of memory → watchdog kills process at 85%       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3: Model Review                                        │
│ Engine: LM Studio (external, http://host.docker.internal:1234)│
│                                                              │
│ Input:  Extracted text content from each crawled page        │
│ Output: Decision per page: keep / derank / archive           │
│ Config:                                                      │
│   - Temperature: 0.7                                         │
│   - Timeout: 30 seconds per request                          │
│   - Max retries: 3                                           │
│   - Retry delay: 1 second                                    │
│ Failure: LM Studio unreachable → default to "keep"           │
│          Timeout → retry up to 3 times, then default "keep"  │
│          Model error → log warning, default "keep"           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 4: Vector Storage                                      │
│ Engine: ChromaDB (embedded, /app/data/chroma)                │
│                                                              │
│ Input:  Reviewed content with keep/derank/archive labels     │
│ Output: ChromaDB document IDs                                │
│ Config:                                                      │
│   - Collection prefix: "crawl4ai_"                           │
│   - Similarity threshold: 0.7                                │
│   - Embedding batch size: 100                                │
│ Tiered storage:                                              │
│   - "keep" → hot tier (/app/data/tiers/hot, 24h retention)  │
│   - "derank" → warm tier (/app/data/tiers/warm, 7d retention)│
│   - "archive" → cold tier (/app/data/tiers/cold, 30d)       │
│ Failure: ChromaDB write error → retry, then log and continue │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 5: Knowledge Graph Extraction                          │
│                                                              │
│ Input:  Stored content from ChromaDB                         │
│ Output: Entities and relationships                           │
│ Operations:                                                  │
│   - Entity extraction (people, organizations, locations)     │
│   - Relationship mapping between entities                    │
│   - Cross-reference with existing graph data                 │
│ Storage: Via Memory API POST /entities, POST /relations      │
│ Failure: Memory API unavailable → queue for retry            │
│          Extraction error → log, skip entity                 │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Data Tier Lifecycle

```
    Crawl Result
        │
        ▼
    ┌────────┐   24 hours    ┌────────┐   7 days     ┌────────┐   30 days
    │  HOT   │──────────────►│  WARM  │──────────────►│  COLD  │────────►
    │        │  auto-offload  │        │  auto-offload  │        │
    └────────┘               └────────┘               └────────┘
                                                          │
                                                     10 GB threshold
                                                          │
                                                          ▼
                                                    ┌──────────┐
                                                    │ ARCHIVE  │
                                                    └──────────┘

Cleanup interval: every 60 minutes (DATA_CLEANUP_INTERVAL_MINUTES)
Offload threshold: 14 days (DATA_OFFLOAD_THRESHOLD_DAYS)
```

### 2.3 Watchdog Process

Runs every 300 seconds (5 minutes) via supervisord:
- **Memory check**: Alert/kill at 85% host memory usage
- **Disk check**: Alert at 90% disk usage
- **Orphan cleanup**: Kill processes older than 60 minutes without parent

### 2.4 Cross-Service Storage

The Crawler API also stores results in the Memory API when `ENGRAM_ENABLED=true` and `ENGRAM_AUTO_STORE=true`. This sends crawled content to `http://memory-api:8000` for indexing in the Weaviate vector store, making crawler results searchable through the memory search and RAG pipelines.

---

## Pipeline 3: Investigation / Evidence

Isolated evidence management for structured investigations.

### 3.1 Matter Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│ STAGE 1: Matter Creation                                     │
│ Endpoint: POST /matters                                      │
│ Server: Memory API (engram-memory-api:8000)                  │
│                                                              │
│ Input:  matter_id (unique string, e.g. "CASE-2024-001"),     │
│         title, description, lead_investigator, tags[]        │
│ Output: Created matter with isolated Weaviate tenant         │
│ Isolation: Each matter gets its own Weaviate tenant for      │
│            complete data separation between investigations   │
│ Failure: Duplicate matter_id → 409 Conflict                  │
│          Weaviate unavailable → 503                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 2: Document Ingestion                                  │
│ Endpoint: POST /matters/{matter_id}/ingest                   │
│ Module: memory_system/investigation/                         │
│                                                              │
│ Input:  Document content (text, HTML, PDF, DOCX, email),     │
│         source_url, source_type (WEB/PDF/EMAIL/CSV/EXCEL/    │
│         MANUAL), metadata{}                                  │
│ Processing:                                                  │
│   1. Content extraction (PDF parsing, DOCX parsing, email    │
│      header extraction)                                      │
│   2. Text normalization and cleaning                         │
│ Max upload size: 100 MB (nginx client_max_body_size)         │
│ Output: Extracted text content ready for chunking            │
│ Failure: Unsupported format → 400                            │
│          Parse error → 422 with detail                       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3: Evidence Chunking & Embedding                       │
│                                                              │
│ Input:  Extracted text content                               │
│ Processing:                                                  │
│   1. Split into chunks (respecting sentence/paragraph        │
│      boundaries)                                             │
│   2. Generate embedding vector per chunk                     │
│      (same provider as memory pipeline)                      │
│   3. Store chunks in matter-scoped Weaviate tenant           │
│ Output: Chunk IDs within the matter tenant                   │
│ Failure: Embedding provider error → retry with backoff       │
│          Weaviate write failure → 503                        │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 4: Evidence Search                                     │
│ Endpoint: POST /matters/{matter_id}/search                   │
│                                                              │
│ Input:  Natural language query, limit, offset                │
│ Output: Ranked evidence chunks with similarity scores,       │
│         source metadata, and source_url attribution          │
│ Scope:  Search is strictly isolated to the matter's          │
│         Weaviate tenant — no cross-matter leakage            │
│ Failure: Matter not found → 404                              │
│          Weaviate query timeout → 504                        │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Isolation Guarantee

Each matter operates in a separate Weaviate tenant. This provides:
- **Data isolation**: Evidence from one investigation is invisible to queries against another
- **Independent lifecycle**: Matters can be created, searched, and deleted independently
- **Access control**: Matter-level operations require authentication

---

## Pipeline 4: MCP Integration

The path from Claude Code/Desktop through MCP to the memory system.

### 4.1 Stdio Transport (Claude Code / Claude Desktop)

```
┌──────────────────────────────────────────────────────────────┐
│ STAGE 1: Tool Invocation                                     │
│ Client: Claude Code or Claude Desktop                        │
│ Transport: stdin/stdout (stdio)                              │
│                                                              │
│ Configuration (Claude Code settings.json):                   │
│   ENGRAM_API_URL: http://100.78.187.5:8000                   │
│   ENGRAM_API_KEY: <scoped API key>                           │
│                                                              │
│ Available tools (from tools/tool-definitions.ts):            │
│   Memory: add_memory, search_memory, get_memory,             │
│           delete_memory, list_memories, rag_query,           │
│           build_context, batch_add_memories,                 │
│           consolidate_memories, export_memories              │
│   Entities: add_entity, add_relation, query_graph            │
│   Investigation: create_matter, ingest_document,             │
│                  search_matter                               │
│   System: health_check, get_analytics, get_system_metrics    │
│                                                              │
│ Input:  MCP tool call with JSON parameters                   │
│ Output: MCP tool result (JSON content)                       │
│ Hooks:  UserPromptSubmit → auto recall relevant memories     │
│         Stop → auto store conversation insights              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 2: Server Processing                                   │
│ Module: server.ts (createMCPServer factory)                  │
│                                                              │
│ Routing:                                                     │
│   Memory tools → tools/memory-tools.ts → handleMemoryTool()  │
│   Entity tools → tools/entity-tools.ts → handleEntityTool()  │
│   Investigation → tools/investigation-tools.ts               │
│                                                              │
│ Server capabilities: tools, resources, prompts               │
│ Request ID: Generated per request for tracing (logger.ts)    │
│ Error mapping: isMemoryError() → typed MCP errors            │
│   InvalidInputError, NotFoundError, InternalServerError      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3: Resilient API Call                                  │
│ Module: client.ts (MemoryAPIClient)                          │
│                                                              │
│ Target: Memory API at configured apiUrl                      │
│ Wrapper: resilientFetch() composing three layers:            │
│                                                              │
│   ┌─── Circuit Breaker (circuit-breaker.ts) ───┐            │
│   │ State: closed → open (5 failures in 60s)   │            │
│   │        open → half-open (after 30s)         │            │
│   │        half-open → closed (2 successes)     │            │
│   │                                             │            │
│   │   ┌─── Retry (retry.ts) ───────────────┐   │            │
│   │   │ Max: 3 retries                      │   │            │
│   │   │ Backoff: 100ms × 2^attempt          │   │            │
│   │   │ Max delay: 5,000ms                  │   │            │
│   │   │ Jitter: 0.1                         │   │            │
│   │   │ Retry on: network errors, 5xx, abort│   │            │
│   │   │                                     │   │            │
│   │   │   ┌─── Fetch + Timeout ─────────┐   │   │            │
│   │   │   │ AbortController: 30s timeout│   │   │            │
│   │   │   │ Keep-alive: 50 max sockets  │   │   │            │
│   │   │   └─────────────────────────────┘   │   │            │
│   │   └─────────────────────────────────────┘   │            │
│   └─────────────────────────────────────────────┘            │
│                                                              │
│ Failure modes:                                               │
│   - Circuit open → immediate CircuitOpenError (fast-fail)    │
│   - All retries exhausted → error propagated to client       │
│   - Memory API 4xx → error mapped, no retry                  │
│   - Memory API 5xx → retry up to 3 times                     │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 4: Memory API Processing                               │
│ (Executes Pipeline 1 read or write path as appropriate)      │
│                                                              │
│ See Pipeline 1 for full details on:                          │
│   - Embedding generation                                     │
│   - Weaviate vector operations                               │
│   - Redis caching                                            │
│   - Decay reranking                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 5: Response                                            │
│                                                              │
│ Memory API → JSON response                                   │
│ MCP Server → Parse, map to MCP content format                │
│ MCP Client → Receives tool result via stdio                  │
│                                                              │
│ Response format: { content: [{ type: "text", text: "..." }] }│
└──────────────────────────────────────────────────────────────┘
```

### 4.2 HTTP Transport (Remote Clients)

```
Remote MCP Client
    │
    ▼ HTTPS
Nginx (/mcp) → MCP Server :3000
    │
    ▼
Same stages 2-5 as stdio path above

Additional layers:
  - Nginx rate limit: api zone (60r/s, burst 20)
  - Nginx proxy: buffering off, 300s read timeout
  - Auth: Bearer token (MCP_AUTH_TOKEN) or OAuth 2.1 with PKCE
  - OAuth token storage: Memory Redis at mcp:oauth:* keys
  - OAuth access token TTL: 1 hour
  - OAuth refresh token TTL: 24 hours
  - OAuth discovery: /.well-known/oauth-authorization-server
```

### 4.3 Auto-Memory Hooks

The MCP server supports hook-driven automatic memory operations:

```
┌─────────────────────────────────┐
│ Hook: UserPromptSubmit          │
│ Trigger: User sends a prompt    │
│ Action: Search memory for       │
│         relevant context and    │
│         inject into response    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Hook: Stop                      │
│ Trigger: Conversation ends      │
│ Action: Extract key insights    │
│         from conversation and   │
│         store as new memories   │
└─────────────────────────────────┘
```

These hooks are configured in Claude Code's `settings.json` and managed by the `HookManager` class in `hooks/hook-manager.ts`.

---

## Pipeline Summary Matrix

| Pipeline | Input | Processing | Storage | Output | Failure Strategy |
|---|---|---|---|---|---|
| **Memory Write** | Text + metadata | Validate → Embed → Store → Cache | Weaviate + Redis | Memory UUID | Auth fail → 401; Embed fail → error; Redis fail → degraded |
| **Memory Search** | Query + filters | Cache check → Embed → Vector search → Decay rerank | Redis (cache) | Ranked results | Cache miss → full path; Weaviate down → 503 |
| **RAG** | Query + context params | Search → Compress → Assemble | N/A (read-only) | Context + insights | Falls back to fewer results on partial failure |
| **OSINT Crawl** | Target username | Discover → Crawl → Review → Store → Extract | ChromaDB + tiers | Entities + relationships | Per-stage resilience; LM Studio optional |
| **Investigation** | Documents | Create matter → Ingest → Chunk → Embed | Weaviate (isolated tenant) | Searchable evidence | Tenant isolation; format validation |
| **MCP stdio** | Tool call (JSON) | Route → Resilient fetch → Memory API | Via Memory API | MCP tool result | Circuit breaker + 3 retries + 30s timeout |
| **MCP HTTP** | Tool call (HTTPS) | Nginx → Auth → Route → Fetch → Memory API | Via Memory API | MCP tool result | TLS + rate limit + circuit breaker + retry |
