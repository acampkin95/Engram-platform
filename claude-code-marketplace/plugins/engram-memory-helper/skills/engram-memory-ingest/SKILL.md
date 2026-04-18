---
name: engram-memory-ingest
description: Convert documents, notes, or URLs into Engram memories or matter evidence.
argument-hint: <file-path-or-url>
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*), Bash(file:*)]
disable-model-invocation: true
---

# Engram Memory Ingest

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

Convert `$ARGUMENTS` into Engram memory.

## Decision Rule

- Use `POST /memories` or `POST /memories/batch` for concise extracted insights.
- Use matters and evidence endpoints for large documents, forensic material, repeat retrieval, or evidence-grade storage.

## Process

1. Inspect the source the user passed in.
2. Extract only durable, useful memory candidates.
3. Choose storage path:
   - direct memories for distilled insights
   - matter evidence for large source preservation and later search
4. Preserve scope explicitly with `tenant_id`, `project_id`, `user_id`, and tier.
5. Tag memories so they remain searchable.

## Output

Report:

- what was stored
- where it was stored
- which tags and scope were used
- any source material that should stay as evidence instead of memory
