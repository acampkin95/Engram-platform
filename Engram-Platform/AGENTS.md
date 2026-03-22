<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Engram-Platform

## Purpose

Next.js 15 + React 19 unified dashboard for the Engram platform. Provides a single frontend interface for memory management, crawler orchestration, intelligence features, and system monitoring. Uses Turbopack for fast dev builds, Clerk for authentication, Zustand v5 for state, and Tailwind CSS v4 for styling.

## Key Files

| File | Description |
|------|-------------|
| `frontend/app/layout.tsx` | Root layout with providers (Clerk, SWR, Sonner, Themes) |
| `docker-compose.yml` | Master orchestration file linking all 8 services |
| `frontend/package.json` | Dependencies and scripts (v1.1.0) |
| `nginx/nginx.conf` | Reverse proxy config (port 8080 external, 3000 internal) |
| `scripts/deploy-production.sh` | Production deployment orchestration (Tailscale, health checks) |
| `scripts/validate-env.sh` | Environment variable validation script |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `frontend/` | Next.js 15 application root |
| `frontend/app/` | App Router (layout, dashboard, auth routes) |
| `frontend/src/` | TypeScript source (components, stores, hooks, lib) |
| `nginx/` | Nginx reverse proxy configuration |
| `scripts/` | Deployment and utility scripts |
| `docs/` | Architecture and audit documentation |
| `config/` | Configuration files |
| `certs/` | TLS certificates (Tailscale) |

## For AI Agents

### Working In This Directory

1. **Frontend Development**
   - Work in `/frontend/` for all UI changes
   - Use `npm run dev` (Turbopack on port 3002)
   - Single quotes, 100 char width, 2-space indent (biome)
   - All trailing commas (differs from AiMemory)

2. **Testing**
   - Unit tests: `npm run test` (vitest watch)
   - Single run: `npm run test:run`
   - E2E: `npm run test:e2e` (playwright)
   - Coverage: `npm run test:coverage` (VITEST_COVERAGE_VISIBILITY=true)

3. **Linting**
   - Check: `npm run lint` (biome check)
   - Fix: `npm run lint --fix` (biome check --fix)
   - TypeScript: `tsc --noEmit` (built-in)

4. **Docker/Deployment**
   - All services orchestrated via `docker-compose.yml` in this directory
   - Deploy to production: `scripts/deploy-production.sh`
   - Validate env: `scripts/validate-env.sh`
   - Health checks: `scripts/verify-health.sh`

### Testing Requirements

- **Unit Tests:** 80% statements minimum (vitest)
- **E2E Tests:** Playwright (smoke tests in `e2e/` directory)
- **Coverage:** Enforced via `vitest.config.ts`
- **Pre-commit:** Run `npm run lint` and `npm run test:run` before committing

### Common Patterns

1. **Components:** Located in `frontend/src/components/` and `frontend/src/design-system/`
   - UI primitives in `src/components/ui/` (Radix + shadcn pattern)
   - Design system in `src/design-system/components/` (42 tested components)
   - Always use `use client` directive for interactive components

2. **State Management:** Zustand v5 stores in `frontend/src/stores/`
   - `uiStore.ts` — sidebar state, service status
   - `preferencesStore.ts` — user preferences

3. **Data Fetching:** SWR v2 with custom hooks
   - Crawler client: `src/lib/crawler-client.ts`
   - Memory client: `src/lib/memory-client.ts`
   - System client: `src/lib/system-client.ts`

4. **Styling:** Tailwind CSS v4 (CSS-native, dark-mode-first)
   - Colors: Void (#03020A), Amber (#F2A93B), Violet (#7C5CBF), Teal (#2EC4C4)
   - Design tokens in `globals.css`
   - Component variants via `class-variance-authority`

5. **Auth:** Clerk integration
   - Protected routes via `@clerk/nextjs` middleware
   - User sessions in layout providers

6. **Hooks:** Custom hooks in `frontend/src/hooks/`
   - `useRAGChat.ts` — RAG chat orchestration
   - `useWebSocket.ts` — WebSocket management
   - `useKeyboardShortcuts.ts` — Keyboard event handling
   - `useHealthPolling.ts` — Service health polling
   - `useForceLayout.ts` — Force layout recalculation

## Dependencies

### Internal

- Engram-AiMemory (Memory API on port 8000)
- Engram-AiCrawler (Crawler API on port 11235)
- Engram-MCP (MCP Server on port 3000, optional)
- Weaviate (Vector DB on port 8080)
- Redis (Caching, 2 instances: 6379)

### External

**Core Framework:**
- next@15.0.0 (App Router, Turbopack)
- react@19.0.0 (Server Components)
- react-dom@19.0.0

**Auth & Security:**
- @clerk/nextjs@6.0.0 (Authentication)

**State & Data:**
- zustand@5.0.0 (Store management)
- swr@2.2.0 (Data fetching with revalidation)
- react-hook-form@7.71.2 (Form handling)
- zod@3.25.76 (Runtime validation)

**UI & Styling:**
- tailwindcss@4.0.0 (CSS-native)
- @tailwindcss/postcss@4.0.0
- radix-ui (multiple v1 components) (Accessible primitives)
- class-variance-authority@0.7.1 (Component variants)
- clsx@2.1.1 (Class merging)

**Components & Visualization:**
- framer-motion@12.0.0 (Animations)
- echarts@5.6.0 (Charts, 1MB gzipped)
- @xyflow/react@12.0.0 (Knowledge graphs)
- react-grid-layout@2.2.2 (Draggable widgets)
- @tanstack/react-virtual@3.13.19 (Virtual scrolling)
- sonner@2.0.7 (Toast notifications)

**Forms & Input:**
- cmdk@1.1.1 (Command palette)
- date-fns@4.1.0 (Date utilities)
- react-day-picker@9.14.0 (Date picker)

**Other:**
- next-themes@0.4.6 (Theme management)
- nuqs@2.8.9 (URL state)
- @sentry/nextjs@8.28.0 (Error tracking, optional)

**DevDependencies:**
- @biomejs/biome@2.4.5 (Linting + formatting)
- typescript@5.6.0 (Type checking)
- vitest@4.0.0 (Unit tests)
- @vitest/coverage-v8@4.0.0 (Coverage reporting)
- @playwright/test@1.58.2 (E2E tests)
- msw@2.12.10 (Mock Service Worker)

## Environment Setup

Copy `.env.example` to `.env`:

```bash
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# API Endpoints (docker-compose defaults)
NEXT_PUBLIC_MEMORY_API_URL=http://localhost:8000
NEXT_PUBLIC_CRAWLER_API_URL=http://localhost:11235
NEXT_PUBLIC_MCP_URL=http://localhost:3000

# Sentry (optional)
NEXT_PUBLIC_SENTRY_AUTH_TOKEN=...

# Feature flags
NEXT_PUBLIC_ENABLE_SENTRY=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

## Conventions

**Code Style:**
- Line width: 100 characters
- Indent: 2 spaces
- Quotes: **Single** (differs from AiMemory/MCP)
- Semicolons: Yes
- Trailing commas: All (differs from AiMemory)

**Linter:** biome v2.4.5 (ESLint + Prettier replacement)

**Commit Format:** `type(scope): subject`
- Types: feat, fix, refactor, test, docs, chore, perf, ci
- Scopes: platform, frontend, crawler, memory, mcp, docker, scripts

**Test Coverage:** 80% statements minimum (enforced in CI)

## Key Commands

```bash
cd frontend

# Development
npm run dev                # Turbopack on :3002
npm run build              # Production build
npm start                  # Start production server

# Testing
npm run test               # vitest (watch)
npm run test:run           # vitest (single run)
npm run test:coverage      # Coverage report (VITEST_COVERAGE_VISIBILITY=true)
npm run test:e2e           # Playwright E2E

# Linting & Type Checking
npm run lint               # biome check (all files)
npm run lint --fix         # biome check --fix

# Bundling
npm run build              # Next.js build (outputs to .next/)
```

## Known Patterns & Gotchas

1. **Sentry Integration:** Conditional at runtime via `NEXT_PUBLIC_ENABLE_SENTRY`
   - Client config: `sentry.client.config.ts`
   - Server config: `sentry.server.config.ts` (if exists)

2. **ECharts Bundle:** ~1MB gzipped — isolated in separate webpack chunk

3. **Framer Motion:** v12.0.0 — use `motion` from `framer-motion/m`, not default export

4. **Clerk Auth:** Middleware handles protected routes — check `middleware.ts`

5. **Tailwind v4:** CSS-native (no more @apply) — use composition or `@layer`

6. **MSW (Mock Service Worker):** Configured for tests — handlers in `public/mockServiceWorker.js`

<!-- MANUAL: Update this section with project-specific patterns as they emerge -->
