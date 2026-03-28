<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Core Package

## Purpose

Primary Python FastAPI backend for the memory system. Implements 3-tier Weaviate-based vector storage, Redis caching, JWT/API-key auth, and background maintenance jobs. Exposes REST API on port 8000 and provides Python client for programmatic access.

## Key Files

| File | Description |
|------|-------------|
| `pyproject.toml` | Package metadata, dependencies, tool config (ruff, mypy, pytest, coverage) |
| `requirements.txt` | Frozen pip dependencies (for Docker builds) |
| `setup.py` (not present) | Uses hatchling build backend via pyproject.toml |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/memory_system/` | Core Python package — see `src/memory_system/AGENTS.md` |
| `tests/` | pytest test suite (26 test files) — see `tests/AGENTS.md` |

## For AI Agents

### Working In This Directory

- **Python 3.11+ required** (pinned in pyproject.toml)
- **Install**: `pip install -e ".[dev]"` (editable mode includes dev deps)
- **Run API**: `python -m memory_system.api` (uvicorn on :8000)
- **Run tests**: `pytest tests/ -v` (80% coverage threshold enforced)
- **Type check**: `mypy src/memory_system/` (strict mode with Phase 2 relaxations)
- **Lint**: `ruff check src/` / `ruff format src/` (100 char line width)

### Testing Requirements

- Coverage threshold: 79.8% (via `--cov-fail-under=79.8`)
- Async mode: `asyncio_mode = "auto"` in pytest.ini
- Fixtures: Shared `conftest.py` mocks Weaviate, Redis, auth
- Test paths: `tests/` directory with modules matching `test_*.py` pattern
- Omitted from coverage: `mcp/`, `investigation/crawler.py`, `compat.py`, legacy integrations

### Common Patterns

- **Memory operations**: All go through `MemorySystem` orchestrator class
- **Database access**: `WeaviateClient` handles schema, CRUD, search
- **Caching**: `RedisCache` wraps hot reads
- **Embeddings**: Multi-provider via `EmbeddingsProvider` factory
- **Auth**: JWT tokens created in `auth.py`, verified in FastAPI dependencies
- **Background jobs**: `workers.py` with APScheduler (decay, consolidation)
- **Document ingestion**: `investigation/` module for crawling, PDF/DOCX parsing

## Dependencies

### Internal

- `src/memory_system/` → main package (see `src/memory_system/AGENTS.md`)
- Tests import from `memory_system` directly

### External

- See `pyproject.toml` [dependencies] and [project.optional-dependencies]
- Key: weaviate-client, redis, fastapi, uvicorn, sentence-transformers, crawl4ai, pydantic

<!-- MANUAL: -->
