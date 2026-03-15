# Test Coverage Improvement Session - 2026-03-14

## Summary

Improved MCP test coverage from **69.99%** to **75.79%** (target: 80%).

## Changes Made

### 1. Fixed client.test.ts (Complete Rewrite)

**Problem:** File was corrupted during sed operations, reverted to minimal 25-line version with only 3 tests.

**Solution:** Complete rewrite using bash heredoc (to bypass `write` tool stack overflow) with comprehensive tests for all MemoryAPIClient methods.

**New Tests Added:**
- `addMemory` - POST /memories
- `searchMemories` - POST /memories/search
- `getMemory` - GET /memories/:id (including 404 handling)
- `deleteMemory` - DELETE /memories/:id
- `getStats` - GET /stats
- `healthCheck` - GET /health
- `batchAddMemories` - POST /memories/batch
- `buildContext` - POST /context/build
- `ragQuery` - POST /rag/query
- `consolidateMemories` - POST /memories/consolidate
- `cleanupExpired` - POST /memories/cleanup
- `runDecay` - POST /memories/decay
- `exportMemories` - POST /memories/export
- `bulkDeleteMemories` - POST /memories/bulk-delete
- `triggerConfidenceMaintenance` - POST /maintenance/confidence
- `getMemoryGrowthAnalytics` - GET /analytics/growth
- `getActivityTimeline` - GET /analytics/timeline
- `getSearchStats` - GET /analytics/search
- `getKnowledgeGraphStats` - GET /analytics/graph
- `getSystemMetrics` - GET /analytics/system
- `createTenant` - POST /tenants
- `listTenants` - GET /tenants
- `deleteTenant` - DELETE /tenants/:id
- `addEntity` - POST /entities
- `addRelation` - POST /relations
- `queryGraph` - POST /graph/query
- `getEntity` - GET /entities/:id (including 404 handling)
- `deleteEntity` - DELETE /entities/:id
- `findEntityByName` - GET /entities/by-name (including 404 handling)
- `createMatter` - POST /matters
- `ingestDocument` - POST /documents/ingest
- `searchMatter` - POST /matters/search
- Error handling: network error, 500 error, 400 error

**Total Tests:** 41 (up from 3)

**Coverage Impact:** `client.js` improved from **14.86%** to **86.20%**

## Coverage Report (Final)

```
all files                |  75.79 |    81.43 |   61.03
```

### Files Above 80%:
- `circuit-breaker.js`: 99.39%
- `config.js`: 99.23%
- `errors.js`: 100.00%
- `client.js`: 86.20%↑
- `schemas.js`: 100.00%
- `tool-definitions.js`: 100.00%
- `entity-tools.js`: 100.00%
- `investigation-tools.js`: 100.00%
- `memory-tools.js`: 99.37%
- `read-body.js`: 94.67%
- `token-store.ts`: 95.51%
- `pkce.ts`: 100.00%

### Files Below 80%:
- `server.js`: 9.95% (entry point, requires integration testing)
- `oauth-server.js`: 18.35% (OAuth flow, requires integration testing)
- `redis-token-store.js`: 24.58% (JScompiled version)
- `index.js`: 63.49% (entry point)
- `http.js`: 36.91% (HTTP server, requires integration testing)
- `stdio.js`: 48.15% (stdio transport)
- `prompts.js`: 78.11%
- `memory-hooks.js`: 59.63%
- `oauth-middleware.js`: 52.08%

## Technical Issues Encountered

1. **`write` tool stack overflow** - Workaround: Use bash heredoc with `cat`
2. **`read` tool stack overflow** - Workaround: Use `cat` via bash
3. **`edit` tool stack overflow** - Workaround: Use heredoc with `cat`

## Remaining Work (To Reach 80%)

Need integration-level tests for:
1. `server.js` - MCP server creation
2. `oauth-server.js` - OAuth authorization flow
3. `http.js` - HTTP server with SSE streaming
4. `stdio.js` - Stdio transport

These require mocking HTTP servers, OAuth flows, or stdio which ismore complex than unit tests.

## Test Count

- **Before:** 272 tests
- **After:** 310 tests (+38 tests)

## Files Modified

- `/Engram-MCP/tests/client.test.ts` - Complete rewrite with 41 tests

## Memory Leak Fixes (OllamaEmbedder)

### Fixed: Missing `async` keyword on `_embed_one`

**File:** `Engram-AiMemory/packages/core/src/memory_system/embeddings.py`

**Problem:** The `_embed_one` method was defined as a regular function (`def`) but used `await` inside, which would cause a SyntaxError at runtime.

**Fix:** Changed `def _embed_one` to `async def _embed_one` on line 131.

### Already Implemented Memory Leak Fixes

The following memory leak mitigations were already in place from a previous session:

1. **Connection Pooling (Line 114-121)** - Class-level `_client_pool` dict that reuses HTTP clients:
   ```python
   _client_pool: dict[str, httpx.AsyncClient] = {}
       
   def _get_client(self) -> httpx.AsyncClient:
       if self._host not in self._client_pool:
           self._client_pool[self._host] = httpx.AsyncClient(...)
       return self._client_pool[self._host]
   ```

2. **Singleton Pattern (Line 181-230)** - Provider cache ensures single instance per configuration:
   ```python
   _provider_cache: dict[str, "NomicEmbedder | OllamaEmbedder"] = {}
   _provider_cache_order: list[str] = []  # LRU tracking
   ```

3. **Memory Limits with LRU Eviction (Line 164-180)** - Max 100 providers, LRU eviction when full:
   ```python
   _PROVIDER_CACHE_MAX_SIZE = 100
   # On eviction, close and remove the client
   if isinstance(old_provider, OllamaEmbedder) and old_provider._host in OllamaEmbedder._client_pool:
       OllamaEmbedder._client_pool[old_provider._host].close()
   ```

4. **Parallel Processing in Workers** - Semaphore-based concurrency control:
   - Main semaphore: `asyncio.Semaphore(max_concurrent)` (default 2)
   - Scoring semaphore: `asyncio.Semaphore(5)` for up to 5 concurrent AI requests
   - `asyncio.gather()` for parallel processing

5. **Connection Cleanup** - `clear_embedding_provider_cache()` function properly closes all connections:
   ```python
   def clear_embedding_provider_cache() -> None:
       for provider in _provider_cache.values():
           if isinstance(provider, OllamaEmbedder):
               for client in OllamaEmbedder._client_pool.values():
                   client.close()
               OllamaEmbedder._client_pool.clear()
   ```

### Verification Needed

To verify memory reduction from 40-45GB to <8GB:
1. Start Docker Desktop
2. Run `docker-compose up` in Engram-Platform/
3. Monitor memory usage with `docker stats`
4. Expected: AiMemory service <500MB, total system <8GB
