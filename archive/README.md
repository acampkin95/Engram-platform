# Archive

This directory holds archived project artifacts that are intentionally kept out of the active source tree.

## What belongs here

- session changelogs and QA summaries no longer needed at repository root
- diagnostics and one-off investigation outputs
- superseded research prototypes and patch leftovers
- legacy documents retained for reference but not part of build, test, or deployment

## What does not belong here

- active source code
- current deployment entry points
- canonical documentation referenced by `README.md` or `docs/`

## Current archival policy

- prefer moving over deleting when provenance matters
- prefer compression for large diagnostic outputs
- keep active root surface minimal: `README.md`, `AGENTS.md`, `CLAUDE.md`, `PROJECT_ROADMAP.md`, current task changelog(s), and operational docs
