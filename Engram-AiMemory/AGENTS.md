# AGENTS.md — Engram-AiMemory

**Generated:** 2026-03-02

## OVERVIEW

Python 3.11+ FastAPI + TypeScript npm workspaces. 3-tier vector memory system with Weaviate, Redis, and MCP integration.

## STRUCTURE

```
Engram-AiMemory/
├── packages/
│   ├── cli/              # Command-line interface
│   ├── mcp-server/       # MCP server (stdio/HTTP)
│   └── dashboard/        # Next.js dashboard UI
├── packages/core/
│   └── src/memory_system/
│       ├── api.py        # FastAPI entry (port 8000)
│       ├── system.py     # MemorySystem orchestrator
│       ├── embeddings.py # Multi-provider embeddings
│       ├── cache.py      # Redis caching layer
│       ├── rag.py        # RAG query pipeline
│       ├── auth.py       # JWT + API key auth
│       └── investigation/# Document ingestion
├── 01_devroot/           # Additional dev code
├── 02_data/              # Data storage
├── 04_branding/          # Marketing assets
└── 05_research/          # Research notes
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Memory operations | `packages/core/src/memory_system/system.py` |
| API endpoints | `packages/core/src/memory_system/api.py` |
| Embeddings | `packages/core/src/memory_system/embeddings.py` |
| Document crawling | `packages/core/src/memory_system/investigation/crawler.py` |
| MCP bridge | `packages/core/src/memory_system/mcp/` |

## CONVENTIONS

**Python (packages/core)**
- Line width: 100 chars
- Ruff rules: E,F,I,N,W,UP,B,C4,SIM
- MyPy: Relaxed (Phase 2 type-safety work in progress)
- Async tests: `asyncio_mode = "auto"`
- Coverage: 79.8% minimum

**TypeScript (packages/)**
- Line width: 100 chars
- Indent: 2 spaces
- Quotes: Double
- Trailing commas: ES5
- Linter: biome

## COMMANDS

```bash
# All tests
make test

# Python only
make test-python          # pytest with coverage

# TypeScript only
make test-ts              # vitest

# Lint everything
make lint                 # ruff + biome + mypy
make lint-fix             # Auto-fix

# Dev servers
make dev                  # Concurrent MCP + dashboard

# Docker
make docker-up
make docker-down
```

## ANTI-PATTERNS

1. **NEVER set `check_robots_txt=False`** in crawler.py — legal/ethical violation
2. **NEVER use 0.0.0.0 in production** — Tailscale only
3. Do NOT remove MCP bridge code — required for Claude integration
