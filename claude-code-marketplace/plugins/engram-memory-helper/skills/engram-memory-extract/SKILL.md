---
name: engram-memory-extract
description: Extract durable facts from documents, notes, or transcripts and store them as tiered Engram memories.
argument-hint: <file-path-or-url> [tier]
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*), Bash(file:*)]
disable-model-invocation: true
---

# Engram Memory Extract

References:

- @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md
- @${CLAUDE_PLUGIN_ROOT}/docs/document-workflows.md

Extract durable memory from `$ARGUMENTS`.

## Process

1. Read or inspect the source.
2. Extract only durable, reusable knowledge.
3. Split the result into small atomic memories.
4. Choose the appropriate tier:
   - tier 1 for project-specific knowledge
   - tier 2 for personal knowledge
   - tier 3 only for intentionally global knowledge
5. Add tags and metadata for traceability.
6. Store the result via direct memory creation or batch creation.

## Output Requirements

Return:

- extracted memory candidates
- chosen tier and scope
- tags and metadata used
- memory ids created

If the source is too large or should stay preserved in full, recommend `/engram-memory-matter` instead of forcing direct memory storage.
