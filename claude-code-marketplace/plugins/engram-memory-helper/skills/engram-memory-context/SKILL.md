---
name: engram-memory-context
description: Build prompt-ready Engram context or RAG context for a task.
argument-hint: <query> [context|rag]
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*)]
disable-model-invocation: true
---

# Engram Memory Context

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

Build enriched context for `$ARGUMENTS`.

## Mode Selection

- Use `context` when the user wants assembled supporting context.
- Use `rag` when the user wants a synthesis prompt and retrieved context.
- If no mode is provided, default to `context`.

## Process

1. Validate `ENGRAM_MEMORY_API_URL` and `ENGRAM_API_KEY`.
2. Collect only the scope values required for relevance: `project_id`, `user_id`, `session_id`, `tier`, `max_tokens`.
3. Call either:
   - `POST .../memories/context`
   - `POST .../memories/rag`
4. Return the response in a form ready to reuse in the current task, and summarize the most important retrieved themes.

## Notes

- Tier 1 is best for repo-local context.
- Tier 2 is best for personal reusable context.
- Use tier 3 sparingly when the user explicitly wants global/shared memory.
