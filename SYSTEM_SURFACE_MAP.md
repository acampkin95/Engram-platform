# Engram Platform - System Surface Map

**Generated**: 2026-03-29
**Loop**: 1 - Baseline Mapping and Surface Discovery
**Version**: 1.1.0

---

## Executive Summary

Engram Platform is a unified AI memory and intelligence platform comprising four subprojects:

| Subproject | Language | Purpose | Internal Port |
|---|---|---|---|
| **Engram-Platform** | Next.js 15 / React 19 | Unified frontend dashboard | 3000 (via nginx:8080) |
| **Engram-AiMemory** | Python 3.11+ | 3-tier vector memory system | 8000 |
| **Engram-AiCrawler** | Python 3.11 / React 18 | OSINT web crawler with AI analysis | 11235 |
| **Engram-MCP** | TypeScript (Node 20+) | MCP server — dual transport | 3000 |

**Data Flow**: Crawler → Memory API (Weaviate/Redis) → MCP Server → Platform UI

---

## 1. Frontend: Engram-Platform

**Location**: `Engram-Platform/frontend/`

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **UI**: React 19, Server Components
- **Auth**: Clerk (`@clerk/nextjs`)
- **State**: Zustand v5 + Jotai
- **Data Fetching**: SWR v2
- **Charts**: ECharts + Recharts
- **UI Components**: Radix primitives + shadcn/ui pattern
- **Styling**: Tailwind CSS v4 (CSS-native)
- **Fonts**: Syne (display), IBM Plex Mono (mono), Instrument Serif (serif)

### Route Structure

```
/                             - Landing page (root)
/sign-in/[[...sign-in]]      - Clerk auth sign-in
/sign-up/[[...sign-up]]      - Clerk auth sign-up
/dashboard/                  - Main dashboard (protected)
  /memory/
    /home                    - Memory dashboard home
    /memories                - Memory browser
    /timeline                - Timeline view
    /graph                   - Knowledge graph viewer
    /matters                 - Matters/cases management
    /analytics               - Memory analytics
  /intelligence/
    /investigations          - Investigation workflows
    /chat                    - AI chat interface
    /knowledge-graph         - Knowledge graph viewer
    /search                  - Unified search
    /canvas                  - Canvas workspace
  /crawler/
    /home                    - Crawler dashboard
    /investigations          - Crawler investigations
    /knowledge-graph         - Crawler knowledge graph
    /osint                   - OSINT scan interface
    /crawl                   - Crawl execution
  /system/
    /settings                - System settings
    /health                  - Health monitoring
```

### Key State Stores
- `src/stores/canvasStore.ts` - Canvas workspace state
- `src/stores/preferencesStore.ts` - User preferences
- `src/stores/uiStore.ts` - UI state management

### API Client Integration
- `src/lib/system-client.ts` - Memory API client
- `src/lib/crawler-client.ts` - Crawler API client
- `src/lib/swr-keys.ts` - SWR cache key definitions

### Test Coverage
- **1081 tests passing** (Vitest)
- Located in `src/**/__tests__/` directories

---

## 2. Backend: Engram-AiMemory

**Location**: `Engram-AiMemory/`

### Technology Stack
- **Framework**: FastAPI (Python 3.11+)
- **Vector DB**: Weaviate 1.27.0
- **Cache**: Redis 7
- **Embeddings**: Multi-provider (OpenAI, DeepInfra, Nomic/Ollama, local)
- **Testing**: pytest with 80% coverage threshold

### API Endpoints

**Base**: `http://localhost:8000`

| Path | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/memory` | POST | Store memory |
| `/memory/{id}` | GET | Retrieve memory |
| `/memory/search` | POST | Vector similarity search |
| `/memory/rag` | POST | RAG query pipeline |
| `/entities` | POST/GET | Entity CRUD |
| `/matters` | POST/GET | Matter/case management |
| `/investigation` | POST/GET | Investigation operations |
| `/admin/cache/clear` | POST | Clear Redis cache |
| `/admin/decay/run` | POST | Run memory decay job |

### Core Modules

| Module | Purpose | Location |
|---|---|---packages/core/src/memory_system/|
| `system.py` | Main MemorySystem orchestrator |
| `api.py` | FastAPI application |
| `embeddings.py` | Multi-provider embedding support |
| `cache.py` | Redis caching layer |
| `rag.py` | RAG query pipeline |
| `auth.py` | JWT + API key authentication |
| `decay.py` | Memory decay/retention logic |

### 3-Tier Memory Architecture
1. **Tier 1 (Project)**: Per-project isolated memory — code insights, decisions, patterns
2. **Tier 2 (General)**: Cross-project, user-specific — preferences, workflows
3. **Tier 3 (Global)**: Shared bootstrap knowledge — best practices, docs

### Test Coverage
- **985 tests passing, 3 skipped** (pytest)

---

## 3. Backend: Engram-AiCrawler

**Location**: `Engram-AiCrawler/01_devroot/`

### Technology Stack
- **Framework**: FastAPI (Python 3.11)
- **Crawling**: Crawl4AI 0.7.4 with Chromium
- **Vector Storage**: ChromaDB
- **LM Integration**: LM Studio bridge
- **Process Manager**: Supervisord

### API Endpoints

**Base**: `http://localhost:11235`

| Path | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/api/crawl` | POST | Single URL crawl |
| `/api/crawl/batch` | POST | Batch crawl |
| `/api/crawl/deep` | POST | Deep crawl |
| `/api/osint/scan` | POST | OSINT scan |
| `/api/osint/alias` | POST | Alias discovery |
| `/api/osint/fraud` | POST | Fraud detection |
| `/api/osint/threat-intel` | POST | Threat intelligence |
| `/api/osint/image-intel` | POST | Image intelligence |
| `/api/darkweb/scan/full` | POST | Full dark web scan |
| `/api/darkweb/scan/marketplace` | POST | Dark web marketplace scan |
| `/api/darkweb/scan/breach` | POST | Breach scan |
| `/api/darkweb/scan/crypto` | POST | Crypto trace |
| `/api/chat` | POST | Chat with crawled content |
| `/api/knowledge_graph` | GET/POST | Knowledge graph operations |
| `/api/cases` | GET/POST | Case management |
| `/api/stats` | GET | Crawl statistics |
| `/api/storage` | GET | Storage optimization |
| `/api/scheduler/*` | * | Scheduled crawl management |

### 5-Stage OSINT Pipeline
1. **Alias Discovery** — 8 platforms scanned
2. **Crawl** — Crawl4AI with Chromium
3. **Model Review** — LM Studio for keep/derank/archive
4. **Store** — ChromaDB vector storage
5. **Knowledge Graph** — Entity/relationship extraction

### Data Lifecycle
- **Hot** → **Warm** → **Cold** → **Archive** tiers
- Configurable age thresholds

### Test Coverage
- **2393 tests passing, 2 skipped** (pytest)

---

## 4. MCP Layer: Engram-MCP

**Location**: `Engram-MCP/`

### Technology Stack
- **Runtime**: Node 20+
- **Language**: TypeScript (strict mode)
- **Transports**: stdio + HTTP streaming

### Transport Endpoints
- **stdio**: For Claude Code/Desktop (default)
- **HTTP**: `http://localhost:3000/mcp` (for remote clients)

### Tools Exposed

**Memory Tools**:
- `memory_store` — Store memory
- `memory_search` — Vector search
- `memory_get` — Retrieve by ID
- `memory_delete` — Delete memory
- `memory_update` — Update existing memory

**Entity Tools**:
- `entity_create` — Create entity
- `entity_link` — Link entities
- `entity_query` — Query entities
- `query_graph` — Knowledge graph query

**Investigation Tools**:
- `investigation_create` — Create investigation
- `investigation_add_evidence` — Add evidence
- `investigation_query` — Query investigations

**Health Tools**:
- `health_check` — System health

### Authentication
- OAuth 2.1 with PKCE
- Dynamic client registration
- Bearer token support for HTTP transport

### Test Coverage
- **382 tests passing** (node --test)

---

## 5. Unified Deployment

### Docker Compose Services

**Configuration**: `Engram-Platform/docker-compose.yml`

| Service | Image | Internal Port | External Port | Depends On |
|---|---|---|---|---|---|
| `crawler-api` | crawl4ai-engram | 11235 | - | crawler-redis, memory-api |
| `memory-api` | engram-memory-api | 8000 | - | weaviate, memory-redis |
| `weaviate` | weaviate:1.27.0 | 8080 | - | - |
| `crawler-redis` | redis:7-alpine | 6379 | - | - |
| `memory-redis` | redis:7-alpine | 6379 | - | - |
| `mcp-server` | engram-mcp-server | 3000 | - | memory-api (profile: mcp) |
| `platform-frontend` | engram-platform-frontend | 3000 | - | - |
| `nginx` | nginx:alpine | 80 | 8080 | all services |

### Deployment Script

**Location**: `scripts/deploy-unified.sh`

**Commands**:
- `init` — Initialize deployment
- `setup` — Setup environment
- `up` — Start all services
- `down` — Stop all services
- `deploy` — Build and deploy
- `health` — Health check
- `ps` — Process status
- `logs` — View logs
- `restart` — Restart services
- `config` — Show configuration

### Port Assignments

| Service | Internal | External (nginx) |
|---|---|---|
| Platform UI | 3000 | 8080 |
| Memory API | 8000 | - |
| Crawler API | 11235 | - |
| MCP Server | 3000 | - |
| Weaviate | 8080 | - |

---

## 6. Service Dependencies

```
┌─────────────────────────────────────────────────────────┐
│  Engram-Platform (Next.js 15, port 3000)                │
│  Unified frontend: dashboard, memory browser,           │
│  crawler UI, knowledge graph viewer                     │
├──────────────┬──────────────┬───────────────────────────┤
│  Engram-MCP  │ Crawler API  │  Memory API               │
│  (port 3000) │ (port 11235) │  (port 8000)              │
│  stdio/HTTP  │ FastAPI      │  FastAPI                   │
├──────────────┴──────────────┴───────────────────────────┤
│  Weaviate (8080) │ Redis x2 (6379) │ ChromaDB │ LM Studio│
└──────────────────┴─────────────────┴──────────┴─────────┘
```

---

## 7. Code Quality Tools Summary

| Subproject | Linter | Formatter | Type Checker | Test Runner | Tests Passing |
|---|---|---|---|---|---|
| AiMemory (Python) | ruff | ruff format | mypy | pytest | 985 |
| AiMemory (TS) | biome | biome | TypeScript strict | vitest | - |
| AiCrawler (Python) | ruff | ruff format | mypy | pytest | 2393 |
| AiCrawler (React) | eslint | - | tsc | vitest | - |
| MCP | biome | biome | TypeScript strict | node --test | 382 |
| Platform | biome | biome | TypeScript | vitest | 1081 |
| **TOTAL** | - | - | - | - | **4841** |

---

## 8. Critical User Journeys

### Journey 1: Store and Retrieve Memory
1. User creates memory via Platform UI → `POST /memory`
2. Memory API generates embedding → stores in Weaviate
3. User searches memories → `POST /memory/search`
4. Vector similarity search returns results

### Journey 2: OSINT Investigation
1. User starts OSINT scan via Platform UI → `POST /api/osint/scan`
2. Crawler discovers aliases across 8 platforms
3. Crawls content, stores in ChromaDB
4. Extracts entities, builds knowledge graph
5. Results displayed in Platform dashboard

### Journey 3: MCP Client Integration
1. Claude Code connects via stdio transport
2. Calls `memory_search` tool
3. MCP server proxies to Memory API
4. Returns formatted results to client

---

## 9. Known Issues & Risks

### Issues Found (This Session)
1. **Python 3.9 Compatibility** — Fixed UTC/StrEnum imports in AiCrawler
2. **Trailing comma syntax error** — Fixed in test_api_scheduler.py
3. **Pydantic deprecation warnings** — Non-blocking, needs migration to ConfigDict

### Security Considerations
- Rate limiting implemented (Upstash Redis)
- JWT authentication on Memory API
- OAuth 2.1 on MCP server
- CSP headers configured in Platform

### Performance Notes
- Multi-level caching (Redis, Nginx, application)
- Connection pooling configured
- Resource limits set in Docker Compose

---

## 10. Next Steps (Loop 2)

Loop 2 will focus on:
1. Core E2E flow validation across all services
2. Testing real user journeys
3. Verifying service-to-service integration
4. Testing auth/session flows
5. Error path validation
