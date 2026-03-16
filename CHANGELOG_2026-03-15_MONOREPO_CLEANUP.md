# Changelog - Monorepo Cleanup And Unified Deployment

Date: 2026-03-15

## Planned

- Archive stale session changelogs, QA summaries, diagnostics, and research prototypes.
- Remove tracked generated artifacts and legacy leftovers.
- Tighten ignore rules for diagnostics, output files, old virtualenvs, and archived AI workspace state.
- Add a canonical root deployment wrapper around `Engram-Platform/docker-compose.yml`.
- Update top-level docs and setup flow to prefer the unified deployment entry point.

## Completed

- Archived stale root changelogs and QA session docs into `archive/2026-03/root-session-docs/`.
- Compressed and archived the large diagnostic dump into `archive/2026-03/diagnostics/Spindump.txt.gz`.
- Archived the superseded `Engram-AiMemory/05_research/weaviate_memory/` prototype and the stale `decay.py.patch` file.
- Removed tracked generated artifacts and stale local environment remnants.
- Tightened `.gitignore` to block future diagnostic/output drift.
- Added `scripts/deploy-unified.sh` as the canonical root deployment wrapper for `Engram-Platform/docker-compose.yml`.
- Updated `README.md`, `PRODUCTION_SETUP.md`, `setup.sh`, and root `package.json` to point at the unified deployment entry point.
