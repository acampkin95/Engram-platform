---
name: engram-memory-personal
description: Manage tier-2 personal Engram memory for preferences, habits, workflows, and personal context.
argument-hint: <task>
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*)]
disable-model-invocation: true
---

# Engram Personal Memory

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

Handle personal memory task: `$ARGUMENTS`.

## Rules

- Personal memory should default to tier 2.
- Always include `user_id` if available.
- Keep private preferences and workflows out of project/global memory unless the user explicitly wants them shared.

## Supported Actions

- add or update personal preferences as memory
- search personal memory only
- list tier-2 memory for a user
- clean up obsolete or duplicate personal entries

## Process

1. Identify whether the user wants add, search, list, or delete.
2. Use the Memory API directly with tier 2 filters.
3. Return the effect clearly and show any identifiers needed for follow-up cleanup.
