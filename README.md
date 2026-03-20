# Engram -- AI Memory & Intelligence Platform

A production-grade multi-layer AI memory platform. Engram gives AI assistants persistent, searchable memory across projects, with a built-in OSINT crawler, knowledge graph, and unified dashboard.

---

## Quick Start

```bash
# First-time setup (interactive env configuration + deploy)
./scripts/deploy-unified.sh init

# Or step by step:
./scripts/deploy-unified.sh setup    # configure .env interactively
./scripts/deploy-unified.sh up       # build and start all services

# Services:
#   Platform UI    http://localhost:3002
#   Memory API     http://localhost:8000
#   Crawler API    http://localhost:11235
#   MCP Server     http://localhost:3000
#   Weaviate       http://localhost:8080
```

> **Full deployment guide** -> [`docs/01-deployment-manual.md`](docs/01-deployment-manual.md)

---

## What Is Engram?

| Component | Purpose | Stack |
|-----------|---------|-------|
| [**Engram-AiMemory**](Engram-AiMemory/) | 3-tier vector memory system | Python 3.11+, FastAPI, Weaviate, Redis |
| [**Engram-AiCrawler**](Engram-AiCrawler/) | OSINT web crawler with AI analysis | Python 3.11+, FastAPI, Crawl4AI, Chromium |
| [**Engram-MCP**](Engram-MCP/) | Model Context Protocol server | TypeScript, Node 20, OAuth 2.1, 381 tests |
| [**Engram-Platform**](Engram-Platform/) | Unified frontend dashboard | Next.js 15, React 19, Clerk, Tailwind v4 |

**Data flow:** Crawler discovers & scrapes -> Memory API stores vectors -> MCP exposes tools to AI clients -> Platform provides the UI.

---

## Architecture

```
+---------------------------------------------+
|  Engram-Platform  (Next.js 15, port 3002)   |
|  Dashboard . Memory browser . Crawler UI    |
+--------------+--------------+---------------+
|  Engram-MCP  | Crawler API  |  Memory API   |
|  port 3000   | port 11235   |  port 8000    |
+--------------+--------------+---------------+
|  Weaviate :8080  |  Redis x2 :6379/:6380    |
+------------------+--------------------------+
```

## Project Structure

```
Engram/
+-- Engram-AiMemory/        Python FastAPI memory system + CLI
+-- Engram-AiCrawler/       Python FastAPI OSINT crawler
+-- Engram-MCP/             TypeScript MCP server (canonical)
+-- Engram-Platform/        Next.js 15 dashboard (canonical UI)
|   +-- docker-compose.yml  Master orchestration file
+-- scripts/
|   +-- deploy-unified.sh   Canonical deployment entry point
+-- docs/                   Consolidated documentation
+-- engram-shared/          Shared Python utilities
+-- archive/                Retired artifacts and session docs
+-- plans/                  Implementation roadmaps
```

---

## Unified Deployment

All deployment goes through a single entry point:

```bash
./scripts/deploy-unified.sh <command>
```

| Command | Description |
|---------|-------------|
| `init` | First-time setup: interactive env config + build + deploy + health check |
| `setup` | Interactive environment configuration wizard |
| `up` | Build and start the stack |
| `down` | Stop the stack |
| `deploy [--dry-run]` | Production deploy with pre-flight checks |
| `health` | Check all service health endpoints |
| `ps` | Show container status |
| `logs [service]` | Tail service logs |
| `restart [service]` | Restart all or one service |
| `config` | Validate compose config |

Legacy per-subproject scripts are accessible via delegation:

```bash
./scripts/deploy-unified.sh deploy:production    # full production deploy
./scripts/deploy-unified.sh deploy:devnode       # devnode-optimized deploy
./scripts/deploy-unified.sh deploy:memory        # memory system deploy
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
| [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) | Completion plan |
| [`MEMORY_FEATURES.md`](MEMORY_FEATURES.md) | Memory system feature reference |
| [`engram-shared/README.md`](engram-shared/README.md) | Shared Python utilities package |

---

## Development Setup

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ (for AiMemory & AiCrawler development)
- Node.js 20+ (for MCP & Platform development)

### Per-Subproject Dev

```bash
# AiMemory -- Python memory system + CLI
cd Engram-AiMemory
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
make test

# AiCrawler -- FastAPI + React
cd Engram-AiCrawler/01_devroot
source .venv/bin/activate
uvicorn app.main:app --reload --port 11235

# MCP Server -- TypeScript (381 tests, OAuth 2.1)
cd Engram-MCP
npm install && npm run dev

# Platform -- Next.js 15 + React 19
cd Engram-Platform/frontend
npm install && npm run dev    # http://localhost:3002
```

### Shared Utilities

```bash
pip install -e ./engram-shared
```

---

## Key Ports

| Service | Port | Notes |
|---------|------|-------|
| Platform UI | 3002 | Next.js with Clerk auth |
| Memory API | 8000 | FastAPI, JWT auth |
| Crawler API | 11235 | FastAPI, supervisord |
| MCP Server | 3000 | Dual transport: stdio + HTTP, OAuth 2.1 |
| Weaviate | 8080 | Vector DB |
| Crawler Redis | 6379 | Cache |
| Memory Redis | 6380 | Cache |

---

## Environment Variables

Run `./scripts/deploy-unified.sh setup` for interactive configuration, or copy `.env.example`:

```bash
cp Engram-Platform/.env.example Engram-Platform/.env
```

Key variables:

```env
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
JWT_SECRET=your-secret-min-32-chars

# Embeddings
EMBEDDING_PROVIDER=deepinfra   # openai | deepinfra | nomic | local

# Network (never use 0.0.0.0 in production)
BIND_ADDRESS=127.0.0.1
TAILSCALE_HOSTNAME=your-host.tail1234.ts.net

# MCP
MCP_AUTH_TOKEN=your-mcp-token
```

See [`docs/reference/environment-variables.md`](docs/reference/environment-variables.md) for the full list.

---

## Testing

```bash
# AiMemory (Python, 80% coverage threshold)
cd Engram-AiMemory && make test

# AiCrawler (Python)
cd Engram-AiCrawler/01_devroot && pytest tests/ -v

# MCP (TypeScript, 381 tests)
cd Engram-MCP && npm test

# Platform (Vitest + Playwright)
cd Engram-Platform/frontend && npm run test:run && npm run test:e2e
```

---

## Production

Engram is deployed on Tailscale (`*.tail4da6b7.ts.net`). Never expose services on public IPs directly.

```bash
./scripts/deploy-unified.sh deploy             # full deploy with pre-flight
./scripts/deploy-unified.sh deploy --dry-run   # validate without changes
./scripts/deploy-unified.sh health             # verify all services
```

See [`docs/01-deployment-manual.md`](docs/01-deployment-manual.md) and [`PRODUCTION_SETUP.md`](PRODUCTION_SETUP.md).

---

## Status

**Current:** ~75% complete -- In active development (baselined 2026-03-17)
**Roadmap:** [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md)

| Component | Test Coverage | Tests | Overall |
|-----------|--------------|-------|---------|
| AiMemory | 78% (4049 stmts) | 883 pass, 18 fail | 70% |
| AiCrawler | 81% (12468 stmts) | 2393 pass | 75% |
| MCP Server | unmeasured | 381 pass | 80% |
| Platform | 79% stmts, 72% branch | 318 pass | 60% |
