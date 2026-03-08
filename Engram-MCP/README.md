# Engram MCP — Unified Memory Server

AI memory persistence for Claude Code, Claude Desktop, and Cursor via the Model Context Protocol.

## Features
- 🔄 **Dual transport**: stdio (local) + HTTP streaming (remote/multi-client)
- 🔐 **OAuth 2.1**: Full PKCE + dynamic client registration + authorization server metadata
- 🧠 **Auto memory hooks**: Recall context before tools, store decisions after writes
- 📦 **Streamlined installer**: `npx @engram/mcp init` auto-detects your MCP client
- 📝 **CLAUDE.md injection**: Auto-injects memory system docs into your project

## Quick Start

### 1. Install

```bash
npx @engram/mcp init
```

Or with the shell installer:
```bash
curl -fsSL https://raw.githubusercontent.com/engramhq/engram-mcp/main/install.sh | bash
```

### 2. Manual Configuration

#### Claude Code (stdio)
Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "engram-memory": {
      "command": "npx",
      "args": ["-y", "@engram/mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MEMORY_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

#### Claude Code (HTTP streaming)
```json
{
  "mcpServers": {
    "engram-memory": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `http` | Transport: `stdio` or `http` |
| `MCP_SERVER_PORT` | `3000` | HTTP server port |
| `MEMORY_API_URL` | `http://localhost:8000` | Engram backend URL |
| `MCP_AUTH_TOKEN` | — | Static Bearer token (simple auth) |
| `OAUTH_ENABLED` | `false` | Enable OAuth 2.1 |
| `OAUTH_ISSUER` | `http://localhost:3000` | OAuth issuer URL |
| `OAUTH_SECRET` | — | OAuth signing secret |
| `OAUTH_ACCESS_TOKEN_TTL` | `3600` | Access token TTL (seconds) |
| `OAUTH_REFRESH_TOKEN_TTL` | `86400` | Refresh token TTL (seconds) |

## Available Tools

### Memory Tools
| Tool | Description |
|------|-------------|
| `search_memory` | Search memories by query |
| `add_memory` | Store a new memory |
| `get_memory` | Get memory by ID |
| `delete_memory` | Delete a memory |
| `list_memories` | List all memories |
| `batch_add_memories` | Add multiple memories |
| `build_context` | Build context for current task |
| `rag_query` | RAG query over memories |
| `consolidate_memories` | Merge related memories |
| `cleanup_expired` | Remove expired memories |

### Entity Tools
| Tool | Description |
|------|-------------|
| `add_entity` | Add entity to knowledge graph |
| `add_relation` | Add relation between entities |
| `query_graph` | Query the knowledge graph |

### Matter Tools
| Tool | Description |
|------|-------------|
| `create_matter` | Create a matter/project context |
| `ingest_document` | Ingest document into matter |
| `search_matter` | Search within a matter |

## Hook System

Memory hooks run automatically on every tool call:

- **Pre-hook (memory-recall)**: Searches relevant memories before tool execution
- **Post-hook (memory-store)**: Stores insights after write operations

### Hookify Rules

Copy the bundled hookify rules to your project:
```bash
cp node_modules/@engram/mcp/hookify/*.md .claude/
```

Or run `npx @engram/mcp init` which copies them automatically.

## OAuth 2.1

Enable full OAuth 2.1 with PKCE:

```bash
OAUTH_ENABLED=true OAUTH_SECRET=your-secret npx @engram/mcp --transport http
```

Endpoints:
- `GET /.well-known/oauth-authorization-server` — Server metadata (RFC 8414)
- `POST /oauth/register` — Dynamic client registration (RFC 7591)
- `GET /oauth/authorize` — Authorization endpoint (PKCE required)
- `POST /oauth/token` — Token endpoint (code exchange + refresh)

## Docker

```bash
cd docker
docker compose up
```

Or standalone:
```bash
docker build -f docker/Dockerfile -t engram-mcp .
docker run -p 3000:3000 -e MEMORY_API_URL=http://host.docker.internal:8000 engram-mcp
```

## Development

```bash
npm install
npm run build
npm run start:http    # HTTP transport on :3000
npm run start:stdio   # stdio transport
```

## License

MIT
