---
name: engram-memory-matter
description: Create or manage investigation matters and ingest documents as searchable evidence before promoting conclusions into memory.
argument-hint: <matter-id-or-task>
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*), Bash(file:*)]
disable-model-invocation: true
---

# Engram Memory Matter

References:

- @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md
- @${CLAUDE_PLUGIN_ROOT}/docs/document-workflows.md

Handle matter workflow for `$ARGUMENTS`.

## Use This When

- the source document must remain preserved in searchable form
- the source is large, multi-part, or evidence-grade
- you need a matter-centric workflow rather than isolated memories

## Process

1. Determine whether the user needs to create a matter, list matters, ingest evidence, or search evidence.
2. Use the `/matters` endpoints directly.
3. For evidence ingestion, keep the original source traceable with `source_url` and `source_type`.
4. After ingesting evidence, offer to promote durable findings into standard memories.

## Safety

- Do not treat evidence as the same thing as distilled memory.
- Keep matter identifiers exact.
- Preserve tenant isolation and matter scope.
