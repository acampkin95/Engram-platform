<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# tools

MCP tool implementations — memory (add/search/list), entities (create/update), investigations (case/matter/evidence), and health diagnostics.

## Key Files

| File | Description |
|------|-------------|
| `tool-definitions.ts` | Tool metadata and schemas (name, description, inputSchema) |
| `memory-tools.ts` | add_memory, search_memory, list_memories, clear_memory |
| `entity-tools.ts` | entity_create, entity_find, entity_update, entity_relationships |
| `investigation-tools.ts` | case_new, matter_add, evidence_store, entity_link |
| `health-tools.ts` | system_health check (Memory API, Redis, uptime) |

## For AI Agents

### Working In This Directory

1. **Adding a New Tool**
   - Define schema in `tool-definitions.ts` with name, description, inputSchema
   - Create handler function in appropriate file (memory-, entity-, investigation-, or health-)
   - Export and register in `server.ts` via `handleMyTool()`
   - Add tests in `tests/`

2. **Tool Handler Pattern**
   - Receive `input` object (validated by Zod schema)
   - Call Memory API via `client.ts`
   - Handle errors — classify as user vs. system
   - Return `{ content: [...], isError?: boolean }`

3. **Memory Tier Semantics**
   - Tier 1: Project-scoped (isolated per investigation)
   - Tier 2: User-specific, cross-project (preferences, patterns)
   - Tier 3: Global/shared (bootstrap knowledge, best practices)

### Testing Requirements

- Mock Memory API responses in `tests/memory-tools.test.ts`, etc.
- Test both success and error paths
- Validate input parsing (Zod + tool definitions)
- Test retry behavior on transient failures
- Coverage: 80%+

### Common Patterns

- **Memory CRUD**: All ops go through Memory API — no local storage
- **Entity Linking**: Supports entity_id references across memory entries
- **Investigation Context**: Tools detect active case/matter from context
- **Error Messages**: Return user-friendly descriptions, log internals to stderr
- **Async**: All tools are async — use `await client.xxx()`

## Dependencies

### Internal
- `../client.ts` — Memory API HTTP client
- `../config.ts` — Settings (API URL, timeouts)
- `../logger.ts` — Structured logging
- `../errors.ts` — Error classification

### External
- `@modelcontextprotocol/sdk` — Tool types and response schemas

<!-- MANUAL: -->
