<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# hooks

## Purpose

Custom React hooks for data fetching, state management, lifecycle management, and WebSocket communication. Encapsulates reusable logic and integrates with external services (Memory API, Crawler API, health checks).

## Key Files

| File | Description |
|------|-------------|
| `useRAGChat.ts` | RAG chat message flow + streaming |
| `useWebSocket.ts` | WebSocket connection lifecycle |
| `useHealthPolling.ts` | Service health polling (5s interval) |
| `useKeyboardShortcuts.ts` | Global keyboard shortcuts |
| `useForceLayout.ts` | Force layout recalculation |
| `useMounted.ts` | Track component mount status |
| `use-mobile.tsx` | Mobile breakpoint detection |
| `useURLState.ts` | URL parameter state management |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Hook unit tests (vitest) |

## For AI Agents

### Working In This Directory

1. **Creating Hooks**
   - Prefix with `use`
   - Export from `hooks/` root
   - Add unit test in `__tests__/`
   - Handle cleanup (useEffect returns)

2. **Data Fetching Hooks**
   - Use SWR v2 for caching
   - Null URL for conditional fetching
   - Handle isLoading, error states

3. **Lifecycle Hooks**
   - useEffect with proper dependencies
   - useCallback for stable references
   - useMemo for expensive computations

4. **WebSocket Hooks**
   - Manual cleanup on unmount
   - Exponential backoff for reconnects
   - Type-safe message handling

### Testing Requirements

- **All Hooks:** Unit tests with vitest
- **Data Hooks:** Mock SWR with MSW
- **Lifecycle:** Test cleanup, dependencies
- **WebSocket:** Mock WebSocket API

### Common Patterns

1. **Data Fetching Hook (SWR)**
   ```tsx
   // src/hooks/useExample.ts
   import useSWR from 'swr';

   export function useExample(id?: string) {
     const { data, error, isLoading } = useSWR(
       id ? `/api/example/${id}` : null,
       fetcher,
     );
     return { data, error, isLoading };
   }
   ```

2. **RAG Chat Hook**
   ```tsx
   export function useRAGChat() {
     const [messages, setMessages] = useState<Message[]>([]);
     const [input, setInput] = useState('');
     const [isLoading, setIsLoading] = useState(false);

     const handleSubmit = useCallback(async (message: string) => {
       setIsLoading(true);
       try {
         const response = await fetchRAG(message);
         setMessages((prev) => [...prev, response]);
       } finally {
         setIsLoading(false);
       }
     }, []);

     return { messages, input, isLoading, handleSubmit };
   }
   ```

3. **Health Polling Hook**
   ```tsx
   export function useHealthPolling(interval = 5000) {
     const [services, setServices] = useState<Service[]>([]);

     useEffect(() => {
       const timer = setInterval(async () => {
         const health = await checkHealth();
         setServices(health);
       }, interval);

       return () => clearInterval(timer);
     }, [interval]);

     return services;
   }
   ```

4. **WebSocket Hook**
   ```tsx
   export function useWebSocket(url: string) {
     const [connected, setConnected] = useState(false);
     const [data, setData] = useState<Data | null>(null);

     useEffect(() => {
       const ws = new WebSocket(url);
       ws.onopen = () => setConnected(true);
       ws.onmessage = (e) => setData(JSON.parse(e.data));
       return () => ws.close();
     }, [url]);

     return { connected, data };
   }
   ```

5. **Keyboard Shortcuts Hook**
   ```tsx
   export function useKeyboardShortcuts(shortcuts: Shortcuts) {
     useEffect(() => {
       const handle = (e: KeyboardEvent) => {
         if (e.ctrlKey && e.key === 'k') {
           e.preventDefault();
           shortcuts.openCommandPalette?.();
         }
       };
       window.addEventListener('keydown', handle);
       return () => window.removeEventListener('keydown', handle);
     }, [shortcuts]);
   }
   ```

## Hook Index

| Hook | Purpose | Dependencies |
|------|---------|--------------|
| `useRAGChat` | RAG message flow | Memory API, MCP |
| `useWebSocket` | WebSocket lifecycle | — |
| `useHealthPolling` | Service health (5s) | API health endpoints |
| `useKeyboardShortcuts` | Global shortcuts | — |
| `useForceLayout` | Force reflow | React |
| `useMounted` | Mount status | React |
| `use-mobile` | Mobile detection | — |
| `useURLState` | URL params | nuqs or next/router |

## Testing Requirements

- **Unit Tests:** All hooks must have vitest tests
- **SWR Mocks:** Use MSW for data-fetching hooks
- **Cleanup:** Verify useEffect cleanup runs
- **Dependencies:** Test dependency array correctness

## Dependencies

- react (Hooks, useState, useEffect, etc.)
- swr (Data fetching)
- zustand (State access, optional)

## Code Style

- `use` prefix required
- Line width: 100 characters
- Indent: 2 spaces
- Single quotes
- Return typed tuple/object

## Known Patterns

1. **Conditional Fetching:** Null URL
   ```tsx
   const { data } = useSWR(id ? `/api/${id}` : null, fetcher);
   ```

2. **Cleanup Pattern:** useEffect return
   ```tsx
   useEffect(() => {
     const timer = setInterval(...);
     return () => clearInterval(timer); // Cleanup
   }, [deps]);
   ```

3. **Type-Safe Hook Return:**
   ```tsx
   export function useExample() {
     return { data, error, isLoading } as const;
   }
   ```

4. **Memoization:** useCallback + useMemo
   ```tsx
   const handleSubmit = useCallback((value) => { ... }, [deps]);
   const computed = useMemo(() => expensive(value), [value]);
   ```

<!-- MANUAL: Add hook-specific patterns as they emerge -->
