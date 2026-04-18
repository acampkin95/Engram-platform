---
name: engram-memory-search
description: Search Engram memories with tenant, project, user, and tier awareness.
argument-hint: <query>
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*), Bash(python3:*)]
disable-model-invocation: true
---

# Engram Memory Search

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

Search Engram memory for `$ARGUMENTS`.

## Process

1. Confirm `ENGRAM_MEMORY_API_URL` and `ENGRAM_API_KEY` are set.
2. Ask only for missing filters that materially change the result: `tenant_id`, `project_id`, `user_id`, `tier`, `tags`, `limit`.
3. If the MCP server is available and the user only wants a normal semantic lookup, prefer MCP.
4. Otherwise call the Memory API directly with `POST ${ENGRAM_MEMORY_API_URL}/search` semantics using the real route `POST ${ENGRAM_MEMORY_API_URL}/search` only if the base URL already ends at `/memories`, or `POST ${ENGRAM_MEMORY_API_URL}/memories/search` if it is the API root. Detect which form is configured before calling.
5. Return results grouped by tier and score, and point out any likely duplicates or conflicting memories.

## Validation

Check configuration: !`test -n "${ENGRAM_MEMORY_API_URL:-}" && test -n "${ENGRAM_API_KEY:-}" && echo OK || echo MISSING_ENV`

If the user did not specify a scope, default to the narrowest reasonable scope and state it explicitly.
