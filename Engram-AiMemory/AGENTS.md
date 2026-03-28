<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Engram-AiMemory

## Purpose

3-Tier persistent vector memory system for AI agents. Weaviate stores multi-tenant memories organized into Tier 1 (project-scoped), Tier 2 (user cross-project), and Tier 3 (global bootstrap). Redis caches hot data. FastAPI exposes REST endpoints on port 8000. CLI and MCP integrations enable tool-based memory access from Claude and other AI clients.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Quick start, stack overview, architecture diagram |
| `Makefile` | Development entry points (install, test, lint, build, docker) |
| `pyproject.toml` | Python package config, ruff/mypy/pytest settings, 79.8% coverage threshold |
| `package.json` | npm workspaces root (cli only, MCP/dashboard moved to Engram-MCP and Engram-Platform) |
| `AGENTS.md` | (This file, 2026-03-16) Agent guidance for Engram-AiMemory |
| `.env.example` | Environment template (JWT_SECRET, embedding provider, Redis/Weaviate URLs) |
| `docker-compose.test.yml` | Local testing compose (memory-api, weaviate, redis) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `packages/core/` | Python FastAPI backend — see `packages/AGENTS.md` |
| `packages/cli/` | TypeScript CLI tool — see `cli/AGENTS.md` |
| `docker/` | Dockerfiles and compose files — see `docker/AGENTS.md` |
| `scripts/` | Deployment, testing, and system management — see `scripts/AGENTS.md` |
| `docs/` | Architecture, API docs, guides |
| `01_devroot/` | Legacy remote agent code (not active) |
| `04_branding/` | Marketing assets, landing page |

## For AI Agents

### Working In This Directory

- **Setup**: `make install` (requires Python 3.11+), then `make test` or `make dev`
- **Root is npm-based** but Python is primary via Make. Commands sequence: Python 3.11 venv → pip install -e → pytest
- **JWT_SECRET required**: Tests and API dev both need it (Makefile exports a local default)
- **Docker compose**: Use `docker/docker-compose.yml` for local services (Weaviate, Redis)
- **Entry point for API**: `memory_system.api:app` (FastAPI, runs on :8000)

### Testing Requirements

- **Python**: `pytest packages/core/tests/ -v` with 79.8% coverage threshold
- **Coverage omits**: `mcp/`, `investigation/crawler.py`, `compat.py`, `ollama_client.py`, `ai_provider.py`
- **Async mode**: `asyncio_mode = "auto"` — async tests run automatically
- **Fixtures**: Shared `conftest.py` provides mock Weaviate, Redis, auth, embeddings
- **Test files**: 26 test modules covering API, client, cache, embeddings, workers, investigation

### Common Patterns

- **Auth**: JWT tokens via `memory_system.auth:create_access_token()` — verified in API endpoints
- **Memory lifecycle**: Add → Search → Get → Delete via `MemorySystem` orchestrator
- **Vector search**: Delegated to `WeaviateClient` with automatic schema management
- **Background jobs**: `workers.py` runs decay, consolidation, cleanup via APScheduler
- **Investigation**: Document crawling/parsing via `investigation/` module (PDF, DOCX, email, web)
- **Embeddings**: Multi-provider strategy (OpenAI, DeepInfra, Nomic, Ollama, local mock)

## Dependencies

### Internal

- **Engram-Platform**: Frontend consumes Memory API (http://localhost:8000)
- **Engram-MCP**: MCP server wraps Memory API tools
- **Engram-AiCrawler**: May consume memory APIs for OSINT workflows

### External

**Python (packages/core)**:
- `weaviate-client` (4.9.0+): Vector database client
- `redis` (5.0.0+): Cache layer
- `fastapi` (0.115.0+): REST API framework
- `uvicorn` (0.30.0+): ASGI server
- `pydantic` (2.0+): Data validation
- `sentence-transformers` (3.0.0+): Embeddings
- `apscheduler` (3.10.0+): Background job scheduling
- `crawl4ai` (0.7.8+): Web crawling
- `PyMuPDF`, `pytesseract`, `python-docx`, `openpyxl`: Document parsing
- `python-jose[cryptography]`: JWT auth
- `slowapi`: Rate limiting

**TypeScript (packages/cli)**:
- `typescript` (5.6.0+): Type checking
- `@types/node` (20.0.0+): Node types
- `tsx`: TypeScript executor

**Dev**:
- `pytest` (8.0.0+), `pytest-asyncio`: Testing
- `ruff` (0.6.0+): Linting, formatting
- `mypy` (1.0.0+): Type checking
- `pytest-cov`: Coverage

<!-- MANUAL: -->
