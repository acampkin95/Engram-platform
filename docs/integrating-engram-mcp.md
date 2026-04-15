# Integrating Engram MCP with Third-Party Clients

## LibreChat (Full MCP Support)

LibreChat supports MCP servers via **Streamable HTTP** (recommended), SSE, and stdio transports.

### Option A: `librechat.yaml` Configuration

Add Engram as a Streamable HTTP MCP server:

```yaml
mcpServers:
  engram-memory:
    type: streamable-http
    url: http://<ENGRAM_HOST>:3000/mcp
    headers:
      Authorization: "Bearer <MCP_AUTH_TOKEN>"
```

If you're running Engram MCP with OAuth 2.1 enabled, use the OAuth flow instead:

```yaml
mcpServers:
  engram-memory:
    type: streamable-http
    url: http://<ENGRAM_HOST>:3000/mcp
    oauth: true
```

### Option B: UI-Based Setup

1. Open LibreChat **Settings > MCP**
2. Click **Add Server**
3. Fill in:
   - **Name**: `engram-memory`
   - **Transport**: Streamable HTTP
   - **URL**: `http://<ENGRAM_HOST>:3000/mcp`
   - **Headers**: `Authorization: Bearer <MCP_AUTH_TOKEN>`
4. Save and reconnect

### Option C: stdio Transport (Local Only)

```yaml
mcpServers:
  engram-memory:
    type: stdio
    command: npx
    args: ["-y", "@engram/mcp", "--transport", "stdio"]
    env:
      ENGRAM_API_URL: "http://<ENGRAM_HOST>:8000"
      ENGRAM_API_KEY: "<your-api-key>"
```

### User-Specific Credentials

For multi-user deployments, map credentials per user via `customUserVars`:

```yaml
mcpServers:
  engram-memory:
    type: streamable-http
    url: http://<ENGRAM_HOST>:3000/mcp
    headers:
      Authorization: "Bearer {{ENGRAM_TOKEN}}"
    customUserVars:
      ENGRAM_TOKEN: "user_engram_token"
```

### Prerequisites

- Engram MCP server running with HTTP transport (`MCP_TRANSPORT=http` or default)
- `MCP_AUTH_TOKEN` set on the MCP server, or OAuth 2.1 enabled
- Network connectivity from LibreChat host to `<ENGRAM_HOST>:3000`
- Set `CORS_ORIGINS` if the LibreChat frontend makes direct calls (e.g., `CORS_ORIGINS=http://localhost:3080`)

### Verify

After connecting, check **LibreChat Settings > MCP** — `engram-memory` should show as connected with 27 tools available (search_memory, add_memory, build_context, rag_query, etc.).

---

## Perplexity (No MCP Support)

Perplexity does not currently support custom MCP server integration. Their product focuses on built-in web search and reasoning rather than extensible tool servers.

**Alternatives:**

- **Use the Engram Memory API directly** — send HTTP requests to `http://<ENGRAM_HOST>:8000` with your API key for search, CRUD, and RAG operations.
- **Use a MCP-capable client** — Claude Code, Claude Desktop, LibreChat, Cursor, or Windsurf all support MCP natively.
- **Monitor Perplexity's roadmap** — MCP support may be added in the future.

---

## Quick Reference: Engram MCP Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /mcp` | MCP JSON-RPC (tools, prompts, resources) |
| `GET /health` | Health check |
| `GET /.well-known/oauth-authorization-server` | OAuth 2.1 discovery (when enabled) |

| Env Var | Default | Description |
|---------|---------|-------------|
| `MCP_TRANSPORT` | `http` | `http` or `stdio` |
| `MCP_SERVER_PORT` | `3000` | HTTP listener port |
| `MCP_AUTH_TOKEN` | — | Static Bearer token for HTTP transport |
| `ENGRAM_API_URL` | `http://localhost:8000` | Memory API base URL |
| `ENGRAM_API_KEY` | — | API key for Memory API auth |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |
| `OAUTH_ENABLED` | `false` | Enable OAuth 2.1 with PKCE |
