# AGENTS.md — Engram-Platform

**Generated:** 2026-03-02

## OVERVIEW

Next.js 15 + React 19 frontend. Unified dashboard with Clerk auth, Tailwind v4, and Turbopack.

## STRUCTURE

```
Engram-Platform/
├── frontend/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (providers)
│   │   ├── page.tsx            # Root page (redirects)
│   │   ├── dashboard/          # Dashboard routes
│   │   ├── sign-in/            # Auth routes
│   │   └── sign-up/            # Auth routes
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── stores/             # Zustand stores
│   │   ├── design-system/      # UI components
│   │   ├── lib/                # Utilities
│   │   └── test/               # Test setup (MSW)
│   └── package.json
├── docker-compose.yml          # Master orchestration
├── nginx/                      # Nginx configs
└── scripts/
    └── deploy-production.sh    # Enterprise deployment
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Root layout | `frontend/app/layout.tsx` |
| Dashboard | `frontend/app/dashboard/` |
| UI components | `frontend/src/components/` |
| Design system | `frontend/src/design-system/` |
| State stores | `frontend/src/stores/` |
| Test setup | `frontend/src/test/setup.ts` |

## CONVENTIONS

**TypeScript/React**
- Line width: 100 chars
- Indent: 2 spaces
- Quotes: **Single** (differs from other projects)
- Trailing commas: All (differs from AiMemory)
- Linter: biome

**Testing**
- Unit: vitest with 80% coverage threshold
- E2E: Playwright with 1 worker, 2 retries in CI
- Mocking: MSW (Mock Service Worker)

**Tech Stack**
- Framework: Next.js 15 (App Router)
- React: 19
- Auth: Clerk
- Styling: Tailwind CSS v4
- State: Zustand v5 + Jotai
- Data: SWR v2

## COMMANDS

```bash
cd frontend

# Dev server (Turbopack, port 3002)
npm run dev

# Build
npm run build

# Testing
npm run test              # Unit tests (watch)
npm run test:run          # Unit tests (single run)
npm run test:e2e          # Playwright E2E

# Linting
npm run lint              # biome check
```

## ANTI-PATTERNS

1. **NEVER use public IP in production** — Tailscale only (`*.tail4da6b7.ts.net`)
2. **NEVER log sensitive values** (Clerk tokens, credentials)
3. Do NOT remove critical deps: react-dom, tailwindcss, typescript, @biomejs/biome, next
4. Avoid deprecated Clerk properties: `afterSignInUrl`, `afterSignUpUrl`
