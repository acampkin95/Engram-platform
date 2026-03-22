<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# system

## Purpose

System monitoring and health check routes. Provides real-time visibility into service health (Memory API, Crawler API, MCP Server), resource usage, and system logs. Uses polling and WebSocket connections for live updates.

## Key Files

| File | Description |
|------|-------------|
| `page.tsx` | System health page |
| `loading.tsx` | Loading skeleton |

## For AI Agents

### Working In This Directory

1. **Health Polling**
   - Use `useHealthPolling()` hook from `@/hooks/useHealthPolling.ts`
   - Polls `/api/health` endpoint every 5 seconds
   - Returns service status (up/down/degraded)

2. **System API Integration**
   - System client: `@/lib/system-client.ts`
   - Fetches service health, resource metrics, logs
   - Uses SWR for caching

3. **Real-time Updates**
   - Optional WebSocket connection via `useWebSocket()` hook
   - Streaming logs, metrics, alerts

### Testing Requirements

- **Health Status:** Unit tests with MSW mocking
- **Page:** E2E tests for navigation
- **Polling Hook:** Unit tests for interval management
- Coverage: 80% minimum

### Common Patterns

1. **Service Health Display**
   ```tsx
   'use client';
   import { useHealthPolling } from '@/hooks/useHealthPolling';

   export function SystemHealth() {
     const services = useHealthPolling();

     return (
       <div>
         {services.map((service) => (
           <ServiceCard
             key={service.name}
             name={service.name}
             status={service.status}
             latency={service.latency}
           />
         ))}
       </div>
     );
   }
   ```

2. **Resource Metrics**
   ```tsx
   'use client';
   import { useSystemClient } from '@/lib/system-client';

   export function ResourceMetrics() {
     const { data: metrics } = useSystemClient();
     return (
       <div>
         <MetricCard label="Memory" value={metrics?.memory} />
         <MetricCard label="CPU" value={metrics?.cpu} />
       </div>
     );
   }
   ```

3. **Service Status Badge**
   ```tsx
   function StatusDot({ status }: { status: 'up' | 'down' | 'degraded' }) {
     const colors = {
       up: 'bg-green-500',
       down: 'bg-red-500',
       degraded: 'bg-yellow-500',
     };
     return (
       <div className={`w-3 h-3 rounded-full ${colors[status]}`} />
     );
   }
   ```

## Directory Structure

```
system/
├── page.tsx         # System health/monitoring page
└── loading.tsx      # Loading skeleton
```

## Key Routes

| Route | Purpose |
|-------|---------|
| `/dashboard/system` | System health monitoring |

## Health Check Endpoints

**Services Monitored:**
- Memory API (port 8000) → `/api/health`
- Crawler API (port 11235) → `/api/health`
- MCP Server (port 3000) → `/api/health` (optional)
- Weaviate (port 8080) → `/api/health`
- Redis instances (port 6379) → Health check

**Health Status:**
- `up` — Service responding normally
- `down` — Service unreachable
- `degraded` — Service responding but slow
- `unknown` — Unable to determine status

**Health Response Format:**
```json
{
  "status": "up" | "down" | "degraded",
  "latency_ms": 42,
  "timestamp": "ISO timestamp",
  "version": "1.1.0"
}
```

## Hooks

**useHealthPolling():**
```tsx
const services = useHealthPolling();
// Returns: Service[]
// {
//   name: string,
//   status: 'up' | 'down' | 'degraded',
//   latency: number,
//   lastCheck: Date
// }
```

**useWebSocket():**
```tsx
const { connected, data } = useWebSocket(url);
// Streaming logs, metrics, alerts
// Optional: real-time updates
```

## Dependencies

- @/hooks/useHealthPolling (Polling logic)
- @/hooks/useWebSocket (WebSocket management)
- @/lib/system-client (System metrics)
- @/components/StatusDot (Status indicator)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- 'use client' for interactive components

## Known Patterns

1. **Health Polling Interval:** 5 seconds (adjustable)
   - Configurable in `useHealthPolling()` hook
   - Respects React Suspense boundaries

2. **Service Dependencies:**
   - Memory API depends on: Weaviate, Redis
   - Crawler API depends on: Redis, Chromium
   - Platform depends on: All above services

3. **Graceful Degradation:**
   - Missing service shows "unknown" status
   - Polling continues even if one service is down
   - UI displays partial status

<!-- MANUAL: Add system-specific patterns as they emerge -->
