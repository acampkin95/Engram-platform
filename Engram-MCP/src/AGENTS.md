<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# src

Core TypeScript source code. Entry points and transport-agnostic server factory.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Entry point — parses `--transport` flag, selects stdio or HTTP, initializes server |
| `server.ts` | MCP server factory — registers tools, resources, prompts, handlers |
| `client.ts` | HTTP client to Memory API with timeout, retry, circuit breaker |
| `config.ts` | Configuration loader from env vars with Zod validation |
| `errors.ts` | Error types: `MCPError`, `InvalidInputError`, `NotFoundError`, etc. |
| `circuit-breaker.ts` | Resilience: exponential backoff with half-open state |
| `retry.ts` | Retry logic with jitter (3 attempts default) |
| `logger.ts` | Structured logging with request IDs and context |
| `prompts.ts` | MCP prompt definitions (system, diagnostics, etc.) |
| `schemas.ts` | Zod schemas for input validation |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `auth/` | OAuth 2.1 server, PKCE, token store (in-memory or Redis) |
| `tools/` | MCP tool handlers (memory, entity, investigation, health) |
| `hooks/` | Pre/post tool hook manager and registrations |
| `installer/` | CLI for `engram-mcp-install` — sets up MCP in client configs |
| `transports/` | stdio and HTTP streaming transport implementations |
| `utils/` | Helper functions (read-body) |
| `resources/` | MCP resource definitions and request handlers |

## For AI Agents

### Working In This Directory

1. **Adding a Tool**
   - Create handler in `tools/` (e.g., `my-tool.ts`)
   - Export from `tools/tool-definitions.ts`
   - Register in `server.ts` via `handleMyTool()`
   - Write tests in `tests/`

2. **Adding a Hook**
   - Create hook in `hooks/memory-hooks.ts`
   - Register via `hookManager.registerPreToolHook()` or `.registerPostToolHook()`
   - Implement `ToolCallContext` interface from `hooks/types.ts`

3. **Modifying Client Behavior**
   - Edit `client.ts` for resilience logic
   - Edit `config.ts` for env var mapping
   - Timeouts, retries in `circuit-breaker.ts` and `retry.ts`

### Testing Requirements

- All new code requires tests in `tests/`
- Use `node --test` with `.test.ts` suffix
- Mock HTTP responses with `node:http` stubs
- Mock Memory API responses in `client.test.ts`
- Coverage target: 80%+

### Common Patterns

- **Error Handling**: Classify errors as retryable vs. terminal in `errors.ts`
- **Configuration**: All runtime config via `config.ts` — never hardcode
- **Logging**: Always log with `logger` — include request ID for tracing
- **Validation**: Use Zod schemas from `schemas.ts` for all untrusted input
- **Resilience**: All Memory API calls use `apiCircuitBreaker.execute()`

## Dependencies

### Internal
- `auth/` — OAuth endpoints and token storage
- `tools/` — Tool implementations
- `hooks/` — Hook manager and registrations
- `transports/` — Transport factories
- `resources/` — Resource definitions
- `utils/` — Helper functions

### External
- `@modelcontextprotocol/sdk` — MCP server and types
- `hono` — HTTP framework (for HTTP transport)
- `redis` — Optional token store backend
- `zod` — Schema validation
- Node.js builtins: `http`, `https`, `stream`, `crypto`

<!-- MANUAL: -->
