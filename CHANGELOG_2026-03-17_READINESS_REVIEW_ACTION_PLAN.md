# Changelog - Readiness Review Action Plan

Date: 2026-03-17

## Completed

### Analysis and Plan Creation
- Reviewed the external readiness assessment in `docs/Engram Platform Readiness and Code Review.md`.
- Cross-referenced all 10 recommendations (5 short-term, 5 medium-term) against existing planning docs.
- Identified 8 items already addressed since the review was written.
- Identified 2 genuinely new items: contract tests (MT-2) and CONTRIBUTING.md (MT-4).
- Created 29-item consolidated execution sequence in `plans/2026-03-17-readiness-review-action-plan.md`.

### Phase 1 Execution: Hygiene and Baselines

#### Cleanup
- Deleted 3 stray `1` files from `Engram-AiCrawler/01_devroot/`, `Engram-MCP/`, `Engram-Platform/frontend/`.
- Deleted root `.DS_Store` (already in `.gitignore`).
- Archived 5 remaining Platform fix scripts to `archive/2026-03/platform-fix-scripts/`:
  - `fix_client_syntax.py`, `fix_client_syntax_again.py`, `fix_types_final.py`, `fix_client_syntax_brace.py`, `fix_perf.js`

#### Test Fix
- Fixed `src/server/__tests__/system-admin.test.ts` — added `// @vitest-environment node` directive.
  - Root cause: server-side tests importing `node:child_process/promises` failed in jsdom environment.
  - Result: 4 previously failing tests now pass (318/318 all green).

#### Coverage Baselines Established
- **AiMemory:** 78% (4049 stmts, 897 missed), 883 pass, 18 fail
- **AiCrawler:** 81% (12468 stmts, 2411 missed), 2393 pass
- **Platform:** 79% stmts, 72% branch, 67% functions, 81% lines, 318 pass
- **MCP:** 381 pass, 0 fail (coverage metric not yet instrumented)

#### Major Corrections to Documented State
- Platform coverage was documented as "~0%" across README, AGENTS.md, and PROJECT_ROADMAP.md — actual is **79% stmts**.
- AiCrawler coverage was documented as "57.82%" — actual is **81%**.
- AiCrawler already exceeds its 75% enforced minimum — no longer a release blocker.
- Platform coverage reporting works correctly in visibility mode.

#### Documentation Updates
- Updated `AGENTS.md` testing table with corrected baselines and dates.
- Updated `AGENTS.md` component maturity table with corrected coverage numbers.
- Updated `AGENTS.md` critical gaps section to reflect resolved items.
- Updated `PROJECT_ROADMAP.md` delivery scorecard — marked 4 of 6 blockers as resolved.
- Updated `PROJECT_ROADMAP.md` target metrics table with actual current numbers.
- Updated `README.md` status table with corrected coverage and test counts.
- Updated action plan with completed items and corrected current state.

### CI Workflow Verification
- All 4 subproject CI workflows verified as configured with push/PR triggers:
  - AiMemory: `on: push/pull_request` to `main`
  - AiCrawler: `on: push/pull_request` to `main, develop` with path filters
  - MCP: `on: push/pull_request` to `main, develop` with path filters
  - Platform: `on: push/pull_request` to `main, develop` with path filters
- No coverage reporting steps found in any CI workflow — identified as remaining gap.

## Remaining Release Blockers (Updated)

1. ~~Coverage baselines inconsistent~~ **RESOLVED**
2. MCP OAuth state is still in-memory only
3. ~~AiMemory baseline not established~~ **PARTIALLY RESOLVED** (18 test failures remain)
4. ~~Platform coverage reporting broken~~ **RESOLVED**
5. ~~AiCrawler coverage below minimum~~ **RESOLVED** (81% > 75% minimum)
6. Cross-service release verification checklist not yet validated end-to-end

## Notes

- The external review was written before the 2026-03-15 and 2026-03-16 sessions.
- AiCrawler has pre-existing LSP/type errors (UTC imports, apscheduler types) unrelated to this work.
- AiMemory 18 test failures are in: embeddings (8), weaviate_unit (7), memory_system MCP tools (2), weaviate tenant (1).
