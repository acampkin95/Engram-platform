# Engram Platform — Architecture & Feature Factsheet

**Version:** 0.7.0 (70% Complete)  
**Generated:** 2026-03-17  
**Classification:** Internal Technical Reference

---

## Page 1: Architecture Overview

### System Summary

Engram is a production-grade multi-layer AI memory and intelligence platform. It provides AI assistants with persistent, searchable memory across projects, backed by an OSINT web crawler, knowledge graph engine, and unified dashboard.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              ENGRAM-PLATFORM  (Next.js 15 · Port 3002)           │
│   Dashboard · Memory Browser · Crawler UI · Knowledge Graph     │
│   Auth: Clerk · State: Zustand v5 · Fetch: SWR v2               │
├──────────────┬───────────────────┬───────────────────────────────┤
│  ENGRAM-MCP  │  CRAWLER API      │  MEMORY API                   │
│  Port 3000   │  Port 11235       │  Port 8000                    │
│  TypeScript  │  Python/FastAPI   │  Python/FastAPI               │
│  OAuth 2.1   │  JWT (Clerk)      │  JWT + API Key                │
├──────────────┴───────────────────┴───────────────────────────────┤
│     Weaviate :8080 (Vectors)  │  Redis x2 :6379/:6380 (Cache)   │
│     ChromaDB (Crawler local)  │  Chromium (Browser automation)   │
└───────────────────────────────┴──────────────────────────────────┘
```

### Service Topology

| Service           | Technology              | Port  | Purpose                              |
|-------------------|-------------------------|-------|--------------------------------------|
| **Platform UI**   | Next.js 15, React 19    | 3002  | Unified frontend dashboard           |
| **Memory API**    | Python 3.11+, FastAPI   | 8000  | 3-tier vector memory system          |
| **Crawler API**   | Python 3.11+, FastAPI   | 11235 | OSINT web crawler + AI analysis      |
| **MCP Server**    | TypeScript, Node 20     | 3000  | Model Context Protocol bridge        |
| **Weaviate**      | Go (vector DB)          | 8080  | Vector storage + semantic search     |
| **Crawler Redis** | Redis 7                 | 6379  | Crawler cache + job queue            |
| **Memory Redis**  | Redis 7                 | 6380  | Memory cache + rate limiting         |

### Data Pipeline

```
                    ┌─────────────┐
                    │  Web Sources │
                    └──────┬──────┘
                           │ Crawl4AI + Playwright
                    ┌──────▼──────┐
                    │  AiCrawler  │  Stage 1: Discover & Scrape
                    │  Port 11235 │  - Alias discovery (8 platforms)
                    │             │  - Deep/batch crawling
                    │  ChromaDB   │  - LM Studio AI analysis
                    │  Redis      │  - Image intelligence
                    └──────┬──────┘
                           │ REST API / Ingest
                    ┌──────▼──────┐
                    │  AiMemory   │  Stage 2: Store & Index
                    │  Port 8000  │  - 3-tier memory hierarchy
                    │             │  - Embedding generation
                    │  Weaviate   │  - Knowledge graph entities
                    │  Redis      │  - Decay & consolidation
                    └──────┬──────┘
                           │ MCP Protocol
                    ┌──────▼──────┐
                    │  MCP Server │  Stage 3: Expose to AI
                    │  Port 3000  │  - 25+ tools for AI clients
                    │             │  - Auto memory hooks
                    │  OAuth 2.1  │  - Context building
                    └──────┬──────┘
                           │ REST + SWR
                    ┌──────▼──────┐
                    │  Platform   │  Stage 4: Visualise & Manage
                    │  Port 3002  │  - Memory browser
                    │             │  - Crawler dashboard
                    │  Clerk Auth │  - Knowledge graph viewer
                    └─────────────┘
```

### Memory Tier Architecture

| Tier | Scope       | Isolation      | Use Case                          |
|------|-------------|----------------|-----------------------------------|
| **1** | Project    | Per-project    | Code insights, decisions, patterns |
| **2** | General    | Per-user       | Preferences, workflows, cross-project |
| **3** | Global     | Shared (all)   | Best practices, documentation, bootstrap |

### Authentication Matrix

| Service      | Method         | Token Type | Expiry     |
|--------------|----------------|------------|------------|
| Memory API   | JWT + API Key  | HS256      | 24 hours   |
| Crawler API  | JWT (Clerk)    | RS256      | Session    |
| MCP Server   | OAuth 2.1 / Bearer | PKCE   | 1 hr / 24 hr |
| Platform     | Clerk          | Session    | Rolling    |

---

## Page 2: Feature Specification & API Endpoints

### Feature Matrix

| Feature Area         | AiMemory | AiCrawler | MCP | Platform |
|----------------------|:--------:|:---------:|:---:|:--------:|
| Semantic search      |    Y     |     Y     |  Y  |    Y     |
| Knowledge graph      |    Y     |     Y     |  Y  |    Y     |
| OSINT alias discovery|          |     Y     |     |    Y     |
| Dark web monitoring  |          |     Y     |     |    Y     |
| Image intelligence   |          |     Y     |     |    Y     |
| Case management      |          |     Y     |     |    Y     |
| Scheduled crawling   |          |     Y     |     |    Y     |
| RAG pipeline         |    Y     |     Y     |  Y  |          |
| Memory decay         |    Y     |           |  Y  |          |
| Multi-tenancy        |    Y     |           |  Y  |          |
| OAuth 2.1            |          |           |  Y  |          |
| Real-time WebSocket  |          |     Y     |     |    Y     |
| Data lifecycle tiers |          |     Y     |     |          |
| Investigation mgmt   |    Y     |     Y     |  Y  |    Y     |

### API Endpoint Summary

#### Engram-AiMemory — 28 Endpoints (Port 8000)

| Group               | Method | Path                              | Description                        |
|----------------------|--------|-----------------------------------|------------------------------------|
| **Health**           | GET    | `/health`                         | Basic health check                 |
|                      | GET    | `/health/detailed`                | Detailed with resource usage       |
| **Auth**             | POST   | `/auth/login`                     | JWT login                          |
|                      | POST   | `/auth/refresh`                   | Refresh JWT                        |
| **Memories**         | POST   | `/memories`                       | Add memory                         |
|                      | POST   | `/memories/batch`                 | Batch add (up to 100)              |
|                      | POST   | `/memories/search`                | Semantic search                    |
|                      | GET    | `/memories/list`                  | List with pagination               |
|                      | GET    | `/memories/{id}`                  | Get by ID                          |
|                      | DELETE | `/memories/{id}`                  | Delete by ID                       |
|                      | POST   | `/memories/context`               | Build context string               |
|                      | POST   | `/memories/rag`                   | RAG query                          |
|                      | POST   | `/memories/consolidate`           | Deduplicate memories               |
|                      | POST   | `/memories/cleanup`               | Remove expired                     |
|                      | POST   | `/memories/decay`                 | Trigger decay calculation          |
| **Analytics**        | GET    | `/stats`                          | Memory counts                      |
|                      | GET    | `/analytics/memory-growth`        | Growth time-series                 |
|                      | GET    | `/analytics/activity-timeline`    | Daily activity                     |
|                      | GET    | `/analytics/search-stats`         | Search analytics                   |
|                      | GET    | `/analytics/system-metrics`       | Real-time system metrics           |
|                      | GET    | `/analytics/knowledge-graph-stats`| KG entity/relation counts          |
| **Tenants**          | POST   | `/tenants`                        | Create tenant                      |
|                      | DELETE | `/tenants/{id}`                   | Delete tenant                      |
|                      | GET    | `/tenants`                        | List tenants                       |
| **Knowledge Graph**  | POST   | `/graph/entities`                 | Add entity                         |
|                      | GET    | `/graph/entities`                 | List entities                      |
|                      | POST   | `/graph/relations`                | Add relation                       |
|                      | POST   | `/graph/query`                    | Traverse graph (BFS)               |

#### Engram-AiCrawler — 100+ Endpoints (Port 11235)

| Group                | Count | Key Paths                                  |
|----------------------|-------|--------------------------------------------|
| **Crawl**            | 7     | `/api/crawl/start`, `batch`, `deep`, `status`, `list`, `cancel`, `delete` |
| **OSINT Alias**      | 3     | `/api/osint/alias/discover`, `search`, `platforms` |
| **OSINT Image**      | 2     | `/api/osint/image/analyze`, `search`       |
| **OSINT Scan**       | 4     | `/api/osint/scan`, `scan/sync`, `scan/list`, `scan/{id}` |
| **Dark Web**         | 8     | `/api/darkweb/scan/*`, `correlate`, `status`, `sites` |
| **Chat / LM Studio** | 4     | `/api/chat/completions`, `sessions`, `history`, `clear` |
| **Data Management**  | 13    | `/api/data/sets` CRUD, `migrate`, `export`, `archive-rules` |
| **Cases**            | 20    | `/api/cases/` CRUD, `subjects`, `evidence`, `export/*`, `timeline` |
| **Investigations**   | 7     | `/api/investigations/` CRUD, link crawls/scans |
| **Knowledge Graph**  | 10    | `/api/knowledge-graph/build`, `search`, `merge`, `export` |
| **Extraction**       | 7     | `/api/extraction/templates` CRUD, `fetch-page`, `preview` |
| **RAG**              | 5     | `/api/rag/config`, `preview-chunking`, `process`, `status` |
| **Scheduling**       | 7     | `/api/scheduler/schedules` CRUD, `toggle`, `run` |
| **Storage**          | 6     | `/api/storage/collections` CRUD, `documents`, `search` |
| **Performance**      | 17    | `/api/performance/storage/*`, `cache/*`, `jobs/*`, `chroma/*` |
| **Settings**         | 3     | `/api/settings/`, `test-connection`        |
| **Stats**            | 3     | `/api/stats/dashboard`, `system`, `scheduler` |

#### Engram-MCP — 25 Tools (Port 3000)

| Category           | Count | Tools                                                    |
|--------------------|-------|----------------------------------------------------------|
| **Memory**         | 10    | `add`, `search`, `get`, `delete`, `list`, `batch_add`, `build_context`, `rag_query`, `consolidate`, `cleanup` |
| **Entity/Graph**   | 4     | `add_entity`, `add_relation`, `query_graph`, `health_check` |
| **Investigation**  | 3     | `create_matter`, `ingest_document`, `search_matter`      |
| **Analytics/Admin**| 8     | `export`, `bulk_delete`, `confidence_maintenance`, `analytics`, `system_metrics`, `manage_tenant`, `growth`, `activity` |

**OAuth 2.1 Endpoints:** `/.well-known/oauth-authorization-server`, `/oauth/register`, `/oauth/authorize`, `/oauth/token`

#### Engram-Platform — 7 API Routes + 18 Pages (Port 3002)

| API Route                          | Method    | Purpose                  |
|------------------------------------|-----------|--------------------------|
| `/api/system/health`               | GET       | System health snapshot   |
| `/api/system/logs`                 | GET       | Fetch system logs        |
| `/api/system/logs/stream`          | GET (SSE) | Stream logs real-time    |
| `/api/system/history`              | GET       | System event history     |
| `/api/system/maintenance`          | POST      | Trigger maintenance      |
| `/api/system/control`              | POST      | Control services         |
| `/api/system/notifications`        | POST      | Manage notifications     |

**Dashboard Pages:** Home, Memory (5 pages), Crawler (5 pages), Intelligence (4 pages), System Health

---

## Page 3: Code Map & Data Pipeline Detail

### Source File Counts

| Subproject         | Language   | Source Files | Test Files | Key Entry Point (LOC)        |
|--------------------|------------|:------------:|:----------:|------------------------------|
| **AiMemory**       | Python     | 40           | 30         | `api.py` (1,884)             |
|                    | TypeScript | ~10          | 5          | `client.py` (1,312)          |
| **AiCrawler**      | Python     | 104          | 73         | `main.py` (322)              |
|                    | TypeScript | ~15          | 22         | 16 API router files          |
| **MCP Server**     | TypeScript | 34           | 22         | `server.ts` (247)            |
|                    |            |              |            | `tool-definitions.ts` (648)  |
| **Platform**       | TypeScript | 244          | 554        | `layout.tsx` (283)           |
|                    |            |              |            | 22 design system components  |
| **TOTAL**          | Mixed      | **~447**     | **~706**   |                              |

### AiMemory Code Map

```
Engram-AiMemory/packages/core/src/memory_system/
├── api.py               (1,884 LOC)  FastAPI endpoint definitions
├── system.py            (1,349 LOC)  Memory orchestration core
├── client.py            (1,312 LOC)  Weaviate vector DB client
├── workers.py             (654 LOC)  Background maintenance jobs
├── auth.py                           JWT + API key authentication
├── cache.py                          Redis caching layer
├── config.py                         Configuration management
├── context.py                        Context building engine
├── decay.py               (124 LOC)  Relevance decay algorithm
├── embeddings.py                     Embedding provider abstraction
├── rag.py                            RAG pipeline (query + synthesis)
├── analyzer.py                       Content analysis
├── contradiction.py                  Contradiction detection
├── credibility.py                    Source credibility scoring
├── propagation.py                    Importance propagation
├── temporal.py                       Temporal relevance
├── investigation/                    Legal matter management
│   └── investigation_router.py       Investigation API routes
├── mcp/                              MCP bridge utilities
└── prompts/                          LLM prompt templates
```

### AiCrawler Code Map

```
Engram-AiCrawler/01_devroot/app/
├── main.py              (322 LOC)   FastAPI entry + middleware
├── api/                 (16 files)  REST API routers
│   ├── crawl.py                     Crawl start/batch/deep/status
│   ├── chat.py                      LM Studio chat completions
│   ├── data.py                      Data set CRUD + lifecycle
│   ├── osint/           (8 files)   OSINT endpoint groups
│   │   ├── alias.py                 Alias discovery
│   │   ├── scan.py                  Scan pipeline
│   │   ├── image_intel.py           Image intelligence
│   │   ├── threat_intel.py          Threat intelligence
│   │   ├── fraud.py                 Fraud graph analysis
│   │   └── deep_crawl.py            Deep crawl endpoints
│   ├── cases.py                     Case management (20 endpoints)
│   ├── darkweb.py                   Dark web monitoring
│   ├── knowledge_graph.py           KG build/search/merge/export
│   ├── extraction.py                Template-based extraction
│   ├── investigations.py            Investigation linking
│   ├── rag.py                       RAG processing pipeline
│   ├── scheduler.py                 Scheduled crawl jobs
│   ├── performance.py               Storage/cache/job monitoring
│   └── settings.py                  App configuration
├── osint/               (13 files)  OSINT service implementations
│   ├── alias_discovery.py           Multi-platform alias search
│   ├── image_intelligence.py        Image hash + EXIF analysis
│   ├── image_search.py              Reverse image search
│   ├── semantic_tracker.py          Semantic tracking engine
│   ├── threat_intel_service.py      Threat intelligence service
│   ├── email_osint_service.py       Email OSINT
│   ├── whois_dns_service.py         WHOIS/DNS lookups
│   ├── face_recognition_service.py  Face recognition
│   ├── darkweb/                     Dark web modules
│   └── platforms/                   Platform-specific crawlers
├── services/                        Business logic layer
│   ├── cache.py                     Multi-layer Redis cache
│   └── concurrency_governor.py      Concurrency control
├── orchestrators/                   Multi-step pipeline orchestration
├── pipelines/                       Model review pipeline
├── storage/                         ChromaDB vector store
├── workers/                         Background job workers
├── middleware/                      Auth, CORS, rate limiting
├── models/                          Pydantic data models
├── core/                            Security, retry policies
└── websocket/                       WebSocket manager
```

### MCP Server Code Map

```
Engram-MCP/src/
├── index.ts             (67 LOC)    Entry point (transport selection)
├── server.ts           (247 LOC)    MCP Server factory
├── schemas.ts          (284 LOC)    Zod input validation (27 schemas)
├── client.ts                        Memory API HTTP client
├── config.ts                        Configuration loader
├── errors.ts           (187 LOC)    Typed error hierarchy
├── logger.ts                        Structured logging
├── circuit-breaker.ts               Circuit breaker (threshold: 5)
├── retry.ts                         Exponential backoff + jitter
├── prompts.ts                       MCP prompt definitions
├── tools/
│   ├── tool-definitions.ts (648 LOC) 25+ tool definitions
│   ├── memory-tools.ts              Memory tool handlers
│   ├── entity-tools.ts              Knowledge graph handlers
│   ├── investigation-tools.ts       Matter/document handlers
│   └── health-tools.ts              Health check handler
├── auth/
│   └── oauth-server.ts  (543 LOC)   OAuth 2.1 + PKCE + RFC 7591
├── resources/                       MCP resource providers
├── transports/                      stdio + HTTP transport config
├── hooks/                           Pre/post tool hooks (memory recall)
├── installer/                       npx init auto-installer
└── utils/                           Shared utilities
```

### Platform Code Map

```
Engram-Platform/frontend/
├── app/                              Next.js App Router
│   ├── layout.tsx      (283 LOC)    Root layout + Clerk + providers
│   ├── page.tsx                     Redirect → /dashboard
│   ├── globals.css                  Tailwind v4 + design tokens
│   ├── global-error.tsx             Global error boundary
│   ├── instrumentation.ts           Sentry instrumentation
│   ├── manifest.ts                  PWA manifest
│   ├── api/system/     (7 routes)   System admin API routes
│   ├── dashboard/
│   │   ├── home/                    Dashboard home
│   │   ├── memory/     (6 pages)    Memories, Graph, Analytics, Matters, Timeline
│   │   ├── crawler/    (5 pages)    Crawl, OSINT, Investigations, KG
│   │   ├── intelligence/ (4 pages)  Chat, Search, Investigations, KG
│   │   └── system/     (1 page)     Health monitoring
│   ├── sign-in/                     Clerk sign-in
│   └── sign-up/                     Clerk sign-up
├── src/
│   ├── design-system/  (22 components)
│   │   └── components/              Badge, Button, Card, DataTable,
│   │                                EmptyState, ErrorState, Input,
│   │                                LoadingState, Modal, NavItem,
│   │                                SearchInput, SectionHeader,
│   │                                SidebarGroup, Slider, Spinner,
│   │                                StatCard, StatusDot, Tabs, Tag,
│   │                                Toast, Tooltip
│   ├── components/     (13 files)   App-level components
│   │   ├── ErrorBoundary.tsx        Route error boundary
│   │   ├── DraggableGrid.tsx        Dashboard widget grid
│   │   ├── FilterBar.tsx            Data filtering
│   │   ├── Skeletons.tsx            7 skeleton variants
│   │   ├── ThemeProvider.tsx        Dark/light theme
│   │   ├── Animations.tsx           Framer Motion animations
│   │   ├── OptimizedImage.tsx       Next/Image wrapper
│   │   └── ui/Toast.tsx             Toast notifications
│   ├── hooks/          (7 hooks)    useMounted, useHealthPolling,
│   │                                useRAGChat, useWebSocket,
│   │                                useURLState, useForceLayout
│   ├── stores/                      Zustand v5 (uiStore)
│   ├── providers/      (3 files)    Clerk, SWR, URL state, Motion
│   ├── lib/            (6 files)    API clients, SWR keys, utils
│   │   ├── memory-client.ts         Memory API client
│   │   ├── crawler-client.ts        Crawler API client
│   │   ├── system-client.ts         System API client
│   │   └── performance.ts           Web Vitals tracking
│   ├── config/                      App configuration
│   ├── server/                      Server-side utilities
│   ├── types/                       TypeScript type definitions
│   └── test/                        Test utilities
```

### Docker Compose Orchestration

```
docker-compose.yml (469 LOC) — 8 Services
├── memory-api          1G mem, 1.0 CPU     FastAPI :8000
├── crawler-api         3G mem, 2.0 CPU     FastAPI :11235
├── mcp-server        512M mem, 0.5 CPU     Node.js :3000
├── platform          512M mem, 0.5 CPU     Next.js :3002
├── weaviate            2G mem, 1.0 CPU     Vector DB :8080
├── crawler-redis       1G mem, 0.5 CPU     Redis :6379
├── memory-redis      768M mem, 0.5 CPU     Redis :6380
└── nginx             256M mem, 0.5 CPU     Reverse proxy :80
Total: 10.5 GB RAM / 6.5 CPU
```

### Deployment

| Target              | Method                    | Entry Point                    |
|---------------------|---------------------------|--------------------------------|
| Local Dev           | `npm run dev` per service | Per-subproject                 |
| Docker (all)        | `docker compose up`       | `Engram-Platform/docker-compose.yml` |
| Production          | `deploy-unified.sh deploy`| `scripts/deploy-unified.sh`    |
| Tailscale (remote)  | SSH + deploy script       | `*.tail4da6b7.ts.net`          |

### Key Environment Variables

```bash
# Embeddings
EMBEDDING_PROVIDER=deepinfra          # openai | deepinfra | nomic | local

# Storage
WEAVIATE_URL=http://localhost:8080
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<min-32-chars>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
MCP_AUTH_TOKEN=<bearer-token>

# Network (Tailscale-only in production)
BIND_ADDRESS=127.0.0.1
TAILSCALE_HOSTNAME=<host>.tail4da6b7.ts.net
```

### Current Status & Gaps

| Metric              | Current     | Target      | Gap       |
|---------------------|-------------|-------------|-----------|
| Overall completion  | 70%         | 100%        | 30%       |
| AiMemory coverage   | ~80%        | 95%         | 15%       |
| AiCrawler coverage  | 58%         | 85%         | 27%       |
| Platform coverage   | Baseline TBD| 80%         | TBD       |
| MCP tests           | 381 passing | Reporting   | Coverage  |
| Docker RAM usage    | 10.5 GB     | 8.5 GB      | -2 GB     |
| NIST compliance     | Partial     | Full        | Encryption, vault, logging |

---

*Document generated from live codebase analysis on 2026-03-17. See `PROJECT_ROADMAP.md` for the 10-week completion plan.*
