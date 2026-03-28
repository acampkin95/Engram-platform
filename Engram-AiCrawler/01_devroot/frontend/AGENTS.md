<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# frontend

## Purpose

React 18 frontend for Engram-AiCrawler. Built with Vite, styled with Tailwind CSS, tested with vitest and Playwright. Provides UI for crawl configuration, OSINT discovery, result visualization, and dashboard.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Dependencies, build scripts, dev server config |
| `vite.config.ts` | Vite bundler configuration |
| `vitest.config.ts` | Vitest test runner configuration |
| `tsconfig.json` | TypeScript compiler options |
| `playwright.config.ts` | Playwright E2E test configuration |
| `src/main.tsx` | React app entry point |
| `src/App.tsx` | Root component and routing |
| `index.html` | HTML template |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | React components, hooks, stores, pages |
| `src/components/` | Reusable UI components |
| `src/pages/` | Page-level components (dashboard, crawl, results, etc.) |
| `src/hooks/` | Custom React hooks (data fetching, state, etc.) |
| `src/stores/` | Zustand state stores |
| `src/layouts/` | Layout wrappers (sidebar, navbar, etc.) |
| `src/context/` | React context providers |
| `src/lib/` | Utility functions and API client |
| `e2e/` | Playwright end-to-end tests |
| `src/__tests__/` | Unit and integration tests |

## For AI Agents

### Working In This Directory

1. **Dev server**: Run `npm run dev` to start HMR dev server on :3000
2. **Building**: Use `npm run build` to create production bundle
3. **Testing**: Use `npm run test` for watch mode or `npm run test:run` for single run
4. **E2E tests**: Use `npm run test:e2e` for Playwright tests
5. **Type checking**: Use `npm run typecheck` to run tsc --noEmit

### Testing Requirements

- All new components must have unit tests in `src/components/__tests__/` or co-located.
- Use vitest for unit tests; Playwright for E2E tests.
- Test error states, loading states, and user interactions.
- Coverage target: 80% statements, 70% branches, 80% functions/lines.

### Common Patterns

- **Component**: `export function MyComponent({ prop }: Props) { return <div>...</div> }`
- **Hook**: `export function useMyHook() { const [state, setState] = useState(...); return { state } }`
- **Store**: `const useMyStore = create((set) => ({ state, action }))`
- **API call**: `const { data, error, isLoading } = useApiRequest("/api/endpoint")`
- **Page**: Typically combines multiple components + hooks to form a feature page

## Dependencies

### Internal
- Backend API at `http://localhost:11235` (set via `VITE_API_BASE_URL`)

### External
- React 18, ReactDOM 18
- Vite (build tool)
- Tailwind CSS v3 (styling)
- Zustand v4 (state management)
- vitest (unit testing)
- Playwright (E2E testing)
- TypeScript 5
- ESLint (linting)

<!-- MANUAL: -->
