# Engram Platform — Changelog

> All notable changes to the Engram Platform project are documented here.
> Format: [YYYY-MM-DD] — Description

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
