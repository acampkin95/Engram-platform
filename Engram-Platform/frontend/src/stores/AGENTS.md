<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# stores

## Purpose

Zustand v5 state stores for client-side state management. Manages UI state (sidebar, theme), preferences, and any shared application state. Intentionally minimal — most data is server-derived via SWR.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Store exports |
| `uiStore.ts` | UI state (sidebar, service status) |
| `preferencesStore.ts` | User preferences (theme, layout) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Store unit tests (vitest) |

## For AI Agents

### Working In This Directory

1. **Creating Stores**
   - Use `create()` from zustand
   - Prefix hook with `use` (e.g., `useUIStore`)
   - Export from `stores/index.ts`
   - Add unit test in `__tests__/`

2. **Store Patterns**
   - Immutable updates (Zustand default)
   - Derived selectors for performance
   - Persist to localStorage if needed

3. **Accessing Stores**
   - In components: `const state = useStore((s) => s.property)`
   - Destructure selectors for memoization
   - Type-safe via TypeScript

### Testing Requirements

- **All Stores:** Unit tests with vitest
- **State Mutation:** Test set/update functions
- **Selectors:** Test derived state
- **Persistence:** Test localStorage integration (if used)

### Common Patterns

1. **Basic Zustand Store**
   ```tsx
   // src/stores/exampleStore.ts
   import { create } from 'zustand';

   interface ExampleState {
     count: number;
     increment: () => void;
   }

   export const useExampleStore = create<ExampleState>((set) => ({
     count: 0,
     increment: () => set((state) => ({ count: state.count + 1 })),
   }));
   ```

2. **UI Store (uiStore.ts)**
   ```tsx
   interface UIState {
     sidebarOpen: boolean;
     setSidebarOpen: (open: boolean) => void;
     serviceStatus: ServiceStatus;
     setServiceStatus: (status: ServiceStatus) => void;
   }

   export const useUIStore = create<UIState>((set) => ({
     sidebarOpen: true,
     setSidebarOpen: (open) => set({ sidebarOpen: open }),
     serviceStatus: {},
     setServiceStatus: (status) => set({ serviceStatus: status }),
   }));
   ```

3. **Preferences Store (preferencesStore.ts)**
   ```tsx
   interface PreferencesState {
     theme: 'light' | 'dark' | 'auto';
     setTheme: (theme: 'light' | 'dark' | 'auto') => void;
     layout: 'compact' | 'normal';
     setLayout: (layout: 'compact' | 'normal') => void;
   }

   export const usePreferencesStore = create<PreferencesState>(
     (set) => ({
       theme: 'auto',
       setTheme: (theme) => set({ theme }),
       layout: 'normal',
       setLayout: (layout) => set({ layout }),
     }),
     // Optional: persist to localStorage
   );
   ```

4. **Destructuring in Components**
   ```tsx
   'use client';
   import { useUIStore } from '@/stores/uiStore';

   export function Component() {
     // Destructure selectors for performance
     const [sidebarOpen, setSidebarOpen] = useUIStore((s) => [
       s.sidebarOpen,
       s.setSidebarOpen,
     ]);

     return (
       <button onClick={() => setSidebarOpen(!sidebarOpen)}>
         {sidebarOpen ? 'Close' : 'Open'}
       </button>
     );
   }
   ```

5. **Store with Persistence**
   ```tsx
   import { create } from 'zustand';
   import { persist } from 'zustand/middleware';

   export const usePreferencesStore = create<PreferencesState>(
     persist(
       (set) => ({
         theme: 'auto',
         setTheme: (theme) => set({ theme }),
       }),
       {
         name: 'preferences-storage', // localStorage key
         partialize: (state) => ({ theme: state.theme }),
       },
     ),
   );
   ```

## Store Index

| Store | Purpose | Persisted |
|-------|---------|-----------|
| `uiStore` | UI state (sidebar, service status) | No |
| `preferencesStore` | User preferences (theme, layout) | Yes (localStorage) |

## Architecture Notes

**Minimal By Design:**
- Zustand is used ONLY for UI state and preferences
- All data state is server-derived (SWR)
- Avoids data duplication between server and client
- Simplifies sync and invalidation

**Performance:**
- Selector destructuring prevents unnecessary re-renders
- Immutable updates (no manual spread required)
- No middleware (keep it fast)

## Dependencies

- zustand@5.0.0 (State management)
- zustand/middleware (Optional: persist, devtools)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- Type state explicitly (interface)

## Testing Pattern

```tsx
// src/stores/__tests__/exampleStore.test.ts
import { useExampleStore } from '../exampleStore';

test('increments count', () => {
  const { getState } = useExampleStore;
  getState().increment();
  expect(getState().count).toBe(1);
});
```

## Known Patterns

1. **Selector Destructuring:**
   ```tsx
   const [sidebarOpen, setSidebarOpen] = useUIStore((s) => [
     s.sidebarOpen,
     s.setSidebarOpen,
   ]);
   ```

2. **Atomic Selectors:**
   ```tsx
   const sidebarOpen = useUIStore((s) => s.sidebarOpen);
   const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
   ```

3. **DevTools Integration (Development):**
   ```tsx
   import { devtools } from 'zustand/middleware';

   export const useStore = create<State>(
     devtools((set) => ({ ... })),
   );
   ```

4. **Computed State (if needed):**
   ```tsx
   const isSidebarClosed = useUIStore((s) => !s.sidebarOpen);
   ```

<!-- MANUAL: Add store-specific patterns as they emerge -->
