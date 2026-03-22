<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# app

## Purpose

Next.js App Router directory. Contains all route segments (pages, layouts), API routes, middleware, and server components. Implements file-based routing with dynamic segments, nested layouts, and error boundaries.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Root layout (providers, global styles) |
| `page.tsx` | Root page (redirects to /dashboard) |
| `global-error.tsx` | Unrecoverable error boundary (500 page) |
| `middleware.ts` | Clerk authentication middleware |
| `instrumentation.ts` | Sentry initialization |
| `manifest.ts` | PWA manifest (generated) |
| `critical.css` | Critical CSS for above-fold content |
| `globals.css` | Global Tailwind styles + design tokens |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `api/` | API route handlers (server-side only) |
| `dashboard/` | Protected dashboard routes |
| `sign-in/` | Clerk sign-in page (public) |
| `sign-up/` | Clerk sign-up page (public) |

## For AI Agents

### Working In This Directory

1. **Creating Routes**
   - Add `page.tsx` to create a route
   - Add `layout.tsx` to wrap nested routes
   - Folder name = route segment (e.g., `dashboard/page.tsx` → `/dashboard`)

2. **Dynamic Routes**
   - Use `[param]` for dynamic segments
   - Use `[[...param]]` for catch-all segments
   - Access via `params` prop

3. **API Routes**
   - Create in `api/` directory
   - Export functions: `export async function GET(req) { ... }`
   - HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS

4. **Layouts**
   - Nest layouts by directory depth
   - Shared across all nested routes
   - Root layout at `app/layout.tsx`

5. **Error Handling**
   - `error.tsx` — Client error boundary (renders as fallback)
   - `global-error.tsx` — Unrecoverable errors (5xx)
   - Both are Server Components that render UI

6. **Loading States**
   - `loading.tsx` — Renders while page loads (via Suspense)
   - Returns a Skeleton or spinner
   - 17+ loading.tsx files in this project

### Testing Requirements

- **Page Components:** Test via E2E (Playwright)
- **API Routes:** Test via `fetch()` or API client
- **Middleware:** Test via E2E (full request cycle)
- Coverage: Pages and routes should have E2E coverage

### Common Patterns

1. **Root Layout (Providers)**
   ```tsx
   // app/layout.tsx
   import { Providers } from '@/providers/Providers';

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode;
   }) {
     return (
       <html>
         <body>
           <Providers>{children}</Providers>
         </body>
       </html>
     );
   }
   ```

2. **Protected Route Layout**
   ```tsx
   // app/dashboard/layout.tsx
   import { auth } from '@clerk/nextjs/server';

   export default async function DashboardLayout({
     children,
   }: {
     children: React.ReactNode;
   }) {
     const { userId } = await auth();
     if (!userId) {
       redirect('/sign-in');
     }
     return <>{children}</>;
   }
   ```

3. **Dynamic Route**
   ```tsx
   // app/dashboard/crawler/[id]/page.tsx
   export default function CrawlerPage({ params }: { params: { id: string } }) {
     return <div>Crawler {params.id}</div>;
   }
   ```

4. **Error Boundary**
   ```tsx
   // app/dashboard/error.tsx
   'use client';
   export default function Error({
     error,
     reset,
   }: {
     error: Error;
     reset: () => void;
   }) {
     return <ErrorState error={error} onRetry={reset} />;
   }
   ```

5. **Loading Skeleton**
   ```tsx
   // app/dashboard/loading.tsx
   export default function Loading() {
     return <Skeleton />;
   }
   ```

6. **API Route**
   ```tsx
   // app/api/health/route.ts
   export async function GET() {
     return Response.json({ status: 'ok' });
   }
   ```

## Directory Structure

```
app/
├── layout.tsx              # Root layout (providers)
├── page.tsx                # Root page (redirect)
├── global-error.tsx        # Unrecoverable errors
├── middleware.ts           # Clerk auth
├── instrumentation.ts      # Sentry init
├── manifest.ts             # PWA manifest
├── critical.css            # Critical CSS
├── globals.css             # Global styles + tokens
├── api/                    # API routes
│   └── health/
│       └── route.ts
├── dashboard/              # Protected routes
│   ├── layout.tsx
│   ├── page.tsx
│   ├── error.tsx
│   ├── loading.tsx
│   ├── home/
│   ├── crawler/            # Crawler UI
│   ├── intelligence/       # Intelligence UI
│   ├── memory/             # Memory UI
│   └── system/             # System monitoring
├── sign-in/                # Clerk sign-in
│   └── [[...sign-in]]/
│       └── page.tsx
└── sign-up/                # Clerk sign-up
    └── [[...sign-up]]/
        └── page.tsx
```

## Key Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Root (redirects to `/dashboard`) | Public |
| `/sign-in` | Clerk sign-in page | Public |
| `/sign-up` | Clerk sign-up page | Public |
| `/dashboard` | Main dashboard | Protected |
| `/dashboard/crawler/**` | Crawler UI | Protected |
| `/dashboard/intelligence/**` | Intelligence UI | Protected |
| `/dashboard/memory/**` | Memory UI | Protected |
| `/dashboard/system/**` | System monitoring | Protected |
| `/api/health` | Health check | Public |

## Dependencies

- next (App Router, routing)
- react (Server/Client Components)
- @clerk/nextjs (Auth middleware, session)
- framer-motion (Animations)
- @sentry/nextjs (Error tracking, optional)

## Code Style

- **Server Components by default** (fastest!)
- Use `'use client'` only for interactive features
- Async server components for data fetching
- Error boundaries per route segment

## Known Patterns

1. **Clerk Auth Middleware:**
   - Configured in `middleware.ts`
   - Protects `/dashboard/**` routes
   - Public routes: `/`, `/sign-in`, `/sign-up`, `/api/**`

2. **Nested Layouts:**
   - Root layout: `app/layout.tsx`
   - Dashboard layout: `app/dashboard/layout.tsx`
   - Dashboard sub-layouts: `app/dashboard/[segment]/layout.tsx`

3. **Suspense Boundaries:**
   - Use `loading.tsx` for async sections
   - Define error boundaries with `error.tsx`
   - 17+ loading.tsx files for streaming UX

4. **Critical CSS:**
   - `app/critical.css` inlined in HTML head
   - Above-fold styles (header, navigation)

5. **Sentry Instrumentation:**
   - `app/instrumentation.ts` — runs on server startup
   - Optional: gated by `NEXT_PUBLIC_ENABLE_SENTRY`

<!-- MANUAL: Add route-specific patterns as they emerge -->
