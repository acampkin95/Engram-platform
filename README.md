# Engram — AI Memory & Intelligence Platform

A production-grade multi-layer AI memory platform. Engram gives AI assistants persistent, searchable memory across projects, with a built-in OSINT crawler, knowledge graph, and unified dashboard.

---

## Quick Start

```bash
# Clone and configure
cp Engram-Platform/.env.example Engram-Platform/.env   # fill in secrets

# Start full stack
./scripts/deploy-unified.sh up

# Services will be available at:
#   Platform UI    → http://localhost:3002
#   Memory API     → http://localhost:8000
#   Crawler API    → http://localhost:11235
#   MCP Server     → http://localhost:3000 (profile: mcp)
#   Weaviate       → http://localhost:8080
```

> **Full deployment guide** → [`docs/01-deployment-manual.md`](docs/01-deployment-manual.md)

---

## What Is Engram?

| Component | Purpose | Stack |
|-----------|---------|-------|
| [**Engram-AiMemory**](Engram-AiMemory/) | 3-tier vector memory system | Python 3.13, FastAPI, Weaviate, Redis |
| [**Engram-AiCrawler**](Engram-AiCrawler/) | OSINT web crawler with AI analysis | Python 3.13, FastAPI, Crawl4AI, Chromium |
| [**Engram-MCP**](Engram-MCP/) | Model Context Protocol server | TypeScript, Node 20, OAuth 2.1 |
| [**Engram-Platform**](Engram-Platform/) | Unified frontend dashboard | Next.js 15, React 19, Clerk |

**Data flow:** Crawler discovers & scrapes → Memory API stores vectors → MCP exposes tools to AI clients → Platform provides the UI.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Engram-Platform  (Next.js 15, port 3002)   │
│  Dashboard · Memory browser · Crawler UI    │
├──────────────┬──────────────┬───────────────┤
│  Engram-MCP  │ Crawler API  │  Memory API   │
│  port 3000   │ port 11235   │  port 8000    │
├──────────────┴──────────────┴───────────────┤
│  Weaviate :8080  │  Redis x2 :6379/:6380    │
└──────────────────┴──────────────────────────┘
```

---

## Documentation

### Start Here

| Document | Description |
|----------|-------------|
| [`docs/00-index.md`](docs/00-index.md) | Full documentation index |
| [`docs/01-deployment-manual.md`](docs/01-deployment-manual.md) | Deploy with Docker Compose |
| [`docs/03-architecture-manual.md`](docs/03-architecture-manual.md) | System design & data flow |
| [`docs/05-mcp-manual.md`](docs/05-mcp-manual.md) | MCP server setup & tools |

### Reference

| Document | Description |
|----------|-------------|
| [`docs/reference/environment-variables.md`](docs/reference/environment-variables.md) | All `.env` variables |
| [`docs/reference/ports-network.md`](docs/reference/ports-network.md) | Service ports & URLs |
| [`docs/reference/commands.md`](docs/reference/commands.md) | Common dev commands |

### Operations

| Document | Description |
|----------|-------------|
| [`docs/02-maintenance-manual.md`](docs/02-maintenance-manual.md) | Backups, updates, monitoring |
| [`docs/04-troubleshooting-manual.md`](docs/04-troubleshooting-manual.md) | Diagnostics & common errors |
| [`docs/06-admin-manual.md`](docs/06-admin-manual.md) | User management, tenants, security |
| [`docs/07-pre-commit-guide.md`](docs/07-pre-commit-guide.md) | Code quality hooks setup |
| [`PRODUCTION_SETUP.md`](PRODUCTION_SETUP.md) | Production configuration notes |
| [`TAILSCALE_SETUP.md`](TAILSCALE_SETUP.md) | VPN & remote access setup |

### Project

| Document | Description |
|----------|-------------|
| [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) | 12-week completion plan |
| [`MEMORY_FEATURES.md`](MEMORY_FEATURES.md) | Memory system feature reference |
| [`engram-shared/README.md`](engram-shared/README.md) | Shared Python utilities package |

---

## Development Setup

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ (for AiMemory & AiCrawler development)
- Node.js 20+ (for MCP & Platform development)
- (Optional) Python venv per subproject

### Per-Subproject Dev

```bash
# AiMemory — Python + TypeScript monorepo
cd Engram-AiMemory
python3.13 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
make dev              # starts MCP + Dashboard concurrently

# AiCrawler — FastAPI + React
cd Engram-AiCrawler/01_devroot
source .venv/bin/activate
uvicorn app.main:app --reload --port 11235
cd frontend && npm run dev

# MCP Server — TypeScript
cd Engram-MCP
npm install && npm run dev

# Platform — Next.js 15
cd Engram-Platform/frontend
npm install && npm run dev    # → http://localhost:3002
```

### Shared Utilities

```bash
# Install engram-shared in any service venv
pip install -e ./engram-shared
```

---

## Key Ports

| Service | Port | Notes |
|---------|------|-------|
| Platform UI | 3002 | Next.js with Clerk auth |
| Memory API | 8000 | FastAPI, JWT auth |
| Crawler API | 11235 | FastAPI, supervisord |
| MCP Server | 3000 | stdio + HTTP transport |
| Weaviate | 8080 | Vector DB |
| Crawler Redis | 6379 | Cache |
| Memory Redis | 6380 | Cache |
| Nginx (prod) | 8080 | Reverse proxy |

---

## Environment Variables

Copy `.env.example` in each subproject. Key variables:

```env
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
JWT_SECRET=your-secret

# Embeddings (choose one)
EMBEDDING_PROVIDER=openai   # openai | deepinfra | nomic | local

# Services
WEAVIATE_URL=http://weaviate:8080
REDIS_URL=redis://memory-redis:6379
LM_STUDIO_URL=http://host.docker.internal:1234
```

See [`docs/reference/environment-variables.md`](docs/reference/environment-variables.md) for the full list.

---

## Testing

```bash
# AiMemory (Python — 80% coverage threshold)
cd Engram-AiMemory && make test

# AiCrawler (Python)
cd Engram-AiCrawler/01_devroot && pytest tests/ -v

# MCP (TypeScript)
cd Engram-MCP && npm run test && npm run smoke

# Platform (Vitest + Playwright)
cd Engram-Platform/frontend && npm run test:run && npm run test:e2e
```

---

## Production

Engram is deployed via Docker Swarm on Tailscale (`*.tail4da6b7.ts.net`).

```bash
./scripts/deploy-unified.sh up --profile mcp
./scripts/deploy-unified.sh logs memory-api
```

See [`docs/01-deployment-manual.md`](docs/01-deployment-manual.md) and [`PRODUCTION_SETUP.md`](PRODUCTION_SETUP.md).

---

## Status

**Current:** ~65% complete — In active development
**Roadmap:** [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md)

| Component | Test Coverage | Overall |
|-----------|--------------|---------|
| AiMemory | ~70% (target 95%) | 70% |
| AiCrawler | ~58% (target 85%) | 65% |
| MCP Server | 161 tests passing | 80% |
| Platform | ~0% (target 80%) | 45% |
