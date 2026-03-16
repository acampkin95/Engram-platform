# Changelog - Monorepo Cleanup And Unified Deployment

Date: 2026-03-15

## Planned

- Archive stale session changelogs, QA summaries, diagnostics, and research prototypes.
- Remove tracked generated artifacts and legacy leftovers.
- Tighten ignore rules for diagnostics, output files, old virtualenvs, and archived AI workspace state.
- Add a canonical root deployment wrapper around `Engram-Platform/docker-compose.yml`.
- Update top-level docs and setup flow to prefer the unified deployment entry point.

## Completed

### Low-risk cleanup (pass 1)
- Archived stale root changelogs and QA session docs into `archive/2026-03/root-session-docs/`.
- Compressed and archived the large diagnostic dump into `archive/2026-03/diagnostics/Spindump.txt.gz`.
- Archived the superseded `Engram-AiMemory/05_research/weaviate_memory/` prototype and the stale `decay.py.patch` file.
- Removed tracked generated artifacts and stale local environment remnants.
- Tightened `.gitignore` to block future diagnostic/output drift.
- Added `scripts/deploy-unified.sh` as the canonical root deployment wrapper for `Engram-Platform/docker-compose.yml`.
- Updated `README.md`, `PRODUCTION_SETUP.md`, `setup.sh`, and root `package.json` to point at the unified deployment entry point.

### High-risk consolidation (pass 2)
- Swapped `Engram-Platform/docker-compose.yml` MCP service from shadow `Engram-AiMemory/docker/Dockerfile.mcp-server` to canonical `Engram-MCP/docker/Dockerfile`.
- Hardened `Engram-MCP/docker/Dockerfile` with curl for health checks, non-root user, and built-in HEALTHCHECK.
- Archived `@ai-memory/mcp-server` to `archive/2026-03/engram-aimemory/retired-packages/mcp-server`.
- Archived `@ai-memory/dashboard` to `archive/2026-03/engram-aimemory/retired-packages/dashboard`.
- Updated `Engram-AiMemory/package.json` workspaces to only include `packages/cli`.
- Updated `Engram-AiMemory/Makefile` to remove retired package references.
- Updated `Engram-AiMemory/.github/workflows/ci.yml` to remove retired lint/build/test steps.
- Updated `Engram-AiMemory/packages/cli/src/index.ts` to stop calling retired build/test targets.

### Deploy script consolidation (pass 3)
- Extended `scripts/deploy-unified.sh` with `deploy`, `health`, `restart`, and legacy delegation commands.
- Added deprecation notices to all 6 per-subproject deploy scripts pointing at the unified entry point.
- Legacy scripts are retained for their operational logic but discoverable only through delegation.

### TDD verification
- Engram-MCP: 381 tests, 0 failures (build + full suite)
- AiMemory Python: 276 tests, 0 failures (client, workers, config, system)
- Unified compose config: validates successfully with new MCP build context
- Unified deploy script: help/config/delegation all functional
