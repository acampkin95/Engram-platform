# Changelog - Pre-Deployment Review & Remediation

Date: 2026-03-19

## Summary

Full pre-deployment review of the Engram Platform monorepo across all 4 subprojects. Explored codebase health, identified blockers, and fixed critical issues in parallel using 7+ agents.

## Subproject Status

| Subproject | Build | Tests | Lint | Status |
|---|---|---|---|---|
| **Engram-MCP** | PASS | 382/382 | Clean | Production-ready |
| **Engram-AiMemory** | PASS | 901/901 (3 skip) | Clean (66 E501) | Fixed - was blocked |
| **Engram-Platform** | PASS | 318/318 | Clean | TS errors: 255->0 |
| **Engram-AiCrawler** | PASS | 2393 | Clean | Pre-existing stable |

## Critical Fixes Applied

### Engram-AiMemory: Python 3.11 Compatibility (16 files)

**Problem**: All tests blocked by `datetime.UTC` import requiring Python 3.11+, but local system runs 3.9.6.

**Fix**: Updated `compat.py` with version-aware shim, updated 15 files to import `UTC` from compat module instead of `datetime` directly.

**Files changed**:
- `packages/core/src/memory_system/compat.py` - Added UTC compatibility shim
- `packages/core/src/memory_system/api.py`
- `packages/core/src/memory_system/system.py`
- `packages/core/src/memory_system/memory.py`
- `packages/core/src/memory_system/auth.py`
- `packages/core/src/memory_system/client.py`
- `packages/core/src/memory_system/decay.py`
- `packages/core/src/memory_system/workers.py`
- `packages/core/src/memory_system/contradiction.py`
- `packages/core/src/memory_system/credibility.py`
- `packages/core/src/memory_system/investigation/crawler.py`
- `packages/core/src/memory_system/investigation/evidence_client.py`
- `packages/core/src/memory_system/investigation/matter_client.py`
- `packages/core/src/memory_system/investigation/workers.py`
- `packages/core/src/memory_system/investigation/registry_client.py`
- `packages/core/src/memory_system/investigation/workers_service.py`

**Result**: 901 tests pass (was 883 pass / 18 fail, now 901 pass / 0 fail / 3 skip)

### Engram-Platform: TypeScript Type Stubs (3+ files)

**Problem**: `src/lib/crawler-client.ts` and `src/lib/memory-client.ts` exported all types as `Record<string, unknown>`, causing 255 cascading TypeScript errors across 15+ component files.

**Fix**: Replaced stub types with proper TypeScript interfaces matching actual API response structures.

**Files changed**:
- `src/lib/crawler-client.ts` - Added proper interfaces: HealthResponse, StatsResponse, JobResponse, JobsListResponse, Investigation, KnowledgeGraphResponse, SearchResult
- `src/lib/memory-client.ts` - Added proper interfaces: Entity, Relation, AnalyticsResponse, HealthResponse, KnowledgeGraphResponse
- `app/api/system/control/route.ts` - Fixed Zod schema to use `z.enum()` with SERVICE_ALLOWLIST and ACTION_ALLOWLIST
- `src/server/system-shell.ts` - Fixed `node:child_process/promises` import to use `util.promisify`
- `src/server/system-metrics-store.ts` - Fixed implicit `any` type on `line` parameter, stdout Buffer handling
- `src/server/system-admin.ts` - Fixed `{}` to `Record<string, unknown>` cast
- `src/server/__tests__/system-admin.test.ts` - Fixed test to use `as never` for invalid target test
- `vitest.config.ts` - Removed invalid `minWorkers` option

**Result**: 255 errors reduced to 0. All type stubs replaced with proper interfaces, all component type errors fixed.

### Security Fixes

- `app/api/system/maintenance/route.ts` - Fixed type casting bypass (`as never`) with proper `z.enum(MAINTENANCE_ALLOWLIST)` validation
- `app/api/system/notifications/route.ts` - Added input sanitization (lowercase/trim emails, max length on subject/text)
- `next.config.ts` - Tightened CSP `img-src` from wildcard `*.clerk.com` to specific `img.clerk.com`

### Deployment Configuration Fixes

**Problem**: `.env.example` had devnode OAUTH_ISSUER, missing production guidance.

**Fix**:
- `Engram-Platform/.env.example` - Added BIND_ADDRESS production guidance, Clerk/JWT documentation
- `Engram-Platform/docker-compose.yml` - Changed OAUTH_ISSUER from `https://100.78.187.5` (devnode) to `https://dv-syd-host01.icefish-discus.ts.net` (production)
- `Engram-Platform/nginx/nginx.conf` - Added LetsEncrypt upgrade documentation for SSL certs

## Pre-Deployment Review Findings

### Architecture: Production-Ready
- 9 Docker services with proper health checks, resource limits, and logging
- Nginx with comprehensive security headers, rate limiting, CSP, HSTS
- Read-only filesystems and no-new-privileges security hardening
- Tailscale-optimized networking with proper CORS and CSP for Clerk auth

### Remaining Items Before Deployment
1. Create `.env` from `.env.example` with production secrets (Clerk keys, JWT_SECRET, MCP_AUTH_TOKEN)
2. Set `BIND_ADDRESS=100.100.42.6` for Tailscale access
3. Upgrade SSL certs from self-signed to LetsEncrypt (optional for Tailscale-only access)
4. Commit all changes and push
5. Run `./scripts/quality-gate.sh` for final validation
6. Execute `./scripts/deploy-unified.sh deploy` on dv-syd-host01

### Known Limitations (v1.0)
- MCP pagination not implemented across all surfaces
- SonarQube scanner configured but server not deployed
- Storybook not set up for component documentation
- Centralized logging (ELK) deferred to post-1.0

## Ralph Loop - Systematic Review & Polish (2026-03-20)

### Test Coverage Expansion (213 new tests)
- `src/lib/__tests__/crawler-client.test.ts` - 28 tests (0% → 100%)
- `src/lib/__tests__/system-client.test.ts` - 31 tests (0% → 100%)
- `src/lib/__tests__/memory-client.test.ts` - 46 tests (11% → 100%)
- `src/hooks/__tests__/useURLState.test.ts` - new tests (0% → covered)
- `src/components/ui/__tests__/Toast.test.tsx` - new tests
- `src/components/ui/__tests__/Slider.test.tsx` - new tests
- `app/api/system/__tests__/routes.test.ts` - 36 tests covering all 7 API routes (0% → covered)

### Accessibility Improvements (Haiku specialist)
- Added aria-labels to icon-only buttons across dashboard
- Added label elements for select dropdowns
- Added aria-busy and role="status" to loading skeletons
- Improved heading hierarchy

### Styling Polish (Haiku specialist)
- Replaced 20+ hardcoded hex colors with Tailwind theme tokens
- TimelineContent: `text-[#5c5878]` → `text-muted`, `text-[#f0eef8]` → `text-foreground`
- MemoryGraphContent: 12+ color replacements, fixed absolute positioning on detail panel
- All changes use design system variables for consistency

### Validation Improvements (Haiku specialist)
- MemoriesContent: Added `required`, `maxLength` with character counters
- OsintContent: Added URL validation with `new URL()` constructor
- CrawlContent: Added `required` on URL input
- FormInput: Extended with `maxLength`, `minLength`, `pattern` support

## Test Results Summary

```
Engram-MCP:      382 pass, 0 fail, 0 skip  (79.83% coverage)
Engram-AiMemory: 901 pass, 0 fail, 3 skip  (78% coverage)
Engram-Platform: 531 pass, 0 fail           (coverage computing)
Engram-AiCrawler: 2393 pass                 (81% coverage)
```
