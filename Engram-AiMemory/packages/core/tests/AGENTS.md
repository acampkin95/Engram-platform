<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Tests Directory

## Purpose

pytest test suite for memory_system package. 26 test modules covering API endpoints, Weaviate client, cache layer, embeddings, authentication, workers, investigation pipeline, and integration scenarios. Enforces 79.8% code coverage with async-aware test execution.

## Key Files

| File | Description |
|------|-------------|
| `conftest.py` | pytest fixtures (mock Weaviate, Redis, auth, embeddings, FastAPI app) |
| `requirements.txt` | Test-only dependencies (pytest, pytest-cov, pytest-asyncio) |
| `test_api_integration.py` | FastAPI endpoint tests (health, stats, memory CRUD, WebSocket) |
| `test_client.py` | WeaviateClient unit tests (schema, search, lifecycle) |
| `test_cache.py` | RedisCache tests (get, set, delete, TTL) |
| `test_embeddings.py` | EmbeddingsProvider tests (multi-provider strategies) |
| `test_auth.py` | JWT and API key validation |
| `test_system.py` | MemorySystem orchestrator (memory operations, tier routing) |
| `test_memory_system.py` | End-to-end memory workflows |
| `test_workers.py` | Background job workers (decay, consolidation, cleanup) |
| `test_analyzer.py` | Analysis and insight extraction |
| `test_rag.py` | RAG query pipeline |
| `test_weaviate_unit.py` | Weaviate integration unit tests |
| `test_weaviate_live.py` | Live Weaviate tests (requires running instance) |
| `test_weaviate_stability.py` | Stress and reliability tests |
| `test_weaviate_performance.py` | Benchmarks (query speed, memory usage) |
| `test_context_builder.py` | Context building for memory queries |
| `test_context.py` | Context operations |
| `test_credibility.py` | Source credibility scoring |
| `test_decay_ext.py` | Memory decay extensions |
| `test_memory.py` | Memory model validation |
| `test_config.py` | Settings and env loading |
| `test_analytics_endpoints.py` | Analytics API endpoints |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `investigation/` | Investigation module tests (crawling, parsing, ingestion) |

## For AI Agents

### Working In This Directory

- **Run all**: `pytest tests/ -v` (from root, or from `core/` with `../../tests/`)
- **Run single file**: `pytest tests/test_api_integration.py -v`
- **Run single test**: `pytest tests/test_auth.py::test_create_jwt -v`
- **With coverage**: `pytest tests/ --cov=memory_system --cov-report=html` (saves to htmlcov/)
- **Async mode**: Enabled via `asyncio_mode = "auto"` in pyproject.toml — no manual marks needed

### Testing Requirements

- **Coverage threshold**: 79.8% enforced via `--cov-fail-under=79.8`
- **Omitted modules**: `mcp/`, `investigation/crawler.py`, `compat.py`, `ollama_client.py`, `ai_provider.py`
- **Fixtures**: `conftest.py` provides:
  - `mock_weaviate`: Mock WeaviateClient
  - `mock_redis`: Mock RedisCache
  - `auth_token`: Valid JWT for testing
  - `fastapi_app`: TestClient for API endpoints
  - `embeddings_provider`: Mock embeddings
- **Isolation**: Each test gets fresh mocks (no test pollution)

### Common Patterns

- **Fixtures setup**: Tests use `@pytest.fixture` or inherit via conftest
- **Async tests**: Write `async def test_...()` — pytest runs with await automatically
- **Mocking**: Use `unittest.mock.patch()` or `pytest-mock` (not available, use stdlib)
- **FastAPI tests**: Use `TestClient(app)` to call endpoints
- **Parametrized**: `@pytest.mark.parametrize("input,expected", [...])` for multiple cases
- **Markers**: `@pytest.mark.asyncio` not needed (asyncio_mode auto)
- **Timeouts**: `@pytest.mark.timeout(5)` for tests that may hang (requires pytest-timeout)

## Dependencies

### Internal

- `memory_system` (entire package at `src/memory_system/`)
- `tests/` sub-packages (e.g., `investigation/`)

### External

**Test runners & coverage**:
- `pytest` (8.0.0+): Test framework
- `pytest-asyncio` (0.24.0+): Async test support
- `pytest-cov` (5.0.0+): Coverage reporting

**Test dependencies** (via conftest or manual mocking):
- `unittest.mock` (stdlib): Mocking
- `weaviate-client` (mocked): Not live-called
- `redis` (mocked): Not live-called

**Live integration tests** (optional, require running services):
- `weaviate-client`: Real Weaviate instance
- `redis`: Real Redis instance

<!-- MANUAL: -->
