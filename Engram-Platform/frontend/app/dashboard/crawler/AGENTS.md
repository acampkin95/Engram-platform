<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# crawler

## Purpose

OSINT crawler feature routes. Provides UI for web crawling, investigation management, and knowledge graph visualization from the Engram-AiCrawler backend (port 11235). Four main sub-routes: crawl orchestration, home/overview, investigations browser, and knowledge graph viewer.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Crawler section layout (navigation) |
| `page.tsx` | Crawler redirect (to `/crawler/home`) |
| `loading.tsx` | Crawler loading skeleton |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `home/` | Crawler home page (overview, recent crawls) |
| `crawl/` | Start/manage crawls UI |
| `investigations/` | Investigation results browser |
| `knowledge-graph/` | Knowledge graph visualization |
| `osint/` | OSINT module results |

## For AI Agents

### Working In This Directory

1. **Crawler API Integration**
   - Crawler API URL: `process.env.NEXT_PUBLIC_CRAWLER_API_URL` (port 11235)
   - Use `useCrawlerAPI()` hook from `@/lib/crawler-client.ts`
   - Data is fetched via SWR (automatic revalidation)

2. **Content Components**
   - Located in sibling pages: `crawl/`, `home/`, etc.
   - Import and use in `page.tsx`
   - Example: `CrawlContent`, `CrawlerHomeContent`, `InvestigationsContent`

3. **Types**
   - Crawler types: `@/types/crawler.ts`
   - Schemas for validation: `@/types/schemas.ts`

### Testing Requirements

- **Content Components:** Unit tests with MSW mocking
- **Pages:** E2E tests for user flows
- **API Integration:** Mock Crawler API responses with MSW
- Coverage: 80% statements minimum

### Common Patterns

1. **Using Crawler API**
   ```tsx
   'use client';
   import { useCrawlerAPI } from '@/lib/crawler-client';

   export function CrawlerContent() {
     const { data: crawls, isLoading, error } = useCrawlerAPI('/crawls');
     if (isLoading) return <Skeleton />;
     if (error) return <ErrorState />;
     return <CrawlsList data={crawls} />;
   }
   ```

2. **Starting a Crawl**
   ```tsx
   'use client';
   async function handleStartCrawl(url: string) {
     const response = await fetch(`${CRAWLER_API_URL}/crawls`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ url, depth: 2 }),
     });
     const result = await response.json();
     // Update UI with result
   }
   ```

3. **Knowledge Graph Rendering**
   ```tsx
   'use client';
   import { Handle, Position } from '@xyflow/react';
   import '@xyflow/react/dist/style.css';

   export function GraphVisualization({ nodes, edges }) {
     return (
       <ReactFlow
         nodes={nodes}
         edges={edges}
         fitView
       >
         <Background />
         <Controls />
       </ReactFlow>
     );
   }
   ```

## Directory Structure

```
crawler/
├── layout.tsx              # Crawler layout
├── page.tsx                # Redirect to /home
├── loading.tsx             # Loading skeleton
├── home/                   # Overview page
│   ├── page.tsx
│   ├── loading.tsx
│   └── CrawlerHomeContent.tsx (+ test)
├── crawl/                  # Start/manage crawls
│   ├── page.tsx
│   ├── loading.tsx
│   └── CrawlContent.tsx (+ test)
├── investigations/         # Investigation browser
│   ├── page.tsx
│   └── InvestigationsContent.tsx (+ test)
├── knowledge-graph/        # Graph visualization
│   ├── page.tsx
│   ├── loading.tsx
│   └── (KnowledgeGraphContent.tsx if needed)
└── osint/                  # OSINT results
    ├── page.tsx
    └── OsintContent.tsx (+ test)
```

## Key Routes

| Route | Purpose |
|-------|---------|
| `/dashboard/crawler` | Redirect to home |
| `/dashboard/crawler/home` | Overview page |
| `/dashboard/crawler/crawl` | Start/manage crawls |
| `/dashboard/crawler/investigations` | Investigation browser |
| `/dashboard/crawler/knowledge-graph` | Graph viewer |
| `/dashboard/crawler/osint` | OSINT results |

## Dependencies

- @/lib/crawler-client (SWR hooks)
- @/types/crawler (Type definitions)
- @xyflow/react (Graph visualization)
- framer-motion (Animations)
- swr (Data fetching)

## Crawler API Integration

**Base URL:** `process.env.NEXT_PUBLIC_CRAWLER_API_URL` (default: http://localhost:11235)

**Key Endpoints:**
- `GET /crawls` — List crawls
- `POST /crawls` — Start crawl
- `GET /crawls/:id` — Get crawl details
- `GET /investigations` — List investigations
- `GET /investigations/:id` — Get investigation
- `GET /knowledge-graph` — Get graph data
- `GET /osint/:entity` — OSINT results

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- 'use client' for interactive components

## Known Patterns

1. **Content Components:** Separate from pages
   - Pages in `[route]/page.tsx` (minimal, renders component)
   - Components in `[route]/[ComponentName].tsx` (logic)
   - Test files: `[route]/[ComponentName].test.tsx`

2. **SWR Caching:** Automatic revalidation
   - Configure revalidation in `swr-keys.ts`
   - Manual mutation for optimistic updates

3. **Error Handling:** Via MSW mock responses
   - Mock 400/500 errors in tests
   - Render `<ErrorState />` component

<!-- MANUAL: Add crawl-specific patterns as they emerge -->
