# AGENTS.md -- Engram-AiMemory

**Updated:** 2026-03-16

## OVERVIEW

Python 3.11+ FastAPI memory system with CLI. 3-tier vector memory with Weaviate, Redis, and MCP integration.

The MCP server and dashboard UI that were previously in this workspace have been retired:
- MCP server -> now canonical at `Engram-MCP/` (OAuth 2.1, 381 tests)
- Dashboard -> now canonical at `Engram-Platform/` (Next.js 15, Clerk auth)

## STRUCTURE

```
Engram-AiMemory/
+-- packages/
|   +-- cli/              # Command-line interface (only remaining TS package)
+-- packages/core/
|   +-- src/memory_system/
|       +-- api.py        # FastAPI entry (port 8000)
|       +-- system.py     # MemorySystem orchestrator
|       +-- client.py     # Weaviate client (schema, search, lifecycle)
|       +-- embeddings.py # Multi-provider embeddings
|       +-- cache.py      # Redis caching layer
|       +-- rag.py        # RAG query pipeline
|       +-- auth.py       # JWT + API key auth
|       +-- workers.py    # Background maintenance (decay, consolidation, cleanup)
|       +-- investigation/ # Document ingestion
+-- 04_branding/          # Marketing assets
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Memory operations | `packages/core/src/memory_system/system.py` |
| API endpoints | `packages/core/src/memory_system/api.py` |
| Weaviate schema/search | `packages/core/src/memory_system/client.py` |
| Embeddings | `packages/core/src/memory_system/embeddings.py` |
| Background jobs | `packages/core/src/memory_system/workers.py` |
| Document crawling | `packages/core/src/memory_system/investigation/crawler.py` |
| MCP bridge | `packages/core/src/memory_system/mcp/` |

## CONVENTIONS

**Python (packages/core)**
- Line width: 100 chars
- Ruff rules: E,F,I,N,W,UP,B,C4,SIM
- MyPy: Relaxed (Phase 2 type-safety work in progress)
- Async tests: `asyncio_mode = "auto"`
- Coverage: 80% minimum

**TypeScript (packages/cli)**
- Line width: 100 chars
- Indent: 2 spaces
- Quotes: Double
- Trailing commas: ES5
- Linter: biome

## COMMANDS

```bash
# Install deps (Python 3.11+ required)
make install

# All tests (Python only -- TS tests are now in Engram-MCP and Engram-Platform)
make test

# Python only
make test-python

# Lint
make lint                 # ruff + biome (cli) + mypy
make lint-fix             # Auto-fix

# Docker (via unified deployment)
# From monorepo root:
#   ./scripts/deploy-unified.sh up
```

## ANTI-PATTERNS

1. **NEVER set `check_robots_txt=False`** in crawler.py -- legal/ethical violation
2. **NEVER use 0.0.0.0 in production** -- Tailscale only
3. Do NOT remove MCP bridge code in `packages/core/src/memory_system/mcp/` -- required for Claude integration
