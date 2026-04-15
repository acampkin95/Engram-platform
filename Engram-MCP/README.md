# @engram/mcp

AI memory persistence for any MCP-compatible client — Claude Code, Claude Desktop, Cursor, Windsurf, and more.

## Features

- **Dual transport**: stdio (local) + HTTP streaming (remote/multi-client)
- **27 MCP tools**: Memory CRUD, knowledge graph, investigation pipeline, analytics
- **Automatic memory hooks**: Recall context before tools, store decisions after writes
- **OAuth 2.1**: PKCE + dynamic client registration (RFC 7591, 8414)
- **Circuit breaker + retry**: Resilient API client with exponential backoff
- **Guided installer**: `npx @engram/mcp init` auto-detects your MCP client

## Quick Start

### Option 1: Guided Installer

```bash
npx @engram/mcp init
```

Detects your MCP client (Claude Code, Claude Desktop, Cursor), asks for API URL, and writes the config automatically.

### Option 2: One-Command Setup (Claude Code)

```bash
claude mcp add --scope user --transport stdio engram-memory \
  -e ENGRAM_API_URL=http://localhost:8000 \
  -e ENGRAM_API_KEY=your-api-key \
  -- npx -y @engram/mcp --transport stdio
```

### Option 3: HTTP Transport

```bash
ENGRAM_API_URL=http://localhost:8000 \
ENGRAM_API_KEY=your-api-key \
npx @engram/mcp --transport http
```

Endpoints:
- `POST http://localhost:3000/mcp` — MCP JSON-RPC
- `GET http://localhost:3000/health` — Health check
- `GET http://localhost:3000/.well-known/oauth-authorization-server` — OAuth discovery

### Option 4: Docker

```bash
docker run -p 3000:3000 \
  -e ENGRAM_API_URL=http://host.docker.internal:8000 \
  -e ENGRAM_API_KEY=your-api-key \
  -e MCP_TRANSPORT=http \
  @engram/mcp
```

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ENGRAM_API_URL` | `http://localhost:8000` | Yes | Memory API base URL |
| `ENGRAM_API_KEY` | — | Yes | API key for authentication |
| `MCP_TRANSPORT` | `http` | No | Transport: `stdio` or `http` |
| `MCP_SERVER_PORT` | `3000` | No | HTTP server port |
| `MCP_AUTH_TOKEN` | — | No | Static Bearer token for HTTP transport |
| `MCP_LOG_LEVEL` | `info` | No | Logging: debug, info, warn, error |
| `OAUTH_ENABLED` | `false` | No | Enable OAuth 2.1 |
| `OAUTH_SECRET` | — | Conditional | OAuth signing secret (≥32 chars when enabled) |
| `OAUTH_ISSUER` | `http://localhost:3000` | No | OAuth issuer URL |

**Legacy fallbacks** (still supported):
- `MEMORY_API_URL` → falls back from `ENGRAM_API_URL`
- `AI_MEMORY_API_KEY` → falls back from `ENGRAM_API_KEY`

## Available Tools (27)

### Memory Operations (10)

| Tool | Description |
|------|-------------|
| `add_memory` | Store a memory (tier 1/2/3, any type) |
| `search_memory` | Semantic search across memories |
| `list_memories` | List memories with pagination |
| `get_memory` | Retrieve a specific memory by ID |
| `delete_memory` | Delete a memory by ID |
| `batch_add_memories` | Add up to 100 memories at once |
| `bulk_delete_memories` | Delete memories by criteria |
| `build_context` | Assemble prompt context from relevant memories |
| `rag_query` | Retrieval-augmented generation query |
| `export_memories` | Export as JSON, CSV, or Markdown |

### Knowledge Graph (4)

| Tool | Description |
|------|-------------|
| `add_entity` | Add a node (person, project, concept, tool) |
| `add_relation` | Add a relationship between entities |
| `query_graph` | Traverse graph from an entity (1-3 hops) |
| `get_kg_stats` | Knowledge graph statistics |

### Investigation & Evidence (3)

| Tool | Description |
|------|-------------|
| `create_matter` | Create an investigation with isolated tenant |
| `ingest_document` | Ingest documents into a matter (web, PDF, text) |
| `search_matter` | Semantic search within a matter's evidence |

### Maintenance & Analytics (10)

| Tool | Description |
|------|-------------|
| `health_check` | Check Memory API, Weaviate, Redis status |
| `consolidate_memories` | Merge related memories (requires LLM) |
| `cleanup_expired` | Remove expired memories |
| `trigger_confidence_maintenance` | Run confidence propagation |
| `get_analytics` | Memory system analytics |
| `get_memory_growth` | Growth trends over time |
| `get_activity_timeline` | Activity timeline for a memory or tenant |
| `get_search_stats` | Search performance stats |
| `get_system_metrics` | System resource metrics |
| `manage_tenant` | Create, list, or delete tenants |

## Automatic Memory Hooks

The MCP server registers hooks that fire around every tool call:

### Pre-tool Recall

Before each tool call (except read-only tools), relevant memories are searched and logged at DEBUG level. The search query is built from the tool's semantic arguments (`content`, `query`, `description`, etc.) rather than raw JSON.

### Post-tool Store

After write operations, a memory is stored automatically. Content is extracted from input arguments (intent) over result text (noise). For `add_relation`, a human-readable triple is synthesized.

Importance scores per tool:

| Tool | Importance |
|------|-----------|
| `ingest_document` | 0.8 |
| `add_entity`, `add_relation`, `create_matter` | 0.7 |
| `add_memory`, `batch_add_memories` | 0.6 |
| `consolidate_memories` | 0.5 |
| `cleanup_expired` | 0.3 |

## Resilience

| Feature | Config | Default |
|---------|--------|---------|
| **Circuit Breaker** | Trips after 5 failures in 60s | 30s reset |
| **Retry** | Exponential backoff | 3 attempts, 100ms base |
| **Timeout** | Per-request | 30s |
| **Connection Pool** | TCP keep-alive | 50 max sockets |
| **Session Pruning** | TTL-based | 30min inactive sessions removed |
| **Slowloris Protection** | Socket timeouts | 30s idle, 10s headers |

## OAuth 2.1

Enable full OAuth 2.1 with PKCE for multi-tenant or production deployments:

```bash
OAUTH_ENABLED=true OAUTH_SECRET=your-secret-at-least-32-chars npx @engram/mcp --transport http
```

Endpoints:
- `GET /.well-known/oauth-authorization-server` — Server metadata (RFC 8414)
- `POST /oauth/register` — Dynamic client registration (RFC 7591)
- `GET /oauth/authorize` — Authorization endpoint (PKCE required)
- `POST /oauth/token` — Token exchange + refresh

## Client Configuration

### Claude Code

```bash
claude mcp add --scope user --transport stdio engram-memory \
  -e ENGRAM_API_URL=http://localhost:8000 \
  -e ENGRAM_API_KEY=your-api-key \
  -- npx -y @engram/mcp --transport stdio
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "engram-memory": {
      "command": "npx",
      "args": ["-y", "@engram/mcp", "--transport", "stdio"],
      "env": {
        "ENGRAM_API_URL": "http://localhost:8000",
        "ENGRAM_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor / Windsurf / Other MCP Clients

Add to your client's MCP configuration:

```json
{
  "mcpServers": {
    "engram-memory": {
      "command": "npx",
      "args": ["-y", "@engram/mcp", "--transport", "stdio"],
      "env": {
        "ENGRAM_API_URL": "http://localhost:8000",
        "ENGRAM_API_KEY": "your-api-key"
      }
    }
  }
}
```

### HTTP (Any Client)

```json
{
  "mcpServers": {
    "engram-memory": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

## Hookify Rules

Copy the bundled hookify rules to enable automatic memory context in Claude Code:

```bash
cp node_modules/@engram/mcp/hookify/*.md .claude/
```

Or run `npx @engram/mcp init` which copies them automatically.

## Development

```bash
git clone https://github.com/acampkin/engram-mcp.git
cd engram-mcp
npm install
npm run build
npm run start:http    # HTTP transport on :3000
npm run start:stdio   # stdio transport
npm test              # run tests
npm run lint          # biome check
```

## License

MIT
