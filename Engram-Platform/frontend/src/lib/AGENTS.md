<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# lib

## Purpose

Utility functions, API clients, and helper libraries. Contains SWR data fetching hooks for backend services, performance monitoring, configuration, and shared utility functions.

## Key Files

| File | Description |
|------|-------------|
| `crawler-client.ts` | SWR hooks for Crawler API (port 11235) |
| `memory-client.ts` | SWR hooks for Memory API (port 8000) |
| `system-client.ts` | SWR hooks for system health |
| `performance.ts` | Web Vitals tracking + profiling |
| `swr-keys.ts` | SWR revalidation key definitions |
| `utils.ts` | Generic utility functions |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Unit tests for utilities |

## For AI Agents

### Working In This Directory

1. **API Clients**
   - Export SWR hooks (e.g., `useCrawlerAPI()`)
   - Handle error states
   - Configure revalidation intervals
   - Type responses with TypeScript

2. **Performance Monitoring**
   - Web Vitals (LCP, FID, CLS, TTFB, INP)
   - Optional Sentry integration
   - Profiling utilities

3. **Configuration**
   - SWR keys for cache management
   - API endpoints (from env vars)
   - Revalidation strategy

### Testing Requirements

- **API Clients:** Mock SWR and fetch with MSW
- **Performance:** Test metric collection
- **Utils:** Unit tests for pure functions

### Common Patterns

1. **SWR API Hook**
   ```tsx
   // src/lib/crawler-client.ts
   import useSWR from 'swr';

   const CRAWLER_API_URL =
     process.env.NEXT_PUBLIC_CRAWLER_API_URL ||
     'http://localhost:11235';

   const fetcher = async (url: string) => {
     const res = await fetch(`${CRAWLER_API_URL}${url}`);
     if (!res.ok) throw new Error('API Error');
     return res.json();
   };

   export function useCrawlerAPI<T>(endpoint: string) {
     const { data, error, isLoading, mutate } = useSWR<T>(
       endpoint ? `/api${endpoint}` : null,
       fetcher,
       { revalidateOnFocus: false, dedupingInterval: 60000 },
     );
     return { data, error, isLoading, mutate };
   }
   ```

2. **Memory API Hook**
   ```tsx
   // src/lib/memory-client.ts
   export function useMemoryAPI<T>(endpoint: string) {
     const { data, error, isLoading } = useSWR<T>(
       endpoint ? `/memories${endpoint}` : null,
       memoryFetcher,
       { revalidateOnFocus: false },
     );
     return { data, error, isLoading };
   }
   ```

3. **Performance Tracking**
   ```tsx
   // src/lib/performance.ts
   export function trackWebVitals() {
     const vitals = {};

     // LCP, FID, CLS, TTFB, INP
     if ('web-vital' in window) {
       // Track with Sentry or analytics
     }

     return vitals;
   }
   ```

4. **SWR Key Factory**
   ```tsx
   // src/lib/swr-keys.ts
   export const swrKeys = {
     crawls: () => '/crawls',
     crawl: (id: string) => `/crawls/${id}`,
     memories: () => '/memories',
     memory: (id: string) => `/memories/${id}`,
     health: () => '/health',
   };
   ```

## API Clients

### Crawler Client (crawler-client.ts)

**Endpoints:**
- `GET /crawls` — List crawls
- `POST /crawls` — Start crawl
- `GET /crawls/:id` — Get crawl details
- `GET /investigations` — List investigations
- `GET /knowledge-graph` — Graph data

**Usage:**
```tsx
const { data: crawls } = useCrawlerAPI('/crawls');
const { data: graph } = useCrawlerAPI('/knowledge-graph');
```

### Memory Client (memory-client.ts)

**Endpoints:**
- `GET /memories` — List memories
- `POST /memories` — Create memory
- `GET /memories/:id` — Get memory
- `DELETE /memories/:id` — Delete memory
- `POST /memories/search` — Hybrid search
- `GET /investigations` — List matters
- `GET /knowledge-graph` — Memory graph

**Usage:**
```tsx
const { data: memories } = useMemoryAPI('/memories');
const { data: results } = useMemoryAPI('/memories/search?q=...');
```

### System Client (system-client.ts)

**Endpoints:**
- `GET /health` — Service health
- `GET /metrics` — Resource metrics
- `GET /logs` — System logs

**Usage:**
```tsx
const { data: health } = useSystemClient('/health');
```

## Performance Utilities

**trackWebVitals():**
- Collects: LCP, FID, CLS, TTFB, INP
- Optional Sentry reporting
- Gated by `NEXT_PUBLIC_ENABLE_SENTRY`

**Performance Tracking Setup:**
```tsx
// In app/layout.tsx provider
useEffect(() => {
  const vitals = trackWebVitals();
  // Send to analytics/Sentry
}, []);
```

## Configuration

**SWR Keys (swr-keys.ts):**
- `crawls`, `crawl(id)`
- `memories`, `memory(id)`
- `health`, `metrics`, `logs`

**Revalidation Strategy:**
- Default: 60 seconds (dedupingInterval)
- Disabled on focus: `revalidateOnFocus: false`
- Manual mutation available: `mutate()`

## Dependencies

- swr@2.2.0 (Data fetching)
- next (Environment, router if needed)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- Type responses explicitly

## Known Patterns

1. **Conditional Fetching:**
   ```tsx
   const { data } = useSWR(enabled ? '/api/...' : null, fetcher);
   ```

2. **Manual Revalidation:**
   ```tsx
   const { mutate } = useSWR('/api/...', fetcher);
   await mutate(); // Refresh
   ```

3. **SWR Error Handling:**
   ```tsx
   if (error) return <ErrorState message={error.message} />;
   if (isLoading) return <Skeleton />;
   return <Content data={data} />;
   ```

4. **Global SWR Config:**
   ```tsx
   // In provider
   <SWRConfig value={{ dedupingInterval: 60000 }}>
     {children}
   </SWRConfig>
   ```

<!-- MANUAL: Add lib-specific patterns as they emerge -->
