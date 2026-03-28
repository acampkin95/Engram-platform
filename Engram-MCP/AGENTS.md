<!-- Generated: 2026-03-22 -->

# Engram-MCP

Unified MCP server with dual transport (stdio + HTTP streaming), OAuth 2.1 authentication with PKCE, and memory hooks.

## Quick Facts

| Aspect | Details |
|--------|---------|
| Language | TypeScript (Node 20+) |
| Entry | `src/index.ts` |
| Build | `npm run build` (tsc) |
| Dev | `npm run dev` (tsc --watch) |
| Test | `npm run test` (node --test) |
| Lint | `npm run lint` (biome) |
| Format | `npm run format` (biome) |
| HTTP Transport | `npm run start:http` (port 3000) |
| Stdio Transport | `npm run start:stdio` |

## Architecture

```
MCP Server (transport-agnostic)
├── Server Factory (server.ts)
├── HTTP Client (client.ts) → Memory API with circuit breaker
├── Tools (memory, entity, investigation)
├── Hooks (pre/post tool execution)
├── Resources & Prompts
├── Auth (OAuth 2.1 + PKCE)
└── Transports (stdio, HTTP streaming)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — selects transport (stdio or HTTP) |
| `src/server.ts` | MCP server factory — registers tools, resources, prompts |
| `src/client.ts` | HTTP client to Memory API with timeout, retry, circuit breaker |
| `src/config.ts` | Configuration from env vars (JWT secret, timeouts, etc.) |
| `src/errors.ts` | Error types and classification |
| `src/circuit-breaker.ts` | Resilience pattern — prevents cascading failures |
| `src/retry.ts` | Exponential backoff retry logic |
| `src/logger.ts` | Structured logging |
| `src/prompts.ts` | MCP prompt definitions |
| `src/schemas.ts` | Zod schemas for input validation |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/auth/` | OAuth 2.1 server, PKCE, token store |
| `src/tools/` | Tool handlers (memory, entity, investigation) |
| `src/hooks/` | Pre/post tool hooks for memory recall/store |
| `src/installer/` | `engram-mcp-install` CLI — sets up MCP in clients |
| `src/transports/` | stdio and HTTP streaming transports |
| `src/utils/` | Helper functions (read-body, etc.) |
| `src/resources/` | MCP resource definitions and handlers |
| `tests/` | Test suite (node --test) |
| `scripts/` | Utilities (smoke test, deploy) |
| `docker/` | Dockerfile and docker-compose |
| `hookify/` | Hookify rules for auto-memory integration |
| `templates/` | Template files for installer |

## For AI Agents

### Working In This Directory

1. **Setup**
   ```bash
   cd Engram-MCP
   npm install
   npm run build
   ```

2. **Development**
   - Edit TypeScript in `src/`
   - Run `npm run dev` for watch mode
   - Changes require rebuild before testing

3. **Transport Selection**
   - Stdio: `npm run start:stdio` (for Claude Code / Desktop)
   - HTTP: `npm run start:http` (for remote clients, port 3000)
   - Both: `npm start` (default is HTTP)

4. **Configuration**
   - Copy `.env.example` to `.env`
   - Required: `JWT_SECRET`, `MEMORY_API_URL`
   - Optional: OAuth settings (`OAUTH_*`)

### Testing Requirements

- Run all tests: `npm run test`
- Tests use `node --test` with `.test.ts` suffix
- Coverage: `npm run test:coverage`
- Target: 382+ tests passing, 0 failures
- Mock Memory API using http module stubs

### Common Patterns

- **Circuit Breaker**: Wrap Memory API calls with `apiCircuitBreaker.execute()`
- **Retry Logic**: Use `withRetry()` for transient failures (5xx, network)
- **Timeout**: All requests timeout at `config.timeout.requestMs`
- **Zod Validation**: Parse untrusted input with schemas
- **Hook Manager**: Register pre/post hooks via `HookManager.registerPreToolHook()`
- **Logger**: Use structured `logger.info()`, `logger.error()`, etc.

## Dependencies

### Internal
- `src/server.ts` — MCP server setup
- `src/client.ts` — Memory API HTTP client
- `src/auth/` — OAuth endpoints
- `src/tools/` — tool handlers
- `src/hooks/` — hook orchestration
- `src/transports/` — stdio and HTTP

### External
- `@modelcontextprotocol/sdk` — MCP protocol
- `@hono/node-server` — HTTP server (Hono)
- `redis` — token store (optional, in-memory default)
- `zod` — input validation
- `node:http`, `node:https` — HTTP keep-alive agents

## Deployment

- Docker: `docker build -f docker/Dockerfile -t engram-mcp .`
- Environment: `.env` with `JWT_SECRET`, `MEMORY_API_URL`
- Service integration: `docker-compose.yml` in parent Engram-Platform
- Health check: `GET /health` returns JSON with uptime, Memory API status

<!-- MANUAL: -->
