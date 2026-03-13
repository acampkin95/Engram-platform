# AI Memory System

3-Tier persistent memory system for AI agents using Weaviate as the vector database, Redis for caching, and MCP for tool integration.

## Architecture

- **Tier 1 (Project)**: Per-project isolated memory — code insights, decisions, patterns
- **Tier 2 (General)**: User-specific, cross-project memory — preferences, workflows
- **Tier 3 (Global)**: Shared bootstrap knowledge — best practices, documentation

## Stack

| Component | Technology | Port |
|-----------|-----------|------|
| Vector DB | Weaviate 1.25 | 8080 (HTTP), 50051 (gRPC) |
| Cache | Redis 7 | 6379 |
| API | FastAPI (Python 3.11+) | 8000 |
| MCP Server | TypeScript (Node 20+) | stdio |
| Dashboard | Next.js 15 | 3001 |

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — set OPENAI_API_KEY (or use EMBEDDING_PROVIDER=local for mock embeddings)

# 2. Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# 3. Open dashboard
open http://localhost:3001
```

## macOS Setup

This workspace targets Python 3.11+. If `python` is not on your PATH, use an explicit Python 3.11 binary.

```bash
# Homebrew example
brew install python@3.11

# Optional: pin the local interpreter with pyenv
pyenv install 3.11.11
pyenv local 3.11.11
```

## Local Development

### Python API

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"

# Required for auth-enabled tests and API boot
export JWT_SECRET=local-dev-jwt-secret-0123456789abcdef0123456789abcdef

# Run API server
python -m memory_system.api

# Run tests
python -m pytest packages/core/tests/ -v --no-header
```

You can also use the Makefile entry points once Python 3.11 is available:

```bash
make install
make test-python
make build
```

The Makefile exports a local-only `JWT_SECRET` default for `make test` and `make test-python` so the baseline test commands work on a clean machine. Override it in your shell or `.env` if you need a different value.

### MCP Server

```bash
npm install
npm run build -w @ai-memory/mcp-server

# Add to Claude Desktop config:
# "ai-memory": { "command": "node", "args": ["packages/mcp-server/dist/index.js"] }
```

### Dashboard

```bash
npm run dev -w @ai-memory/dashboard
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `add_memory` | Store a new memory (any tier) |
| `search_memory` | Semantic search across tiers |
| `get_memory` | Retrieve by ID |
| `delete_memory` | Remove a memory |
| `list_memories` | Stats overview |
| `add_entity` | Add knowledge graph entity |
| `add_relation` | Link entities |
| `query_graph` | Explore knowledge graph |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health check |
| GET | `/stats` | Memory statistics |
| POST | `/memories` | Add memory |
| POST | `/memories/search` | Search memories |
| GET | `/memories/{id}` | Get memory by ID |
| DELETE | `/memories/{id}` | Delete memory |

## License

MIT
