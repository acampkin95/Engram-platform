<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# src

## Purpose

TypeScript source code root directory. Contains all client-side logic, components, hooks, stores, utilities, and type definitions. Organized by concern (components, hooks, stores, lib, types) rather than by feature.

## Key Files

| File | Description |
|------|-------------|
| (None — all files in subdirectories) | |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `components/` | React components (UI, layouts, features) |
| `design-system/` | Design system components (42 tested) |
| `hooks/` | Custom React hooks (data, state, lifecycle) |
| `stores/` | Zustand v5 stores (state management) |
| `lib/` | Utilities (API clients, helpers, performance) |
| `types/` | TypeScript types and schemas |
| `providers/` | React context providers |
| `test/` | Test setup (MSW, vitest config) |
| `server/` | Server-side utilities (if any) |
| `config/` | Configuration files |

## For AI Agents

### Working In This Directory

1. **Components**
   - Shared UI components: `components/`
   - Design system: `design-system/`
   - Always export types alongside components
   - Use 'use client' for interactive components

2. **Hooks**
   - Custom hooks: `hooks/`
   - Examples: useRAGChat, useHealthPolling, useWebSocket
   - Use React built-in hooks (useState, useEffect, etc.)

3. **State Management**
   - Zustand stores: `stores/`
   - Single source of truth for each store
   - Immutable updates (Zustand pattern)

4. **Type Safety**
   - TypeScript strict mode enabled
   - Types in `types/` directory
   - Schemas for runtime validation (zod)

5. **Testing**
   - Unit tests alongside components: `__tests__/` directories
   - MSW for API mocking
   - vitest as runner

### Testing Requirements

- **Components:** 80% statements minimum
- **Hooks:** Unit tests for logic
- **Stores:** State mutation tests
- **Utils:** Function/utility tests

### Common Patterns

1. **Component with Tests**
   ```
   src/components/MyComponent/
   ├── index.tsx
   ├── MyComponent.tsx
   └── __tests__/
       └── MyComponent.test.tsx
   ```

2. **Custom Hook**
   ```tsx
   // src/hooks/useExample.ts
   export function useExample() {
     const [state, setState] = useState();
     useEffect(() => { ... }, []);
     return { state };
   }
   ```

3. **Zustand Store**
   ```tsx
   // src/stores/exampleStore.ts
   import { create } from 'zustand';

   export const useExampleStore = create((set) => ({
     data: null,
     setData: (data) => set({ data }),
   }));
   ```

4. **Typed API Client**
   ```tsx
   // src/lib/api-client.ts
   export function useAPI<T>(url: string) {
     const { data, error, isLoading } = useSWR<T>(url, fetcher);
     return { data, error, isLoading };
   }
   ```

## Dependencies

- react (Hooks, components)
- zustand (State management)
- swr (Data fetching)
- react-hook-form (Forms)
- zod (Validation)
- tailwindcss (Styling — imported from globals.css)
- framer-motion (Animations)

## Code Style

- Line width: 100 characters
- Indent: 2 spaces
- Quotes: Single (')
- Trailing commas: All
- Semicolons: Always

## Known Patterns

1. **Barrel Exports:** Use `index.ts` files
   ```tsx
   // src/components/index.ts
   export { Button } from './Button';
   export { Card } from './Card';
   export type { ButtonProps, CardProps } from './Button';
   ```

2. **Type Exports:** Export types with components
   ```tsx
   // src/components/Button.tsx
   export interface ButtonProps { ... }
   export function Button() { ... }
   ```

3. **Hook Conventions:** Prefix with `use`
   - `useRAGChat()` — RAG chat management
   - `useHealthPolling()` — Service health polling
   - `useWebSocket()` — WebSocket lifecycle

4. **Store Conventions:** Use `create()` with typed state
   ```tsx
   import { create } from 'zustand';
   export const useStore = create<State>((set) => ({ ... }));
   ```

<!-- MANUAL: Add src-specific patterns as they emerge -->
