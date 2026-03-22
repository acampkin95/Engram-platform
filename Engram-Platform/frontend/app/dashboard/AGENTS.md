<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# dashboard

## Purpose

Protected dashboard routes (all require Clerk authentication). Contains the main application UI with four primary sections: Crawler OSINT, Intelligence/RAG, Memory Management, and System Monitoring. Routes are organized by feature area with shared layout and navigation.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Dashboard wrapper (sidebar, nav, providers) |
| `page.tsx` | Dashboard redirect (to `/dashboard/home`) |
| `error.tsx` | Dashboard error boundary |
| `loading.tsx` | Dashboard loading skeleton |
| `DashboardClient.tsx` | Client component for sidebar/nav state |
| `DashboardClient.test.tsx` | DashboardClient unit tests |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `home/` | Dashboard home page (overview widgets) |
| `crawler/` | OSINT crawler UI (crawl, investigations, knowledge graph) |
| `intelligence/` | RAG chat, investigations, knowledge graph |
| `memory/` | Memory browser, analytics, timeline |
| `system/` | System health monitoring, logs |

## For AI Agents

### Working In This Directory

1. **Dashboard Layout**
   - Shared layout in `layout.tsx` (sidebar, header)
   - DashboardClient manages sidebar state (Zustand)
   - All routes inherit this layout

2. **Adding Routes**
   - Create folder with `page.tsx`
   - Optional: `loading.tsx`, `error.tsx`
   - Routes are automatically nested under `/dashboard`

3. **Navigation**
   - Sidebar in layout — update via `DashboardClient.tsx`
   - Use `Link` from next/link for navigation
   - Active route detection via `usePathname()`

4. **Protected Content**
   - All dashboard routes protected by Clerk middleware
   - Access user info via `useUser()` from @clerk/nextjs (client)
   - Server-side: use `auth()` from @clerk/nextjs/server

### Testing Requirements

- **DashboardClient:** Unit tests (Zustand store, sidebar state)
- **Pages:** E2E tests via Playwright
- **Error boundary:** Test error state rendering
- Coverage: 80% minimum for client components

### Common Patterns

1. **Dashboard Layout (Parent)**
   ```tsx
   // app/dashboard/layout.tsx
   import { DashboardClient } from './DashboardClient';

   export default function DashboardLayout({
     children,
   }: {
     children: React.ReactNode;
   }) {
     return (
       <DashboardClient>
         <div className="flex">
           <Sidebar />
           <main>{children}</main>
         </div>
       </DashboardClient>
     );
   }
   ```

2. **Dashboard Page with Loading**
   ```tsx
   // app/dashboard/page.tsx
   import { redirect } from 'next/navigation';

   export default function DashboardPage() {
     redirect('/dashboard/home');
   }
   ```

3. **Protected Route**
   ```tsx
   // app/dashboard/crawler/page.tsx
   import { auth } from '@clerk/nextjs/server';
   import { CrawlerContent } from './CrawlerContent';

   export default async function CrawlerPage() {
     const { userId } = await auth();
     if (!userId) {
       redirect('/sign-in');
     }
     return <CrawlerContent />;
   }
   ```

4. **Client Component with State**
   ```tsx
   // app/dashboard/DashboardClient.tsx
   'use client';
   import { useStore } from '@/stores/uiStore';

   export function DashboardClient({ children }: { children: React.ReactNode }) {
     const [sidebarOpen, setSidebarOpen] = useStore((s) => [
       s.sidebarOpen,
       s.setSidebarOpen,
     ]);
     return (
       <div className={sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}>
         {children}
       </div>
     );
   }
   ```

5. **Error Boundary**
   ```tsx
   // app/dashboard/error.tsx
   'use client';
   export default function DashboardError({
     error,
     reset,
   }: {
     error: Error;
     reset: () => void;
   }) {
     return (
       <div className="p-4">
         <h1>Error in Dashboard</h1>
         <p>{error.message}</p>
         <button onClick={() => reset()}>Try again</button>
       </div>
     );
   }
   ```

## Directory Structure

```
dashboard/
├── layout.tsx                    # Shared dashboard layout
├── page.tsx                      # Redirect to /home
├── error.tsx                     # Error boundary
├── loading.tsx                   # Loading skeleton
├── DashboardClient.tsx           # Client component (sidebar state)
├── DashboardClient.test.tsx      # Tests
├── home/                         # Dashboard overview
│   ├── page.tsx
│   ├── loading.tsx
│   └── [content components]
├── crawler/                      # OSINT crawler
│   ├── layout.tsx
│   ├── page.tsx
│   ├── loading.tsx
│   ├── crawl/                    # Crawl UI
│   ├── home/                     # Crawler home
│   ├── investigations/           # Investigation browser
│   ├── knowledge-graph/          # Graph visualization
│   └── osint/                    # OSINT results
├── intelligence/                 # Intelligence & RAG
│   ├── layout.tsx
│   ├── page.tsx
│   ├── chat/                     # RAG chat
│   ├── investigations/           # Investigation search
│   ├── knowledge-graph/          # Graph visualization
│   ├── search/                   # Search interface
│   └── error.tsx
├── memory/                       # Memory management
│   ├── layout.tsx
│   ├── page.tsx
│   ├── home/                     # Memory overview
│   ├── analytics/                # Memory analytics
│   ├── graph/                    # Memory graph
│   ├── matters/                  # Matter browser
│   ├── memories/                 # Memory browser
│   ├── timeline/                 # Timeline view
│   └── loading.tsx
└── system/                       # System monitoring
    ├── page.tsx
    ├── loading.tsx
    └── [components]
```

## Key Routes

| Route | Purpose | Component |
|-------|---------|-----------|
| `/dashboard` | Redirect to home | page.tsx |
| `/dashboard/home` | Overview/widgets | home/page.tsx |
| `/dashboard/crawler/**` | OSINT features | crawler/** |
| `/dashboard/intelligence/**` | RAG/search | intelligence/** |
| `/dashboard/memory/**` | Memory browser | memory/** |
| `/dashboard/system/**` | Health monitoring | system/** |

## Dependencies

- next (routing, layouts)
- @clerk/nextjs (auth, useUser)
- zustand (sidebar state)
- framer-motion (page transitions)
- react-hook-form (forms, if used)

## Code Style

- Server Components by default
- Use `'use client'` only for interactive features
- Async page components for data fetching
- Error boundaries per route segment

## Known Patterns

1. **Sidebar State:** Managed by `DashboardClient` + Zustand
   - Open/closed state
   - Active menu item
   - Persisted to localStorage

2. **Protected Routes:** All routes require Clerk auth
   - Middleware intercepts at root level
   - Server-side check: `const { userId } = await auth()`

3. **Loading States:** 17+ `loading.tsx` files
   - Skeleton components for fast perceived performance
   - Suspense boundaries for streaming

4. **Error Boundaries:** `error.tsx` files at each level
   - Route-level errors caught and rendered
   - Global error in `global-error.tsx`

<!-- MANUAL: Add subroutes and patterns as they develop -->
