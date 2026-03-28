<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# services

## Purpose

Business logic services that support API handlers and OSINT pipelines. Includes caching, LM Studio bridge, deduplication, scheduler, Redis connection pooling, RAG, and data lifecycle management.

## Key Files

| File | Description |
|------|-------------|
| `cache.py` | Multi-layer Redis cache with stampede prevention and negative caching |
| `lm_studio_bridge.py` | LM Studio client for local LLM inference |
| `entity_deduplication.py` | Semantic deduplication of entities using embeddings |
| `scheduler_service.py` | Crawl scheduling and periodic job management |
| `redis_client.py` | Async Redis client wrapper |
| `redis_pool.py` | Redis connection pooling |
| `rag_service.py` | Retrieval-Augmented Generation (chunking, embedding, retrieval) |
| `data_lifecycle.py` | Hot/warm/cold/archive storage tier management |
| `case_service.py` | Case management (create, read, update) |
| `investigation_service.py` | Investigation CRUD and timeline operations |
| `job_queue.py` | Background job queue (Redis-backed) |
| `job_store.py` | Job persistence and state tracking |
| `chromadb_optimizer.py` | ChromaDB query optimization |
| `concurrency_governor.py` | Concurrency control (semaphore-based rate limiting) |
| `watchdog.py` | Process health monitoring and auto-restart |

## For AI Agents

### Working In This Directory

1. **Adding a service**: Create new file with class inheriting from common base (e.g., `BaseService`).
2. **Dependency injection**: Accept dependencies in `__init__` (Redis, LM Studio client, etc.).
3. **Async methods**: All I/O must be async (Redis, HTTP, file ops).
4. **Error handling**: Raise domain-specific exceptions (e.g., `CacheError`, `LMStudioError`).

### Testing Requirements

- Mock Redis, LM Studio, and external APIs.
- Test happy path and error cases (timeout, invalid input, connection failure).
- Test concurrency with `asyncio.gather()` and multiple concurrent calls.

### Common Patterns

- **Initialization**: `async def __init__()` or `async def initialize()` for async setup
- **Context manager**: `async with service: ...` for resource cleanup
- **Error handling**: Custom exception classes for domain-specific errors
- **Logging**: Use `logger = logging.getLogger(__name__)` and log at key points
- **Caching**: Use `CacheLayer.get_or_compute()` for cache-aside pattern with stampede prevention

## Dependencies

### Internal
- None (services are self-contained; imported by `app.api`, `app.orchestrators`)

### External
- Redis (async via aioredis)
- LM Studio (HTTP via aiohttp)
- ChromaDB (vector DB)
- aiohttp, asyncio

<!-- MANUAL: -->
