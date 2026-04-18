---
name: engram-memory-graph
description: Resolve entities and inspect Engram knowledge graph relationships.
argument-hint: <entity-name-or-id>
allowed-tools: [Read, Glob, Grep, Bash(curl:*), Bash(test:*)]
disable-model-invocation: true
---

# Engram Memory Graph

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

Inspect the knowledge graph for `$ARGUMENTS`.

## Process

1. Determine whether `$ARGUMENTS` looks like an entity UUID or a name.
2. If it is a name, resolve it first using `GET /graph/entities/by-name`.
3. Query the graph with `POST /graph/query` using the resolved entity id.
4. Ask for `depth`, `tenant_id`, and `project_id` only when they matter.
5. Present:
   - root entity
   - neighboring entities
   - relation types and weights
   - likely interpretation of the relationship map

## Relationship Guidance

- Call out ambiguous entity matches.
- Distinguish direct relations from deeper traversal results.
- If the graph is sparse, suggest which entities or relations should be added next.
