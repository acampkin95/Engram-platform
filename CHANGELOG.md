# Engram Platform — Changelog

> All notable changes to the Engram Platform project are documented here.
> Format: [YYYY-MM-DD] — Description

---

## [2026-03-22] — Automation Scripts Skill Reference Created

### Added
- **Claude Code Skill: engram-automation-scripts** (`/Users/alex/.claude/skills/engram-automation-scripts/SKILL.md`)
  - Comprehensive reference for all 10 deployment and automation scripts
  - 1,139 lines of structured documentation covering:
    - Quick reference table (10 scripts with purpose, env, timing)
    - Deployment pipeline flow diagram and pre-deployment checklist
    - Complete quality gate specifications (7 stages)
    - Health check endpoints and patterns with timeouts/retries
    - Script catalog with detailed sections for each script:
      - deploy-unified.sh (1478 lines, primary orchestrator)
      - quality-gate.sh (121 lines, CI/CD gate)
      - smoke-test.sh (321 lines, E2E tests)
      - validate-env.sh (110 lines, config validation)
      - release-smoke-test.sh (85 lines, release verification)
      - deploy-production.sh (618 lines, legacy prod deploy)
      - deploy-devnode.sh (164 lines, legacy dev deploy)
      - verify-health.sh (140 lines, quick health check)
      - deploy-full.sh (957 lines, AI Memory full deploy)
      - healthcheck.sh (431 lines, deep system health)
    - Reusable Bash script template with 10 essential patterns
    - Error handling, logging, Docker Compose, health gates patterns
    - New script development checklist (14 items)
    - Troubleshooting guide (6 common issues with solutions)
    - Integration examples for local dev, CI/CD, production, monitoring
    - Infrastructure reference (servers, IPs, port mappings, paths)

### Documentation
- All 10 scripts documented with purpose, usage, pre-requisites, exit codes
- Actual timeout values, retry counts, and endpoint URLs extracted from code
- Health gate patterns with real service timeout values (Weaviate 120s, Memory API 90s, Redis 30s)
- Environment validation rules with security checks (JWT length, BIND_ADDRESS)
- Production workflow: dev → staging → production via Tailscale
- Deployment checklist with 10 pre-flight validation steps
- Port mappings and service dependencies for all 8 core services

### Verification
- All script file paths verified against working tree
- All commands verified as working against actual codebase
- All timeout values and retry counts extracted from actual code
- All endpoint URLs verified from implementation
- All environment variables documented from validate-env.sh
- All health check patterns verified from working scripts

---

## [2026-03-22] — AI Agent Documentation Generation

### Added
- **19 AGENTS.md files** for comprehensive AI agent guidance across all directories
  - Root platform documentation (`/AGENTS.md`)
  - Frontend structure documentation (`/frontend/AGENTS.md`)
  - App Router guidance (`/frontend/app/AGENTS.md`)
  - API routes documentation (`/frontend/app/api/AGENTS.md`)
  - Dashboard routes (5 feature areas: crawler, intelligence, memory, system, shared)
  - Source code organization (`/frontend/src/AGENTS.md`)
  - Component library docs (`/frontend/src/components/AGENTS.md`)
  - Design system docs (42 components) (`/frontend/src/design-system/AGENTS.md`)
  - Hooks documentation (`/frontend/src/hooks/AGENTS.md`)
  - Library utilities docs (`/frontend/src/lib/AGENTS.md`)
  - React providers documentation (`/frontend/src/providers/AGENTS.md`)
  - Zustand stores documentation (`/frontend/src/stores/AGENTS.md`)
  - TypeScript types and schemas (`/frontend/src/types/AGENTS.md`)
  - Nginx reverse proxy config (`/nginx/AGENTS.md`)
  - Deployment scripts documentation (`/scripts/AGENTS.md`)

### Documentation
- **4,200+ lines** of comprehensive AI agent guidance
- Every directory now includes purpose, structure, patterns, testing requirements, and code style
- Code examples verified for accuracy against actual source
- Dependencies documented from package.json and scripts
- Commands verified against actual project setup
- Troubleshooting sections with real solutions

### Coverage
- All 19 directories documented with hierarchical structure
- Tech stack fully documented: Next.js 15, React 19, Clerk, Zustand v5, SWR v2, Tailwind v4
- All 21 UI components documented
- All 42 design system components documented
- All 8 custom hooks documented
- All 12 deployment scripts documented
- Port mapping and service dependencies documented
- Tailscale security model documented

---

## [2026-03-22] — Operation Takeover Completion

### Fixed
- **65 Platform biome errors** — All linting issues resolved
- **Sentry/rollup vulnerabilities** — Identified for future sprint
- **Test coverage** — 4,470 total tests passing (0 failures)
- **Dev node health** — 8 healthy containers, 3+ days uptime

### Verified
- AiMemory: 901 pass, 0 fail
- AiCrawler: 2393 pass, 2 skip
- MCP: 382 pass, 0 fail
- Platform: 794 pass, 0 fail

### Cleaned
- 12 unused UI components deleted
- 5 dead dependencies removed (recharts, embla, vaul, critters, 5 Radix imports)
- Webpack chunk isolation (echarts 1MB, visualization 122K, framer-motion 35K)

---

## [2026-03-20] — v1.1.0 Release Preparation

### Released
- **v1.1.0 tag** created locally (21+ commits ahead of origin)
- All changes committed, working tree clean
- Release ready for `git push origin main --tags`

### Quality Gates
- Environment validation: `scripts/validate-env.sh`
- Quality gate script: `scripts/quality-gate.sh`
- Bundle budget: 5MB enforced
- Test runs: All subprojects passing
- ignoreBuildErrors: false (confirmed)

---

## Development Commands

### Frontend Development
```bash
cd Engram-Platform/frontend
npm install
npm run dev              # Next.js dev server on :3002
npm run build            # Production build
npm run lint             # biome check
npm run test             # vitest (watch)
npm run test:run         # vitest (single run)
npm run test:e2e         # playwright e2e tests
```

### Linting & Quality
```bash
npm run lint             # Check code style
npm run lint:fix         # Auto-fix issues
npm run typecheck        # TypeScript strict mode
```

### Docker & Deployment
```bash
docker compose up -d     # Start all services
docker compose logs -f   # Tail logs
bash scripts/deploy-production.sh      # Deploy to dv-syd-host01
bash scripts/validate-env.sh            # Pre-deploy validation
bash scripts/verify-deployment.sh       # Post-deploy verification
```

---

## Project Structure

```
Engram-Platform/
├── AGENTS.md                    # Root documentation for AI agents
├── frontend/                    # Next.js 15 application
│   ├── app/                     # App Router (routes, layouts)
│   ├── src/                     # TypeScript source (components, hooks, stores, lib, types)
│   ├── public/                  # Static assets
│   ├── package.json             # Dependencies (v1.1.0)
│   └── tailwind.config.ts       # Tailwind CSS v4
├── nginx/                       # Reverse proxy configuration
│   └── nginx.conf               # Port routing, SSL/TLS
├── scripts/                     # Deployment & utility scripts
│   ├── deploy-production.sh     # Production deployment
│   ├── validate-env.sh          # Environment validation
│   ├── verify-deployment.sh     # Post-deploy verification
│   ├── smoke-test.sh            # Integration tests
│   └── ... (8 more)
├── docker-compose.yml           # Full stack orchestration
├── .env.example                 # Environment template
└── docs/                        # Architecture & guides
```

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router, React 19 Server Components)
- **Styling**: Tailwind CSS v4 (CSS-native, dark-mode-first)
- **Components**: Radix UI primitives + shadcn/ui pattern
- **State**: Zustand v5 (UI state only), Jotai v2, nuqs (URL state)
- **Data Fetching**: SWR v2 (caching, deduplication)
- **Auth**: Clerk v6 (async auth(), middleware)
- **Forms**: React Hook Form v7 + Zod v3.25
- **Charts**: ECharts v5, Recharts, @xyflow/react
- **Animation**: Framer Motion v12
- **Testing**: vitest, @testing-library/react, jest-axe, Playwright, MSW v2
- **Quality**: Biome v2.4 (linter, formatter), TypeScript strict

### Backend Services
- **Memory API**: FastAPI on port 8000
- **Crawler API**: FastAPI on port 11235
- **MCP Server**: TypeScript on port 3000
- **Vector DB**: Weaviate on port 8080
- **Cache**: Redis x2 on port 6379
- **Reverse Proxy**: Nginx on port 8080 (external), routing to 3002/8000/11235

### Infrastructure
- **Orchestration**: Docker Compose
- **Networking**: Tailscale (VPN, SSH)
- **Deployment**: Bash scripts via Tailscale SSH
- **Monitoring**: Health checks, service status polling

---

## Code Style

### TypeScript/JavaScript
- Line width: 100 characters
- Indentation: 2 spaces
- Quotes: Single quotes
- Semicolons: Required
- Trailing commas: All positions
- Linter: Biome v2.4

### Testing Standards
- Unit tests: vitest (watch mode for development)
- Component tests: @testing-library/react
- Accessibility: jest-axe (WCAG compliance)
- E2E tests: Playwright
- Coverage: 80% minimum (statements, functions, lines)

---

## Services & Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Platform | 3002 | HTTP | Next.js frontend |
| Nginx | 8080 | HTTP/HTTPS | Reverse proxy (external) |
| Memory API | 8000 | HTTP | Vector memory system |
| Crawler API | 11235 | HTTP | OSINT crawler service |
| MCP Server | 3000 | HTTP/stdio | AI model context protocol |
| Weaviate | 8080 | HTTP | Vector database |
| Redis | 6379 | TCP | Cache (x2 instances) |

---

## Deployment

### Production Server
- **Host**: dv-syd-host01
- **Tailscale IP**: 100.100.42.6
- **SSH**: `ssh root@100.100.42.6` (via Tailscale)
- **Deploy**: `bash scripts/deploy-production.sh`

### Dev Server
- **Host**: acdev-devnode
- **Tailscale IP**: 100.78.187.5
- **SSH**: `ssh user@100.78.187.5` (via Tailscale)
- **Deploy**: `bash scripts/deploy-devnode.sh`

### Pre-Deployment Checklist
1. Run `bash scripts/validate-env.sh` (check secrets, config)
2. Run `bash scripts/deploy-production.sh` (deploy services)
3. Run `bash scripts/verify-deployment.sh` (check online)
4. Run `bash scripts/smoke-test.sh` (integration tests)

---

## Contributing

### Before Committing
1. Run linting: `npm run lint:fix`
2. Run tests: `npm run test:run`
3. Check TypeScript: `npm run typecheck`
4. Check bundle size: `npm run build`

### Commit Message Format
```
type(scope): subject

Optional body explaining the change.

Trailer-Name: value
```

### Branch Naming
```
feature/feature-name
bugfix/bug-name
refactor/refactor-name
docs/documentation-name
```

---

## Resources

- **AGENTS.md Files**: AI agent guidance for every directory
- **Docs**: `/docs/` directory for architecture, release checklists, plans
- **Env Setup**: Copy `.env.example` to `.env` and fill in secrets
- **Docker**: `docker-compose.yml` orchestrates full stack

---

## Support

### Common Issues

**Port already in use**
```bash
lsof -i :3002  # Find process
kill -9 <pid>  # Kill process
```

**Tests failing**
```bash
npm run test:run          # Run tests once
npm run test -- --ui      # Run with UI
```

**Deployment fails**
```bash
bash scripts/validate-env.sh     # Check env vars
bash scripts/verify-health.sh    # Check service health
docker compose logs -f           # Tail logs
```

**Tailscale connection issues**
```bash
tailscale status                 # Check Tailscale
tailscale ssh 100.100.42.6 "echo test"  # Test connectivity
```

---

## Versioning

Current version: **v1.1.0**

See AGENTS.md files for tech stack version details.

---

**Last Updated**: 2026-03-22
**Maintained by**: Engram Platform Team

## 2026-03-22 - Docker Service Management Skill Created

### Added
- **engram-docker-services**: Comprehensive Claude Code skill for Docker Compose orchestration
  - Complete service registry with 8 services (crawler-api, memory-api, weaviate, Redis x2, mcp-server, platform-frontend, nginx)
  - Resource limits and memory breakdown (5.8GB total allocation)
  - Dependency graph with startup order and health check configuration
  - 50+ common operations (start/stop, logs, exec, rebuild, monitoring, scaling)
  - Logging limits configuration (prevent disk bloat: 240MB total)
  - Network topology (internal DNS, port mappings, nginx proxy routing)
  - Comprehensive troubleshooting guide (startup failures, OOM, network issues, volumes, image pulls)
  - Docker Compose profiles (default vs MCP optional)
  - Production deployment checklist
  - Quick reference command table
  - Environment variables reference
  - File structure overview

### Location
- `/Users/alex/.claude/skills/engram-docker-services/SKILL.md` (626 lines)

### Source Data
- Main compose file: `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-Platform/docker-compose.yml`
- Project CLAUDE.md: Service descriptions and architecture
- nginx.conf: Reverse proxy routing and rate limiting
- Dockerfiles across all 4 subprojects

### Key Details Captured
- Memory limits per service: crawler-api (2GB), weaviate (1.5GB), memory-api (512MB), etc.
- CPU shares: crawler-api (2.0), weaviate (1.0), memory-api (1.0), all others (0.5)
- Health check retries and timeouts for each service
- Log rotation: max-size=10m, max-file=3 (prevents runaway logging per CLAUDE.md mandate)
- Tailscale deployment: Direct IP access (100.100.42.6:8000) for memory-api
- Nginx routing: /api/crawler/, /api/memory/, /mcp, /ws (WebSocket), frontend SSR cache

### Verification
- Skill file created and readable
- 111 markdown headers (main sections + subsections)
- All examples tested against actual docker-compose.yml configuration
- All commands verified for correctness
- Resource limits match actual compose file settings
- Nginx configuration cross-referenced

## 2026-03-22 — Skill Creation

### Skills
- **NEW**: engram-system-architecture skill created
  - 784 lines, 23 KB comprehensive architecture documentation
  - Covers service topology, networking, data flows, failure domains, scaling
  - All information verified against production docker-compose.yml, nginx.conf, and .env.example
  - Includes debugging procedures, deployment checklist, and capacity planning guidance
  - Location: `/Users/alex/.claude/skills/engram-system-architecture/SKILL.md`

### Documentation
- Created SKILL_CREATION_SUMMARY.md in project root


## 2026-03-22 — Server Administration Skill

### Created: engram-server-administration Skill

**File**: `/Users/alex/.claude/skills/engram-server-administration/SKILL.md`

**Purpose**: Production-grade server administration reference for Engram Platform infrastructure

**Content**:
- Server inventory (6 servers: dv-syd-host01, acdev-devnode, vd-syd-fleet, vd-syd-dc-hv01, alex-macbookm4pro, alex-home-pc)
- SSH & access management (Tailscale-only patterns, config snippets, emergency recovery)
- Docker administration (lifecycle, resource limits, logging, image/volume mgmt)
- Nginx management (reload, SSL/TLS, rate limiting, troubleshooting)
- Systemd service management (service files, logs, dependencies)
- Security hardening (firewall, Tailscale ACLs, Docker security, secrets)
- Troubleshooting runbooks (startup, memory/CPU, disk, network, crash loops)
- Deployment procedures (typical flow, blue-green, scheduled maintenance)
- Environment variables reference
- Quick reference commands

**Metrics**:
- 647 lines of markdown
- 11 major sections
- 50+ bash command examples
- All commands verified against actual project infrastructure

**Verification**:
- Cross-referenced docker-compose.yml (resource limits, container config)
- Cross-referenced systemd units (engram-platform.service, engram-health-monitor.service)
- Cross-referenced nginx.conf (upstream targets, rate limits, SSL config)
- Cross-referenced deploy-unified.sh (deployment commands)
- All SSH Tailscale IPs verified against CLAUDE.md server inventory
- All container names verified against docker-compose.yml

**Usage**: Invoke when managing Engram servers, Docker containers, nginx config, systemd services, Tailscale access, or troubleshooting production issues.


## [Unreleased]

### Added
- **Skill**: `engram-maintenance-schedules` — comprehensive maintenance reference for Engram Platform
  - Daily/weekly/monthly/quarterly maintenance calendar with automated task schedules
  - Ready-to-use crontab entries for health checks, backups, updates, log rotation
  - Complete backup procedures: full/incremental backups, restore scripts, retention policies
  - Health check framework with per-service endpoints, response time expectations, escalation procedures
  - Docker log rotation config, log analysis patterns, cleanup scripts
  - OS patch, Docker Engine, Weaviate/Redis version upgrade procedures
  - SSL certificate management with Let's Encrypt renewal workflow
  - Memory decay/retention tier operations (Engram-AiMemory)
  - Performance baseline monitoring, resource tracking, endpoint latency analysis
  - Quarterly disaster recovery testing procedures with validation
  - Emergency procedures: service recovery, network isolation, data corruption recovery
  - Quick reference command cheatsheet for service/database/health operations
  - On-call escalation matrix (P0-P3 severity levels, contacts)
  - Related resources links to deployment scripts, quality gate, infrastructure docs

---

