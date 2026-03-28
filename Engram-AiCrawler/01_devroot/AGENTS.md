<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# 01_devroot

## Purpose

Root directory for the Engram-AiCrawler FastAPI backend and React frontend. Contains the development setup, supervisord configuration, and main application structure.

## Key Files

| File | Description |
|------|-------------|
| `main.py` | Launcher script for supervisord (starts all services) |
| `run_tests.py` | Test runner for the entire project |
| `supervisord.conf` | Supervisord process manager config (FastAPI, watchdog, LM bridge) |
| `requirements.txt` | Python dependencies for backend |
| `Dockerfile` | Container image for FastAPI backend |
| `docker-compose.yml` | Local development compose (crawler-redis, memory-api, FastAPI) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `app/` | FastAPI application (main logic) |
| `frontend/` | React 18 UI (Vite + vitest) |
| `cli/` | CLI tool entry point (c4ai command) |
| `tests/` | Python unit and integration tests |
| `data/` | Data files (supervisord configs, SQL schema) |
| `scripts/` | Helper scripts (deployment, setup) |
| `addons/` | Crawl4AI addon modules |
| `nginx/` | Nginx reverse proxy configuration |

## For AI Agents

### Working In This Directory

1. **Backend work**: All Python code lives in `app/` and `tests/`. Import paths use `from app.X import Y`.
2. **Frontend work**: React code is in `frontend/src/`. Run `cd frontend && npm run dev` for HMR.
3. **Process management**: Use supervisord for local dev (see `supervisord.conf`). Don't manually spawn processes.
4. **Testing**: Run `python run_tests.py` or `pytest tests/ -v` from this directory.

### Testing Requirements

- Python tests: `pytest tests/ -v` (must pass before committing)
- Frontend tests: `cd frontend && npm run test` (vitest in watch mode)
- Lint: `ruff check app/` (E,F,W,C90,UP rules)
- Type check: `mypy app/` (strict_optional=true)

### Common Patterns

- **Async/await**: All I/O uses `async` (see `CrawlOrchestrator`, `AliasDiscoveryService`)
- **LM Studio bridge**: Use `LMStudioBridge` for AI model inference
- **Redis caching**: Use `CacheLayer.get_or_compute()` for cache-aside with stampede prevention
- **FastAPI routes**: Register in `app/api/*.py` and include in `app/main.py`

## Dependencies

### Internal
- `app/` — FastAPI business logic
- `frontend/` — React UI
- `tests/` — Test suite

### External
- FastAPI 0.104+
- Crawl4AI (Chromium-based web crawler)
- LM Studio (local LLM inference)
- Redis (caching layer)
- Supervisord (process management)

<!-- MANUAL: -->
