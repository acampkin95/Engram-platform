<!-- Parent: ../../../../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Memory System Package

## Purpose

Core Python package implementing a 3-tier vector memory system with Weaviate backend, Redis caching, JWT authentication, and background maintenance workers. Exposes FastAPI REST API and provides Python client API for memory CRUD, search, and knowledge graph operations.

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Public API exports (MemorySystem, MemoryTier, MemoryType, KnowledgeEntity, etc.) |
| `api.py` | FastAPI application (port 8000) with REST endpoints, WebSocket streaming, rate limiting |
| `system.py` | MemorySystem orchestrator (main class coordinating all operations) |
| `client.py` | WeaviateClient for schema management, CRUD, semantic search |
| `cache.py` | RedisCache wrapper for hot memory access |
| `embeddings.py` | EmbeddingsProvider factory supporting OpenAI, DeepInfra, Nomic, Ollama, local |
| `rag.py` | RAG query pipeline for memory-augmented responses |
| `auth.py` | JWT token creation and API key validation |
| `config.py` | Settings (via pydantic_settings from .env) |
| `memory.py` | Memory model classes (pydantic) |
| `workers.py` | Background maintenance jobs (decay, consolidation, cleanup) |
| `context.py` | Context builder for memory queries |
| `temporal.py` | Time-based memory operations (TTL, decay schedules) |
| `decay.py` | Memory decay/retention logic |
| `credibility.py` | Source credibility scoring |
| `contradiction.py` | Contradiction detection between memories |
| `propagation.py` | Memory propagation across tiers |
| `analyzer.py` | Analysis and insight extraction |
| `investigation_router.py` | Router for document investigation tasks |
| `compat.py` | Compatibility layer (datetime, etc.) |
| `ollama_client.py` | Ollama integration for local embeddings |
| `ai_provider.py` | AI model provider abstraction |
| `update_weaviate_schema.py` | Schema migration script |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `investigation/` | Document crawling, parsing, ingestion — see `investigation/AGENTS.md` |
| `mcp/` | MCP server code (kept for backwards compatibility) |
| `prompts/` | System prompts for analysis and generation |

## For AI Agents

### Working In This Directory

- **Main entry**: `api.py` runs FastAPI (8000) or `system.py` for direct Python use
- **Initialization**: `MemorySystem()` constructor starts Weaviate/Redis connections, APScheduler
- **Operations**: Call methods on MemorySystem instance (add, search, delete, get)
- **Auth**: Set `JWT_SECRET` env var or create tokens via `auth.create_access_token()`
- **Embeddings**: Configure `EMBEDDING_PROVIDER` env var (openai, deepinfra, nomic, ollama, local)

### Testing Requirements

- Test files in `../tests/` (26 modules, 80% coverage)
- Mocks: conftest.py provides fixtures for Weaviate, Redis, auth, embeddings
- Async: tests use `asyncio_mode = "auto"`, no manual `@pytest.mark.asyncio` needed
- Coverage omissions: This module itself has minimal omissions (investigation/, mcp/ subfolders and compat.py excluded)

### Common Patterns

- **Memory add**: `system.add_memory(content, tier, source, type)` → returns ID
- **Search**: `system.search_memories(query, tier, limit)` → semantic similarity
- **Get**: `system.get_memory(id)` → single record by ID
- **Delete**: `system.delete_memory(id)` → remove and propagate deletion
- **Entities**: `system.add_entity(name, type, properties)` → knowledge graph node
- **Relations**: `system.add_relation(entity1, entity2, type)` → knowledge graph edge
- **Background jobs**: APScheduler runs decay, consolidation, cleanup on schedule
- **Caching**: RedisCache wraps searches (configurable TTL per tier)
- **Rate limit**: fastapi-slowapi enforces per-client limits in API layer

## Dependencies

### Internal

- `investigation/` — Document crawling and parsing (see `investigation/AGENTS.md`)
- `mcp/` — MCP server wrapper (legacy, kept for Claude integration)
- `prompts/` — System prompt templates

### External

- `fastapi`, `uvicorn`: HTTP API framework
- `weaviate-client`: Vector database client
- `redis`: Cache client
- `pydantic`, `pydantic-settings`: Data validation and config
- `sentence-transformers`: Embeddings generation
- `openai`, `httpx`: External API clients
- `apscheduler`: Background job scheduling
- `python-jose[cryptography]`: JWT tokens
- `slowapi`: Rate limiting
- `python-dotenv`: Environment loading
- `crawl4ai`: Web crawling for investigation

<!-- MANUAL: -->
