# 08 - API Reference

> Engram Platform -- complete API reference for the Memory API and MCP tools.
> Last updated: 2026-03-31

---

## Table of Contents

1. [Memory API (REST)](#1-memory-api-rest)
   - [Authentication](#authentication)
   - [Health](#health-endpoints)
   - [Auth](#auth-endpoints)
   - [Memory CRUD](#memory-crud-endpoints)
   - [Search and Retrieval](#search-and-retrieval-endpoints)
   - [Knowledge Graph](#knowledge-graph-endpoints)
   - [Tenant Management](#tenant-management-endpoints)
   - [Investigation Matters](#investigation-matter-endpoints)
   - [Analytics](#analytics-endpoints)
   - [Admin](#admin-endpoints)
   - [Maintenance](#maintenance-endpoints)
   - [Export](#export-endpoints)
   - [WebSocket](#websocket-endpoints)
2. [MCP Tools](#2-mcp-tools)

---

## 1. Memory API (REST)

**Base URL**: `http://localhost:8000` (development) or configured via `ENGRAM_API_URL`.

**Rate limiting**: Configurable per minute per IP (default: 100/minute). Destructive bulk operations are limited to 10/minute.

### Authentication

All endpoints except `/health` and `/metrics` require authentication via one of:

- **API Key**: `X-API-Key: <key>` header
- **JWT Bearer**: `Authorization: Bearer <jwt_token>` header

API keys are managed via the `/admin/keys` endpoints. JWTs are obtained from `/auth/login`.

### Error Format

All errors follow a consistent format:

```json
{
  "error": "HTTPException",
  "detail": "Human-readable error message",
  "request_id": null
}
```

Validation errors (422):

```json
{
  "detail": "Validation error",
  "errors": [
    {
      "loc": ["body", "content"],
      "msg": "String should have at least 1 character",
      "type": "string_too_short"
    }
  ]
}
```

---

### Health Endpoints

#### `GET /health`

Basic health check. **No authentication required.**

**Response** `200`:

```json
{
  "status": "healthy",
  "weaviate": true,
  "redis": true,
  "initialized": true
}
```

---

#### `GET /health/detailed`

Detailed health check with per-service resource usage. **Auth required.**

**Response** `200`:

```json
{
  "status": "healthy",
  "services": {
    "weaviate": { "status": "up", "memory_mb": 77, "model": null, "models_loaded": [] },
    "redis": { "status": "up", "memory_mb": 21, "model": null, "models_loaded": [] },
    "ollama": { "status": "up", "memory_mb": 900, "model": null, "models_loaded": ["liquid/lfm2.5:1.2b"] },
    "embedding_model": { "status": "loaded", "memory_mb": 350, "model": "nomic-embed-text-v1.5", "models_loaded": [] },
    "reranker": { "status": "loaded", "memory_mb": 280, "model": "BAAI/bge-reranker-base", "models_loaded": [] }
  },
  "maintenance_queue": {
    "pending": 0,
    "running": 0,
    "last_run": {},
    "scheduler_running": true
  },
  "resource_usage": {
    "total_model_ram_mb": 1530,
    "budget_mb": 3072,
    "headroom_mb": 1542
  }
}
```

---

#### `GET /stats`

Memory statistics. **Auth required.**

**Query parameters**:
- `tenant_id` (optional): Filter by tenant.

**Response** `200`:

```json
{
  "total_memories": 142,
  "tier1_count": 98,
  "tier2_count": 32,
  "tier3_count": 12,
  "by_type": { "fact": 80, "insight": 30, "code": 20, "conversation": 12 },
  "oldest_memory": "2026-01-15T10:30:00Z",
  "newest_memory": "2026-03-31T14:22:00Z",
  "avg_importance": 0.62,
  "importance_distribution": {
    "low (0.0-0.3)": 0,
    "medium (0.3-0.7)": 142,
    "high (0.7-1.0)": 0
  }
}
```

---

### Auth Endpoints

#### `POST /auth/login`

Authenticate with username/password, returns JWT. Rate limited to 10/minute.

**Request body**:

```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response** `201`:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**Errors**: `401` if credentials invalid or login not configured.

---

#### `POST /auth/refresh`

Refresh a JWT token. **Auth required** (existing valid token or API key).

**Response** `201`:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

---

### Memory CRUD Endpoints

#### `POST /memories`

Add a new memory. **Auth required.**

**Request body**:

```json
{
  "content": "The deployment uses Nginx as a reverse proxy with Traefik for SSL termination.",
  "tier": 1,
  "memory_type": "fact",
  "source": "agent",
  "project_id": "engram-platform",
  "user_id": "user-123",
  "tenant_id": "default",
  "session_id": "sess-abc",
  "importance": 0.7,
  "confidence": 1.0,
  "tags": ["infrastructure", "deployment"],
  "metadata": { "context": "deployment discussion" },
  "expires_in_days": 90
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `content` | string | Yes | -- | Memory content (min 1 char) |
| `tier` | int (1-3) | No | 1 | 1=Project, 2=General, 3=Global |
| `memory_type` | string | No | `"fact"` | One of: fact, insight, code, conversation, document, preference, error_solution, workflow, consolidated |
| `source` | string | No | `"agent"` | One of: user, agent, system, documentation, external |
| `project_id` | string | No | null | Project ID for tier 1 |
| `user_id` | string | No | null | User identifier |
| `tenant_id` | string | No | null | Tenant identifier |
| `session_id` | string | No | null | Session identifier |
| `importance` | float (0-1) | No | 0.5 | Importance score |
| `confidence` | float (0-1) | No | 1.0 | Confidence score |
| `tags` | string[] | No | [] | Tags for categorization |
| `metadata` | object | No | {} | Additional metadata |
| `expires_in_days` | int | No | null | Days until expiration |

**Response** `200`:

```json
{
  "memory_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tier": 1,
  "created_at": "2026-03-31T14:22:00Z"
}
```

---

#### `POST /memories/batch`

Add multiple memories in a single batch operation. **Auth required.**

**Request body**:

```json
{
  "memories": [
    {
      "content": "First memory content",
      "tier": 1,
      "importance": 0.8,
      "tags": ["batch-test"]
    },
    {
      "content": "Second memory content",
      "tier": 2,
      "memory_type": "insight"
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `memories` | AddMemoryRequest[] | Yes | Array of memories (max 100) |

**Response** `200`:

```json
{
  "memory_ids": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ],
  "failed": 0,
  "total": 2
}
```

---

#### `GET /memories/{memory_id}`

Get a specific memory by ID. **Auth required.**

**Query parameters**:
- `tier` (required, int 1-3): Memory tier.
- `tenant_id` (optional): Tenant identifier.

**Example**: `GET /memories/a1b2c3d4-e5f6-7890?tier=1`

**Response** `200`:

```json
{
  "memory_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "content": "The deployment uses Nginx...",
  "summary": null,
  "tier": 1,
  "memory_type": "fact",
  "source": "agent",
  "project_id": "engram-platform",
  "user_id": "user-123",
  "tenant_id": "default",
  "session_id": "sess-abc",
  "importance": 0.7,
  "confidence": 1.0,
  "tags": ["infrastructure", "deployment"],
  "metadata": { "context": "deployment discussion" },
  "created_at": "2026-03-31T14:22:00Z",
  "updated_at": "2026-03-31T14:22:00Z",
  "expires_at": "2026-06-29T14:22:00Z"
}
```

**Errors**: `404` if memory not found.

---

#### `GET /memories/list`

List memories with pagination, without requiring a search query. **Auth required.**

**Query parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `tenant_id` | string | null | Filter by tenant |
| `project_id` | string | null | Filter by project |
| `tier` | int (1-3) | null | Filter by tier |
| `limit` | int (1-500) | 50 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response** `200`:

```json
{
  "memories": [
    {
      "memory_id": "...",
      "content": "...",
      "summary": null,
      "tier": 1,
      "memory_type": "fact",
      "source": "agent",
      "project_id": "engram-platform",
      "user_id": null,
      "tenant_id": "default",
      "importance": 0.7,
      "confidence": 1.0,
      "tags": [],
      "created_at": "2026-03-31T14:22:00Z",
      "score": null,
      "distance": null
    }
  ],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

---

#### `DELETE /memories/{memory_id}`

Delete a memory by ID. **Auth required.**

**Query parameters**:
- `tier` (required, int 1-3): Memory tier.
- `tenant_id` (optional): Tenant identifier.

**Response** `200`:

```json
{
  "status": "deleted",
  "memory_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Errors**: `404` if memory not found.

---

#### `DELETE /memories/bulk`

Bulk delete memories by filter or explicit ID list. Rate limited to 10/minute. **Auth required.**

**Request body**:

```json
{
  "memory_ids": ["uuid-1", "uuid-2"],
  "tier": null,
  "project_id": null,
  "tenant_id": "default",
  "max_delete": 100
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `memory_ids` | string[] | null | Specific IDs to delete |
| `tier` | int (1-3) | null | Filter by tier (if no IDs) |
| `project_id` | string | null | Filter by project (if no IDs) |
| `tenant_id` | string | null | Tenant identifier |
| `max_delete` | int (1-1000) | 100 | Safety limit |

**Response** `200`:

```json
{
  "deleted": 2,
  "failed": 0,
  "total_processed": 2
}
```

---

### Search and Retrieval Endpoints

#### `POST /memories/search`

Semantic search across memories. **Auth required.**

**Request body**:

```json
{
  "query": "deployment infrastructure",
  "tier": 1,
  "project_id": "engram-platform",
  "user_id": null,
  "tenant_id": "default",
  "tags": ["infrastructure"],
  "min_importance": 0.5,
  "limit": 10,
  "event_only": false,
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": null
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string (1-10000) | Yes | -- | Search query |
| `tier` | int (1-3) | No | null | Filter by tier |
| `project_id` | string | No | null | Filter by project |
| `user_id` | string | No | null | Filter by user |
| `tenant_id` | string | No | null | Filter by tenant |
| `tags` | string[] | No | null | Filter by tags |
| `min_importance` | float (0-1) | No | null | Minimum importance |
| `limit` | int (1-100) | No | 10 | Max results |
| `event_only` | bool | No | false | Only return event memories |
| `start_date` | string (ISO) | No | null | Start date filter |
| `end_date` | string (ISO) | No | null | End date filter |

**Response** `200`:

```json
{
  "results": [
    {
      "memory_id": "a1b2c3d4-...",
      "content": "The deployment uses Nginx...",
      "summary": null,
      "tier": 1,
      "memory_type": "fact",
      "source": "agent",
      "project_id": "engram-platform",
      "user_id": "user-123",
      "tenant_id": "default",
      "importance": 0.7,
      "confidence": 1.0,
      "tags": ["infrastructure"],
      "created_at": "2026-03-31T14:22:00Z",
      "score": 0.92,
      "distance": 0.08
    }
  ],
  "query": "deployment infrastructure",
  "total": 1
}
```

---

#### `POST /memories/rag`

RAG (Retrieval-Augmented Generation) query. Returns a synthesis prompt with relevant memory context. **Auth required.**

**Request body**:

```json
{
  "query": "How is the deployment configured?",
  "tier": null,
  "project_id": "engram-platform",
  "user_id": null,
  "session_id": null
}
```

**Response** `200`:

```json
{
  "query": "How is the deployment configured?",
  "mode": "rag",
  "synthesis_prompt": "Based on these memories, provide a comprehensive response...\n\nContext:\n1. The deployment uses Nginx...\n2. ...",
  "source_count": 5,
  "context": {
    "memories": [...],
    "token_estimate": 1200
  }
}
```

---

#### `POST /memories/context`

Build a formatted context string from relevant memories. **Auth required.**

**Request body**:

```json
{
  "query": "What do I know about deployments?",
  "tier": 1,
  "project_id": "engram-platform",
  "user_id": null,
  "session_id": null,
  "max_tokens": 4000
}
```

**Response** `200`:

```json
{
  "query": "What do I know about deployments?",
  "context": "Memory 1 (importance: 0.8): The deployment uses Nginx...\nMemory 2 (importance: 0.6): ...",
  "token_estimate": 850
}
```

---

### Knowledge Graph Endpoints

#### `POST /graph/entities`

Add a new entity to the knowledge graph. **Auth required.**

**Request body**:

```json
{
  "name": "Weaviate",
  "entity_type": "tool",
  "description": "Vector database used for memory storage",
  "project_id": "engram-platform",
  "tenant_id": "default",
  "aliases": ["weaviate-db"],
  "metadata": { "version": "1.27.0" }
}
```

**Response** `201`:

```json
{
  "entity_id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890"
}
```

---

#### `GET /graph/entities`

List knowledge graph entities. **Auth required.**

**Query parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `tenant_id` | string | null | Filter by tenant |
| `project_id` | string | null | Filter by project |
| `limit` | int (1-500) | 50 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response** `200`:

```json
{
  "entities": [
    {
      "entity_id": "e1f2a3b4-...",
      "name": "Weaviate",
      "entity_type": "tool",
      "description": "Vector database used for memory storage",
      "project_id": "engram-platform",
      "created_at": "2026-03-31T14:22:00Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

---

#### `GET /graph/entities/by-name`

Find an entity by name. **Auth required.**

**Query parameters**:
- `name` (required): Entity name to search.
- `project_id` (optional): Project scope.
- `tenant_id` (optional, default: `"default"`).

**Response** `200`:

```json
{
  "entity_id": "e1f2a3b4-...",
  "name": "Weaviate",
  "entity_type": "tool",
  "description": "Vector database used for memory storage",
  "project_id": "engram-platform",
  "tenant_id": "default",
  "aliases": ["weaviate-db"],
  "metadata": { "version": "1.27.0" },
  "created_at": "2026-03-31T14:22:00Z",
  "updated_at": "2026-03-31T14:22:00Z"
}
```

**Errors**: `404` if entity not found.

---

#### `GET /graph/entities/{entity_id}`

Get entity by UUID. **Auth required.**

**Query parameters**:
- `tenant_id` (optional, default: `"default"`).

**Response** `200`: Same as `GET /graph/entities/by-name` response.

---

#### `DELETE /graph/entities/{entity_id}`

Delete an entity. **Auth required.**

**Query parameters**:
- `tenant_id` (optional, default: `"default"`).

**Response** `200`:

```json
{
  "deleted": true
}
```

---

#### `POST /graph/relations`

Add a relation between two entities. **Auth required.**

**Request body**:

```json
{
  "source_entity_id": "e1f2a3b4-...",
  "target_entity_id": "f2a3b4c5-...",
  "relation_type": "depends_on",
  "weight": 0.9,
  "project_id": "engram-platform",
  "tenant_id": "default",
  "context": "Memory API requires Weaviate for vector storage"
}
```

**Response** `201`:

```json
{
  "relation_id": "r1a2b3c4-d5e6-7890-abcd-ef1234567890"
}
```

---

#### `POST /graph/query`

Traverse the knowledge graph from an entity (BFS). **Auth required.**

**Request body**:

```json
{
  "entity_id": "e1f2a3b4-...",
  "depth": 2,
  "project_id": "engram-platform",
  "tenant_id": "default"
}
```

**Response** `200`:

```json
{
  "root_entity_id": "e1f2a3b4-...",
  "entities": [
    {
      "entity_id": "e1f2a3b4-...",
      "name": "Memory API",
      "entity_type": "service",
      "description": "...",
      "project_id": "engram-platform",
      "tenant_id": "default",
      "aliases": [],
      "metadata": {},
      "created_at": "2026-03-31T14:22:00Z",
      "updated_at": "2026-03-31T14:22:00Z"
    }
  ],
  "relations": [
    {
      "relation_id": "r1a2b3c4-...",
      "source_entity_id": "e1f2a3b4-...",
      "target_entity_id": "f2a3b4c5-...",
      "relation_type": "depends_on",
      "weight": 0.9,
      "project_id": "engram-platform",
      "tenant_id": "default",
      "context": "...",
      "created_at": "2026-03-31T14:22:00Z"
    }
  ],
  "depth": 2
}
```

---

### Tenant Management Endpoints

#### `POST /tenants`

Create a new tenant. **Auth required.**

**Request body**:

```json
{
  "tenant_id": "my-tenant"
}
```

**Response** `201`:

```json
{
  "tenant_id": "my-tenant",
  "status": "created"
}
```

---

#### `GET /tenants`

List all tenants. **Auth required.**

**Response** `200`:

```json
{
  "tenants": ["default", "my-tenant"],
  "total": 2
}
```

---

#### `DELETE /tenants/{tenant_id}`

Delete a tenant and all its data. **Auth required.**

**Response** `200`:

```json
{
  "tenant_id": "my-tenant",
  "status": "deleted"
}
```

---

### Investigation Matter Endpoints

All investigation endpoints are prefixed with `/matters`.

#### `POST /matters/`

Create a new investigation matter with tenant isolation. **Auth required.**

**Request body**:

```json
{
  "matter_id": "CASE-2026-001",
  "title": "Infrastructure Audit Q1",
  "description": "Review of all production infrastructure",
  "tags": ["audit", "infrastructure"],
  "lead_investigator": "admin"
}
```

**Response** `201`:

```json
{
  "matter_id": "CASE-2026-001",
  "title": "Infrastructure Audit Q1",
  "description": "Review of all production infrastructure",
  "status": "ACTIVE",
  "created_at": "2026-03-31T14:22:00Z",
  "tags": ["audit", "infrastructure"],
  "lead_investigator": "admin",
  "id": "weaviate-uuid-here"
}
```

**Errors**: `409` if matter_id already exists.

---

#### `GET /matters/`

List all matters, optionally filtered by status. **Auth required.**

**Query parameters**:
- `matter_status` (optional): `ACTIVE`, `CLOSED`, or `ARCHIVED`.

**Response** `200`: Array of `MatterResponse` objects.

---

#### `GET /matters/{matter_id}`

Get a matter by its ID. **Auth required.**

**Response** `200`: `MatterResponse` object.

**Errors**: `404` if not found.

---

#### `PATCH /matters/{matter_id}/status`

Update matter status. **Auth required.**

**Query parameters**:
- `new_status`: `ACTIVE`, `CLOSED`, or `ARCHIVED`.

**Response** `200`: Updated `MatterResponse` object.

---

#### `DELETE /matters/{matter_id}`

Delete a matter and all its tenant data. **Auth required.**

**Response** `204`: No content.

---

#### `POST /matters/{matter_id}/evidence`

Ingest a document into the matter's evidence store. Content is automatically chunked and embedded. **Auth required.**

**Request body**:

```json
{
  "matter_id": "CASE-2026-001",
  "content": "Full text content of the document...",
  "source_url": "https://example.com/report.pdf",
  "source_type": "WEB",
  "metadata": { "author": "admin" },
  "page_number": 0,
  "message_id": ""
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | string | -- | Document content to ingest |
| `source_url` | string | `""` | Source URL or file path |
| `source_type` | string | `"MANUAL"` | One of: PDF, EMAIL, CSV, WEB, MANUAL |
| `metadata` | object | {} | Additional metadata |
| `page_number` | int | 0 | Page number reference |
| `message_id` | string | `""` | Email message ID |

**Response** `201`: Array of `EvidenceResponse` objects (one per chunk):

```json
[
  {
    "id": "chunk-uuid",
    "matter_id": "CASE-2026-001",
    "source_url": "https://example.com/report.pdf",
    "source_type": "WEB",
    "chunk_index": 0,
    "ingested_at": "2026-03-31T14:22:00Z"
  }
]
```

---

#### `POST /matters/{matter_id}/evidence/search`

Semantic search within a matter's evidence. **Auth required.**

**Request body**:

```json
{
  "matter_id": "CASE-2026-001",
  "query": "infrastructure vulnerabilities",
  "limit": 10,
  "offset": 0,
  "source_types": ["WEB", "PDF"]
}
```

**Response** `200`:

```json
{
  "results": [...],
  "total": 5,
  "query": "infrastructure vulnerabilities",
  "matter_id": "CASE-2026-001",
  "limit": 10,
  "offset": 0
}
```

---

#### `POST /matters/{matter_id}/crawl`

Trigger an OSINT crawl job for a matter. Non-blocking, returns immediately. **Auth required.**

**Request body**: JSON array of `seed_urls`.

**Query parameters**:
- `max_pages` (default: 50)
- `max_depth` (default: 2)

**Response** `202`:

```json
{
  "status": "accepted",
  "matter_id": "CASE-2026-001",
  "seed_urls": ["https://example.com"],
  "max_pages": 50,
  "max_depth": 2,
  "message": "Crawl job queued. Results will be ingested into evidence store."
}
```

---

### Analytics Endpoints

#### `GET /analytics`

Aggregated analytics for the frontend dashboard. **Auth required.**

**Query parameters**:
- `tenant_id` (optional).

**Response** `200`:

```json
{
  "total_memories": 142,
  "total_entities": 25,
  "total_relations": 0,
  "memory_distribution": { "fact": 80, "insight": 30, "code": 20 },
  "tier_distribution": { "1": 98, "2": 32, "3": 12 },
  "timestamp": "2026-03-31T14:22:00Z"
}
```

---

#### `GET /analytics/memory-growth`

Time-series memory counts by tier. **Auth required.**

**Query parameters**:
- `tenant_id` (optional).
- `period`: `daily` (default), `weekly`, or `monthly`.

**Response** `200`: Array of `MemoryGrowthPoint`:

```json
[
  { "date": "2026-03-01", "total": 50, "tier1": 30, "tier2": 15, "tier3": 5 },
  { "date": "2026-03-31", "total": 142, "tier1": 98, "tier2": 32, "tier3": 12 }
]
```

---

#### `GET /analytics/activity-timeline`

Daily activity counts from the search log. **Auth required.**

**Query parameters**:
- `tenant_id` (optional).
- `year` (default: current year).

**Response** `200`: Array of `ActivityDay`:

```json
[
  { "date": "2026-03-30", "count": 15 },
  { "date": "2026-03-31", "count": 23 }
]
```

---

#### `GET /analytics/search-stats`

Search analytics from the in-memory log. **Auth required.**

**Response** `200`:

```json
{
  "total_searches": 150,
  "avg_score": 0.0,
  "top_queries": [
    { "query": "deployment config", "count": 12, "avg_score": 0.0 }
  ],
  "score_distribution": [
    { "bucket": "0.0-0.2", "count": 0 },
    { "bucket": "0.8-1.0", "count": 150 }
  ]
}
```

---

#### `GET /analytics/system-metrics`

Real-time system health metrics. **Auth required.**

**Response** `200`:

```json
{
  "weaviate_latency_ms": 12.5,
  "redis_latency_ms": 3.2,
  "api_uptime_seconds": 86400.0,
  "requests_per_minute": 2.5,
  "error_rate": 0.01
}
```

---

#### `GET /analytics/knowledge-graph-stats`

Knowledge graph entity/relation counts. **Auth required.**

**Response** `200`:

```json
{
  "entities_by_type": { "tool": 5, "service": 3, "concept": 10 },
  "total_entities": 18,
  "total_relations": 0
}
```

---

#### `GET /analytics/logs`

Recent search/activity logs. **Auth required.**

**Query parameters**:
- `limit` (1-500, default: 50).

**Response** `200`:

```json
{
  "logs": [
    {
      "timestamp": "2026-03-31T14:22:00Z",
      "query": "deployment config",
      "results_count": 5,
      "tier": 1,
      "tenant_id": "default",
      "user_id": "admin"
    }
  ],
  "total": 150
}
```

---

#### `GET /metrics`

Prometheus-format metrics endpoint. **No authentication required.**

**Response** `200` (text/plain):

```
# HELP ai_memory_requests_total Total HTTP requests
# TYPE ai_memory_requests_total counter
ai_memory_requests_total 1500
# HELP ai_memory_errors_total Total HTTP errors
# TYPE ai_memory_errors_total counter
ai_memory_errors_total 5
# HELP ai_memory_latency_ms_avg Average request latency in milliseconds
# TYPE ai_memory_latency_ms_avg gauge
ai_memory_latency_ms_avg 15.32
# HELP ai_memory_uptime_seconds Server uptime in seconds
# TYPE ai_memory_uptime_seconds gauge
ai_memory_uptime_seconds 86400
```

---

### Admin Endpoints

#### `GET /admin/keys`

List all API keys with metadata (key values are masked). **Auth required.**

**Response** `200`:

```json
{
  "keys": [
    {
      "id": "ek_a1b2c3d4e5f6a7b8",
      "name": "Production MCP Server",
      "prefix": "AbCdEfGh...wxYz",
      "created_at": "2026-03-20T10:00:00Z",
      "created_by": "admin",
      "last_used_at": "2026-03-31T14:00:00Z",
      "status": "active",
      "request_count": 1542,
      "source": "api"
    }
  ],
  "total": 1
}
```

---

#### `POST /admin/keys`

Create a new API key. Returns the full key value once -- it cannot be retrieved again. **Auth required.**

**Request body**:

```json
{
  "name": "My New Key"
}
```

**Response** `201`:

```json
{
  "id": "ek_b2c3d4e5f6a7b8c9",
  "name": "My New Key",
  "key": "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefgh",
  "prefix": "AbCdEfGh...efgh",
  "created_at": "2026-03-31T14:22:00Z"
}
```

**Errors**: `400` if name is empty or exceeds 100 characters.

---

#### `PATCH /admin/keys/{key_id}`

Update key name or status. **Auth required.**

**Request body**:

```json
{
  "name": "Renamed Key",
  "status": "active"
}
```

**Response** `200`: Updated key metadata (without key_hash).

---

#### `DELETE /admin/keys/{key_id}`

Revoke an API key (soft-delete). **Auth required.**

**Response** `200`:

```json
{
  "status": "revoked",
  "key_id": "ek_b2c3d4e5f6a7b8c9"
}
```

---

#### `GET /admin/audit-log`

Query the audit log with optional filters. **Auth required.**

**Query parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `key_id` | string | null | Filter by API key ID |
| `path` | string | null | Filter by path (substring match) |
| `method` | string | null | Filter by HTTP method |
| `limit` | int (1-500) | 50 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response** `200`:

```json
{
  "entries": [
    {
      "id": "1711900920000-0",
      "timestamp": "2026-03-31T14:22:00Z",
      "key_id": "",
      "key_name": "",
      "identity": "apikey:AbCd...",
      "method": "POST",
      "path": "/memories",
      "status_code": "200",
      "ip": "127.0.0.1",
      "latency_ms": "12.5",
      "tenant_id": "default"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0,
  "has_more": true
}
```

---

#### `GET /admin/audit-log/summary`

Audit log summary statistics for the last N hours. **Auth required.**

**Query parameters**:
- `hours` (1-720, default: 24).

**Response** `200`:

```json
{
  "period_hours": 24,
  "total_requests": 500,
  "error_count": 5,
  "error_rate": 1.0,
  "top_endpoints": [
    { "path": "/memories/search", "count": 200 },
    { "path": "/memories", "count": 150 }
  ],
  "top_keys": [
    { "key": "Production MCP Server", "count": 400 }
  ],
  "stream_size": 5000
}
```

---

### Maintenance Endpoints

#### `POST /memories/consolidate`

Trigger memory consolidation -- merges related memories to reduce redundancy. **Auth required.**

**Query parameters**:
- `project_id` (optional).
- `tenant_id` (optional).

**Response** `200`:

```json
{
  "processed": 5
}
```

---

#### `POST /memories/cleanup`

Remove expired memories. **Auth required.**

**Query parameters**:
- `tenant_id` (optional).

**Response** `200`:

```json
{
  "removed": 3
}
```

---

#### `POST /memories/decay`

Manually trigger memory decay calculation for all memories. **Auth required.**

**Query parameters**:
- `tenant_id` (optional).

**Response** `200`:

```json
{
  "processed": 42,
  "total_checked": 142
}
```

---

#### `POST /memories/confidence-maintenance`

Trigger confidence propagation and contradiction detection. **Auth required.**

**Query parameters**:
- `tenant_id` (optional).

**Response** `200`:

```json
{
  "status": "success",
  "message": "Confidence maintenance job triggered"
}
```

---

### Export Endpoints

#### `GET /memories/export`

Export memories as JSONL or CSV download. **Auth required.**

**Query parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `format` | string | `"jsonl"` | `jsonl` or `csv` |
| `tier` | int (1-3) | null | Filter by tier |
| `project_id` | string | null | Filter by project |
| `tenant_id` | string | null | Filter by tenant |
| `limit` | int (1-10000) | 1000 | Max records |

**Response** `200`: Streaming download.

JSONL format (`application/x-ndjson`):
```
{"id":"uuid","content":"...","tier":1,"memory_type":"fact","importance":0.7,"project_id":"...","tenant_id":"default","tags":[],"created_at":"2026-03-31T14:22:00Z"}
{"id":"uuid","content":"...","tier":1,...}
```

CSV format (`text/csv`):
```csv
id,content,tier,memory_type,source,project_id,tenant_id,importance,confidence,tags,created_at
uuid,...,1,fact,agent,...,default,0.7,1.0,"tag1,tag2",2026-03-31T14:22:00Z
```

---

### WebSocket Endpoints

#### `WS /ws/events`

Live memory system event stream.

**Events**:

```json
{ "type": "connected", "message": "Listening for memory events" }
{ "type": "memory_added", "memory_id": "uuid", "tier": 1 }
{ "type": "memory_deleted", "memory_id": "uuid" }
```

Send `"ping"` to receive `"pong"` for keepalive.

---

## 2. MCP Tools

The Engram MCP Server exposes memory operations as MCP tools for AI clients (Claude Code, Claude Desktop, etc.). The server supports both stdio and HTTP streaming transports.

### Memory Tools

| Tool | Description | Read-only | Destructive |
|---|---|---|---|
| `add_memory` | Add a memory (tier, type, importance, tags) | No | No |
| `search_memory` | Semantic search with filters | Yes | No |
| `get_memory` | Retrieve by UUID + tier | Yes | No |
| `delete_memory` | Delete by UUID + tier | No | Yes |
| `list_memories` | Paginated listing with filters | Yes | No |
| `batch_add_memories` | Add up to 100 memories in one call | No | No |
| `build_context` | Build formatted context for a query | Yes | No |
| `rag_query` | RAG query with synthesis prompt | Yes | No |
| `consolidate_memories` | Merge related memories | No | Yes |
| `cleanup_expired` | Remove expired memories | No | Yes |
| `export_memories` | Export as json/csv/markdown | Yes | No |
| `bulk_delete_memories` | Bulk delete by criteria | No | Yes |
| `trigger_confidence_maintenance` | Run confidence/contradiction checks | No | No |
| `get_analytics` | Aggregated analytics | Yes | No |
| `get_system_metrics` | System performance data | Yes | No |
| `manage_tenant` | Create/list/delete tenants | No | Yes |
| `get_memory_growth` | Memory growth time series | Yes | No |
| `get_activity_timeline` | Activity timeline data | Yes | No |
| `get_search_stats` | Search statistics | Yes | No |
| `get_kg_stats` | Knowledge graph statistics | Yes | No |

### Entity Tools

| Tool | Description | Read-only | Destructive |
|---|---|---|---|
| `add_entity` | Add a knowledge graph entity | No | No |
| `add_relation` | Add a relation between entities | No | No |
| `query_graph` | Traverse the knowledge graph by entity name | Yes | No |
| `health_check` | Check MCP server and dependency health | Yes | No |

### Investigation Tools

| Tool | Description | Read-only | Destructive |
|---|---|---|---|
| `create_matter` | Create an investigation matter | No | No |
| `ingest_document` | Ingest evidence into a matter | No | No |
| `search_matter` | Semantic search within a matter's evidence | Yes | No |

---

*Document 08 of the Engram Platform System Documentation.*
