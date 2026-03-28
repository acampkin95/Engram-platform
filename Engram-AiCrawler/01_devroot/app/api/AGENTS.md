<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# api

## Purpose

FastAPI route handlers and API endpoints. Each file defines a router for a specific feature domain (crawl, chat, OSINT, RAG, storage, etc.).

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker; imports all routers |
| `crawl.py` | POST /crawl endpoints (start crawl, get status, pause, resume) |
| `chat.py` | POST /chat endpoints (conversational queries with context) |
| `data.py` | GET /data endpoints (fetch crawl results, metadata) |
| `extraction.py` | POST /extract endpoints (data extraction templates, preview) |
| `investigations.py` | POST /investigations endpoints (case/investigation CRUD) |
| `knowledge_graph.py` | GET /kg endpoints (entity graph, relationships) |
| `rag.py` | POST /rag endpoints (chunk, embed, retrieve) |
| `storage.py` | GET /storage endpoints (DB stats, usage) |
| `stats.py` | GET /stats endpoints (crawl counts, performance metrics) |
| `scheduler.py` | POST /scheduler endpoints (schedule crawls) |
| `settings.py` | GET/POST /settings endpoints (config, preferences) |
| `performance.py` | GET /performance endpoints (latency, throughput) |
| `cases.py` | POST /cases endpoints (case management) |
| `darkweb.py` | POST /darkweb endpoints (Tor-based OSINT) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `osint/` | OSINT-specific endpoints (alias, threat intel, fraud, image intel) |

## For AI Agents

### Working In This Directory

1. **Creating a new endpoint**: Create a new router file (e.g., `api/my_feature.py`) with `APIRouter` and endpoints.
2. **Registering routes**: Import and include in `main.py` with `app.include_router()`.
3. **Request validation**: Use Pydantic models from `models/` for request body and response.
4. **Error handling**: Catch exceptions and raise `HTTPException(status_code=..., detail="...")`.
5. **Documentation**: Add docstrings and FastAPI field descriptions for OpenAPI schema.

### Testing Requirements

- Each endpoint must have at least one happy path test and one error case test in `../tests/test_api.py` or equivalent.
- Mock external dependencies (Redis, LM Studio, etc.) using `unittest.mock` or pytest fixtures.
- Use `@pytest.fixture(autouse=True)` to disable rate limiting and auth in tests.

### Common Patterns

- **Router setup**: `router = APIRouter(prefix="/api/resource", tags=["resource"])`
- **Async endpoints**: `async def endpoint_name(...) -> ResponseModel:`
- **Request body**: `async def create(..., req: RequestModel) -> ResponseModel:`
- **Path params**: `async def get_by_id(id: str) -> ResponseModel:`
- **Query params**: `async def list(..., skip: int = 0, limit: int = 10) -> List[ResponseModel]:`

## Dependencies

### Internal
- `app.models` — Pydantic request/response schemas
- `app.services` — Business logic (cache, LM bridge, etc.)
- `app.osint` — OSINT pipelines
- `app.orchestrators` — High-level workflows
- `app.pipelines` — Data transformations

### External
- FastAPI, Pydantic
- HTTP client libraries (aiohttp, httpx)

<!-- MANUAL: -->
