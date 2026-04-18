# Engram Memory API Surface

## Authentication

- Memory API accepts either `X-API-Key: <key>` or `Authorization: Bearer <jwt>`.
- Engram MCP HTTP transport expects `Authorization: Bearer <token>`.

## Core URLs

- MCP URL: `${ENGRAM_MCP_URL}`
- Memory API base: `${ENGRAM_MEMORY_API_URL}`

Recommended hosted defaults:

- MCP: `https://app.velocitydigi.com/mcp`
- Memory API: `https://app.velocitydigi.com/api/memory`

## Memory Workflows

- `GET /health`
- `POST /memories`
- `POST /memories/batch`
- `POST /memories/search`
- `GET /memories/list`
- `GET /memories/{memory_id}?tier=<1|2|3>&tenant_id=<id>`
- `DELETE /memories/{memory_id}?tier=<1|2|3>&tenant_id=<id>`
- `POST /memories/context`
- `POST /memories/rag`

Common filters and scopes:

- `tier`: 1 project, 2 personal cross-project, 3 global
- `project_id`: project-scoped memories
- `user_id`: user-scoped memories
- `tenant_id`: tenant isolation
- `tags`, `min_importance`, `limit`

## Knowledge Graph

- `POST /graph/entities`
- `GET /graph/entities`
- `GET /graph/entities/by-name?name=<entity>`
- `GET /graph/entities/{entity_id}`
- `DELETE /graph/entities/{entity_id}`
- `POST /graph/relations`
- `POST /graph/query`

## Tenants

- `POST /tenants`
- `GET /tenants`
- `DELETE /tenants/{tenant_id}`

## Matters and Evidence

- `POST /matters/`
- `GET /matters/`
- `GET /matters/{matter_id}`
- `PATCH /matters/{matter_id}/status`
- `DELETE /matters/{matter_id}`
- `POST /matters/{matter_id}/evidence`
- `POST /matters/{matter_id}/evidence/search`
- `DELETE /matters/{matter_id}/evidence/{document_hash}`

## Suggested Workflow Choices

- Search existing memory: MCP first, API for debugging or exact filters
- Build enriched context: `POST /memories/context`
- Produce RAG-ready prompt: `POST /memories/rag`
- Manage personal memory: tier `2` with `user_id`
- Manage project memory: tier `1` with `project_id`
- Visualize relationships: resolve entity then `POST /graph/query`
- Convert large documents into evidence: matters + evidence endpoints
