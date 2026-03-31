# 07 - Developer Guide

> Engram Platform -- contributor and extension reference.
> Last updated: 2026-03-31

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Module Responsibilities](#2-module-responsibilities)
3. [Coding Conventions](#3-coding-conventions)
4. [Commit Format](#4-commit-format)
5. [Local Development Setup](#5-local-development-setup)
6. [How to Extend the Platform](#6-how-to-extend-the-platform)
7. [Test Strategy](#7-test-strategy)
8. [Debugging Tips](#8-debugging-tips)
9. [Design System](#9-design-system)

---

## 1. Project Structure

The repository is a monorepo containing five subprojects plus orchestration infrastructure:

```
09_EngramPlatform/
├── Engram-AiMemory/          # 3-tier vector memory system
│   ├── packages/
│   │   ├── core/             # Python: FastAPI + Weaviate + Redis
│   │   ├── cli/              # TypeScript: CLI tool
│   │   ├── mcp-server/       # TypeScript: legacy MCP server
│   │   └── dashboard/        # TypeScript: legacy dashboard
│   ├── docker/               # Docker compose for standalone dev
│   └── Makefile              # Unified build/test/lint commands
│
├── Engram-AiCrawler/         # OSINT web crawler with AI analysis
│   └── 01_devroot/
│       ├── app/              # Python FastAPI backend
│       └── frontend/         # React 18 frontend
│
├── Engram-MCP/               # Unified MCP server (TypeScript)
│   ├── src/
│   │   ├── tools/            # MCP tool definitions
│   │   ├── hooks/            # Auto memory recall/store hooks
│   │   ├── auth/             # OAuth 2.1 + PKCE
│   │   ├── transports/       # stdio + HTTP streaming
│   │   ├── installer/        # npx @engram/mcp init
│   │   └── resources/        # MCP resource definitions
│   └── tests/
│
├── Engram-Platform/          # Unified frontend dashboard
│   ├── frontend/
│   │   ├── app/              # Next.js 15 App Router pages
│   │   │   ├── dashboard/
│   │   │   │   ├── home/
│   │   │   │   ├── memory/   # memories, graph, timeline, matters, analytics
│   │   │   │   ├── intelligence/  # investigations, chat, canvas
│   │   │   │   ├── crawler/
│   │   │   │   └── system/
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   ├── components/       # Shared UI components
│   │   ├── lib/              # Utility functions, API clients
│   │   └── stores/           # Zustand + Jotai state
│   ├── docker-compose.yml    # Full platform orchestration
│   └── nginx/                # Reverse proxy configuration
│
├── engram-shared/            # Shared Python utilities
│   └── src/engram_shared/
│       ├── auth.py           # JWT/auth helpers
│       ├── config.py         # Shared config patterns
│       ├── health.py         # Health check utilities
│       ├── http.py           # HTTP client helpers
│       └── logging.py        # Structured logging
│
├── scripts/                  # Deploy, quality gate, etc.
├── docs/                     # System documentation
└── plans/                    # Development plans
```

---

## 2. Module Responsibilities

### Engram-AiMemory (`packages/core/src/memory_system/`)

| Module | Responsibility |
|---|---|
| `api.py` | FastAPI REST application -- all HTTP endpoints (port 8000) |
| `system.py` | `MemorySystem` orchestrator -- coordinates all subsystems |
| `memory.py` | Pydantic data models: `Memory`, `KnowledgeEntity`, `KnowledgeRelation`, enums |
| `config.py` | `Settings` (pydantic-settings) -- all env var configuration |
| `client.py` | `WeaviateMemoryClient` -- Weaviate CRUD, schema, multi-tenancy |
| `embeddings.py` | Multi-provider embedding support (OpenAI, DeepInfra, Nomic/Ollama, local) |
| `cache.py` | `RedisCache` -- embedding, search, memory, session, and stats caching |
| `rag.py` | `MemoryRAG` -- Retrieval-Augmented Generation pipeline |
| `auth.py` | JWT creation/verification, API key validation, `require_auth` dependency |
| `key_manager.py` | `KeyManager` -- Redis-backed API key CRUD with SHA-256 hashing |
| `audit.py` | `AuditLogger` -- Redis Stream-backed request audit logging |
| `decay.py` | `MemoryDecay` -- exponential decay: `2^(-age_days / half_life_days)` |
| `context.py` | `ContextBuilder`, `ConversationMemoryManager` -- context assembly |
| `analyzer.py` | `MemoryAnalyzer` -- LLM-based importance scoring and entity extraction |
| `contradiction.py` | Contradiction detection between memories |
| `credibility.py` | Confidence factor calculation |
| `propagation.py` | Confidence propagation across related memories |
| `temporal.py` | Temporal event modeling and timeline queries |
| `workers.py` | `MaintenanceScheduler` -- background jobs (summarize, decay, consolidate) |
| `investigation_router.py` | FastAPI router for `/matters/**` investigation endpoints |
| `investigation/` | Investigation subsystem: matters, evidence, crawling, ingestors |

### Engram-MCP (`src/`)

| Module | Responsibility |
|---|---|
| `server.ts` | MCP server setup -- tool/prompt/resource registration |
| `client.ts` | HTTP client for Memory API with circuit breaker |
| `config.ts` | Configuration loading from environment |
| `tools/tool-definitions.ts` | All MCP tool schemas with annotations |
| `tools/memory-tools.ts` | Memory CRUD tool handlers |
| `tools/entity-tools.ts` | Knowledge graph tool handlers |
| `tools/investigation-tools.ts` | Matter/evidence tool handlers |
| `tools/health-tools.ts` | Health check tool handler |
| `hooks/memory-hooks.ts` | Auto memory recall on conversation start, auto store on end |
| `hooks/hook-manager.ts` | Hook lifecycle management |
| `auth/oauth-server.ts` | OAuth 2.1 authorization server |
| `auth/pkce.ts` | PKCE challenge/verifier utilities |
| `transports/http.ts` | HTTP streaming transport |
| `transports/stdio.ts` | stdio transport for Claude Code/Desktop |
| `installer/cli.ts` | `npx @engram/mcp init` installer |
| `circuit-breaker.ts` | Circuit breaker for API resilience |
| `schemas.ts` | Zod validation schemas |

### Engram-Platform (`frontend/`)

| Area | Responsibility |
|---|---|
| `app/dashboard/home/` | Dashboard overview with stats cards |
| `app/dashboard/memory/` | Memory browser, graph viewer, timeline, matters, analytics |
| `app/dashboard/intelligence/` | Investigations, AI chat, canvas |
| `app/dashboard/crawler/` | Crawler UI |
| `app/dashboard/system/` | System settings and configuration |
| `components/` | Reusable UI components (shadcn/ui pattern) |
| `stores/` | Zustand v5 + Jotai state management |
| `lib/` | API client functions, utility helpers |
| `middleware.ts` | Clerk auth middleware |

### engram-shared (`src/engram_shared/`)

| Module | Responsibility |
|---|---|
| `auth.py` | Shared JWT and authentication helpers |
| `config.py` | Common configuration patterns for microservices |
| `health.py` | Standardized health check utilities |
| `http.py` | Shared HTTP client with retry logic (httpx + tenacity) |
| `logging.py` | Structured JSON logging configuration |

---

## 3. Coding Conventions

### Python (AiMemory, AiCrawler, engram-shared)

| Property | Value |
|---|---|
| Linter | ruff (rules: E, F, I, N, W, UP, B, C4, SIM) |
| Formatter | ruff format |
| Type checker | mypy |
| Line width | 100 characters |
| Indent | 4 spaces |
| Quotes | Double quotes |
| Style | PEP 8, type hints on all public functions |
| Async | `asyncio_mode = "auto"` in pytest |

### TypeScript -- Platform (Next.js frontend)

| Property | Value |
|---|---|
| Linter/Formatter | Biome |
| Line width | 100 characters |
| Indent | 2 spaces |
| Quotes | Single quotes |
| Semicolons | Required |
| Trailing commas | All |
| Path alias | `@/` maps to `frontend/` |

### TypeScript -- MCP Server and AiMemory TS packages

| Property | Value |
|---|---|
| Linter/Formatter | Biome |
| Line width | 100 characters |
| Indent | 2 spaces |
| Quotes | Double quotes |
| Semicolons | Required |
| Trailing commas | ES5 |
| TypeScript | Strict mode |

---

## 4. Commit Format

All commits follow **Conventional Commits**:

```
type(scope): subject
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`

**Scopes**: `memory`, `crawler`, `mcp`, `platform`, `shared`, `infra`, `docs`

**Examples**:

```
feat(memory): add temporal event filtering to search endpoint
fix(mcp): handle circuit breaker timeout in entity tools
chore(platform): upgrade Clerk to v6.1
docs(memory): update API reference for audit endpoints
```

For non-trivial commits, use git trailers for decision context:

```
feat(memory): add confidence propagation engine

Propagates confidence scores through related memories using
graph traversal with configurable damping factor.

Constraint: Must complete within 500ms for graphs under 1000 nodes
Rejected: PageRank approach (too slow for real-time updates)
Confidence: high
Scope-risk: moderate
```

---

## 5. Local Development Setup

### Prerequisites

- Python 3.11+ (3.12 recommended)
- Node.js 20+
- Docker and Docker Compose
- Redis 7+
- Weaviate 1.27+

### Engram-AiMemory

```bash
cd Engram-AiMemory

# Python virtual environment
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Run all tests (Python + TypeScript)
make test

# Python tests only (pytest with 79.8% coverage threshold)
make test-python
# or: pytest packages/core/tests/ -v

# Single test file or function
pytest packages/core/tests/test_api_integration.py -v
pytest packages/core/tests/test_cache.py::test_get -v

# TypeScript tests
make test-ts

# Lint everything (ruff + biome + mypy)
make lint
make lint-fix

# Format
make format

# Dev server (MCP + Dashboard concurrently)
make dev

# Docker
make docker-up    # docker compose -f docker/docker-compose.yml up -d
make docker-down
```

### Engram-AiCrawler

```bash
cd Engram-AiCrawler/01_devroot

# Backend
ruff check app/                    # lint
ruff format app/                   # format
mypy app/                          # type check
pytest tests/ -v                   # all tests
pytest tests/test_api.py -v        # single file
pytest tests/ --cov=app --cov-report=html   # with coverage

# Frontend
cd frontend
npm install && npm run dev         # dev server on :3000
npm run lint                       # eslint
npm run typecheck                  # tsc --noEmit
npm run test                       # vitest
```

### Engram-MCP

```bash
cd Engram-MCP
npm install
npm run build                      # tsc
npm run dev                        # tsc --watch
npm run test                       # node --test tests/*.test.ts
npm run lint                       # biome check
npm run smoke                      # build + smoke test
npm run start:http                 # HTTP transport on :3000
npm run start:stdio                # stdio transport
```

### Engram-Platform

```bash
cd Engram-Platform/frontend
npm install
npm run dev                        # next dev --turbopack on :3002
npm run build                      # next build
npm run lint                       # biome check
npm run test                       # vitest (watch mode)
npm run test:run                   # vitest (single run)
npm run test:e2e                   # playwright
```

### Full Platform (Docker Compose)

```bash
cd Engram-Platform
cp .env.example .env               # fill in secrets
docker compose up -d               # all services
docker compose up -d --profile mcp # include MCP server
docker compose logs -f memory-api  # tail specific service
```

---

## 6. How to Extend the Platform

### Adding a New Memory Type

1. Add the enum value to `MemoryType` in `Engram-AiMemory/packages/core/src/memory_system/memory.py`:

```python
class MemoryType(StrEnum):
    CONVERSATION = "conversation"
    DOCUMENT = "document"
    # ... existing types
    MY_NEW_TYPE = "my_new_type"    # Add here
```

2. The API accepts `memory_type` as a free-form string that maps to `MemoryType` via `_type_from_str()` in `api.py`. Unknown types fall back to `FACT`.

3. Update the MCP tool definition in `Engram-MCP/src/tools/tool-definitions.ts` to include the new type in the `memory_type` enum array.

4. No Weaviate schema change is needed -- `memory_type` is stored as a string property.

### Adding a New MCP Tool

1. Define the tool schema in `Engram-MCP/src/tools/tool-definitions.ts`:

```typescript
// In MEMORY_TOOLS or a new array
{
  name: "my_new_tool",
  description: "Description of what the tool does",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "..." },
    },
    required: ["param1"],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
}
```

2. Implement the handler in the appropriate tool handler file (e.g., `memory-tools.ts`).

3. Register it in `server.ts` if using a new tool array.

4. If the tool calls a new Memory API endpoint, add the client method in `client.ts`.

### Adding a New Dashboard Page

1. Create a new directory under `Engram-Platform/frontend/app/dashboard/`:

```
app/dashboard/my-feature/
├── page.tsx           # Server component (entry point)
├── MyFeatureContent.tsx    # Client component with "use client"
├── MyFeatureContent.test.tsx
├── loading.tsx        # Suspense fallback
└── error.tsx          # Error boundary
```

2. The page pattern follows this structure:

```tsx
// page.tsx (Server Component)
import MyFeatureContent from './MyFeatureContent';

export default function MyFeaturePage() {
  return <MyFeatureContent />;
}
```

```tsx
// MyFeatureContent.tsx (Client Component)
'use client';
import { useEffect, useState } from 'react';

export default function MyFeatureContent() {
  // Component logic here
}
```

3. Add navigation to the sidebar in the dashboard layout component.

4. Use the `@/` path alias for imports: `import { api } from '@/lib/api';`

### Adding a New Data Source to the Crawler

The AiCrawler uses a five-stage OSINT pipeline. To add a new data source:

1. **Create a new extraction module** in `Engram-AiCrawler/01_devroot/app/`:

```python
class MySourceExtractor:
    """Extract data from a new source type."""

    async def discover(self, target: str) -> list[str]:
        """Discover URLs or identifiers for the target."""
        ...

    async def extract(self, url: str) -> dict:
        """Extract structured data from a single URL."""
        ...
```

2. **Register the extractor** in the pipeline configuration. The crawler's main pipeline in `app/main.py` orchestrates the five stages.

3. **Add the source type** to `SourceType` enum in `Engram-AiMemory/packages/core/src/memory_system/investigation/models.py` if needed for evidence ingestion:

```python
class SourceType(StrEnum):
    PDF = "PDF"
    EMAIL = "EMAIL"
    CSV = "CSV"
    WEB = "WEB"
    MANUAL = "MANUAL"
    MY_SOURCE = "MY_SOURCE"    # Add here
```

4. **Update the MCP tool** `ingest_document` enum in `Engram-MCP/src/tools/investigation-tools.ts`.

### Adding a New Embedding Provider

1. Implement the provider in `Engram-AiMemory/packages/core/src/memory_system/embeddings.py` following the existing pattern.

2. Add the provider name to the `embedding_provider` literal type in `config.py`:

```python
embedding_provider: Literal["openai", "local", "ollama", "nomic", "deepinfra", "my_provider"] = Field(...)
```

3. Wire the provider into `MemorySystem.__init__()` in `system.py`.

---

## 7. Test Strategy

### Test Runners by Subproject

| Subproject | Runner | Command |
|---|---|---|
| AiMemory (Python) | pytest + pytest-asyncio | `make test-python` or `pytest packages/core/tests/ -v` |
| AiMemory (TypeScript) | vitest | `make test-ts` |
| AiCrawler (Python) | pytest | `pytest tests/ -v` |
| AiCrawler (React) | vitest | `npm run test` |
| MCP (TypeScript) | node --test | `npm run test` |
| Platform (Frontend) | vitest + playwright | `npm run test:run` / `npm run test:e2e` |

### Coverage Thresholds

| Subproject | Threshold |
|---|---|
| AiMemory Python | 79.8% (`--cov-fail-under=79.8`) |
| Platform frontend | 85% statements, 75% branches, 80% functions, 85% lines |

### Test Patterns

**AiMemory (Python)**: Uses `asyncio_mode = "auto"` so async test functions run automatically without `@pytest.mark.asyncio`.

```python
async def test_add_memory(memory_system):
    memory_id = await memory_system.add(
        content="test content",
        tier=MemoryTier.PROJECT,
    )
    assert memory_id is not None
```

**Platform (vitest)**: Component tests use React Testing Library.

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

**MCP (node --test)**: Uses Node.js built-in test runner.

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("MemoryTools", () => {
  it("should add a memory", async () => {
    const result = await handler({ content: "test" });
    assert.ok(result.content[0].text.includes("success"));
  });
});
```

### Live API Validation

The `engram-test` skill is a 56-test Python suite that validates the live Memory API end-to-end. It covers health, CRUD, search, RAG, knowledge graph, tenants, key management, audit logging, maintenance, export, and auth edge cases.

---

## 8. Debugging Tips

### Docker Logs

```bash
# Tail all services
docker compose logs -f

# Tail a specific service
docker compose logs -f memory-api
docker compose logs -f weaviate
docker compose logs -f crawler-api

# Check container status
docker compose ps

# Restart a single service
docker compose restart memory-api
```

### Redis CLI

```bash
# Connect to memory Redis
docker compose exec memory-redis redis-cli

# Check cache keys
KEYS emb:*            # Embedding cache entries
KEYS search:*         # Search result cache
KEYS mem:*            # Individual memory cache
KEYS sess:*           # Session state
KEYS stats:*          # Stats cache
KEYS engram:api_keys:*  # API key metadata
XLEN engram:audit_log   # Audit log stream length
XREVRANGE engram:audit_log + - COUNT 5  # Last 5 audit entries

# Clear all cache (use with caution)
FLUSHDB
```

### Weaviate REST API

```bash
# Base URL (inside Docker network or via exposed port)
WEAVIATE=http://localhost:8080

# Health check
curl $WEAVIATE/v1/.well-known/ready

# List all collections (schema)
curl $WEAVIATE/v1/schema

# Get object count per collection
curl "$WEAVIATE/v1/objects?class=MemoryProject&limit=0"

# Query a specific memory by UUID
curl "$WEAVIATE/v1/objects/MemoryProject/<uuid>"

# List tenants for a collection
curl "$WEAVIATE/v1/schema/MemoryProject/tenants"

# Check cluster status
curl $WEAVIATE/v1/nodes
```

### Memory API Debug Endpoints

```bash
API=http://localhost:8000

# Health check (no auth)
curl $API/health

# Detailed health (auth required)
curl -H "X-API-Key: $KEY" $API/health/detailed

# System metrics
curl -H "X-API-Key: $KEY" $API/analytics/system-metrics

# Prometheus metrics (no auth)
curl $API/metrics

# Audit log
curl -H "X-API-Key: $KEY" "$API/admin/audit-log?limit=10"
```

### Common Issues

| Issue | Diagnosis | Fix |
|---|---|---|
| `503 System not initialized` | Weaviate or Redis is down | Check `docker compose ps`, restart the affected service |
| `401 Unauthorized` | Missing or invalid API key/JWT | Verify `X-API-Key` header or `Authorization: Bearer <jwt>` |
| Slow searches | Embedding cache miss | Check Redis connectivity; cache TTL is 7 days for embeddings |
| Missing memories after add | Search cache stale | Cache auto-expires in 1 hour; or call search with fresh query |
| MCP tools timeout | Circuit breaker open | Check Memory API health; circuit breaker resets after cooldown |
| Platform 500 errors | Check Next.js logs | `npm run dev` shows server-side errors in terminal |

---

## 9. Design System

The Engram Platform uses a **dark-mode-first** design system built on Radix primitives + shadcn/ui pattern with Tailwind CSS v4.

### Color Palette

| Role | Color | Hex |
|---|---|---|
| Primary (amber) | Warm amber | `#F2A93B` |
| Accent (violet) | Rich violet | `#7C5CBF` |
| Background (void) | Deep void black | `#03020A` |
| Surface | Elevated surface | Dark gray tones |
| Text primary | White/light gray | Standard text on dark |
| Text secondary | Muted gray | De-emphasized content |
| Success | Green | Standard success indicators |
| Error | Red | Standard error indicators |

### Typography

| Role | Font | Weight |
|---|---|---|
| Display headings | Syne | Bold (700) |
| Monospace / code | IBM Plex Mono | Regular (400) |
| Serif accents | Instrument Serif | Regular (400) |

### Component Patterns

- **Radix primitives** for accessible, unstyled base components
- **shadcn/ui** pattern for styled component library
- **Tailwind CSS v4** with CSS-native configuration (no `tailwind.config.js`)
- Dark mode is the default; light mode is secondary

### Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| React | React 19 (Server Components) |
| Auth | Clerk (`@clerk/nextjs`) |
| State | Zustand v5 + Jotai |
| Data fetching | SWR v2 |
| Charts | ECharts + Recharts |
| UI primitives | Radix UI |
| Styling | Tailwind CSS v4 |
| Testing | vitest + Playwright |

---

*Document 07 of the Engram Platform System Documentation.*
