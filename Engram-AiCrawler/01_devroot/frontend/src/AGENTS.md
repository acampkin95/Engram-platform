<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# src

## Purpose

Source code root for React frontend. Contains components, pages, hooks, stores, layouts, and utilities.

## Key Files

| File | Description |
|------|-------------|
| `main.tsx` | React app bootstrapper (mounts App.tsx to #root) |
| `App.tsx` | Root component with routing and providers |
| `index.css` | Global styles |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `components/` | Reusable UI components (buttons, cards, forms, etc.) |
| `pages/` | Page-level components (Dashboard, Crawl, Results, etc.) |
| `hooks/` | Custom React hooks (useApiRequest, useCrawlConfig, etc.) |
| `stores/` | Zustand state stores (crawlStore, notificationStore, etc.) |
| `layouts/` | Layout wrappers (AppLayout, DashboardLayout) |
| `context/` | React context providers (if used alongside Zustand) |
| `lib/` | Utility functions and API client |
| `__tests__/` | Integration and unit tests |

## For AI Agents

### Working In This Directory

1. **Adding components**: Create in `components/` with `.tsx` extension and optional test file.
2. **Adding pages**: Create in `pages/` and register in `App.tsx` routing.
3. **Adding hooks**: Create in `hooks/` (e.g., `useMyHook.ts`); hooks are testable, composable functions.
4. **Adding stores**: Create in `stores/` using Zustand pattern (e.g., `useMyStore.ts`).
5. **Adding utils**: Create in `lib/` for API client, helpers, constants.

### Testing Requirements

- All components must have unit tests with vitest + React Testing Library.
- Test user interactions (click, input), loading states, error states.
- Use mocked API responses via `MSW` (Mock Service Worker) or direct mocks.

### Common Patterns

- **Component with hooks**: `function MyComponent() { const [state, setState] = useState(...); return <div>...</div> }`
- **API call**: `const { data, isLoading, error } = useApiRequest("/api/endpoint")`
- **Store usage**: `const { state, action } = useMyStore()`
- **Props interface**: `interface MyComponentProps { title: string; onClose?: () => void }`

## Dependencies

### Internal
- Components depend on hooks and stores
- Pages depend on components, hooks, and stores
- Hooks depend on API client (`lib/api-client.ts`)
- Stores are self-contained (Zustand)

### External
- React 18, ReactDOM 18
- React Router (for routing)
- Tailwind CSS (for styling)
- Zustand (for state management)

<!-- MANUAL: -->
