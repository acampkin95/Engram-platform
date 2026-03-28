<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# resources

MCP resources — static and dynamic documentation, capabilities, and system state.

## Key Files

| File | Description |
|------|-------------|
| `enhanced-resources.ts` | Static and templated resource definitions (stats, health, tiers) |
| `memory-resources.ts` | Request handlers — return JSON/markdown for resource URIs |

## For AI Agents

### Working In This Directory

1. **Adding a Resource**
   - Define in `enhanced-resources.ts` with URI, name, description, MIME type
   - Implement handler in `memory-resources.ts`
   - Register in `server.ts` via `handleResourceRequest()`

2. **Resource Semantics**
   - Static: Always available (memory://stats, memory://health)
   - Templated: Dynamic based on parameters (memory://entity/{id})
   - MIME types: `application/json`, `text/markdown`, `text/plain`

3. **Common Resources**
   - `memory://stats` — Memory storage breakdown by tier
   - `memory://health` — System health (Memory API, Redis, uptime)
   - `memory://tiers` — Architecture documentation
   - `memory://entities/{type}` — Entity schemas and examples

### Testing Requirements

- Test static resource definitions
- Test dynamic resource handlers in `tests/memory-resources.test.ts`
- Mock Memory API calls
- Verify JSON/markdown output format

### Common Patterns

- **Read-only**: Resources are exposed for reading; mutations via tools
- **Caching**: Cache expensive resources (e.g., stats) for 30s
- **Error Handling**: Return 404 for unknown resources, 500 for API errors
- **Markdown Documentation**: Use for architecture, schemas, best practices

## Dependencies

### Internal
- `../client.ts` — Query Memory API for stats, health
- `../logger.ts` — Error logging

### External
- `@modelcontextprotocol/sdk` — Resource types

<!-- MANUAL: -->
