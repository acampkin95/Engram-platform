# Engram Platform — System Architecture

**Version**: 1.1.0
**Last Updated**: 2026-03-31
**Status**: Production

---

## 1. System Overview

Engram is a multi-layer AI memory and intelligence platform. It provides persistent, searchable, tiered vector memory for AI agents, an OSINT web crawler with AI-powered content analysis, and a unified frontend dashboard. The system is composed of six primary components and four supporting infrastructure services, all orchestrated via Docker Compose on a single host.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                       │
│  Claude Code (stdio) │ Claude Desktop │ Browser │ HTTP API consumers │
└────────┬─────────────┴───────┬────────┴────┬────┴───────────────────┘
         │ stdio               │ HTTPS/443   │
         │                     ▼             │
         │            ┌────────────────┐     │
         │            │  Nginx Proxy   │◄────┘
         │            │  (port 80/443) │
         │            └──┬──┬──┬──┬────┘
         │               │  │  │  │
         │    ┌──────────┘  │  │  └──────────────┐
         │    │  /api/      │  │  /api/           │  /mcp
         │    │  crawler/   │  │  memory/         │
         │    ▼             │  ▼                  ▼
         │ ┌────────────┐  │ ┌──────────────┐ ┌──────────────┐
         │ │ Crawler API │  │ │  Memory API  │ │  MCP Server  │
         │ │  FastAPI    │  │ │  FastAPI     │ │  TypeScript   │
         │ │  :11235     │  │ │  :8000       │ │  :3000 HTTP   │
         │ └──────┬─────┘  │ └──┬───────┬───┘ └──────┬───────┘
         │        │        │    │       │             │
         └────────┼────────┼────┼───────┼─────────────┘
                  │        │    │       │        │ stdio
                  ▼        │    ▼       ▼        │
         ┌────────────┐   │ ┌──────┐ ┌───────┐  │
         │ ChromaDB   │   │ │Weavi-│ │Memory │  │
         │ (embedded) │   │ │ate   │ │Redis  │  │
         │            │   │ │:8080 │ │:6379  │  │
         └────────────┘   │ └──────┘ └───────┘  │
         ┌────────────┐   │                      │
         │ Crawler     │  │                      │
         │ Redis :6379 │  │                      │
         └────────────┘   │                      │
                          ▼                      │
                  ┌────────────────┐             │
                  │ Platform       │             │
                  │ Frontend       │             │
                  │ Next.js :3000  │             │
                  │ (container)    │             │
                  └────────────────┘             │
                                                │
                  ┌─────────────────────────────┘
                  ▼
          Claude Code / Desktop
          (local stdio transport)
```

---

## 2. Component Inventory

| Component | Language | Framework | Container Name | Internal Port | Image |
|---|---|---|---|---|---|
| **Memory API** | Python 3.11+ | FastAPI + Uvicorn | `engram-memory-api` | 8000 | `engram-memory-api:latest` |
| **Crawler API** | Python 3.11 | FastAPI + Crawl4AI | `engram-crawler-api` | 11235 | `crawl4ai-engram:latest` |
| **MCP Server** | TypeScript (Node 20+) | @modelcontextprotocol/sdk | `engram-mcp-server` | 3000 | `engram-mcp-server:latest` |
| **Platform Frontend** | TypeScript | Next.js 15 / React 19 | `engram-platform-frontend` | 3000 | `engram-platform-frontend:latest` |
| **Weaviate** | Go | Weaviate 1.27.0 | `engram-weaviate` | 8080 (HTTP), 50051 (gRPC) | `semitechnologies/weaviate:1.27.0` |
| **Memory Redis** | C | Redis 7 Alpine | `engram-memory-redis` | 6379 | `redis:7-alpine` |
| **Crawler Redis** | C | Redis 7 Alpine | `engram-crawler-redis` | 6379 | `redis:7-alpine` |
| **Nginx** | C | Nginx Alpine | `engram-nginx` | 80, 443 | `nginx:alpine` |
| **engram-shared** | Python | Shared library | N/A (installed as dependency) | N/A | N/A |

---

## 3. Component Responsibilities

### 3.1 Engram-AiMemory (Memory API)

**Path**: `Engram-AiMemory/packages/core/src/memory_system/`

The core of the platform. A FastAPI application serving the 3-tier vector memory system.

**Tier Architecture**:
- **Tier 1 (Project)**: Per-project isolated memory. Code insights, decisions, patterns. Scoped by `project_id` and `tenant_id`.
- **Tier 2 (General)**: Cross-project, user-specific memory. Preferences, workflows, learned patterns.
- **Tier 3 (Global)**: Shared bootstrap knowledge. Best practices, documentation, reference material.

**Key Modules**:

| Module | File | Responsibility |
|---|---|---|
| API Server | `api.py` | FastAPI app, REST endpoints, WebSocket events, rate limiting (slowapi) |
| Memory System | `system.py` | Orchestrator: add, search, consolidate, cleanup, multi-tenant isolation |
| Weaviate Client | `client.py` | Vector DB operations, schema management, multi-tenancy |
| Redis Cache | `cache.py` | Caching layer with key prefixes: `emb:`, `search:`, `mem:`, `sess:`, `stats:` |
| Embeddings | `embeddings.py` | Multi-provider: OpenAI, DeepInfra, Nomic (local), Ollama |
| RAG Pipeline | `rag.py` | Context retrieval, memory compression, synthesis prompt assembly |
| Decay Engine | `decay.py` | Exponential decay: `2^(-age_days / half_life_days)`, access-count boost |
| Auth | `auth.py` | JWT + API key authentication |
| Key Manager | `key_manager.py` | API key CRUD lifecycle with scoped permissions |
| Audit Logger | `audit.py` | Structured audit trail for admin actions and auth events |
| Investigation | `investigation/` | Document ingestion: PDF, DOCX, email, web content chunking |
| Config | `config.py` | Pydantic Settings from env vars |
| Context Builder | `context.py` | Memory compression and context window assembly for RAG |
| Analyzer | `analyzer.py` | Memory analytics and pattern detection |

**API Endpoints** (selected):
- `POST /memories` — Add memory with tier, type, importance, tags
- `GET /memories/{id}` — Retrieve memory by UUID
- `POST /search` — Semantic vector search with tier/project filters
- `POST /rag` — RAG query with context assembly
- `POST /entities` — Add knowledge graph entity
- `POST /relations` — Add entity relationship
- `POST /admin/keys` — Create scoped API key
- `GET /admin/audit` — Query audit log
- `POST /matters` — Create investigation matter
- `POST /matters/{id}/ingest` — Ingest document into matter
- `POST /matters/{id}/search` — Semantic search within matter evidence
- `GET /health` — Health check

**Rate Limiting**: slowapi with `get_remote_address` key function. Configured via `_api_settings`.

### 3.2 Engram-AiCrawler (Crawler API)

**Path**: `Engram-AiCrawler/01_devroot/app/`

An OSINT web crawler with AI-powered content analysis. Five-stage pipeline:

1. **Alias Discovery** — Scans 8 platforms for username/handle presence
2. **Crawl** — Crawl4AI with headless Chromium (viewport 1920x1080, page timeout 60s)
3. **Model Review** — LM Studio inference for keep/derank/archive decisions (temperature 0.7)
4. **Store** — ChromaDB vector storage (collection prefix `crawl4ai_`, similarity threshold 0.7)
5. **Knowledge Graph** — Entity and relationship extraction

**Data Lifecycle Tiers**:

| Tier | Path (container) | Max Age | Purpose |
|---|---|---|---|
| Hot | `/app/data/tiers/hot` | 24 hours | Active crawl data |
| Warm | `/app/data/tiers/warm` | 7 days | Recent results |
| Cold | `/app/data/tiers/cold` | 30 days | Archived results |
| Archive | `/app/data/tiers/archive` | N/A (10 GB threshold) | Long-term storage |

**Process Management**: Supervisord manages FastAPI, LM Studio bridge, and watchdog processes. Watchdog checks every 300 seconds, monitors memory (85% threshold) and disk (90% threshold), cleans orphan processes older than 60 minutes.

**External Dependencies**:
- LM Studio at `http://host.docker.internal:1234` (configurable via `LM_STUDIO_URL`)
- Memory API at `http://memory-api:8000` for cross-service storage
- ChromaDB embedded at `/app/data/chroma`

### 3.3 Engram-MCP (MCP Server)

**Path**: `Engram-MCP/src/`

A Model Context Protocol server supporting dual transport: stdio (for Claude Code/Desktop local connections) and HTTP streaming (for remote clients via Nginx).

**Key Modules**:

| Module | File | Responsibility |
|---|---|---|
| Server Factory | `server.ts` | Transport-agnostic MCP server with tools, resources, prompts |
| HTTP Client | `client.ts` | Resilient fetch to Memory API: timeout + retry + circuit breaker |
| Circuit Breaker | `circuit-breaker.ts` | Prevents cascading failures (5 failures open, 30s reset, 2 successes close) |
| Retry | `retry.ts` | Exponential backoff: 3 retries, 100ms initial, 5s max, 2x multiplier, 0.1 jitter |
| Config | `config.ts` | Unified config from env vars and CLI args |
| Auth (OAuth) | `auth/` | OAuth 2.1 with PKCE + dynamic client registration |
| Tool Definitions | `tools/tool-definitions.ts` | All MCP tool schemas |
| Memory Tools | `tools/memory-tools.ts` | Memory CRUD, search, RAG via Memory API |
| Entity Tools | `tools/entity-tools.ts` | Knowledge graph operations |
| Investigation Tools | `tools/investigation-tools.ts` | Matter management, document ingestion |
| Hook Manager | `hooks/hook-manager.ts` | Auto memory recall/store hooks |
| Installer | `installer/` | `npx @engram/mcp init` CLI setup |

**Resilience Configuration**:

| Parameter | Value |
|---|---|
| Request timeout | 30,000 ms |
| Connection timeout | 5,000 ms |
| Max retries | 3 |
| Initial retry delay | 100 ms |
| Max retry delay | 5,000 ms |
| Backoff multiplier | 2x |
| Circuit breaker failure threshold | 5 failures in 60s window |
| Circuit breaker reset timeout | 30,000 ms |
| Circuit breaker success threshold | 2 successes to close |
| HTTP keep-alive max sockets | 50 |

**OAuth Configuration** (when enabled):
- Access token TTL: 3,600 seconds (1 hour)
- Refresh token TTL: 86,400 seconds (24 hours)
- Redis key prefix: `mcp:oauth:`

### 3.4 Engram-Platform (Frontend)

**Path**: `Engram-Platform/frontend/`

Next.js 15 App Router with React 19 Server Components. Serves as the unified dashboard.

**Technology Stack**:

| Layer | Technology |
|---|---|
| Framework | Next.js 15 with Turbopack |
| UI Library | React 19 (Server Components) |
| Auth | Clerk (`@clerk/nextjs`) |
| State Management | Zustand v5 + Jotai |
| Data Fetching | SWR v2 |
| Charts | ECharts + Recharts |
| UI Components | Radix primitives + shadcn/ui |
| Styling | Tailwind CSS v4 (CSS-native) |
| Path Alias | `@/` maps to `frontend/` root |

**Design System**:
- Dark-mode-first
- Primary: Amber `#F2A93B`
- Accent: Violet `#7C5CBF`
- Background: Deep Void `#03020A`
- Display font: Syne
- Mono font: IBM Plex Mono
- Serif font: Instrument Serif

**Dashboard Sections**: Memory browser, crawler UI, knowledge graph viewer, API key management, audit logs, system analytics.

### 3.5 engram-shared (Shared Library)

**Path**: `engram-shared/`

A shared Python library providing common utilities, type definitions, and configuration helpers consumed by both the Memory API and Crawler API. Installed as a dependency in both services.

---

## 4. Service Boundaries and Failure Domains

### Failure Domain Map

```
┌─────────────────────────────────────────────────────────┐
│ DOMAIN A: Ingress                                       │
│ ┌─────────┐                                             │
│ │  Nginx  │ Single point of entry for HTTP/HTTPS        │
│ └─────────┘ Failure: all browser access lost            │
│             MCP stdio unaffected                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DOMAIN B: Memory Core                                   │
│ ┌────────────┐  ┌──────────┐  ┌──────────────┐         │
│ │ Memory API │──│ Weaviate │  │ Memory Redis │         │
│ │  :8000     │  │  :8080   │  │  :6379       │         │
│ └────────────┘  └──────────┘  └──────────────┘         │
│ Failure: all memory operations unavailable              │
│ Redis failure: degraded mode (no cache, still works)    │
│ Weaviate failure: total memory outage                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DOMAIN C: Crawler                                       │
│ ┌─────────────┐  ┌───────────────┐  ┌─────────────┐    │
│ │ Crawler API │──│ Crawler Redis │  │ ChromaDB    │    │
│ │  :11235     │  │  :6379        │  │ (embedded)  │    │
│ └─────────────┘  └───────────────┘  └─────────────┘    │
│ Failure: crawling unavailable; memory still works       │
│ LM Studio failure: model review skipped, crawl continues│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DOMAIN D: MCP                                           │
│ ┌────────────┐                                          │
│ │ MCP Server │ Depends on Memory API (Domain B)         │
│ │  :3000     │ Circuit breaker isolates failures        │
│ └────────────┘                                          │
│ Failure: Claude Code/Desktop lose memory access          │
│ Circuit open: fast-fail after 5 errors in 60s           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DOMAIN E: Frontend                                      │
│ ┌──────────────────┐                                    │
│ │ Platform Frontend │ Stateless; depends on APIs         │
│ │  :3000 (container)│ via server-side + client-side      │
│ └──────────────────┘                                    │
│ Failure: dashboard unavailable; APIs still accessible   │
│ Clerk failure: auth unavailable, dashboard inaccessible  │
└─────────────────────────────────────────────────────────┘
```

### Dependency Graph

```
Nginx ──► Platform Frontend
Nginx ──► Memory API ──► Weaviate
                     ──► Memory Redis (optional/degraded)
Nginx ──► Crawler API ──► Crawler Redis
                      ──► Memory API
                      ──► LM Studio (external, optional)
                      ──► ChromaDB (embedded)
Nginx ──► MCP Server ──► Memory API
Claude Code ──► MCP Server (stdio) ──► Memory API
```

---

## 5. Interaction Patterns

### 5.1 Synchronous Request/Response
- Browser → Nginx → Platform Frontend (SSR pages)
- Browser → Nginx → Memory API (REST JSON)
- Browser → Nginx → Crawler API (REST JSON)
- MCP Client → MCP Server → Memory API → Weaviate

### 5.2 WebSocket
- Browser → Nginx `/ws` → Crawler API WebSocket (live crawl progress)
- Memory API internal `_ConnectionManager` broadcasts events to connected WebSocket clients

### 5.3 Stdio (MCP)
- Claude Code/Desktop → stdin/stdout → MCP Server → HTTP → Memory API

### 5.4 Background/Async
- Crawler API: Crawl jobs run asynchronously; watchdog process monitors resource usage
- Memory API: Background tasks for consolidation and cleanup (`_background_tasks` set in `MemorySystem`)
- Memory API: Maintenance scheduler (`_scheduler`) for periodic decay recalculation

### 5.5 Cross-Service Communication
All inter-service communication uses HTTP over the Docker bridge network `engram-platform-network`. No service-mesh or message queue. Services resolve each other by Docker Compose service name (e.g., `http://memory-api:8000`).

---

## 6. Data Flow Overview

```
                    ┌─────────────┐
                    │ User Input  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Platform │ │  MCP     │ │ Crawler  │
        │ Frontend │ │ (stdio)  │ │  API     │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             ▼            ▼            ▼
        ┌─────────────────────────────────────┐
        │          Memory API (:8000)         │
        │  Embedding → Weaviate → Redis Cache │
        └──────────────┬──────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
        ┌──────────┐     ┌──────────┐
        │ Weaviate │     │  Redis   │
        │  :8080   │     │  :6379   │
        │ Vectors  │     │  Cache   │
        └──────────┘     └──────────┘
```

**Write Path**: Content → Embedding provider → Vector → Weaviate storage → Redis cache invalidation
**Read Path**: Query → Redis cache check → (miss) Embedding → Weaviate vector search → Decay reranking → Cache store → Response

---

## 7. Security Boundaries

| Boundary | Mechanism |
|---|---|
| External → Nginx | TLS 1.2/1.3, HSTS, security headers (CSP, X-Frame-Options, X-Content-Type-Options) |
| Nginx → Services | HTTP over Docker bridge network (not exposed to host) |
| Memory API auth | JWT tokens + API keys with scoped permissions |
| MCP Server auth | Bearer token (`MCP_AUTH_TOKEN`) or OAuth 2.1 with PKCE |
| Platform Frontend auth | Clerk (`@clerk/nextjs`) with custom domain |
| Container isolation | `no-new-privileges:true`, `read_only: true` (Memory API, MCP, Frontend) |
| Rate limiting | Nginx: 60r/s API, 120r/s general, 20r/s write. Memory API: slowapi |
| Network isolation | Single Docker bridge network; only Nginx ports exposed to host |
| Memory API port 8000 | Exposed to host for direct Tailscale access by MCP stdio clients |
