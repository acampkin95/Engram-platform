# Engram Release Roadmap

**Generated:** 2026-03-11
**Status:** Planning Refresh
**Target Window:** 10 weeks to production release
**Release Strategy:** smallest credible release first, enterprise hardening second

---

## Executive Summary

The previous 12-week roadmap mixed true release blockers with enterprise-grade enhancements. This refresh narrows the plan to what must be true for a credible production release of the Engram platform.

### What Changed Since The Prior Roadmap

- AiCrawler CI/CD is not missing; GitHub Actions workflows exist in `Engram-AiCrawler/.github/workflows/ci.yml` and `Engram-AiCrawler/01_devroot/.github/workflows/ci.yml`.
- MCP input validation is not missing; Zod validation is already implemented.
- Platform does not lack `nuqs` and Sentry packages; both are present, but rollout is incomplete.
- AiCrawler's enforceable Python coverage minimum is 75% in `.coveragerc`; 85% remains the stretch target.
- AiMemory is no longer a missing submodule; it is present and now needs hygiene review, verification, and a new baseline.

### Smallest Credible Release Scope

A production-worthy Engram v1.0 requires:

- the full stack to build and boot cleanly from the monorepo
- stable auth paths across Platform, MCP, Memory API, and Crawler API
- persistent MCP OAuth storage instead of process-memory-only state
- meaningful automated test coverage at agreed minimums
- deployable Docker Compose configuration tuned for the target i5/16GB/1TB profile
- operational visibility through smoke tests, health checks, and error reporting
- updated runbooks and release documentation

The following do not block the first production release and should not own the critical path:

- full NIST control closure
- HashiCorp Vault rollout
- ELK stack deployment
- Storybook adoption
- FIDO2 or hardware-key MFA
- API gateway introduction
- full Lighthouse score gating
- enterprise installer automation beyond a reliable guided deploy path

---

## Current State Snapshot

### Corrected Delivery Scorecard

| Area | Current State | Release Target | Notes |
|------|---------------|----------------|-------|
| AiMemory | Code restored; baseline needs re-audit | Verified build, clean bootstrap, 85%+ in-scope coverage | Hygiene and verification first |
| AiCrawler | 57.82% Python coverage, frontend gaps documented | 75% enforced minimum, frontend buildable, CI simplified | Largest testing gap |
| MCP | Strongest component, OAuth store volatile | Redis-backed OAuth, pagination, measurable coverage | Zod already present |
| Platform | CI exists, coverage config exists, rollout gaps remain | Reliable coverage reporting, Sentry active, key dashboard flows tested | `nuqs` present but not rolled out |
| Deployment | Compose exists, installer fragmented | Repeatable deploy + smoke validation on target host | One-shot installer can wait |

### Release Blockers

1. Coverage baselines and thresholds are inconsistent with the documentation.
2. MCP OAuth state is still in-memory only.
3. AiMemory needs hygiene cleanup and a reproducible baseline bootstrap.
4. Platform coverage reporting and real tested surface are not trustworthy enough.
5. AiCrawler still needs focused coverage work and workflow consolidation.
6. Cross-service release verification is not yet captured as a single repeatable checklist.

---

## Release Principles

1. Ship the smallest integrated product that is secure enough, testable, and operable.
2. Prefer evidence-backed gates over aspirational maturity scores.
3. Fix documentation drift before adding more roadmap scope.
4. Pull infrastructure complexity right only when it blocks release.
5. Treat coverage numbers as guardrails, not vanity metrics.
6. Keep the first release bias toward reliability, not feature expansion.

---

## Milestones

## Milestone 0 - Planning And Baseline Reset (2-3 days)

**Goal:** remove stale assumptions and establish trustworthy baselines.

### Outcomes

- `AGENTS.md` corrected where it conflicts with current evidence.
- `PROJECT_ROADMAP.md` refreshed to match real blockers.
- Gap analysis and execution plan added under `plans/`.
- Coverage, CI/CD, and security assumptions aligned across docs.

### Exit Criteria

- No roadmap item claims AiCrawler CI/CD is missing.
- No roadmap item claims MCP lacks input validation.
- Release scope is explicitly divided into `must-have`, `important`, and `deferred`.

---

## Milestone 1 - Deployable Beta (Weeks 1-3)

**Goal:** make the monorepo boot, build, test, and deploy as an integrated beta.

### Track A - AiMemory Verification

- Audit `Engram-AiMemory` for stray tracked artifacts and temporary repair scripts.
- Make local bootstrap reproducible with the correct Python version and required env setup.
- Re-run build, lint, and test baselines for the Memory API, dashboard package, and MCP bridge.
- Note that the current Python suite now reaches full collection, but fixture and test debt still block a trustworthy final baseline until those failures are triaged.
- Decide which omitted modules are legitimately out of scope for coverage and document why.

### Track B - AiCrawler Stabilization

- Consolidate duplicate CI workflows so there is one authoritative pipeline.
- Fix the frontend compilation assumptions and verify the current source tree matches the documented architecture.
- Raise Python coverage to the 75% enforced minimum.
- Add or confirm frontend coverage reporting.

### Track C - Platform Confidence

- Fix coverage reporting so the number is trustworthy in CI.
- Lock in a minimum tested set of critical routes and shared UI/state layers.
- Confirm Sentry initialization path and document env requirements, even if full rollout finishes later.

### Track D - MCP Release Safety

- Replace the in-memory OAuth token store with Redis-backed persistence.
- Add coverage measurement or reporting for the Node test suite.
- Validate dual transport plus auth paths against smoke tests.

### Beta Exit Criteria

- AiMemory bootstrap is reproducible from docs.
- AiCrawler CI is single-source and green.
- MCP OAuth tokens survive service restart.
- Platform coverage reporting is visible in CI.
- Full-stack smoke test passes locally.

---

## Milestone 2 - Production Hardening (Weeks 4-6)

**Goal:** turn the beta into a release candidate by closing reliability and observability gaps.

### Required Work

- Raise AiMemory toward 85%+ in-scope coverage with emphasis on client, system, and worker paths.
- Raise AiCrawler coverage from 57.82% to at least the enforced 75% minimum, then continue toward 80% where practical.
- Raise Platform coverage to a credible baseline across stores, hooks, clients, and core dashboard flows.
- Add MCP pagination support and cover it with tests.
- Wire Sentry end-to-end for Platform runtime errors.
- Tune Docker resource limits to the i5/16GB/1TB target profile.
- Add dependency auditing (`npm audit`/`pip-audit` or equivalent) into CI where practical.

### Hardening Exit Criteria

- Coverage gates are enforced and documented for every major subproject.
- Redis-backed OAuth persistence is in production config.
- Resource profile fits target hardware envelope.
- Sentry captures real application errors in non-local environments.
- A release checklist exists and passes on a clean environment.

---

## Milestone 3 - Release Candidate (Weeks 7-8)

**Goal:** complete the last release-only work and freeze scope.

### Required Work

- Roll out `nuqs` only to the high-value dashboard filters and navigation state that benefit from shareable URLs.
- Finish release docs: deployment, rollback, smoke checks, env setup, known limitations.
- Add a guided deployment wrapper or consolidated release script rather than a fully interactive installer.
- Run full release rehearsal on the target server profile.
- Freeze non-essential feature work.

### Release Candidate Exit Criteria

- RC deployment succeeds without manual guesswork.
- Known limitations are documented.
- URL state and Sentry are active where they materially improve operability.
- Release rehearsal findings are triaged or fixed.

---

## Milestone 4 - Production Launch And Stabilization (Weeks 9-10)

**Goal:** ship and stabilize the first production release.

### Required Work

- Deploy to `dv-syd-host01` via Tailscale-access workflow.
- Run smoke tests against live services.
- Capture and triage launch-week defects.
- Monitor resource usage, auth stability, and error volume.
- Patch only release bugs and operational defects.

### Launch Exit Criteria

- Production stack remains stable through the stabilization window.
- No Sev-1 auth, data-loss, or deployment regressions remain open.
- The release checklist, rollback path, and post-release notes are complete.

---

## Deferred Until Post-1.0

These items remain valuable, but they should not block the first production release:

- full secrets vault rollout
- encryption at rest across every data store
- ELK or equivalent centralized logging stack
- Storybook and comprehensive component docs
- FIDO2 MFA and advanced admin-session controls
- API gateway / request signing program
- full accessibility and Lighthouse maturity program
- full one-shot Ubuntu installer with menu-driven UX
- aggressive 95% coverage target for every code path

---

## Target Metrics

| Component | Current | Beta Gate | RC Gate | Post-1.0 Stretch |
|-----------|---------|-----------|---------|------------------|
| AiMemory coverage | baseline refresh needed | baseline established + gaps ranked | 85%+ in-scope | 90-95% in-scope |
| AiCrawler coverage | 57.82% | 70% | 75% | 80-85% |
| Platform coverage | reporting broken | reporting fixed + baseline established | 30-45% targeted critical surface | 60-80% |
| MCP coverage | unknown | baseline established | meaningful tracked metric | 85%+ |
| Target memory budget | 10.5GB current | under 9.5GB | 8.5GB target | optimized further |

---

## Risks And Mitigations

| Risk | Why It Matters | Mitigation |
|------|----------------|------------|
| Documentation drift returns | Causes roadmap churn and bad sequencing | Update roadmap/AGENTS after each major audit |
| AiMemory scope explodes during hygiene pass | Newly restored tree may hide more cleanup | Time-box audit, separate must-fix from later cleanup |
| Platform coverage remains misleading | Slows every release decision | Fix reporting before counting coverage work |
| AiCrawler coverage work stalls on large modules | Biggest test deficit in repo | Tackle highest-risk modules first; enforce 75% before stretch work |
| Security scope balloons into platform program | Delays first release unnecessarily | Keep v1.0 focused on auth, dependency auditing, and operational safety |

---

## Weekly Operating Cadence

- **Monday:** baseline metrics, blocker review, scope control
- **Midweek:** implementation focus on current milestone only
- **Friday:** verification run, doc updates, roadmap status refresh

Track these every week:

- build status by subproject
- test pass rate and coverage deltas
- deployment rehearsal status
- auth and error-reporting health
- open release blockers vs deferred work

---

## Immediate Next Actions

1. Correct `AGENTS.md` so it matches current evidence.
2. Preserve this roadmap as the single source of truth for release sequencing.
3. Execute the granular plan in `plans/2026-03-11-granular-release-plan.md`.
4. Re-baseline coverage and CI health before starting new feature work.
