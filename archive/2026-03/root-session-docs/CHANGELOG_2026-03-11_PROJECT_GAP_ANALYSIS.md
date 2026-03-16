# Changelog — 2026-03-11 Project Gap Analysis And Roadmap Refresh

## Session Summary

Performed a comprehensive planning refresh across the Engram monorepo to reconcile stale roadmap assumptions with the current repository state.

## What Was Reviewed

- `AGENTS.md`
- `PROJECT_ROADMAP.md`
- existing documents under `plans/`
- recent root changelogs from 2026-03-09
- selected live evidence from CI workflows, package manifests, Vitest config, Platform instrumentation, and MCP OAuth storage

## Key Findings

### Corrected Assumptions

- AiCrawler CI/CD is configured and should be consolidated, not created from scratch.
- MCP input validation is already implemented; the real release blocker is OAuth persistence and remaining compliance gaps.
- Platform already has `nuqs` and Sentry packages; the remaining work is rollout and verification.
- AiCrawler's enforceable Python coverage minimum is 75%; 85% remains a stretch target.
- AiMemory is present in the repository and now needs hygiene review, reproducible bootstrap, and a fresh baseline.

### Release-Level Gaps

- AiMemory verification and cleanup remain unresolved.
- AiCrawler coverage is still below its enforced threshold.
- MCP OAuth state is still restart-volatile.
- Platform coverage reporting and tested critical surface still need trustworthy baselines.
- A unified release checklist and smoke-test path are still missing.

## Artifacts Created Or Updated

- Updated `PROJECT_ROADMAP.md` with a corrected 10-week release roadmap.
- Updated `AGENTS.md` to remove major stale claims and refresh immediate priorities.
- Created `plans/2026-03-11-comprehensive-gap-analysis.md`.
- Created `plans/2026-03-11-granular-release-plan.md`.
- Created `CHANGELOG_2026-03-11_PROJECT_GAP_ANALYSIS.md`.
- Updated `Engram-AiMemory/Makefile`, `Engram-AiMemory/README.md`, `Engram-AiMemory/AGENTS.md`, and added `Engram-AiMemory/.python-version` to make the local bootstrap path explicit.
- Removed 24 tracked AiMemory debugging/import artifacts and added ignore rules in `Engram-AiMemory/.gitignore` to prevent them from reappearing.

## Verification Notes

- `cd Engram-AiMemory && make test-python` now resolves `python3.11` and injects a local-only `JWT_SECRET`; that exposed and allowed fixes for two pre-existing import blockers: a missing `RequestValidationError` import in `packages/core/src/memory_system/api.py` and a syntax error in `packages/core/src/memory_system/workers.py`.
- Standalone regression tests now pass: `python3.11 -m pytest tests/test_api_module_import.py -q --no-cov` and `python3.11 -m pytest tests/test_workers_module_import.py -q --no-cov`.
- A broader baseline run now reaches full collection (`741` tests) but still shows substantial pre-existing fixture and suite failures, including a `timezone` misuse in `packages/core/tests/conftest.py`; coverage scope is now measurable, but not yet trustworthy enough to treat as the final baseline.
- `cd Engram-AiMemory && npm run build` passes after the artifact cleanup, confirming the removed files were not part of the active build path.
- No `.envelopes` files exist in the monorepo; the closest maintained config surfaces are the committed `.env.example` / `.env.production.example` templates.
- Updated env templates across `Engram-AiMemory`, `Engram-MCP`, and `Engram-Platform` to align with actual runtime variables, remove duplicate sections, and add inferable defaults such as `NEXT_PUBLIC_APP_URL`, default tenant/project values, MCP OAuth resilience settings, and platform Clerk redirect paths.
- Kept secrets as placeholders only; no credentials or fabricated tokens were introduced.

## Release Operations Update

- Added `plans/2026-03-11-release-checklist.md` as the authoritative release gate document.
- Updated `docs/01-deployment-manual.md` to point operators at the checklist before deployment.
- Updated `docs/04-troubleshooting-manual.md` so smoke verification starts with the release checklist path.
- Rehearsed the production deployment path on `dv-syd-host01` over Tailscale: created `/opt/engram/Engram-Platform`, cloned the repo, fixed deploy-script dry-run defects, and completed a full remote `--dry-run` rehearsal successfully.
- The remote dry-run required staging a non-production `JWT_SECRET` into `.env`; a real live launch still depends on replacing placeholder/example env values with production secrets before `docker compose up -d` is allowed.

## Roadmap Decision

The release plan now prioritizes:

1. doc and baseline reconciliation
2. deployable beta blockers
3. production hardening
4. release-candidate rehearsal
5. production launch and stabilization

Enterprise-grade backlog items such as full secrets-vault rollout, ELK, Storybook, API gateway work, and advanced MFA remain visible but explicitly deferred until after v1.0.
