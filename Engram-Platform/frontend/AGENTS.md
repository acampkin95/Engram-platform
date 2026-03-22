<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# frontend

## Purpose

Next.js 15 App Router application. Contains all pages, layouts, API routes, server components, and client components. Handles routing, data fetching, authentication middleware, and UI rendering for the unified Engram dashboard.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Dependencies and npm scripts (v1.1.0) |
| `app/layout.tsx` | Root layout with all providers (Clerk, SWR, Sonner, Themes) |
| `app/page.tsx` | Root page (redirects to /dashboard) |
| `app/manifest.ts` | PWA manifest generation |
| `middleware.ts` | Clerk auth middleware for route protection |
| `src/providers/Providers.tsx` | Client-side provider wrapper |
| `next.config.js` | Next.js configuration (Sentry, bundle analysis) |
| `tailwind.config.js` | Tailwind CSS v4 configuration with design tokens |
| `tsconfig.json` | TypeScript strict mode config |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router (pages, layouts, api routes) |
| `src/` | TypeScript source code (components, hooks, stores, lib, types) |
| `src/components/` | React components (forms, ui primitives, layouts) |
| `src/design-system/` | 42 design system components (Button, Card, Modal, etc.) |
| `src/hooks/` | Custom React hooks (RAG chat, WebSocket, health polling) |
| `src/stores/` | Zustand v5 state stores (ui, preferences) |
| `src/lib/` | Utility functions (API clients, performance, SWR keys) |
| `src/types/` | TypeScript type definitions (crawler, memory, schemas) |
| `src/providers/` | React context providers (Motion, URL state) |
| `src/test/` | Test setup and MSW handlers |
| `public/` | Static assets (favicon, mockServiceWorker.js) |
| `e2e/` | Playwright end-to-end tests |
| `.next/` | Build output (auto-generated) |

## For AI Agents

### Working In This Directory

1. **Pages & Routing**
   - Add new routes via `app/` directory (App Router)
   - Server Components by default (fastest)
   - Use `'use client'` only for interactive features
   - Suspense + loading.tsx for streaming UX

2. **Components**
   - Shared components: `src/components/`
   - Design system: `src/design-system/`
   - UI primitives: `src/components/ui/` (Radix + shadcn)
   - Always export types alongside components

3. **State Management**
   - Zustand stores: `src/stores/`
   - Single source of truth: `uiStore` for sidebar/service status
   - Preferences: `preferencesStore` for user settings

4. **Data Fetching**
   - SWR v2 hooks in components
   - API clients: `src/lib/crawler-client.ts`, `memory-client.ts`
   - Revalidation keys in `src/lib/swr-keys.ts`

5. **Styling**
   - Tailwind v4 (CSS-native, dark-mode-first)
   - Global tokens: `app/globals.css`
   - Component variants: Use CVA + clsx
   - Theme toggle: `next-themes` provider

### Testing Requirements

**Unit Tests:**
- Location: `src/components/__tests__/`, `src/hooks/__tests__/`, etc.
- Runner: vitest with @testing-library/react
- Minimum: 80% statements
- Mock API with MSW (Mock Service Worker)

**E2E Tests:**
- Location: `e2e/*.spec.ts`
- Runner: Playwright
- Scope: Critical user flows (auth, dashboard navigation)

**Running Tests:**
```bash
npm run test          # Watch mode (vitest)
npm run test:run      # Single run
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright
```

### Common Patterns

1. **Server Components** (default)
   ```tsx
   export default function Page() {
     // Direct DB/API access allowed
     // No state, no event handlers
     return <div>...</div>;
   }
   ```

2. **Client Components**
   ```tsx
   'use client';
   import { useState } from 'react';
   export default function Component() {
     // State, hooks, event handlers
     return <div>...</div>;
   }
   ```

3. **Loading States**
   ```tsx
   // app/dashboard/loading.tsx
   export default function Loading() {
     return <Skeleton />;
   }
   ```

4. **Data Fetching with SWR**
   ```tsx
   'use client';
   import { useCrawlerAPI } from '@/lib/crawler-client';
   export function MyComponent() {
     const { data, isLoading, error } = useCrawlerAPI('/endpoint');
     if (isLoading) return <LoadingState />;
     if (error) return <ErrorState />;
     return <div>{data}</div>;
   }
   ```

5. **Forms with React Hook Form + Zod**
   ```tsx
   'use client';
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   import { mySchema } from '@/types/schemas';

   export function MyForm() {
     const form = useForm({ resolver: zodResolver(mySchema) });
     return <form onSubmit={form.handleSubmit(onSubmit)}>{...}</form>;
   }
   ```

## Dependencies

### Core

- next@15.0.0
- react@19.0.0
- react-dom@19.0.0

### Must-Keep Critical Deps

These are enforced and must NEVER be removed:
- react-dom (Server rendering)
- tailwindcss (Styling)
- typescript (Type checking)
- @biomejs/biome (Linting)
- next (Framework)

### Key Deps by Category

**UI & Components:**
- Radix UI (v1 primitives: dialog, dropdown, popover, tooltip, tabs, etc.)
- class-variance-authority (Component variants)
- clsx (Class merging)
- framer-motion (Animations, animations/)

**Data & State:**
- zustand@5.0.0 (Stores)
- swr@2.2.0 (Data fetching)
- react-hook-form (Form handling)
- zod (Validation)

**Styling:**
- tailwindcss@4.0.0 (CSS-native)
- next-themes (Theme switching)

**Charts & Visualization:**
- echarts@5.6.0 (1MB+ gzipped)
- @xyflow/react (Knowledge graphs)
- react-grid-layout (Draggable widgets)

**Auth:**
- @clerk/nextjs@6.0.0 (Authentication)

**Notifications:**
- sonner@2.0.7 (Toast messages)

**Testing:**
- vitest (Unit tests)
- @testing-library/react (Component testing)
- msw@2.12.10 (API mocking)
- @playwright/test (E2E tests)

## Environment Variables

Create `.env` from `.env.example`:

```bash
# Clerk Auth (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# API Endpoints (required)
NEXT_PUBLIC_MEMORY_API_URL=http://localhost:8000
NEXT_PUBLIC_CRAWLER_API_URL=http://localhost:11235
NEXT_PUBLIC_MCP_URL=http://localhost:3000

# Optional
NEXT_PUBLIC_SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_ENABLE_SENTRY=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

## Code Style

| Rule | Value |
|------|-------|
| Line Width | 100 characters |
| Indent | 2 spaces |
| Quotes | Single (') |
| Semicolons | Always |
| Trailing Commas | All |
| Linter | biome v2.4.5 |

**Biome Rules:**
- ESLint rules enabled
- Prettier formatting (single quotes)
- Auto-format on save (IDE integration)

## Key Commands

```bash
# Development
npm run dev              # Next.js dev server (Turbopack, :3002)
npm run build            # Production build
npm start                # Start production server

# Testing
npm run test             # vitest (watch)
npm run test:run         # vitest (single run)
npm run test:coverage    # Coverage with visibility
npm run test:e2e         # Playwright tests

# Linting
npm run lint             # biome check
npm run lint --fix       # biome check --fix (if flag supported)

# Production
npm run build            # Next.js build (:3002 in production)
```

## Known Limitations & Patterns

1. **TypeScript Strict Mode:** Enabled (`strict: true` in tsconfig.json)
   - All `any` requires explicit justification
   - Null/undefined checks required

2. **Sentry Integration:** Optional, gated via `NEXT_PUBLIC_ENABLE_SENTRY`
   - Configured but not required for development

3. **Clerk Auth:** Protects dashboard routes via middleware
   - Public routes: `/`, `/sign-in`, `/sign-up`
   - Protected: `/dashboard/**`

4. **ECharts Size:** 1MB+ gzipped — isolated in separate webpack chunk
   - Lazy load if not critical

5. **CSS-Native Tailwind v4:**
   - No `@apply` shorthand (use composition)
   - Design tokens in `app/globals.css`
   - Support for CSS nesting

6. **React 19 Features:**
   - Use Form Component for HTML forms
   - Server Components default (fast!)
   - UseTransition for async transitions

<!-- MANUAL: Add patterns specific to your development workflow -->
