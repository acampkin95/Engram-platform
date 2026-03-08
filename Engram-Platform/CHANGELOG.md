# Changelog

All notable changes to the Engram Platform orchestration layer are documented here.

---

## [1.0.3] — Lighthouse / Core Web Vitals Audit

**Date:** 2026-03-02

### Analysis

- Completed comprehensive Lighthouse optimization audit of the Next.js 15 frontend
- Identified 19 actionable optimizations across 9 categories (config, layout, images, fonts, code splitting, PWA, CSS, dependencies, CI)
- Found critical bug: dead code block in `next.config.ts` (duplicate config after closing brace)
- Found manifest conflict: `manifest.ts` (dynamic) vs `public/manifest.json` (static) with different theme_colors
- Found unregistered service worker: `public/sw.js` exists but is never activated
- Found MotionProvider using `domMax` (30KB) instead of `domAnimation` (15KB)
- Found 13 packages missing from `optimizePackageImports` (recharts, react-grid-layout, 9 Radix packages, @dnd-kit, zod, react-day-picker)
- Found redundant Google Fonts preconnect (next/font self-hosts)
- Confirmed strong foundations: 19 loading.tsx boundaries, 4 dynamic imports, proper RSC/client split, Tailwind v4 CSS-native
- Full audit saved to `/plans/2026-03-02-lighthouse-optimization-audit.md`

---

## [1.0.2] — Dashboard 404 Fixes

**Date:** 2026-03-01

### Fixed

- **`GET /analytics` 404** — Frontend dashboard called a single `/analytics` aggregate endpoint that didn't exist. Backend only had sub-routes (`/analytics/memory-growth`, `/analytics/search-stats`, etc.). Added `GET /analytics` aggregate route to `api.py` that returns `{total_memories, total_entities, total_relations, memory_distribution, tier_distribution, timestamp}`.
- **`manifest.webmanifest` 404** — Next.js PWA manifest request returning 404. Added `app/manifest.ts` with app name, icons, theme colour, and start URL.

---


## [1.0.1] — Deployment Fixes & DeepInfra Integration

**Date:** 2026-03-01

### Fixed

- **Weaviate DATE property serialization** — `last_accessed_at` and `expires_at` fields in `client.py` were set to empty string `""` when null, causing Weaviate 422 errors. Changed to `None` for proper RFC3339 compliance.
- **Vector dimension mismatch** — Weaviate collections created with 1536-dim vectors (OpenAI default) rejected 1024-dim vectors from DeepInfra BAAI/bge-m3. Added `CLEAN_SCHEMA_MIGRATION` env var pass-through in docker-compose.yml to enable collection recreation.
- **MCP server missing API key** — MCP server lacked `AI_MEMORY_API_KEY` env var, causing "Unauthorized" errors when calling memory-api. Added to docker-compose.yml mcp-server environment.

### Changed

- **Embedding provider** — Switched from OpenAI to DeepInfra (`BAAI/bge-m3`, 1024 dimensions) via OpenAI-compatible API at `https://api.deepinfra.com/v1/openai`.
- **`config.py`** — Added `openai_base_url` field to Settings class for configurable embedding API endpoint.
- **`system.py`** — Updated `AsyncOpenAI()` constructor to accept `base_url` parameter from settings.
- **`docker-compose.yml`** — Added `OPENAI_BASE_URL`, `DEEPINFRA_API_KEY`, `CLEAN_SCHEMA_MIGRATION`, and `AI_MEMORY_API_KEY` environment variables.

### Known Issues

- **Clerk authentication** — Test keys (`pk_test_*`) use a proxy pattern incompatible with Docker containers behind Tailscale (ETIMEDOUT on Clerk proxy requests). Frontend falls back to no-auth mode gracefully. Production Clerk keys (`pk_live_*`) will bypass the proxy and should work correctly.


## [1.0.0] — Production Release

**Date:** 2026-03-01

### Added

- **`scripts/verify-health.sh`** — Platform-wide health check script:
  - Polls all Docker service containers for health status with configurable retry/interval
  - Distinguishes required vs optional services (mcp-server is optional)
  - Colour-coded output with pass/fail/skip counts and exit code for CI
- **`docs/perf/bundle-analysis.md`** — Frontend bundle analysis report:
  - Route-level size inventory, tree-shaking validation, code-splitting verification
  - Dynamic import audit confirming heavy components use `next/dynamic`
  - Actionable recommendations for further optimization
- **Playwright E2E smoke suite** (`frontend/e2e/smoke.spec.ts`) — 40 smoke tests covering:
  - Clerk-guarded page redirects for all dashboard routes
  - Static page rendering, layout structure, meta tags
  - API proxy endpoint availability checks

### Changed

- **`docker-compose.yml`** — Production hardening:
  - All 8 services have `deploy.resources.limits` (memory + CPU caps)
  - All services use `json-file` logging driver with `max-size: 10m`, `max-file: 3`
  - Redis instances have `--maxmemory` and `--maxmemory-policy allkeys-lru`
  - Weaviate pinned to `1.27.0` with explicit resource reservations
  - MCP server uses `mcp` profile (opt-in deployment)
- **`nginx/nginx.conf`** — Security and performance hardening:
  - Added `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` headers
  - Rate limiting: `30r/s` on API endpoints, `60r/s` on general routes with burst buffers
  - Gzip compression for text, JSON, JS, CSS, SVG, WASM
  - Static asset caching (`expires 1y`, `Cache-Control: public, immutable`)
  - `server_tokens off` and `proxy_hide_header X-Powered-By`
  - SSL/TLS placeholder for Let's Encrypt with TLSv1.2/1.3 and modern ciphers
- **`frontend/next.config.ts`** — Build optimization:
  - `@next/bundle-analyzer` integration gated by `ANALYZE=true`
  - Standalone output mode for Docker deployment
  - `serverExternalPackages` for heavy server-only deps
  - Image optimization with remote pattern allowlists
- **`frontend/app/layout.tsx`** — Font optimization:
  - `next/font` with `display: 'swap'` for non-blocking font loading
- **`frontend/vitest.config.ts`** — Coverage configuration:
  - `@vitest/coverage-v8` with threshold enforcement
  - Excluded generated/config files from coverage metrics
- **`frontend/biome.json`** — Lint scope:
  - Excluded `.next/`, `coverage/`, `playwright-report/`, `test-results/` from scanning
  - Prevents Biome hangs on generated output directories
- **`install.sh`** — Installer hardening:
  - Added `--doctor` mode for post-install diagnostics
  - Improved error traps and failure reporting
  - Non-fatal MCP optional service handling
  - `bash -n` syntax validated
- **Dynamic imports** — Heavy components split with `next/dynamic`:
  - Knowledge graph, chat, and memory graph pages use client-only dynamic loading
  - `ssr: false` on WebGL/canvas-heavy components

### Frontend Test Coverage

- 35 test files, 299 tests passing
- Statements: 95.73%, Branches: 86.05%, Functions: 91.5%, Lines: 95.73%
- Coverage thresholds enforced at 80%

### Version Alignment

- All repos aligned to `1.0.0`:
  - `frontend/package.json`: `1.0.0`
  - `docker-compose.yml` APP_VERSION: `1.0.0`
  - `docker-compose.yml` MCP_SERVER_VERSION: `1.0.0`
  - `Engram-MCP/package.json`: `1.0.0`
  - `Engram-AiMemory/pyproject.toml`: `1.0.0`
