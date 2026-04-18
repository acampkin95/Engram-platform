---
name: engram-memory-admin
description: Manage Engram tenants, project scope, and operational listing or cleanup workflows.
argument-hint: <task>
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*)]
disable-model-invocation: true
---

# Engram Memory Admin

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

Handle Engram admin task: `$ARGUMENTS`.

## Scope

Use this for:

- tenant creation or deletion
- tenant inventory
- project-scoped memory listing
- cleanup planning by tenant, tier, or project
- matter inventory and lifecycle actions

## Safety

- Confirm destructive actions before deleting tenant or memory data.
- Repeat the exact tenant, project, or matter id before executing deletes.

## Process

1. Determine target resource: tenant, project memory, or matter.
2. Validate auth and target identifiers.
3. Use direct API calls instead of MCP when performing admin actions.
4. Summarize the impact and any follow-up actions needed.
