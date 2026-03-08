# Bundle Analysis Report

**Date:** 2026-03-01
**Next.js:** 15.5.12 | **Build mode:** Production (`next build`)
**Tooling:** `@next/bundle-analyzer` (gated by `ANALYZE=true`)

---

## How to Run

```bash
ANALYZE=true npm run build
```

Reports are generated at:
- `.next/analyze/client.html` — Client-side bundles (primary)
- `.next/analyze/nodejs.html` — Server-side bundles
- `.next/analyze/edge.html` — Edge/middleware bundles

Open `client.html` in a browser for the interactive treemap.

---

## Summary

| Metric | Value |
|---|---|
| Total client JS (raw, uncompressed) | ~3.4 MB across all chunks |
| Shared JS baseline (all pages) | 103 KB (gzipped) |
| Heaviest page (First Load JS) | `/dashboard/crawler/home` — 234 KB |
| Lightest pages (First Load JS) | `/dashboard/intelligence/chat`, `/memory/graph` — 112 KB |
| Middleware | 71.8 KB |

---

## Route-Level Breakdown (First Load JS, gzipped)

| Route | Page JS | First Load JS | Rating |
|---|---|---|---|
| `/` | 134 B | 103 KB | Good |
| `/dashboard` | 134 B | 103 KB | Good |
| `/dashboard/crawler/home` | 4.1 KB | **234 KB** | Needs work |
| `/dashboard/crawler/crawl` | 2.18 KB | **229 KB** | Needs work |
| `/dashboard/memory/memories` | 3.79 KB | **221 KB** | Needs work |
| `/dashboard/memory/matters` | 5.11 KB | **220 KB** | Needs work |
| `/dashboard/crawler/investigations` | 4.53 KB | **213 KB** | Needs work |
| `/dashboard/crawler/knowledge-graph` | 2.64 KB | **211 KB** | Needs work |
| `/dashboard/memory/analytics` | 5.18 KB | **210 KB** | Needs work |
| `/dashboard/home` | 7.53 KB | 181 KB | Acceptable |
| `/dashboard/crawler/osint` | 8.42 KB | 177 KB | Acceptable |
| `/dashboard/intelligence/investigations` | 7.27 KB | 170 KB | Acceptable |
| `/dashboard/memory/home` | 7.74 KB | 144 KB | OK |
| `/dashboard/intelligence/search` | 6.92 KB | 137 KB | OK |
| `/dashboard/intelligence/chat` | 2.06 KB | 112 KB | Good |
| `/dashboard/intelligence/knowledge-graph` | 2.06 KB | 112 KB | Good |
| `/dashboard/memory/graph` | 2.04 KB | 112 KB | Good |

> **Target:** First Load JS < 170 KB per page for good Core Web Vitals (LCP/TBT).

---

## Largest Client Chunks (raw, uncompressed)

| Chunk | Size | Primary Content | Used By |
|---|---|---|---|
| `3872.*.js` | **1,025 KB** | echarts (full library) | memory/analytics |
| `d0aa168d.*.js` | **363 KB** | vis-network + vis-data | crawler/knowledge-graph, intelligence/knowledge-graph |
| `framework-*.js` | 185 KB | React + ReactDOM | All pages (expected) |
| `4bd1b696-*.js` | 168 KB | React internals / hook-form | All pages (shared) |
| `1255-*.js` | 168 KB | Shared component chunk | All pages (shared) |
| `1437-*.js` | 139 KB | Clerk auth + SWR | All pages (auth) |
| `main-*.js` | 134 KB | Next.js runtime | All pages (expected) |
| `2320-*.js` | 116 KB | framer-motion | Layout/design-system |
| `polyfills-*.js` | 109 KB | Browser polyfills | All pages (expected) |
| `9461.*.js` | 91 KB | @xyflow/react | knowledge-graph, memory/graph |
| `6359-*.js` | 87 KB | react-day-picker | Date-related pages |
| `1560-*.js` | 86 KB | zod | Form/validation pages |
| `1a258343.*.js` | 78 KB | @xyflow/system | knowledge-graph, memory/graph |
| `489-*.js` | 70 KB | react-grid-layout | Dashboard grid pages |

---

## What's Already Working Well

1. **`optimizePackageImports`** configured for lucide-react, react-icons, date-fns, and all Radix UI primitives — prevents full-barrel imports from bloating the bundle.
2. **`vis-network` / `vis-data`** use dynamic `import()` — only loaded on knowledge-graph pages.
3. **`@xyflow/react`** components wrapped in `next/dynamic` with loading states.
4. **Chat component** uses `next/dynamic` — keeps the chat page lean at 112 KB.
5. **Standalone output** mode and compression enabled.

---

## Actionable Optimization Opportunities

### Priority 1: echarts — 1 MB chunk (HIGH IMPACT)

**Problem:** The full echarts library (1,025 KB raw) is bundled as a single chunk. It's only used on `/dashboard/memory/analytics`.

**Current:** `import('echarts')` dynamic import in the page, but this still pulls the *entire* echarts package.

**Recommendation:**
```tsx
// Instead of importing the full library:
import('echarts')

// Use modular imports with echarts/core:
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
```

**Expected savings:** ~600-700 KB (from 1 MB down to ~300 KB depending on components used).

**Also:** `echarts-for-react` is listed in `package.json` but **never imported** in application code. It can likely be removed as a dead dependency, saving install time and avoiding accidental full-bundle imports.

### Priority 2: react-grid-layout — 70 KB (MEDIUM IMPACT)

**Problem:** `DraggableGrid.tsx` statically imports `react-grid-layout`. This chunk loads on all dashboard pages that use the grid, even before the grid is visible.

**Recommendation:** Wrap `DraggableGrid` in `next/dynamic`:
```tsx
// In the consuming page:
const DraggableGrid = dynamic(() => import('@/components/DraggableGrid'), {
  ssr: false,
  loading: () => <GridSkeleton />,
});
```

**Expected savings:** 70 KB deferred from initial load on grid pages.

### Priority 3: Add heavy packages to optimizePackageImports (LOW EFFORT)

**Current `optimizePackageImports`** covers Radix and utility libs but misses:

```ts
experimental: {
  optimizePackageImports: [
    // ... existing entries ...
    'framer-motion',       // 116 KB — used in 5 design-system components
    '@xyflow/react',       // ~170 KB — used on graph pages
    'react-day-picker',    // 87 KB — calendar widget
    'react-hook-form',     // used across form pages
    '@dnd-kit/core',       // drag-and-drop
    '@dnd-kit/sortable',
  ],
},
```

**Expected savings:** Varies by package — primarily prevents barrel-import bloat if import patterns change.

### Priority 4: framer-motion tree-shaking (MEDIUM EFFORT)

**Problem:** framer-motion (116 KB) is imported in 5 files across the design-system (NavItem, StatusDot, Tabs, SidebarGroup) and ChatContent. Since design-system components are used on every page, this chunk loads globally.

**Recommendation:** Use `motion` from `framer-motion/m` (lightweight subset) or import individual features:
```tsx
// Instead of:
import { motion } from 'framer-motion';

// Consider (if only using basic animations):
import { m, LazyMotion, domAnimation } from 'framer-motion';
```

**Expected savings:** ~40-60 KB if using `LazyMotion` + `domAnimation` subset.

### Priority 5: Remove dead dependency — echarts-for-react

**Finding:** `echarts-for-react` is in `package.json` dependencies but has **zero imports** across `app/` and `src/`. It can be safely removed:

```bash
npm uninstall echarts-for-react
```

---

## Shared Baseline Analysis

The 103 KB shared baseline consists of:

| Chunk | Size (gzipped) | Content |
|---|---|---|
| `4bd1b696-*.js` | 54.2 KB | React framework internals |
| `1255-*.js` | 45.8 KB | Shared component code |
| Other shared | 2.81 KB | Webpack runtime, etc. |

This is a healthy baseline for a React 19 + Next.js 15 application.

---

## Next Steps

1. [ ] Implement echarts/core modular imports (Priority 1)
2. [ ] Remove `echarts-for-react` dead dependency (Priority 5)
3. [ ] Wrap `DraggableGrid` in `next/dynamic` (Priority 2)
4. [ ] Extend `optimizePackageImports` list (Priority 3)
5. [ ] Evaluate framer-motion `LazyMotion` pattern (Priority 4)
6. [ ] Re-run `ANALYZE=true npm run build` to measure improvements

---

## Analyzer Reports

Interactive HTML treemaps are generated at build time:

```
.next/analyze/client.html   — 852 KB (client bundles)
.next/analyze/nodejs.html   — 825 KB (server bundles)
.next/analyze/edge.html     — 317 KB (middleware/edge)
```

Open in browser after running `ANALYZE=true npm run build`.
