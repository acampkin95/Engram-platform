<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# transports

Transport layer implementations — stdio (local clients) and HTTP streaming (remote clients).

## Key Files

| File | Description |
|------|-------------|
| `http.ts` | HTTP streaming transport (POST for requests, GET SSE, DELETE for close) |
| `stdio.ts` | Stdio transport (stdin/stdout for local MCP clients) |

## For AI Agents

### Working In This Directory

1. **Understanding Transports**
   - **Stdio**: Used by Claude Code (Claude.app desktop) — reads/writes JSON on stdio
   - **HTTP**: Used by remote clients — POST `/mcp`, GET `/mcp?session=...` for SSE, DELETE to close
   - Both share the same MCP server instance

2. **HTTP Transport Flow**
   - Client POSTs JSON-RPC request to `/mcp?session=SESSION_ID`
   - Request queued and executed
   - Server pushes results via SSE on GET `/mcp?session=SESSION_ID`
   - Client closes session via DELETE

3. **Adding a New Transport**
   - Create `newprotocol.ts`
   - Implement message pump: read request → execute on server → send response
   - Handle connection lifecycle (init, message pump, cleanup)
   - Register in `index.ts`

### Testing Requirements

- Test HTTP endpoints in `tests/http.test.ts`
- Test stdio handling in `tests/`
- Mock server responses
- Test connection cleanup on close
- Verify message ordering and JSON-RPC format

### Common Patterns

- **Message Format**: All transports use MCP JSON-RPC message format
- **Request ID Tracking**: Each request gets unique ID for audit logging
- **Error Propagation**: Errors from server → client in MCP error response
- **Graceful Shutdown**: Both transports handle abrupt client disconnection
- **Resource Cleanup**: Close sockets, cancel pending ops on transport close

## Dependencies

### Internal
- `../server.ts` — Shared MCP server instance
- `../auth/oauth-middleware.ts` — Bearer token validation (HTTP only)
- `../logger.ts` — Request logging with IDs

### External
- `@modelcontextprotocol/sdk` — MCP server transport interfaces
- `@hono/node-server` — HTTP server helper (HTTP transport)
- `node:http` — HTTP server primitives

<!-- MANUAL: -->
