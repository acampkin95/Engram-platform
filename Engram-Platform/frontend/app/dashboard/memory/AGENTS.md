<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# memory

## Purpose

Memory management and analytics routes. Provides UI for browsing memories, viewing analytics, managing matters (investigations), and visualizing the memory graph. Integrates with Engram-AiMemory backend (port 8000) for vector database access.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Memory section layout |
| `page.tsx` | Memory redirect (to `/home`) |
| `loading.tsx` | Loading skeleton |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `home/` | Memory overview (stats, recent) |
| `analytics/` | Memory analytics dashboard |
| `graph/` | Memory graph visualization |
| `matters/` | Matter browser (investigations) |
| `memories/` | Memory browser (search, filter) |
| `timeline/` | Timeline view (by date) |

## For AI Agents

### Working In This Directory

1. **Memory API Integration**
   - Memory API URL: `process.env.NEXT_PUBLIC_MEMORY_API_URL` (port 8000)
   - Use `useMemoryAPI()` hook from `@/lib/memory-client.ts`
   - Data fetched via SWR with deduplication and revalidation

2. **Memory Tiers**
   - Tier 1: Project/Matter specific
   - Tier 2: Workspace/User general
   - Tier 3: Global system knowledge
   - Filter by tier in UI queries

3. **Types**
   - Memory types: `@/types/memory.ts`
   - Schemas: `@/types/schemas.ts`

### Testing Requirements

- **Analytics Components:** Unit tests with MSW mocking
- **Pages:** E2E tests for navigation
- **Graph Visualization:** Test rendering and interactions
- Coverage: 80% statements minimum

### Common Patterns

1. **Memory Analytics Dashboard**
   ```tsx
   'use client';
   import { useMemoryAPI } from '@/lib/memory-client';

   export function MemoryAnalytics() {
     const { data: stats } = useMemoryAPI('/memories/stats');
     return (
       <div>
         <StatCard label="Total" value={stats?.total} />
         <Chart data={stats?.timeline} />
       </div>
     );
   }
   ```

2. **Memory Browser (Search)**
   ```tsx
   'use client';
   import { useMemo, useState } from 'react';
   import { useMemoryAPI } from '@/lib/memory-client';

   export function MemoryBrowser() {
     const [query, setQuery] = useState('');
     const { data: results } = useMemoryAPI(
       query ? `/memories/search?q=${query}` : null,
     );

     return (
       <>
         <SearchInput value={query} onChange={setQuery} />
         <MemoryList memories={results} />
       </>
     );
   }
   ```

3. **Matter Browser**
   ```tsx
   'use client';
   import { useMemoryAPI } from '@/lib/memory-client';

   export function MatterBrowser() {
     const { data: matters } = useMemoryAPI('/investigations');
     return <MatterList matters={matters} />;
   }
   ```

4. **Memory Graph Visualization**
   ```tsx
   'use client';
   import { Handle, Position } from '@xyflow/react';

   export function MemoryGraphVisualization({ data }) {
     return (
       <ReactFlow nodes={data.nodes} edges={data.edges} fitView>
         <Background />
         <Controls />
       </ReactFlow>
     );
   }
   ```

## Directory Structure

```
memory/
├── layout.tsx              # Memory layout
├── page.tsx                # Redirect to /home
├── loading.tsx             # Loading skeleton
├── home/                   # Overview page
│   ├── page.tsx
│   ├── loading.tsx
│   └── (content component)
├── analytics/              # Analytics dashboard
│   ├── page.tsx
│   ├── loading.tsx
│   └── (dashboard component)
├── graph/                  # Graph visualization
│   ├── page.tsx
│   ├── loading.tsx
│   └── (graph component)
├── matters/                # Matter browser
│   ├── page.tsx
│   ├── loading.tsx
│   └── (list component)
├── memories/               # Memory browser
│   └── page.tsx            # Search/filter UI
└── timeline/               # Timeline view
    └── page.tsx
```

## Key Routes

| Route | Purpose |
|-------|---------|
| `/dashboard/memory` | Redirect to home |
| `/dashboard/memory/home` | Overview (stats, recent) |
| `/dashboard/memory/analytics` | Analytics dashboard |
| `/dashboard/memory/graph` | Memory graph viewer |
| `/dashboard/memory/matters` | Matter browser |
| `/dashboard/memory/memories` | Memory search |
| `/dashboard/memory/timeline` | Timeline view |

## Memory API Integration

**Base URL:** `process.env.NEXT_PUBLIC_MEMORY_API_URL` (default: http://localhost:8000)

**Key Endpoints:**
- `GET /memories` — List memories (paginated)
- `POST /memories` — Create memory
- `GET /memories/:id` — Get memory details
- `DELETE /memories/:id` — Delete memory
- `POST /memories/search` — Hybrid search
- `GET /memories/stats` — Stats (count, timeline)
- `POST /memories/decay` — Trigger decay update
- `GET /investigations` — List matters
- `GET /investigations/:id` — Get matter
- `GET /knowledge-graph` — Memory graph data

## Memory Structure

**Memory Entry:**
```json
{
  "id": "uuid",
  "content": "string",
  "tier": 1 | 2 | 3,
  "project_id": "uuid (tier 1 only)",
  "tenant_id": "uuid (tier 2+)",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "expires_at": "ISO timestamp (optional)",
  "embedding": [float] (1536-dim)
}
```

**Matter (Investigation):**
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "status": "open" | "closed",
  "created_at": "ISO timestamp",
  "memories": ["memory_id"]
}
```

## Dependencies

- @/lib/memory-client (SWR hooks)
- @/types/memory (Type definitions)
- @xyflow/react (Graph visualization)
- swr (Data fetching)
- echarts (Analytics charts)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- 'use client' for interactive components

## Known Patterns

1. **Memory Pagination:** SWR handles caching
   - Use `limit` and `offset` params
   - Automatic deduplication by SWR

2. **Memory Decay:** Optional background process
   - Endpoint: `POST /memories/decay`
   - Triggered manually or on schedule
   - Updates relevance scores

3. **Three-Tier System:**
   - Tier 1: Project-specific (not shared)
   - Tier 2: Tenant-wide (shared in workspace)
   - Tier 3: Global (shared system-wide)

<!-- MANUAL: Add memory-specific patterns as they emerge -->
