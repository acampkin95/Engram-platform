# AGENTS.md — Engram Monorepo

**Generated:** 2026-03-02

## OVERVIEW

Multi-layer AI memory and intelligence platform. 4 subprojects: AiMemory (vector memory), AiCrawler (OSINT), MCP (Model Context Protocol), Platform (Next.js dashboard).

## ARCHITECTURE

```
Engram/
├── Engram-AiMemory/     # Python FastAPI + CLI (npm workspace: packages/cli only)
├── Engram-AiCrawler/    # Python FastAPI + React 18 frontend
├── Engram-MCP/          # TypeScript MCP server (stdio + HTTP, OAuth 2.1, 381 tests)
├── Engram-Platform/     # Next.js 15 + React 19 frontend (canonical dashboard)
├── scripts/             # Unified deployment entry point
├── docs/                # Consolidated documentation
└── archive/             # Retired packages and session artifacts
```

**Data flow:** Crawler → Memory API (Weaviate) → MCP Server → Platform UI

## CRITICAL PATTERNS

### Entry Points
| Service | File | Port |
|---------|------|------|
| Memory API | `Engram-AiMemory/packages/core/src/memory_system/api.py` | 8000 |
| Crawler API | `Engram-AiCrawler/01_devroot/app/main.py` | 11235 |
| MCP Server | `Engram-MCP/src/index.ts` | 3000 |
| Platform | `Engram-Platform/frontend/app/layout.tsx` | 3002 |

### Build Commands
```bash
# AiMemory (Python + TS monorepo)
cd Engram-AiMemory && make test && make lint

# AiCrawler (FastAPI + React)
cd Engram-AiCrawler/01_devroot && ruff check app/ && pytest tests/
cd Engram-AiCrawler/01_devroot/frontend && npm run dev

# MCP (TypeScript)
cd Engram-MCP && npm run build && npm run smoke

# Platform (Next.js)
cd Engram-Platform/frontend && npm run dev  # port 3002
```

## CODE STANDARDS

| Language | Width | Indent | Quotes | Linter |
|----------|-------|--------|--------|--------|
| Python | 100 | 4-space | Double | ruff (E,F,I,N,W,UP,B,C4,SIM) |
| TS/JS (AiMemory/MCP) | 100 | 2-space | Double | biome |
| TS/JS (Platform) | 100 | 2-space | **Single** | biome |

**Commit format:** `type(scope): subject`

## ANTI-PATTERNS (FORBIDDEN)

1. **NEVER remove critical deps:** react-dom, tailwindcss, typescript, @biomejs/biome, next
2. **NEVER use public IPs in production** — Tailscale only (`*.tail4da6b7.ts.net`)
3. **NEVER set `check_robots_txt=False`** in crawler — legal/ethical violation
4. **NEVER bypass pre-commit hooks** without explicit justification
5. **NEVER log sensitive values** (credentials, tokens)

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Memory system logic | `Engram-AiMemory/packages/core/src/memory_system/` |
| MCP tools | `Engram-MCP/src/tools/` |
| Crawler OSINT | `Engram-AiCrawler/01_devroot/app/osint/` |
| Platform UI | `Engram-Platform/frontend/src/` |
| Docker orchestration | `Engram-Platform/docker-compose.yml` |

## TESTING

| Project | Runner | Coverage | Tests | Last Baselined |
|---------|--------|----------|-------|----------------|
| AiMemory Python | pytest | 78% (4049 stmts) | 883 pass, 18 fail | 2026-03-17 |
| AiCrawler Python | pytest | 81% (12468 stmts) | 2393 pass | 2026-03-17 |
| Platform | vitest + playwright | 79% stmts, 72% branch | 318 pass | 2026-03-17 |
| MCP | node --test | unmeasured | 381 pass | 2026-03-17 |

## KEY ENV VARS

```bash
EMBEDDING_PROVIDER=openai|deepinfra|nomic|ollama|local
WEAVIATE_URL=http://localhost:8080
REDIS_URL=redis://localhost:6379
JWT_SECRET=<required>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Platform auth>
MCP_AUTH_TOKEN=<MCP bearer token>
```

## NOTES

- Monorepo uses numbered prefixes (`01_devroot`, `04_branding`) — non-standard but intentional
- GitHub Actions CI/CD is configured for AiMemory, AiCrawler, MCP, and Platform; AiCrawler now uses a single authoritative workflow at `Engram-AiCrawler/.github/workflows/ci.yml`
- Docker Compose master file at `Engram-Platform/docker-compose.yml`
- Pre-commit hooks configured at root `.pre-commit-config.yaml`

## CURRENT PROJECT STATE

**Status:** 75% Complete (as of 2026-03-17, after baseline refresh)

### Component Maturity

| Component | Test Coverage | Security | Performance | Docs | Overall |
|-----------|--------------|----------|-------------|------|---------|
| **AiMemory** | 78% (4049 stmts, 18 failing tests) | 60% | 80% | 50% | 70% |
| **AiCrawler** | 81% (12468 stmts, 2393 pass) | 75% | 85% | 40% | 75% |
| **MCP Server** | 381 tests pass, coverage unmeasured | 85% | 90% | 60% | 80% |
| **Platform** | 79% stmts, 72% branch (318 pass) | 70% | 75% | 30% | 60% |

### Critical Gaps

1. **Test Coverage**
   - AiMemory: 78% baseline established; 18 failing tests to fix, then drive toward 85%+ in-scope
   - AiCrawler: 81% baseline established (exceeds 75% enforced minimum); continue toward 85%
   - Platform: 79% stmts baseline established; coverage reporting now works correctly
   - MCP: 381 tests healthy; coverage metric reporting still needs to be surfaced

2. **Security (NIST Compliance)**
   - ❌ No encryption at rest (Weaviate, Redis)
   - ❌ No secrets vault (plaintext .env files)
   - ❌ No centralized logging
   - ❌ No WebSocket authentication
   - ❌ No MFA for admin users

3. **Dashboard (2026 Standards)**
   - ✅ `nuqs` provider and shared hooks exist; rollout is partial rather than absent
   - ✅ Sentry client and runtime instrumentation exist; operational verification remains incomplete
   - ❌ Inconsistent memoization
   - ❌ No component documentation (Storybook missing)

4. **MCP Framework**
   - ~88% compliant (pagination remains incomplete; Zod input validation IS implemented)
   - Redis-backed OAuth storage exists; startup validation bootstrap bug was fixed on 2026-03-18

5. **Performance (i5/16GB/1TB)**
   - Current: 10.5GB (65% of 16GB)
   - Target: 8.5GB (53% of 16GB)
   - Chromium SHM: 3GB → 2GB recommended

## DETAILED ARCHITECTURE

### Engram-AiMemory (Memory DB/Client)

**Tech Stack:**
- Python 3.11+ (FastAPI, Weaviate client, Redis)
- TypeScript (MCP bridge, dashboard package)
- Weaviate (vector database)
- Redis (caching, job queue)

**Key Components:**
- `memory_system/client.py` — Weaviate client (1154 LOC)
- `memory_system/system.py` — Memory orchestration (621 LOC)
- `memory_system/api.py` — FastAPI endpoints (932 LOC)
- `memory_system/workers.py` — Background maintenance (654 LOC)
- `memory_system/decay.py` — Relevance decay algorithm (124 LOC)

**Memory Tiers:**
1. **Tier 1 (Project/Matter):** Project-specific context
2. **Tier 2 (Tenant/General):** Workspace-wide knowledge
3. **Tier 3 (Global):** Universal system facts

**Test Coverage:**
- 21 Python test files (~9,189 LOC)
- Target: 95%
- CI/CD: GitHub Actions configured
- Coverage config: `.coveragerc` (80% minimum)

**Endpoints:**
- `POST /memories/search` — Hybrid search + reranking
- `POST /memories` — Create memory
- `POST /memories/batch` — Bulk ingestion
- `POST /memories/decay` — Trigger decay update
- `POST /memories/consolidate` — Trigger deduplication
- `POST /memories/cleanup` — Remove expired

---

### Engram-AiCrawler (OSINT Platform)

**Tech Stack:**
- Python 3.11+ (FastAPI, Crawl4AI, ChromaDB)
- React 18 (frontend)
- Redis (caching, job queue)
- Playwright (browser automation)

**Key Components:**
- `app/main.py` — FastAPI app entry (178 LOC)
- `app/osint/` — OSINT modules (alias, darkweb, email, etc.)
- `app/services/cache.py` — Multi-layer Redis cache (311 LOC)
- `app/services/concurrency_governor.py` — Concurrency control (181 LOC)
- `frontend/` — React 18 dashboard

**OSINT Capabilities:**
- Alias discovery
- Dark web monitoring
- Email OSINT
- Image intelligence
- Semantic tracking
- Threat intelligence

**Test Coverage:**
- 72 Python test files (~24,907 LOC)
- 22 TS test files
- 7 E2E specs (Playwright)
- Current: 57.82%
- Target: 75% enforced minimum, 85% stretch target
- **CI/CD: CONFIGURED** (single authoritative workflow at `Engram-AiCrawler/.github/workflows/ci.yml`)

**Caching Strategy:**
- HOT: 1 hour (frequently accessed)
- WARM: 24 hours (recent results)
- COLD: 7 days (historical)
- NEGATIVE: 5 minutes (failed URLs)
- LLM: 4 hours (LM Studio responses)

**Concurrency Limits:**
- MAX_CONCURRENT_OSINT: 5
- MAX_CONCURRENT_CRAWLS: 3
- Per-domain rate limiting (1-5s delays)

---

### Engram-MCP (Model Context Protocol Server)

**Tech Stack:**
- TypeScript (Node.js)
- @modelcontextprotocol/sdk@^1.27.1
- Hono (HTTP framework)
- Zod (validation)

**Key Components:**
- `src/server.ts` — MCP Server factory (211 LOC)
- `src/index.ts` — Entry point with transport selection (85 LOC)
- `src/tools/tool-definitions.ts` — 30+ tool definitions (384 LOC)
- `src/auth/oauth-server.ts` — OAuth 2.1 server (543 LOC)
- `src/errors.ts` — Typed error hierarchy (187 LOC)

**Transports:**
- stdio (for local process spawning)
- HTTP streaming (StreamableHTTPServerTransport)

**Tool Categories:**
- Memory Tools (10): add, search, get, delete, batch, consolidate, etc.
- Entity Tools (4): add_entity, add_relation, query_graph, health_check
- Investigation Tools (3): create_matter, ingest_document, search_matter
- Analytics/Admin Tools (13): export, bulk_delete, analytics, metrics, etc.

**Authentication:**
- OAuth 2.1 with PKCE (RFC 7636)
- Dynamic client registration (RFC 7591)
- Authorization server metadata (RFC 8414)
- Bearer token support

**Resilience:**
- Retry logic (exponential backoff with jitter)
- Circuit breaker (failure threshold: 5, reset: 30s)
- Timeouts (request: 30s, connection: 5s)
- Connection pooling (max 50 sockets per origin)

**Test Coverage:**
- 10 TypeScript test files
- 161 tests passing
- Test runner: Node.js native (--test)
- CI/CD: GitHub Actions configured

**MCP Framework Compliance:** ~88%
- ✅ Dual transport, OAuth 2.1, error hierarchy
- ✅ Input validation via Zod (`src/schemas.ts`, 283 LOC — validates all 27 tool inputs on every invocation)
- ✅ Static and dynamic resource support implemented in `src/resources/`
- ❌ No broad pagination model across MCP-facing list/search surfaces

---

### Engram-Platform (Dashboard)

**Tech Stack:**
- Next.js 15 (App Router)
- React 19
- Tailwind CSS v4 (CSS-native)
- Zustand v5 (state management)
- Framer Motion v12 (animations)
- Clerk (authentication)
- SWR v2 (data fetching)

**Key Components:**
- `app/layout.tsx` — Root layout with providers
- `src/stores/uiStore.ts` — Zustand store (sidebar, service status)
- `src/providers/Providers.tsx` — Client providers (Clerk, SWR, Toast)
- `src/design-system/` — 42 components
- `src/lib/performance.ts` — Web Vitals tracking

**Design System:**
- 42 components in `/src/design-system/`
- Tailwind v4 CSS-native with design tokens
- Dark mode first (next-themes)
- Color palette: Void (#03020A), Amber (#F2A93B), Violet (#7C5CBF), Teal (#2EC4C4)

**State Management:**
- Zustand v5 (single store: uiStore)
- SWR v2 (data fetching with deduplication)
- **Missing:** nuqs (URL state management)

**Error Handling:**
- Global error boundary (`app/global-error.tsx`)
- Route-level error boundaries (`error.tsx` files)
- ErrorState component with retry
- **Missing:** Sentry integration

**Loading States:**
- Loading boundaries (`loading.tsx` in 17 routes)
- LoadingState component (spinner/skeleton variants)
- Skeleton components (7 specialized: StatCard, Card, DataTable, etc.)

**Visualizations:**
- Recharts v2.15 (charts)
- @xyflow/react v12 (knowledge graphs)
- react-grid-layout v2.2 (draggable widgets)
- @tanstack/react-virtual v3.13 (virtual scrolling)

**Test Coverage:**
- 15 TS test files
- 2 E2E specs (Playwright)
- Coverage: ~0% (reporting issue)
- Target: 80%
- CI/CD: GitHub Actions configured

**2026 Standards Gaps:**
- ❌ No nuqs (URL state management)
- ❌ No Sentry (error tracking)
- ❌ Inconsistent memoization
- ❌ No Storybook (component docs)
- ❌ No accessibility audit (WCAG 2.1 AA)
- ❌ No Google Lighthouse testing

## PERFORMANCE CONFIGURATION

### Docker Resource Limits (Current: 10.5GB / 65%)

| Service | Memory Limit | CPU | Reservation |
|---------|-------------|-----|-------------|
| Crawler API | 3G | 2.0 | 1G |
| Memory API | 1G | 1.0 | 256M |
| Weaviate | 2G | 1.0 | 512M |
| Crawler Redis | 1G | 0.5 | 384M |
| Memory Redis | 768M | 0.5 | 256M |
| MCP Server | 512M | 0.5 | 128M |
| Platform Frontend | 512M | 0.5 | 128M |
| Nginx | 256M | 0.5 | 64M |
| Chromium SHM | 3GB | — | — |

### Target for i5/16GB/1TB (8.5GB / 53%)

| Service | Current → Target | Reduction |
|---------|-----------------|-----------|
| Crawler API | 3G → 2G | -1G |
| Memory API | 1G → 512M | -512M |
| Weaviate | 2G → 1.5G | -512M |
| Crawler Redis | 1G → 512M | -512M |
| Memory Redis | 768M → 384M | -384M |
| MCP Server | 512M → 256M | -256M |
| Frontend | 512M → 256M | -256M |
| Nginx | 256M → 128M | -128M |
| Chromium SHM | 3GB → 2GB | -1GB |

### Weaviate Configuration

- GOMEMLIMIT: 1.5GiB → 1.2GiB (recommended)
- GOMAXPROCS: 2
- Query cache: 512MB → 384MB (recommended)
- Query defaults limit: 100
- Query maximum timeout: 60s
- GRPC connection pool: 100 max concurrent streams
- Multi-tenancy enabled (REPLICATION_FACTOR: 1)

### Redis Configuration

**Crawler Redis:**
- maxmemory: 768M → 384M (recommended)
- Eviction policy: allkeys-lru
- Connection pool: 20 max connections
- Socket timeout: 5s

**Memory Redis:**
- maxmemory: 512M → 256M (recommended)
- Eviction policy: allkeys-lru

### Concurrency Limits

- MAX_CONCURRENT_OSINT: 5 → 3 (recommended)
- MAX_CONCURRENT_CRAWLS: 3 → 2 (recommended)
- Per-domain rate limiting: 1-5s delays
- Domain-specific delays:
  - LinkedIn/Facebook: 5s
  - Instagram: 4s
  - Twitter/TikTok: 3s
  - Reddit: 2s
  - GitHub: 1s

## SECURITY IMPLEMENTATION

### Authentication

**AiMemory:**
- JWT (HS256) + API key authentication
- Bcrypt password hashing
- FastAPI Security dependencies

**AiCrawler:**
- Clerk JWT verification (RS256)
- Role-based access control (ADMIN/USER)
- Token expiry validation

**MCP:**
- OAuth 2.1 with PKCE
- Dynamic client registration (RFC 7591)
- Authorization server metadata (RFC 8414)
- Access + refresh tokens

### Rate Limiting

- Redis-based distributed rate limiting
- Sliding window algorithm (per-minute)
- Daily quota tracking (resets at midnight UTC)
- Tiered limits:
  - User: 60 req/min, 1,000 req/day
  - Admin: 120 req/min, 10,000 req/day
- HTTP 429 responses with `Retry-After` header

### Input Validation

- SSRF protection:
  - URL scheme validation (HTTP/HTTPS only)
  - Private IP blocking (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8)
  - Hostname blocklist (localhost, metadata.google.internal, 169.254.169.254)
  - DNS resolution validation
- Input sanitization:
  - Null byte rejection
  - Oversized payload rejection (10 MB limit)
- Pydantic model validation on all endpoints

### Security Headers

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: default-src 'self'`
- `Referrer-Policy: strict-origin-when-cross-origin`

### NIST Compliance Gaps

| Control | Status | Gap |
|---------|--------|-----|
| AC-2 (Account Management) | Partial | No MFA, no account lockout |
| AC-3 (Access Enforcement) | Partial | RBAC limited scope |
| AU-2 (Audit Events) | Minimal | No centralized logging |
| SC-7 (Boundary Protection) | Partial | CSP too strict, no cert pinning |
| SC-12 (Cryptographic Key Management) | Minimal | No key rotation, no vault |
| SC-28 (Information at Rest) | Not Implemented | No database encryption |
| SI-4 (Information System Monitoring) | Minimal | No centralized monitoring |
| SI-10 (Information Input Validation) | Good | SSRF + sanitization solid |

## TESTING INFRASTRUCTURE

### Test Runners

- **Python:** pytest (AiMemory, AiCrawler)
- **TypeScript:** vitest (AiMemory, AiCrawler, Platform)
- **MCP:** Node.js native (--test)
- **E2E:** Playwright (AiCrawler, Platform)

### Coverage Configuration

| Component | Config File | Minimum Threshold |
|-----------|-------------|-------------------|
| AiMemory Python | `.coveragerc` | 80% |
| AiCrawler Python | `.coveragerc` | 75% |
| Platform TS | `vitest.config.ts` | 80% statements, 70% branches |

### Test File Counts

- **AiMemory:** 21 Python files, 5 TS files
- **AiCrawler:** 72 Python files, 22 TS files, 7 E2E specs
- **MCP:** 10 TS files (161 tests passing)
- **Platform:** 15 TS files, 2 E2E specs

### CI/CD Status

| Component | GitHub Actions | Status |
|-----------|----------------|--------|
| AiMemory | ✅ `.github/workflows/ci.yml` | Configured |
| AiCrawler | ✅ `.github/workflows/ci.yml` | Configured |
| MCP | ✅ `.github/workflows/ci.yml` | Configured |
| Platform | ✅ `.github/workflows/ci.yml` | Configured |

## DEPLOYMENT

### Docker Compose Files

1. **Master:** `Engram-Platform/docker-compose.yml` (8 services)
2. **AiCrawler:** `docker-compose.yml`, `docker-compose.prod.yml`
3. **AiMemory:** `docker/docker-compose.yml`, `docker/docker-compose.prod.yml`
4. **MCP:** `docker/docker-compose.yml`

### Deployment Scripts

1. `Engram-AiCrawler/01_devroot/scripts/deploy_ubuntu.sh` — Most complete (9-step)
2. `Engram-AiMemory/scripts/deploy-server.sh` — Tailscale-optimized
3. `Engram-AiMemory/scripts/deploy-full.sh` — Most sophisticated
4. `Engram-Platform/scripts/deploy-production.sh` — Orchestration-focused
5. `Engram-MCP/install.sh` — Minimal (Node.js only)
6. `setup.sh` (root level) — Docker Compose only

### Critical Gap

**No unified one-shot Ubuntu installer** — 5 fragmented scripts with:
- No single entry point
- No interactive menu
- Incomplete coverage (no script deploys full stack)
- Port strategy mismatch
- Inconsistent health checks
- No rollback automation (except Platform)

## DOCUMENTATION

### Project Documentation

- `PROJECT_ROADMAP.md` — 12-week completion plan (889 lines)
- `AGENTS.md` — This file (architecture and patterns)
- `MEMORY_FEATURES.md` — Memory system features
- `CHANGELOG_*.md` — Recent changes (3 files)

### Recent Changelogs

1. `CHANGELOG_2026-03-04_COMPREHENSIVE_REVIEW.md` — Project assessment (457 lines)
2. `CHANGELOG_2026-03-02_OPTIMIZATION.md` — Frontend optimization
3. `CHANGELOG_BACKEND_OPTIMIZATION_2026-03-02.md` — Python 3.11+ compatibility

### Recent Sessions (040326)

1. Comprehensive Frontend Overhaul and Testing
2. Improve Test Coverage
3. MCP Enhancements and Deployment
4. Memory System Enhancement

## NEXT STEPS

**See `PROJECT_ROADMAP.md` for the current 10-week release plan**

**Immediate Priorities:**
1. Reconcile docs and plans with the corrected project state
2. Re-baseline AiMemory, MCP, and Platform coverage/reporting
3. Raise AiCrawler to the enforced 75% coverage minimum
4. Move MCP OAuth state out of process memory into Redis
5. Build one verified release checklist and deployment smoke path
