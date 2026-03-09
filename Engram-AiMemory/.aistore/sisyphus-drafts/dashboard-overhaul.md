# Draft: AI Memory Dashboard — Complete Overhaul

## Project Understanding (confirmed)
- **Project**: AI Memory System — 3-tier persistent memory for AI agents (Weaviate + Redis + FastAPI)
- **Dashboard**: Next.js 15 + React 19 + Tailwind CSS v4 + Zustand + SWR + Framer Motion
- **Current Viz**: @xyflow/react for graph visualizations, Recharts installed but UNUSED, NO ECharts
- **Pages**: 6 dashboard pages totaling ~3,600 lines, all monolithic
- **Backend**: FastAPI Python API with /stats, /health, /memories, /graph endpoints

## Audit Findings (confirmed)
- **Visualization Quality**: 6.5/10 — Only graph viz (@xyflow), zero data charts
- **Component Organization**: 4/10 — Monolithic page files (892-line dashboard page)
- **Code Reusability**: 3/10 — Massive duplication (TierBadge, fetcher, types defined 3+ times)
- **Data Fetching**: 5/10 — Inconsistent SWR vs raw fetch, no API client abstraction
- **Styling**: 8/10 — Tailwind v4 well-configured, dark cyan theme is cohesive

## ALL User Decisions (confirmed — Round 1 + Round 2)
- **Scope**: FULL STACK OVERHAUL — dashboard + new API endpoints + data models
- **Visualization Library**: ECharts 5.5+ (replacing unused Recharts)
- **Graph Library**: Keep @xyflow/react (excellent for knowledge graph)
- **Styling**: Keep Tailwind v4 + Framer Motion (already good)
- **Component Library**: Custom project-specific components (not ShadCN)
- **Test Strategy**: TDD (RED-GREEN-REFACTOR) + Agent QA
- **Theme Mode**: DUAL dark + light mode (next-themes + two ECharts themes)
- **Backend Data**: Build new analytics endpoints (FastAPI)
- **Page Structure**: Multiple analytics sub-pages (/analytics/memories, /analytics/search, /analytics/system)
- **Chart Types Requested**: ALL 8:
  1. Memory Growth (Time Series) — line/area → /analytics/memories
  2. Tier Distribution (Pie/Donut) — → Dashboard KPI + /analytics/memories
  3. Memory Type Breakdown (Bar) — → /analytics/memories
  4. Importance Distribution (Histogram) — → /analytics/memories
  5. Activity Timeline (Heatmap/Calendar) — → /analytics/memories
  6. Search Analytics (Scatter/Radar) — → /analytics/search
  7. Knowledge Graph Stats (TreeMap) — → /analytics/search or graph page
  8. System Health (Gauge/Dashboard) — → /analytics/system

## Research Findings
- **ECharts Integration**: Custom useEcharts hook > echarts-for-react (v3.0.3 has canvas bug)
- **SSR**: Must use dynamic import with ssr:false, all chart components 'use client'
- **Tree Shaking**: Centralized registration in lib/echarts.ts
- **Theme**: Dual dark/light theme via registerTheme + key prop for remount (no runtime switch API until ECharts v6)
- **Performance**: Canvas renderer, LTTB sampling for time series, progressive rendering for 3000+ points
- **Accessibility**: aria.show + decal patterns + sr-only data tables
- **Dependencies**: echarts ^5.5.1, next-themes ^0.4.4

## New Backend Endpoints (FastAPI)
- `GET /analytics/memory-growth?tenant_id=&period=daily|weekly|monthly` — time series counts by tier
- `GET /analytics/activity-timeline?tenant_id=&year=2025` — daily activity for calendar heatmap
- `GET /analytics/search-stats?tenant_id=` — search query frequency, avg scores, top queries
- `GET /analytics/system-metrics` — Weaviate/Redis latency, connection uptime, throughput
- Enhanced `GET /stats` — ensure by_type breakdown is present

## New Dashboard Pages
1. `/dashboard` — Enhanced: KPI stat cards + mini donut + mini gauge + mini line chart
2. `/dashboard/analytics/memories` — Memory Growth, Tier Donut, Type Bar, Importance Histogram, Activity Heatmap
3. `/dashboard/analytics/search` — Search Scatter, Knowledge Graph TreeMap
4. `/dashboard/analytics/system` — System Health Gauges, Latency Line, Uptime Status

## Key Architectural Changes
1. Extract shared types to `types/` directory
2. Create centralized API client (`lib/api-client.ts`)  
3. Create custom hooks (`hooks/useMemory.ts`, `hooks/useEcharts.ts`, `hooks/useAnalytics.ts`)
4. Build custom UI component library (`components/ui/` — Card, Badge, Button, etc.)
5. Build ECharts component library (`components/charts/` — Chart, LazyChart, themed wrappers)
6. Build chart-specific components (MemoryGrowthChart, TierDonut, etc.)
7. Add ChartThemeProvider + next-themes integration
8. Refactor ALL existing pages to thin composition layers (50-100 lines each)
9. Standardize all data fetching to SWR + centralized API client
10. Remove unused Recharts dependency, add echarts + next-themes
11. Add sidebar navigation for analytics sub-pages

## Scope Boundaries
- INCLUDE: ALL dashboard pages (6 existing + 3 new), component refactor, ECharts integration, new FastAPI endpoints, shared types/hooks/components, TDD tests, dual theme, accessibility
- EXCLUDE: Weaviate schema changes, MCP server changes, CLI changes, Python core memory system changes, deployment/Docker changes, mobile responsive (desktop-first)

## CLEARANCE CHECKLIST
- [x] Core objective clearly defined? YES — Complete dashboard overhaul with ECharts visualizations + new analytics pages + FastAPI endpoints
- [x] Scope boundaries established? YES — Dashboard + new API endpoints. Excludes Weaviate schema, MCP, CLI, deployment
- [x] No critical ambiguities remaining? YES — All 8 chart types mapped to pages, backend approach decided
- [x] Technical approach decided? YES — Custom useEcharts hook, tree-shaking, dual theme, custom components, SWR standardization
- [x] Test strategy confirmed? YES — TDD + Agent QA
- [x] No blocking questions outstanding? YES — All questions answered
