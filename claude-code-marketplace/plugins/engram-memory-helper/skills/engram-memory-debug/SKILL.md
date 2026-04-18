---
name: engram-memory-debug
description: Troubleshoot Engram MCP, Memory API, auth, search quality, and graph or ingestion issues.
argument-hint: [target]
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*), Bash(python3:*), Bash(docker:*), Bash(ssh:*)]
disable-model-invocation: true
---

# Engram Memory Debug

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

Debug Engram issue: `$ARGUMENTS`.

## Order of Operations

1. Verify configuration:
   - `ENGRAM_MCP_URL`
   - `ENGRAM_MCP_AUTH_TOKEN`
   - `ENGRAM_MEMORY_API_URL`
   - `ENGRAM_API_KEY`
2. Check health endpoints first.
3. Reproduce the failing request with the exact route and headers.
4. Distinguish among:
   - plugin configuration issue
   - MCP auth/transport issue
   - Memory API auth issue
   - backend health issue
   - bad scope/filter choice
5. Return the most likely root cause, the evidence, and the minimal fix.

## Common Checks

- `GET /health`
- `GET /mcp/health`
- search request payload shape
- tenant/project/user scoping mismatches
- missing API key vs missing bearer token
