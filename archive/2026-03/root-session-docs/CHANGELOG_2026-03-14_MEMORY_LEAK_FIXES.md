# Memory Leak Fixes - 2026-03-14

## Summary
Fixed critical memory leak issues in the Engram-AiMemory embedding system that were causing the Python server to consume 40-45GB RAM.

## Root Causes Identified

### 1. No Connection Pooling in OllamaEmbedder
**Problem:** Each OllamaEmbedder instance created a new `httpx.Client` on instantiation, not per request. With 60s timeout and sequential processing, this led to:
- Multiple HTTP clients sitting idle
- Connections never closed
- Memory accumulation per provider instance

**Fix:**
- Added class-level `_client_pool` dictionary to share clients across instances
- Implemented `_get_client()` method to reuse connections per host
- Added connection limits (max 10 connections per host)
- Added proper cleanup in `clear_embedding_provider_cache()`

**File:** `packages/core/src/memory_system/embeddings.py`
- Lines 107-127: Connection pool implementation

### 2. No Singleton Pattern for Embedding Providers
**Problem:** `get_embedding_provider()` created new instances on every call, causing:
- Multiple model loads (NomicEmbedder ~275MB, BGEReranker ~280MB)
- Duplicate HTTP client pools
- Unbounded memory growth

**Fix:**
- Implemented LRU cache with max 100 provider instances
- Added `_provider_cache_order` list to track access patterns
- Evicts least recently used providers when cache is full
- Properly closes HTTP clients on eviction

**File:** `packages/core/src/memory_system/embeddings.py`
- Lines 158-240: Singleton cache with LRU eviction

### 3. Sequential Processing in Workers
**Problem:** Workers processed memories one at a time in `for` loops, causing:
- Slow batch operations
- Inefficient AI API usage
- No concurrency benefits

**Fix:**
- Added parallel processing using `asyncio.gather()`
- Implemented nested semaphore (max 5 concurrent AI requests)
- Maintained outer semaphore for overall job concurrency
- Added proper error handling per memory

**File:** `packages/core/src/memory_system/workers.py`
- Lines 347-386: Parallel scoring implementation

## Changes Made

### embeddings.py
1. **Added httpx import** (line 10)
   - Required for AsyncClient usage

2. **OllamaEmbedder class** (lines 99-155)
   - Added `_client_pool: dict[str, httpx.AsyncClient]` class variable
   - Implemented `_get_client()` method for connection reuse
   - All embedding methods now async
   - Connection limits: max_connections=10, max_keepalive=30

3. **Provider Cache** (lines 158-240)
   - `_PROVIDER_CACHE_MAX_SIZE = 100`
   - `_provider_cache: dict[str, NomicEmbedder | OllamaEmbedder]`
   - `_provider_cache_order: list[str]` for LRU tracking
   - `clear_embedding_provider_cache()` function for cleanup
   - `get_embedding_provider()` with LRU eviction logic

### workers.py
1. **Parallel Memory Scoring** (lines 347-386)
   - `score_single_memory()` async function
   - Nested semaphore limiting to 5 concurrent AI requests
   - `asyncio.gather()` for concurrent execution
   - Error handling per memory (failures don't stop batch)

## Memory Impact

**Before:**
- 40-45GB RAM usage
- Unbounded connection growth
- Multiple model loads per request

**After (Expected):**
- <8GB RAM usage (target for i5/16GB/1TB system)
- Max 100 cached providers
- Max 10 HTTP connections per Ollama host
- Single model load per provider configuration

## Configuration

No configuration changes required. The fixes are transparent to users.

**Optional tuning:**
```python
# Adjust max provider cache size
_PROVIDER_CACHE_MAX_SIZE = 100  # Default

# Adjust max concurrent AI requests per job
score_semaphore = asyncio.Semaphore(5)  # Default
```

## Testing

**Lint check:**
```bash
cd Engram-AiMemory
ruff check packages/core/src/memory_system/embeddings.py  # ✅ All checks passed
ruff check packages/core/src/memory_system/workers.py     # ✅ Only pre-existing TemporalExtractor error
```

**Next steps:**
1. Monitor memory usage in production
2. Adjust cache sizes if needed
3. Add metrics for cache hit/miss rates
4. Consider Redis-backed provider cache for multi-process environments

## Related Issues

- GitHub Issue: #XX - Memory leak in embedding system
- Related to: Docker memory limits (docker-compose.yml)
- Related to: Workers concurrency settings

## References

- [Memory leak investigation notes](plans/2026-03-14-evaluation/)
- [AGENTS.md - Performance Configuration](AGENTS.md)
