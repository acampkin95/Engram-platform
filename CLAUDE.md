# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Engram is a multi-layer AI memory and intelligence platform composed of four subprojects in this monorepo:

| Subproject | Language | Purpose |
|---|---|---|
| **Engram-AiMemory** | Python 3.11+ / TypeScript | 3-tier vector memory system (Weaviate + Redis + MCP) |
| **Engram-AiCrawler** | Python 3.11 / React 18 | OSINT web crawler with AI analysis (Crawl4AI + FastAPI) |
| **Engram-MCP** | TypeScript (Node 20+) | Unified MCP server — dual transport (stdio + HTTP), OAuth 2.1 |
| **Engram-Platform** | Next.js 15 / React 19 | Unified frontend dashboard with Clerk auth |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Engram-Platform (Next.js 15, port 3002)                │
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

**Data flow**: Crawler discovers/scrapes → Memory API stores vectors in Weaviate → MCP Server exposes memory tools to AI clients → Platform frontend provides the UI.

**Orchestration**: `Engram-Platform/docker-compose.yml` is the single compose file that builds and links all services together. It references sibling subproject directories as build contexts.

## Common Commands

### Engram-AiMemory (Python + npm workspaces)

```bash
cd Engram-AiMemory

# Python setup
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Run all tests (Python + TypeScript)
make test

# Python tests only (pytest with 80% coverage threshold)
make test-python                          # or: pytest packages/core/tests/ -v
pytest packages/core/tests/test_api_integration.py -v   # single test file
pytest packages/core/tests/test_cache.py::test_get -v   # single test

# TypeScript tests
make test-ts                              # or: npm run test:run -w packages/dashboard

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

### Engram-AiCrawler (Python backend + React frontend)

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

### Engram-MCP (TypeScript)

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

### Engram-Platform (Next.js 15)

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

## Code Quality Tools

| Subproject | Linter | Formatter | Type Checker | Test Runner |
|---|---|---|---|---|
| AiMemory (Python) | ruff (E,F,I,N,W,UP,B,C4,SIM) | ruff format | mypy | pytest + pytest-asyncio |
| AiMemory (TS) | biome | biome | TypeScript strict | vitest |
| AiCrawler (Python) | ruff (E,F,W,C90,UP) | ruff format | mypy | pytest |
| AiCrawler (React) | eslint | — | tsc | vitest |
| MCP | biome | biome | TypeScript strict | node --test |
| Platform | biome | biome | TypeScript | vitest + playwright |

### Style Conventions

- **Python**: 100 char line width, 4-space indent, double quotes, PEP 8, type hints on public functions
- **TypeScript/JS (AiMemory & MCP)**: 100 char line width, 2-space indent, double quotes, semicolons, ES5 trailing commas
- **TypeScript/JS (Platform)**: 100 char line width, 2-space indent, single quotes, semicolons, all trailing commas
- **Commit messages**: `type(scope): subject` format

## Key Architecture Details

### Engram-AiMemory — 3-Tier Memory

Memory is organised into three tiers stored in Weaviate with multi-tenancy:
- **Tier 1 (Project)**: Per-project isolated memory — code insights, decisions, patterns
- **Tier 2 (General)**: Cross-project, user-specific — preferences, workflows
- **Tier 3 (Global)**: Shared bootstrap knowledge — best practices, docs

Core Python package lives at `packages/core/src/memory_system/`. Key modules:
- `system.py` — main MemorySystem orchestrator
- `api.py` — FastAPI application (port 8000)
- `embeddings.py` — multi-provider embedding support (OpenAI, DeepInfra, Nomic/Ollama, local)
- `cache.py` — Redis caching layer
- `rag.py` — RAG query pipeline
- `auth.py` — JWT + API key authentication
- `decay.py` — memory decay/retention logic
- `investigation/` — document ingestion (crawling, PDF, DOCX, email parsing)

npm workspaces: `packages/cli`, `packages/mcp-server`, `packages/dashboard`

### Engram-AiCrawler — OSINT Pipeline

FastAPI app at `01_devroot/app/main.py`. Five-stage OSINT scan pipeline:
1. Alias discovery (8 platforms)
2. Crawl (Crawl4AI with Chromium)
3. Model review (LM Studio for keep/derank/archive)
4. Store (ChromaDB vector storage)
5. Knowledge graph (entity/relationship extraction)

Uses supervisord to manage multiple processes (FastAPI, LM bridge, watchdog).
Data lifecycle: hot → warm → cold → archive tiers with configurable age thresholds.

### Engram-MCP — Dual Transport MCP Server

TypeScript MCP server at `src/`. Supports both `stdio` (for Claude Code/Desktop) and HTTP streaming (for remote clients). Key modules:
- `server.ts` — MCP server setup with tool/prompt/resource registration
- `client.ts` — HTTP client for Memory API with circuit breaker
- `auth/` — OAuth 2.1 with PKCE + dynamic client registration
- `tools/` — MCP tool definitions (memory CRUD, entities, matters, RAG)
- `hooks/` — auto memory recall/store hooks
- `installer/` — `npx @engram/mcp init` CLI installer

### Engram-Platform — Unified Frontend

Next.js 15 App Router with React 19 Server Components. Key tech:
- **Auth**: Clerk (`@clerk/nextjs`)
- **State**: Zustand v5 + Jotai (stores in `src/stores/`)
- **Data fetching**: SWR v2
- **Charts**: ECharts + Recharts
- **UI**: Radix primitives + shadcn/ui pattern, Tailwind CSS v4 (CSS-native)
- **Design system**: Dark-mode-first, amber (#F2A93B) primary, violet (#7C5CBF) accent, deep void (#03020A) background
- **Fonts**: Syne (display), IBM Plex Mono (mono), Instrument Serif (serif)

Path alias: `@/` maps to the `frontend/` root directory.

## Docker Services (Engram-Platform/docker-compose.yml)

| Service | Image | Internal Port | Depends On |
|---|---|---|---|
| `crawler-api` | crawl4ai-engram | 11235 | crawler-redis, memory-api |
| `memory-api` | engram-memory-api | 8000 | weaviate, memory-redis |
| `weaviate` | weaviate:1.27.0 | 8080 | — |
| `crawler-redis` | redis:7-alpine | 6379 | — |
| `memory-redis` | redis:7-alpine | 6379 | — |
| `mcp-server` | engram-mcp-server | 3000 | memory-api (profile: mcp) |
| `platform-frontend` | engram-platform-frontend | 3000 | — |
| `nginx` | nginx:alpine | 80 (exposed: 8080) | all services |

## Environment Setup

Each subproject has its own `.env.example`. Key variables:
- `EMBEDDING_PROVIDER` — openai, deepinfra, nomic, ollama, or local
- `WEAVIATE_URL` — Weaviate vector DB endpoint
- `REDIS_URL` — Redis cache endpoint
- `LM_STUDIO_URL` — local LLM server for crawler AI analysis
- `JWT_SECRET` — required for Memory API auth
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Platform auth
- `MCP_AUTH_TOKEN` — MCP server bearer token

## Testing Thresholds

- **AiMemory Python**: 79.8% coverage minimum (`--cov-fail-under=79.8`)
- **Platform frontend**: 85% statements, 75% branches, 80% functions, 85% lines
- **AiMemory pytest**: uses `asyncio_mode = "auto"` — async tests run automatically
