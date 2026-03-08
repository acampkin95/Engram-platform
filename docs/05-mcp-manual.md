# Engram MCP Server Manual

**Version:** 1.0.0
**Last Updated:** March 2026
**Classification:** Technical Reference Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Transport Modes](#transport-modes)
5. [Available Tools](#available-tools)
6. [Tool Reference](#tool-reference)
7. [Hook System](#hook-system)
8. [OAuth 2.1 Authentication](#oauth-21-authentication)
9. [Integration Guides](#integration-guides)
10. [Advanced Usage](#advanced-usage)
11. [Troubleshooting](#troubleshooting)
12. [API Reference](#api-reference)

---

## Overview

The Engram MCP (Model Context Protocol) Server provides AI agents with persistent memory capabilities through a standardized protocol. It acts as a bridge between AI clients (Claude Code, Claude Desktop, Cursor) and the Engram Memory System.

### What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI assistants to interact with external tools and data sources. MCP provides:

- **Standardized tool definitions** - Consistent interface across AI clients
- **Bidirectional communication** - Both stdio and HTTP transports
- **Secure authentication** - OAuth 2.1 with PKCE support
- **Hook system** - Automatic memory recall and storage

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI CLIENT                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Claude Code │  │Claude Desktop│  │   Cursor    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
└─────────┼────────────────┼────────────────┼────────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
┌──────────────────────┐         ┌──────────────────────┐
│   STDIO TRANSPORT    │         │    HTTP TRANSPORT    │
│                      │         │                      │
│  • stdin/stdout      │         │  • POST /mcp         │
│  • JSON-RPC 2.0      │         │  • SSE streaming     │
│  • Single client     │         │  • Multi-client      │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           └────────────────┬───────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │       MCP SERVER          │
              │      (TypeScript)         │
              │                           │
              │  • Tool Definitions       │
              │  • Request Router         │
              │  • Auth Middleware        │
              │  • Hook Executor          │
              └─────────────┬─────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │       MEMORY API          │
              │       (FastAPI)           │
              │                           │
              │  • Vector Storage         │
              │  • Semantic Search        │
              │  • Knowledge Graph        │
              └───────────────────────────┘
```

---

## Installation

### Option 1: NPX (Recommended)

```bash
# Initialize MCP in your project
npx @engram/mcp init

# This will:
# 1. Detect your MCP client (Claude Code, Claude Desktop, Cursor)
# 2. Create appropriate configuration
# 3. Copy hookify rules to .claude/
```

### Option 2: Shell Installer

```bash
curl -fsSL https://raw.githubusercontent.com/engramhq/engram-mcp/main/install.sh | bash
```

### Option 3: Manual Installation

```bash
# Clone repository
git clone https://github.com/engramhq/engram-mcp.git
cd engram-mcp

# Install dependencies
npm install

# Build
npm run build

# Run
npm run start:http  # HTTP transport
# or
npm run start:stdio  # stdio transport
```

### Docker Installation

```bash
# Build image
docker build -f docker/Dockerfile -t engram-mcp .

# Run HTTP transport
docker run -p 3000:3000 \
  -e MEMORY_API_URL=http://host.docker.internal:8000 \
  -e MCP_AUTH_TOKEN=your-token \
  engram-mcp

# Run with docker-compose
cd docker
docker compose up -d
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `http` | Transport mode: `stdio` or `http` |
| `MCP_SERVER_PORT` | `3000` | HTTP server port |
| `MCP_SERVER_NAME` | `engram-mcp` | Server name for identification |
| `MCP_SERVER_VERSION` | `1.0.0` | Server version |
| `MEMORY_API_URL` | `http://localhost:8000` | Memory API endpoint |
| `MCP_AUTH_TOKEN` | - | Static Bearer token for simple auth |
| `CORS_ORIGINS` | - | Allowed CORS origins |
| `OAUTH_ENABLED` | `false` | Enable OAuth 2.1 |
| `OAUTH_ISSUER` | `http://localhost:3000` | OAuth issuer URL |
| `OAUTH_SECRET` | - | OAuth signing secret |
| `OAUTH_ACCESS_TOKEN_TTL` | `3600` | Access token TTL (seconds) |
| `OAUTH_REFRESH_TOKEN_TTL` | `86400` | Refresh token TTL (seconds) |

### Configuration File

```typescript
// src/config.ts
export const config = {
  transport: process.env.MCP_TRANSPORT || "http",
  serverName: process.env.MCP_SERVER_NAME || "engram-mcp",
  serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
  port: parseInt(process.env.MCP_SERVER_PORT || "3000"),
  memoryApiUrl: process.env.MEMORY_API_URL || "http://localhost:8000",
  authToken: process.env.MCP_AUTH_TOKEN,
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || ["*"],
  oauth: {
    enabled: process.env.OAUTH_ENABLED === "true",
    issuer: process.env.OAUTH_ISSUER || "http://localhost:3000",
    secret: process.env.OAUTH_SECRET,
    accessTokenTtl: parseInt(process.env.OAUTH_ACCESS_TOKEN_TTL || "3600"),
    refreshTokenTtl: parseInt(process.env.OAUTH_REFRESH_TOKEN_TTL || "86400"),
  },
};
```

---

## Transport Modes

### STDIO Transport

The stdio transport uses standard input/output for JSON-RPC 2.0 communication. Ideal for local, single-client usage.

**When to use:**
- Claude Desktop integration
- Local development
- Single AI client per session

**Configuration for Claude Desktop:**

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "engram-memory": {
      "command": "npx",
      "args": ["-y", "@engram/mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MEMORY_API_URL": "http://localhost:8000",
        "MCP_AUTH_TOKEN": "your-token"
      }
    }
  }
}
```

**Configuration for Claude Code:**

```json
// ~/.claude/settings.json
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

### HTTP Transport

The HTTP transport provides HTTP POST and Server-Sent Events (SSE) for multi-client support.

**When to use:**
- Multiple AI clients
- Remote server deployment
- Web-based clients
- Production deployments

**Configuration for Claude Code (HTTP):**

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "engram-memory": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | JSON-RPC request |
| `/mcp/sse` | GET | Server-Sent Events stream |
| `/health` | GET | Health check |
| `/.well-known/oauth-authorization-server` | GET | OAuth metadata |

---

## Available Tools

### Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| Memory | 10 | CRUD operations on memories |
| Entity | 3 | Knowledge graph entities |
| Context | 2 | Context building for AI |
| Investigation | 3 | Document/matter management |
| Health | 2 | System status |

### Tool List

| Tool Name | Description |
|-----------|-------------|
| `search_memory` | Semantic search across memories |
| `add_memory` | Store a new memory |
| `get_memory` | Retrieve memory by ID |
| `delete_memory` | Delete a memory |
| `list_memories` | List all memories (paginated) |
| `batch_add_memories` | Add multiple memories at once |
| `build_context` | Build context for current task |
| `rag_query` | RAG query over memories |
| `consolidate_memories` | Merge related memories |
| `cleanup_expired` | Remove expired memories |
| `add_entity` | Add entity to knowledge graph |
| `add_relation` | Add relation between entities |
| `query_graph` | Query the knowledge graph |
| `create_matter` | Create investigation matter |
| `ingest_document` | Ingest document into matter |
| `search_matter` | Search within a matter |
| `health_check` | Check system health |
| `get_stats` | Get memory statistics |

---

## Tool Reference

### Memory Tools

#### search_memory

Search memories using semantic similarity.

```json
{
  "name": "search_memory",
  "arguments": {
    "query": "authentication patterns",
    "tier": 1,
    "project_id": "my-project",
    "limit": 10,
    "min_importance": 0.5
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `tier` | integer | No | Filter by tier (1-3) |
| `project_id` | string | No | Filter by project |
| `user_id` | string | No | Filter by user |
| `tenant_id` | string | No | Filter by tenant |
| `tags` | string[] | No | Filter by tags |
| `min_importance` | number | No | Minimum importance (0-1) |
| `limit` | integer | No | Max results (default: 10) |

#### add_memory

Store a new memory.

```json
{
  "name": "add_memory",
  "arguments": {
    "content": "Use JWT tokens with 24-hour expiry for API authentication",
    "tier": 1,
    "memory_type": "decision",
    "source": "agent",
    "project_id": "my-project",
    "importance": 0.8,
    "tags": ["auth", "security", "api"],
    "metadata": {
      "context": "Security review meeting"
    }
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Memory content |
| `tier` | integer | No | Memory tier (1-3, default: 1) |
| `memory_type` | string | No | Type: fact, decision, insight, preference |
| `source` | string | No | Source: agent, user, system |
| `project_id` | string | No | Project ID (required for Tier 1) |
| `user_id` | string | No | User ID |
| `tenant_id` | string | No | Tenant ID |
| `importance` | number | No | Importance score (0-1) |
| `confidence` | number | No | Confidence score (0-1) |
| `tags` | string[] | No | Tags for categorization |
| `metadata` | object | No | Additional metadata |
| `expires_in_days` | integer | No | Days until expiration |

#### build_context

Build context string for AI from relevant memories.

```json
{
  "name": "build_context",
  "arguments": {
    "query": "implementing user authentication",
    "max_tokens": 2000
  }
}
```

**Response:**
```json
{
  "query": "implementing user authentication",
  "context": "Previous decisions:\n- Use JWT tokens with 24-hour expiry...\n- OAuth 2.1 with PKCE for MCP...",
  "token_estimate": 450
}
```

### Entity Tools

#### add_entity

Add an entity to the knowledge graph.

```json
{
  "name": "add_entity",
  "arguments": {
    "name": "Authentication Module",
    "entity_type": "component",
    "description": "Handles user authentication and authorization",
    "project_id": "my-project",
    "aliases": ["auth-module", "auth-service"],
    "metadata": {
      "language": "TypeScript",
      "framework": "FastAPI"
    }
  }
}
```

#### add_relation

Create a relationship between entities.

```json
{
  "name": "add_relation",
  "arguments": {
    "source_entity_id": "uuid-of-auth-module",
    "target_entity_id": "uuid-of-user-service",
    "relation_type": "depends_on",
    "weight": 0.9,
    "context": "Auth module requires user service for validation"
  }
}
```

#### query_graph

Traverse the knowledge graph from an entity.

```json
{
  "name": "query_graph",
  "arguments": {
    "entity_id": "uuid-of-auth-module",
    "depth": 2
  }
}
```

---

## Hook System

### Overview

The MCP server includes an automatic hook system that recalls relevant memories before tool execution and stores insights after write operations.

### Memory Recall Hook (Pre-hook)

Automatically searches for relevant memories before tool execution.

```typescript
// Hook configuration
const recallHook = {
  name: "memory-recall",
  trigger: "before_tool",
  condition: (tool) => !["health_check", "get_stats"].includes(tool),
  action: async (context) => {
    const memories = await searchMemory(context.query);
    return { context: memories };
  }
};
```

### Memory Store Hook (Post-hook)

Automatically stores insights after write operations.

```typescript
// Hook configuration
const storeHook = {
  name: "memory-store",
  trigger: "after_tool",
  condition: (tool) => ["add_memory", "batch_add_memories"].includes(tool),
  action: async (context) => {
    // Memory already stored by the tool
    // Hook can add additional metadata
  }
};
```

### Hookify Rules

Copy hookify rules to your project for automatic memory integration:

```bash
# Copy rules to .claude/
cp node_modules/@engram/mcp/hookify/*.md .claude/

# Or run init which does this automatically
npx @engram/mcp init
```

### Hookify Rule Files

| File | Purpose |
|------|---------|
| `memory-recall.md` | Rules for recalling memories before actions |
| `memory-store.md` | Rules for storing insights after changes |
| `memory-context.md` | Rules for building context from memories |

---

## OAuth 2.1 Authentication

### Overview

The MCP server supports OAuth 2.1 with PKCE for secure client authentication.

### Enabling OAuth

```bash
# Environment variables
OAUTH_ENABLED=true
OAUTH_SECRET=your-256-bit-secret
OAUTH_ISSUER=https://mcp.your-domain.com
```

### OAuth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | Server metadata (RFC 8414) |
| `/oauth/register` | POST | Dynamic client registration (RFC 7591) |
| `/oauth/authorize` | GET | Authorization endpoint |
| `/oauth/token` | POST | Token endpoint |

### Authorization Flow

```
┌─────────────┐                              ┌─────────────┐
│   Client    │                              │  MCP Server │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │ 1. Generate PKCE challenge                 │
       │                                            │
       │ 2. GET /oauth/authorize                    │
       │    ?client_id=xxx                          │
       │    &redirect_uri=xxx                       │
       │    &code_challenge=xxx                     │
       │    &code_challenge_method=S256             │
       │───────────────────────────────────────────▶│
       │                                            │
       │ 3. User consent (if needed)                │
       │                                            │
       │ 4. Redirect with authorization code        │
       │◀───────────────────────────────────────────│
       │                                            │
       │ 5. POST /oauth/token                       │
       │    code + code_verifier                    │
       │──────────────────────────────────────────▶│
       │                                            │
       │ 6. Access token + refresh token            │
       │◀──────────────────────────────────────────│
       │                                            │
       │ 7. API calls with Bearer token             │
       │──────────────────────────────────────────▶│
       │                                            │
```

### Token Response

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

---

## Integration Guides

### Claude Code Integration

1. **Install MCP:**
```bash
npx @engram/mcp init
```

2. **Configure settings:**

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "engram-memory": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

3. **Restart Claude Code**

4. **Verify:**
```
Ask Claude: "What memory tools do you have available?"
```

### Claude Desktop Integration

1. **Install MCP:**
```bash
npm install -g @engram/mcp
```

2. **Configure:**

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "engram-memory": {
      "command": "npx",
      "args": ["-y", "@engram/mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MEMORY_API_URL": "http://localhost:8000",
        "MCP_AUTH_TOKEN": "your-token"
      }
    }
  }
}
```

3. **Restart Claude Desktop**

### Cursor Integration

1. **Install:**
```bash
npx @engram/mcp init
```

2. **Configure:**

```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "engram-memory": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

---

## Advanced Usage

### Batch Operations

```json
{
  "name": "batch_add_memories",
  "arguments": {
    "memories": [
      {
        "content": "Decision: Use PostgreSQL for primary database",
        "tier": 1,
        "memory_type": "decision",
        "project_id": "my-project"
      },
      {
        "content": "Pattern: Repository pattern for data access",
        "tier": 1,
        "memory_type": "pattern",
        "project_id": "my-project"
      },
      {
        "content": "Insight: Connection pooling improves performance by 40%",
        "tier": 1,
        "memory_type": "insight",
        "project_id": "my-project"
      }
    ]
  }
}
```

### RAG Queries

```json
{
  "name": "rag_query",
  "arguments": {
    "query": "What authentication approach should I use?",
    "project_id": "my-project"
  }
}
```

### Knowledge Graph Traversal

```json
{
  "name": "query_graph",
  "arguments": {
    "entity_id": "auth-module-uuid",
    "depth": 3
  }
}
```

---

## Troubleshooting

### Common Issues

#### MCP Server Not Starting

```bash
# Check if port is in use
lsof -i :3000

# Check environment variables
env | grep MCP

# Run with debug logging
LOG_LEVEL=debug npx @engram/mcp
```

#### Connection Refused

```bash
# Verify Memory API is running
curl http://localhost:8000/health

# Check network connectivity
docker compose exec mcp-server curl http://memory-api:8000/health
```

#### Authentication Failed

```bash
# Verify token
curl -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  http://localhost:8000/stats

# Check token in config
cat ~/.claude/settings.json | jq '.mcpServers["engram-memory"].env.MCP_AUTH_TOKEN'
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
npx @engram/mcp

# Or with Docker
docker run -e LOG_LEVEL=debug engram-mcp
```

---

## API Reference

### JSON-RPC Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_memory",
    "arguments": {
      "query": "authentication"
    }
  },
  "id": 1
}
```

### JSON-RPC Response Format

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"results\": [...], \"total\": 5}"
      }
    ]
  },
  "id": 1
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "query",
      "reason": "required"
    }
  },
  "id": 1
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32001 | Unauthorized |
| -32002 | Memory API error |

---

**Document Control**
| Author | Review Date | Next Review |
|--------|-------------|-------------|
| Engram Team | March 2026 | September 2026 |
