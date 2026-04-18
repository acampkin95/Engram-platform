---
name: engram-memory-helper
description: Use this skill when the user wants to work with Engram memory, the 3-tier memory model, project or personal memory, semantic search, memory context enrichment, knowledge graph relationships, matter evidence ingestion, or memory debugging in Claude Code. Prefer this skill for Engram-specific memory workflows over generic notes or generic vector-db guidance.
version: 0.1.0
---

# Engram Memory Helper

Use Engram-specific memory workflows instead of generic memory advice.

Reference: @${CLAUDE_PLUGIN_ROOT}/docs/api-surface.md

## Core Operating Rules

1. Prefer the `engram-memory` MCP server for normal memory lookup and storage if it is connected.
2. Switch to direct HTTP API calls when you need endpoint-specific debugging, tenant operations, matter/evidence ingestion, or exact filter control.
3. Keep memory scope explicit:
   - Tier 1: project memory
   - Tier 2: personal cross-project memory
   - Tier 3: global/shared memory
4. Preserve tenant, project, and user boundaries. Do not silently change scope.
5. For large documents or evidence-grade ingestion, prefer matters/evidence flows over stuffing raw files into a single memory.

## Workflow Selection

### Search and Recall

- Use semantic search when the user wants to find prior facts, notes, decisions, or preferences.
- Use context enrichment when the user wants assembled prompt-ready context.
- Use RAG when the user wants a synthesized prompt with supporting context.

### Relationship Views

- Resolve an entity by name first when only a label is provided.
- Query the graph after the root entity is known.
- Explain nodes, relations, scope, and any ambiguity in entity matching.

### Document to Memory Conversion

- For small structured insights: extract high-value facts and write them as tiered memories.
- For large source material, investigations, or repeat search needs: create or use a matter and ingest evidence.
- When converting documents, summarize, deduplicate, and tag memories instead of storing raw text blindly.

### Personal Memory Management

- Use tier 2 for user-specific preferences, workflows, recurring context, and personal operating notes.
- Attach `user_id` whenever possible.
- Keep personal memory separate from team/global knowledge.

### Tenant and Project Management

- Use tenant endpoints for tenant lifecycle.
- Use `project_id` and tier 1 for project scoping.
- When cleaning up or listing memories, confirm whether the user means one tenant/project or all visible scope.

### Debugging and Troubleshooting

- Start with health checks and auth verification.
- Verify whether failure is in Claude Code plugin config, MCP transport, API auth, or backend health.
- Prefer concrete checks: endpoint reachability, headers, status codes, and payload shape.

## Expected Inputs

Try to capture these with minimal back-and-forth when they are needed:

- query
- tenant_id
- project_id
- user_id
- tier
- tags
- whether MCP or direct API is preferred

If a value is missing and the request is still safe to run, default carefully and say what you assumed.
