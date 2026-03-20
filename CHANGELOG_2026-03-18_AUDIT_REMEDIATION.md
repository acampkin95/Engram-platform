# Audit Remediation Changelog — 2026-03-18

## Scope

Executed the requested audit/remediation pass across security posture, Platform standards, MCP framework status, Docker/Sonar readiness, and release-blocking implementation work.

## Code Changes

### Continued targeted lint remediation

Changed:
- `Engram-MCP/scripts/deploy/deploy_helper.js`
- `Engram-Platform/frontend/app/api/system/control/route.ts`
- `Engram-Platform/frontend/app/api/system/logs/stream/route.ts`
- `Engram-Platform/frontend/app/api/system/maintenance/route.ts`
- `Engram-Platform/frontend/app/api/system/notifications/route.ts`
- `Engram-Platform/frontend/app/dashboard/memory/analytics/AnalyticsContent.test.tsx`
- `Engram-Platform/frontend/app/dashboard/memory/timeline/TimelineContent.tsx`
- `Engram-Platform/frontend/src/components/Skeletons.tsx`
- `Engram-Platform/frontend/src/components/FilterBar.tsx`
- `Engram-Platform/frontend/app/dashboard/system/layout.tsx`
- `Engram-Platform/frontend/app/dashboard/system/health/SystemHealthContent.tsx`
- `Engram-Platform/frontend/src/server/system-metrics-store.ts`

What changed:
- Removed unused Clerk auth imports from admin API routes and restored the intended `requireAdminAccess` imports.
- Cleaned route formatting so targeted Platform API files pass Biome.
- Replaced `any`-typed mock children props in `AnalyticsContent.test.tsx` with `ReactNode`-based props.
- Replaced array-index keys in timeline and skeleton placeholder rendering with stable derived string keys.
- Removed unnecessary ARIA role usage from `FilterBar` and switched the score-range grouping container to a semantic `fieldset`.
- Fixed import ordering/formatting in `SystemHealthContent.tsx`, `system/layout.tsx`, and `system-metrics-store.ts`.
- Updated `deploy_helper.js` to use `node:` builtin imports and simplified the client-path branch structure.

Why it matters:
- These were low-risk lint fixes in isolated files, separate from the broader repo-wide Biome backlog.
- The admin API route cleanup also corrected missing `requireAdminAccess` imports in files that were already calling it.

### MCP OAuth restart-safe validation

Changed:
- `Engram-MCP/src/auth/oauth-server.ts`
- `Engram-MCP/src/auth/oauth-middleware.ts`
- `Engram-MCP/tests/oauth-middleware-bootstrap.test.ts`

What changed:
- Added `initializeOAuthTokenStore(config)` so the configured OAuth store can be initialized explicitly.
- Updated `validateAuth()` to initialize the configured OAuth token store before validating bearer tokens.
- Added a regression test covering the restart/bootstrap scenario where Redis-backed OAuth is configured before any `/oauth/*` route traffic.

Why it matters:
- Without this fix, `/mcp` auth validation could fall back to the in-memory token store after restart, even when `OAUTH_REDIS_URL` was configured.
- This made persisted OAuth access tokens unreliable until an OAuth route initialized the shared store.

### Sonar readiness

Added:
- `Engram-MCP/sonar-project.properties`

Why it matters:
- AiMemory and Platform already had Sonar project configs.
- MCP did not, so scanner readiness was inconsistent across the monorepo.

## Documentation Corrections

Changed:
- `AGENTS.md`
- `PROJECT_ROADMAP.md`
- `plans/2026-03-18-audit-remediation-plan.md`

Corrections captured:
- Platform already has `nuqs` provider/hook wiring.
- Platform already has Sentry client/runtime instrumentation.
- MCP already has static and dynamic resource support.
- MCP already has Redis-backed OAuth storage support; the remaining issue was bootstrap ordering.
- Pagination remains a real MCP gap.

## Audit Findings

### Security

Already present:
- OAuth 2.1 + PKCE in `Engram-MCP`
- JWT/API-key auth in `Engram-AiMemory`
- Clerk-backed auth in `Engram-Platform`
- Structured MCP logging in `Engram-MCP/src/logger.ts`
- SSRF/input validation protections documented in `AGENTS.md`

Still deferred / not implemented:
- secrets vault rollout
- encryption at rest for Weaviate/Redis
- MFA rollout for admins
- centralized logging/monitoring platform

Low-risk now:
- keep env docs current
- verify runtime integrations instead of assuming absence
- avoid roadmap drift that hides already-completed work

### Platform

Already present:
- `nuqs` adapter in `Engram-Platform/frontend/src/providers/URLStateProvider.tsx`
- shared URL state hooks in `Engram-Platform/frontend/src/hooks/useURLState.ts`
- Sentry client init in `Engram-Platform/frontend/sentry.client.config.ts`
- runtime instrumentation in `Engram-Platform/frontend/app/instrumentation.ts`
- Sentry build plugin in `Engram-Platform/frontend/next.config.ts`

Still missing / deferred:
- Storybook setup
- broader `nuqs` rollout beyond current shared hooks
- operational verification of Sentry in non-local runtime

### MCP

Already present:
- Redis-backed OAuth store in `Engram-MCP/src/auth/redis-token-store.ts`
- static/dynamic resource support in `Engram-MCP/src/resources/`
- offset/limit validation in investigation schemas/tests

Still missing:
- broad pagination model across MCP-facing list/search surfaces
- tracked coverage metric in CI/docs

### Performance / Docker

Current compose tuning in `Engram-Platform/docker-compose.yml` is already close to the documented target profile:
- crawler-api: `2G`
- memory-api: `512M`
- weaviate: `1536M`
- crawler-redis: `512M`
- memory-redis: `384M`
- mcp-server: `256M`
- platform-frontend: `256M`
- nginx: `128M`
- crawler shm: `2g`

Conclusion:
- the repo’s live compose file already reflects most of the recommended reductions documented in `AGENTS.md`
- no additional Docker limit changes were necessary in this pass

### SonarScanner

Present:
- `Engram-AiMemory/sonar-project.properties`
- `Engram-Platform/frontend/sonar-project.properties`
- `Engram-MCP/sonar-project.properties` (added in this pass)

Blocked:
- SonarQube endpoint on `http://100.114.241.115:9000` was not reachable during verification

Command run:
```bash
curl -fsS "http://100.114.241.115:9000/api/system/status"
```

Result:
- connection failed (`curl: (7) Couldn't connect to server`)

## Verification

### Passing

```bash
cd Engram-MCP
npm run build && node --test tests/oauth-middleware-bootstrap.test.ts tests/oauth-server.test.ts tests/oauth-server-expanded.test.ts tests/redis-token-store.test.ts
npx biome check src/auth/oauth-middleware.ts src/auth/oauth-server.ts tests/oauth-middleware-bootstrap.test.ts sonar-project.properties
cd ../Engram-Platform/frontend
npx biome check app/api/system/control/route.ts app/api/system/logs/stream/route.ts app/api/system/maintenance/route.ts app/api/system/notifications/route.ts app/dashboard/memory/analytics/AnalyticsContent.test.tsx app/dashboard/memory/timeline/TimelineContent.tsx src/components/Skeletons.tsx src/components/FilterBar.tsx app/dashboard/system/layout.tsx app/dashboard/system/health/SystemHealthContent.tsx src/server/system-metrics-store.ts
cd ../../Engram-MCP
npx biome check scripts/deploy/deploy_helper.js src/auth/oauth-middleware.ts src/auth/oauth-server.ts tests/oauth-middleware-bootstrap.test.ts sonar-project.properties
```

Observed:
- 19 MCP OAuth-related tests passed
- changed MCP files are lint-clean
- changed Platform files are lint-clean

### Broad repo debt found during audit

These commands surfaced pre-existing lint debt outside this remediation scope:

```bash
cd Engram-MCP && npm run lint
cd Engram-Platform/frontend && npm run lint
```

Observed:
- MCP repo-wide Biome failures are mostly pre-existing formatting/import issues outside the touched files
- Platform repo-wide Biome failures include pre-existing formatting/import issues plus existing warnings (`noExplicitAny`, `noArrayIndexKey`, a11y issues)

## Next Recommended Actions

1. Finish MCP pagination design and add tests on the remaining list/search surfaces.
2. Run Sentry smoke validation in a non-local environment with real DSN/project values.
3. Decide whether Storybook stays deferred or becomes a post-1.0 implementation track.
4. Bring the SonarQube service on `100.114.241.115:9000` online before attempting monorepo scans.
5. Triage the existing MCP and Platform Biome backlog separately from release-blocking auth work.
