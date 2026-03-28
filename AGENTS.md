<!-- Generated: 2026-03-22 -->

# AGENTS.md — Engram Platform Monorepo

**Updated:** 2026-03-22

## OVERVIEW

Multi-layer AI memory and intelligence platform. 4 subprojects orchestrated via single Docker Compose file: Engram-AiMemory (vector memory), Engram-AiCrawler (OSINT), Engram-MCP (Model Context Protocol), Engram-Platform (Next.js dashboard).

## ARCHITECTURE

```
Engram Platform Monorepo
├── Engram-AiMemory/        Python 3.11+ FastAPI (port 8000)
│   ├── packages/core/      Memory system + investigation
│   └── packages/cli/       Command-line interface
├── Engram-AiCrawler/       Python 3.11 FastAPI + React 18 (port 11235)
│   └── 01_devroot/         Main codebase + frontend
├── Engram-MCP/             TypeScript MCP server (port 3000)
│   ├── src/                Server, tools, OAuth, auth
│   └── src/tools/          30+ MCP tool definitions
├── Engram-Platform/        Next.js 15 + React 19 (port 3002)
│   ├── frontend/           App Router + design system
│   ├── docker-compose.yml  Master orchestration (8 services)
│   └── nginx/              Reverse proxy configuration
├── engram-shared/          Shared Python library (logging, config, auth, http)
├── docs/                   7 comprehensive manuals + reference
├── scripts/                Unified deployment & orchestration
└── plans/                  Roadmap, evaluations, action plans
```

**Data Flow:** Crawler → Memory API (Weaviate) → MCP Server → Platform UI

**Orchestration:** Single `Engram-Platform/docker-compose.yml` orchestrates all services.

## QUICK START

### Installation

```bash
# Clone and navigate
cd /Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform

# Interactive setup (guided)
./scripts/deploy-unified.sh

# Or manual steps
cp Engram-Platform/.env.example Engram-Platform/.env
# Edit .env with your credentials
docker compose -f Engram-Platform/docker-compose.yml up -d
```

### Development

```bash
# AiMemory (Python + TS monorepo)
cd Engram-AiMemory && make install && make test && make lint

# AiCrawler (FastAPI + React)
cd Engram-AiCrawler/01_devroot && ruff check app/ && pytest tests/ -v

# MCP (TypeScript)
cd Engram-MCP && npm install && npm run build && npm run test

# Platform (Next.js)
cd Engram-Platform/frontend && npm install && npm run dev
```

## COMPONENT MATRIX

| Component | Language | Port | Status | Tests | Coverage |
|-----------|----------|------|--------|-------|----------|
| **AiMemory** | Python 3.11+ | 8000 | Stable | 901 pass | 78% |
| **AiCrawler** | Python 3.11 | 11235 | Stable | 2393 pass | 81% |
| **MCP** | TypeScript | 3000 | Stable | 382 pass | unmeasured |
| **Platform** | Next.js 15 | 3002 | Stable | 794 pass | 85% |
| **Weaviate** | Go | 8080 | Stable | — | — |
| **Redis** | C | 6379, 6380 | Stable | — | — |

## CODE STANDARDS

| Language | Width | Indent | Quotes | Linter |
|----------|-------|--------|--------|--------|
| **Python** | 100 | 4-space | Double | ruff (E,F,I,N,W,UP,B,C4,SIM) |
| **TS (AiMemory/MCP)** | 100 | 2-space | Double | biome |
| **TS (Platform)** | 100 | 2-space | **Single** | biome |

**Commit format:** `type(scope): subject` (conventional commits)

## CRITICAL PATTERNS

### Entry Points

| Service | File | Port | Container |
|---------|------|------|-----------|
| Memory API | `Engram-AiMemory/packages/core/src/memory_system/api.py` | 8000 | `memory-api` |
| Crawler API | `Engram-AiCrawler/01_devroot/app/main.py` | 11235 | `crawler-api` |
| MCP Server | `Engram-MCP/src/index.ts` | 3000 | `mcp-server` |
| Platform | `Engram-Platform/frontend/app/layout.tsx` | 3002 | `platform-frontend` |
| Weaviate | Vector DB | 8080 | `weaviate` |
| Redis (crawler) | Cache/queue | 6379 | `crawler-redis` |
| Redis (memory) | Cache | 6379 | `memory-redis` |
| Nginx | Reverse proxy | 80→8080 | `nginx` |

### Build & Test

```bash
# Full pipeline
./scripts/quality-gate.sh              # Lint + test + coverage + bundle size
./scripts/release-smoke-test.sh        # Post-deploy verification

# Per-component
cd Engram-AiMemory && make test        # 901 tests, 78% coverage
cd Engram-AiCrawler/01_devroot && pytest tests/  # 2393 tests, 81% coverage
cd Engram-MCP && npm run test          # 382 tests
cd Engram-Platform/frontend && npm run test:run  # 794 tests
```

## KEY DIRECTORIES

| Path | Purpose |
|------|---------|
| `docs/` | 7 manuals + reference sheets (see `docs/AGENTS.md`) |
| `scripts/` | Unified deployment & orchestration (see `scripts/AGENTS.md`) |
| `engram-shared/` | Shared Python library (see `engram-shared/AGENTS.md`) |
| `plans/` | Roadmap, evaluations, action items (see `plans/AGENTS.md`) |
| `Engram-AiMemory/AGENTS.md` | Memory system architecture |
| `Engram-AiCrawler/AGENTS.md` | Crawler system architecture |
| `Engram-MCP/AGENTS.md` | MCP server architecture (see root Engram-MCP/) |
| `Engram-Platform/AGENTS.md` | Platform dashboard architecture |

## ANTI-PATTERNS (FORBIDDEN)

1. **NEVER remove critical deps:** react-dom, tailwindcss, typescript, @biomejs/biome, next
2. **NEVER use public IPs in production** — Tailscale only (`*.tail4da6b7.ts.net`)
3. **NEVER set `check_robots_txt=False`** in crawler — legal/ethical violation
4. **NEVER bypass pre-commit hooks** without explicit justification
5. **NEVER log sensitive values** (credentials, tokens, API keys)

## DEPLOYMENT

### Target Infrastructure

**Production:** `dv-syd-host01` (100.100.42.6 via Tailscale)
- Ubuntu 24.04, 12 vCPU, 48GB RAM, 500GB NVMe
- Docker Engine 24.0+, Docker Compose 2.20+

**Development:** `acdev-devnode` (100.78.187.5 via Tailscale)
- Ubuntu, i5, 16GB RAM, 1TB NVMe
- LM Studio, Engram services, Crawl4AI

### Unified Deployment

```bash
# Interactive menu (recommended for first-time setup)
./scripts/deploy-unified.sh

# Specific commands
./scripts/deploy-unified.sh status                    # Service health
./scripts/deploy-unified.sh up                        # Start all services
./scripts/deploy-unified.sh logs crawler-api          # Tail logs
./scripts/deploy-unified.sh backup                    # Create backup
./scripts/deploy-unified.sh restore backups/backup-*.tar.gz  # Restore
```

See `docs/01-deployment-manual.md` for complete setup guide.

## DOCUMENTATION

### For Operators
- `docs/00-index.md` — Navigation hub
- `docs/01-deployment-manual.md` — Setup and configuration
- `docs/02-maintenance-manual.md` — Backups, monitoring, tuning
- `docs/04-troubleshooting-manual.md` — Error diagnosis and recovery

### For Developers
- Root `AGENTS.md` — This file (architecture overview)
- `Engram-AiMemory/AGENTS.md` — Memory system
- `Engram-AiCrawler/AGENTS.md` — Crawler system
- `Engram-MCP/AGENTS.md` — MCP server
- `Engram-Platform/AGENTS.md` — Platform frontend
- `docs/03-architecture-manual.md` — Detailed system design
- `docs/05-mcp-manual.md` — MCP tool reference

### For Administrators
- `docs/06-admin-manual.md` — Users, tenants, security
- `docs/07-pre-commit-guide.md` — Git hooks and compliance
- `docs/RELEASE_CHECKLIST.md` — Pre-release verification

## CURRENT PROJECT STATE

**Status:** 75% complete (as of 2026-03-22, post Operation Takeover)

### Component Health

| Component | Tests | Lint | Type | Performance | Overall |
|-----------|-------|------|------|-------------|---------|
| **AiMemory** | 901✓, 0✗ | ✓ | ⚠ (87 mypy errors) | 80% | 85% |
| **AiCrawler** | 2393✓, 0✗ | ✓ | ✓ | 85% | 90% |
| **MCP** | 382✓, 0✗ | ✓ | ✓ | 90% | 90% |
| **Platform** | 794✓, 0✗ | ✓ | ✓ | 75% | 85% |

### Recent Completions

- 2026-03-22: Operation Takeover — fixed 65+ biome errors, all linters passing
- 2026-03-22: Test consolidation — 4,470 tests passing across all components
- 2026-03-20: Webpack optimization — isolated echarts, visualization, framer-motion chunks
- 2026-03-17: Monorepo cleanup — removed dead deps, unused components, legacy scripts

### Known Issues

| Category | Issue | Status | Owner |
|----------|-------|--------|-------|
| **Security** | No encryption at rest | Open | TBD |
| **Observability** | No centralized logging | Open | TBD |
| **Type Safety** | 87 mypy errors in AiMemory | Open | Team |
| **Documentation** | Platform API docs incomplete | Open | TBD |

## NEXT STEPS

### Immediate (This Week)

1. Verify all services healthy on production
2. Set up Sentry error tracking
3. Enable structured logging aggregation
4. Complete memory API documentation

### Short-term (2-4 Weeks)

1. Encryption at rest for Weaviate + Redis
2. Centralized audit logging
3. WebSocket authentication hardening
4. MFA for admin users

### Medium-term (1-3 Months)

1. Multi-tenancy isolation
2. Advanced observability (metrics, traces)
3. Disaster recovery runbooks
4. Security audit (penetration testing)

See `plans/2026-03-11-granular-release-plan.md` for full roadmap.

## CONTACTING TEAMS

| Function | Location |
|----------|----------|
| Architecture decisions | `/claude` (this codebase) |
| Deployment issues | `scripts/deploy-unified.sh` (help output) |
| API questions | `docs/03-architecture-manual.md` (section: API Architecture) |
| Performance tuning | `docs/02-maintenance-manual.md` (section: Performance) |

<!-- This is the root AGENTS.md. It serves as the project's source of truth for architecture, conventions, and team structure. -->
