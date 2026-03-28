<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# app

## Purpose

FastAPI application root. Contains API route handlers, data models, business logic services, OSINT pipeline, orchestrators, and middleware.

## Key Files

| File | Description |
|------|-------------|
| `main.py` | FastAPI app factory, lifespan, middleware setup, route registration |
| `__init__.py` | Package marker |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `api/` | API route handlers (crawl, chat, data, OSINT endpoints, etc.) |
| `models/` | Pydantic request/response models |
| `services/` | Business logic (cache, LM bridge, dedup, scheduler, etc.) |
| `osint/` | OSINT pipeline (alias discovery, darkweb, image intelligence, etc.) |
| `orchestrators/` | High-level workflow coordinators (crawl orchestrator, etc.) |
| `pipelines/` | Data processing pipelines (entity enrichment, model review) |
| `storage/` | Vector DB client (ChromaDB) |
| `config/` | Configuration (auth, rate limiting) |
| `core/` | Core utilities (exceptions, retry logic, security) |
| `middleware/` | ASGI middleware (rate limit, auth, sanitization) |
| `utils/` | Helper functions |
| `websocket/` | WebSocket connection manager |
| `workers/` | Background worker tasks |

## For AI Agents

### Working In This Directory

1. **Adding routes**: Create new endpoint in `api/` (e.g., `api/new_feature.py`), then import and include router in `main.py`.
2. **Adding services**: Create new class in `services/` (e.g., `services/new_service.py`) with methods for business logic.
3. **OSINT features**: Add to `osint/` for data discovery/extraction (e.g., new platform in `osint/platforms/`).
4. **Models**: Define Pydantic schemas in `models/` for request/response validation.

### Testing Requirements

- All routes in `api/` must have corresponding test in `../tests/`.
- Services must have unit tests covering happy path + error cases.
- OSINT features need mocked external calls (no actual HTTP to live services).
- Type hints required on public functions.

### Common Patterns

- **FastAPI routers**: Create `APIRouter(prefix="...", tags=[...])`, define endpoints, return JSONable models
- **Async context managers**: Use `@asynccontextmanager` for resource setup/teardown
- **Error handling**: Raise `HTTPException` for client errors, log and reraise for server errors
- **Dependency injection**: Use FastAPI dependencies (`Depends()`) for shared resources
- **Config**: Load from environment or `config.yml` at startup

## Dependencies

### Internal
- `models/` — Pydantic schemas
- `services/` — Business logic and utilities
- `osint/` — OSINT discovery and extraction
- `orchestrators/` — High-level workflows
- `pipelines/` — Data transformations
- `storage/` — Vector DB access
- `middleware/` — ASGI middleware for auth, rate limiting, etc.

### External
- FastAPI, Pydantic, asyncio
- Redis (via `services/redis_client.py`)
- ChromaDB (via `storage/chromadb_client.py`)
- LM Studio (via `services/lm_studio_bridge.py`)

<!-- MANUAL: -->
