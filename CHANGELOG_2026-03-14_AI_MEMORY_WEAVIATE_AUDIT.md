# Changelog - AI Memory Weaviate Audit

Date: 2026-03-14

## Completed

- Audited the current `Engram-AiMemory` Weaviate schema and memory lifecycle implementation.
- Compared the implementation against current Weaviate guidance and newer AI memory system patterns.
- Identified major gaps in schema alignment, retrieval strategy, lifecycle consistency, and advanced-memory operationalization.
- Wrote a reusable audit plan and findings summary to `plans/2026-03-14-ai-memory-weaviate-audit.md`.

## Main Findings

- Retrieval is not actually hybrid in the live code path even though settings/docs imply hybrid retrieval.
- The memory schema definition does not fully match the fields written by the Python memory model.
- Multi-tenancy is enabled correctly at the collection level, but some maintenance jobs are not tenant-complete.
- Consolidation, contradiction, provenance, and confidence features are present but only partially wired into storage and lifecycle behavior.

## Suggested Next Focus

1. Fix schema drift and retrieval drift first.
2. Normalize lifecycle rules for dedupe, contradiction, consolidation, and expiry.
3. Introduce clearer episodic/semantic/procedural modeling and better evaluation coverage.

## Follow-up Added

- Added a prioritized implementation roadmap with sequencing, dependencies, risks, and file-by-file targets to `plans/2026-03-14-ai-memory-weaviate-audit.md`.

## Phase 0 Implementation

- Implemented schema-parity fixes in `Engram-AiMemory/packages/core/src/memory_system/client.py` so advanced persisted memory fields are included in collection creation and migration.
- Added explicit retrieval configuration in `Engram-AiMemory/packages/core/src/memory_system/config.py` and retrieval-mode branching in `Engram-AiMemory/packages/core/src/memory_system/client.py`.
- Fixed expired-memory maintenance to process all tenants in `Engram-AiMemory/packages/core/src/memory_system/workers.py`.
- Added targeted unit coverage for advanced schema fields, retrieval mode selection, and multi-tenant expiry cleanup.
- Verified the touched Python paths with targeted tests under Python 3.11.
