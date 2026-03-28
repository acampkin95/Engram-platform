<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# components

## Purpose

Reusable React UI components. Includes base components (Button, Card, Input, etc.), feature-specific components (CrawlPanel, OsintWizard, etc.), and charts/visualizations.

## Key Files/Subdirectories

| Item | Description |
|------|-------------|
| `ui/` | Base UI components (Button, Card, Dialog, etc.) |
| `charts/` | Chart components (ActivityHeatmap, BreachTimelineChart, etc.) |
| `crawl/` | Crawl-specific components (CrawlOptionsPanel, URLInput, etc.) |
| `osint/` | OSINT components (BatchAliasScan, OsintWizard, ProviderStatusBar, etc.) |
| `graph/` | Knowledge graph components (GraphCanvas, EntityDetailPanel) |
| `extraction/` | Data extraction components (SchemaDesigner, RegexTester, etc.) |
| `results/` | Result display components (JSONTreeViewer, MarkdownRenderer, etc.) |
| `rag/` | RAG pipeline components (ChunkingConfig, PipelineVisualizer, etc.) |
| `dashboard/` | Dashboard components (StatCard, QuickActions, RecentActivity) |
| `onboarding/` | Onboarding wizard components |
| `scheduler/` | Scheduling components (CreateScheduleDialog, CronBuilder) |
| `investigations/` | Investigation/case management components |
| `Navigation.tsx` | App navigation sidebar |
| `AppHeader.tsx` | App header bar |
| `ErrorBoundary.tsx` | Error boundary for exception handling |
| `LoadingSpinner.tsx` | Loading spinner component |
| `Toast.tsx` | Toast notification component |

## For AI Agents

### Working In This Directory

1. **Creating base component**: Add to `ui/` (e.g., `ui/MyComponent.tsx`)
2. **Creating feature component**: Add to feature folder (e.g., `crawl/MyCrawlPanel.tsx`)
3. **Testing**: Add `__tests__/MyComponent.test.tsx` or co-locate test file
4. **Props interface**: Always define `interface MyComponentProps { ... }`
5. **Exports**: Export components and types from `index.ts` files

### Testing Requirements

- All components must have unit tests using vitest + React Testing Library.
- Test rendering, user interactions (click, input), and prop changes.
- Test error states and loading states.

### Common Patterns

- **Functional component**: `export function MyComponent({ prop }: MyComponentProps) { return <div>...</div> }`
- **With hooks**: `const [state, setState] = useState(...); const store = useMyStore();`
- **Conditional rendering**: Use `{condition && <Component />}` or ternary
- **Props spreading**: `<div {...props} />`
- **Event handlers**: `const handleClick = () => { ... }; <button onClick={handleClick}>`

## Dependencies

### Internal
- `hooks/` — Custom React hooks
- `stores/` — Zustand state stores
- `lib/` — Utilities and API client

### External
- React 18, ReactDOM 18
- Tailwind CSS (for styling)
- Zustand (for state access)

<!-- MANUAL: -->
