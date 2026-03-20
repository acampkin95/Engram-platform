# Release v1 Preparation Sprint -- 2026-03-18

## Blockers Resolved

All 6 release blockers from `PROJECT_ROADMAP.md` are now resolved:

| # | Blocker | Status | Resolution |
|---|---------|--------|------------|
| 1 | Coverage baselines inconsistent | RESOLVED 2026-03-17 | Baselines re-measured |
| 2 | MCP OAuth restart-safe validation | RESOLVED 2026-03-18 | `initializeOAuthTokenStore()` + regression test |
| 3 | AiMemory 18 failing tests | RESOLVED 2026-03-18 | 901 pass, 0 fail, 3 skipped (require live services) |
| 4 | Platform coverage reporting | RESOLVED 2026-03-17 | 79% stmts, reporting works |
| 5 | AiCrawler coverage + CI | RESOLVED 2026-03-17 | 81% coverage, single CI workflow |
| 6 | Cross-service release checklist | RESOLVED 2026-03-18 | `docs/RELEASE_CHECKLIST.md` + `scripts/release-smoke-test.sh` |

## New Artifacts

### Release Checklist
`docs/RELEASE_CHECKLIST.md` -- covers:
- Pre-release build verification commands
- Coverage gate thresholds
- Auth verification steps
- Docker Compose validation
- Deployment steps for `dv-syd-host01`
- Rollback procedure
- Post-release monitoring checklist
- Known v1.0 limitations

### Smoke Test Script
`scripts/release-smoke-test.sh` -- covers:
- Memory API health (`/health`)
- Crawler API health (`/health`)
- MCP Server health (`/health`)
- Platform frontend accessibility
- Health response JSON structure validation
- MCP OAuth metadata endpoint
- API documentation endpoints
- Color-coded PASS/FAIL output
- Exit code 0 on success, 1 on failure

### MCP Coverage Baseline
Established via `node --experimental-test-coverage`:
- **79.83% line coverage** across all MCP source files
- Key highlights: errors.ts 100%, schemas.js 100%, entity-tools.js 100%, tool-definitions.js 100%
- Areas for improvement: http.ts 32%, server.ts 26% (transport/server bootstrap code)

## Verification Results

| Subproject | Tests | Lint | Coverage |
|------------|-------|------|----------|
| AiMemory | 901 pass, 0 fail, 3 skip | N/A (ruff) | 78% |
| MCP | 382 pass, 0 fail | 64 files, 0 issues | 79.83% |
| Platform | N/A (lint-only) | 262 files, 0 issues | 79% stmts |
| MCP Smoke | 10/10 pass | N/A | N/A |
| Docker Compose | Config validates | N/A | N/A |

## Devnode Deployment (WIP)

- Created `/opt/engram/Engram-Platform/.env` on devnode from `.env.production.example`.
- Set devnode defaults: `BIND_ADDRESS=100.78.187.5`, `TAILSCALE_HOSTNAME=acdev-devnode.icefish-discus.ts.net`, `NEXT_PUBLIC_APP_URL=http://100.78.187.5`.

## Devnode Deployment (Complete)

- Devnode stack deployed successfully on `100.78.187.5` over Tailscale.
- Generated and applied deployment secrets for `JWT_SECRET`, `MCP_AUTH_TOKEN`, `MEMORY_API_KEY`, and `NEXT_PUBLIC_MEMORY_API_KEY`.
- Applied provided Clerk keys and configured DeepInfra embeddings with `BAAI/bge-base-en-v1.5` (`EMBEDDING_DIMENSIONS=768`).
- Fixed monorepo Docker build contexts for `Engram-AiCrawler` and `Engram-AiMemory` so `engram-shared` installs inside container builds.
- Corrected Weaviate startup by changing `GOMEMLIMIT` from invalid `1.2GiB` to valid `1200MiB`.
- Removed unsupported nginx `brotli` directives for the stock `nginx:alpine` image.
- Enabled MCP OAuth metadata through compose/env and proxied `/.well-known/oauth-authorization-server` via nginx.
- Bound `memory-api` to the devnode Tailscale IP with `MEMORY_API_BIND=100.78.187.5` instead of `0.0.0.0`.
- Updated `scripts/release-smoke-test.sh` to validate the deployed nginx-backed surface over HTTPS.
- Release smoke test passed on devnode: **9 passed, 0 failed** against `https://100.78.187.5`.

## Roadmap Updates

Updated `PROJECT_ROADMAP.md`:
- All 6 release blockers marked as resolved with dates
- MCP scorecard updated: 382 tests, 79.83% coverage, OAuth verified
- AiMemory scorecard updated: 901 pass, 0 fail
- Deployment scorecard updated: smoke test + checklist created
- Target metrics updated with measured MCP baseline

## Release Readiness Assessment

### Beta Gate Status: PASS
- [x] Full stack builds from monorepo
- [x] All test suites green (901 + 382 = 1283 tests passing)
- [x] Biome lint clean across MCP (64 files) and Platform (262 files)
- [x] MCP OAuth tokens persist across restart
- [x] Coverage baselines established and documented
- [x] Docker Compose validates
- [x] Smoke test script exists and MCP smoke passes
- [x] Release checklist with deployment/rollback docs exists

### Remaining for RC Gate
- [ ] Deploy to `dv-syd-host01` and run `release-smoke-test.sh`
- [ ] Verify Sentry captures real errors in production
- [ ] MCP pagination across list/search surfaces
- [ ] Docker resource usage confirmed under 9.5GB target
- [ ] Full release rehearsal on target server
