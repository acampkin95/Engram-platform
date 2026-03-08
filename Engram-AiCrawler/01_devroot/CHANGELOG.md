# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased] — 2026-02-28

### Added (2026-02-28 — job_queue test coverage)
- `tests/test_job_queue_service.py` — 70 tests achieving **82% coverage** on `app/services/job_queue.py`
  - `OsintJob`: `to_dict()` / `from_dict()` round-trips, all defaults (priority, status, progress), auto-generated `job_id`, all `JobStatus` and `JobType` enum values
  - `JobStore` file fallback: save/load/list/delete, status filter, job_type filter, limit/offset pagination, corrupt-file resilience, missing-job returns `None`
  - `JobStore` Redis path: `setex`/`sadd` calls on save, Redis→file fallback on `get` miss, `smembers` on list, `delete`/`srem` on delete, file fallback on Redis error
  - `OsintJobQueue`: enqueue returns job_id, `get_job`, `cancel_job` (pending→CANCELLED, terminal→False, nonexistent→False), `list_jobs`, `queue_stats` keys
  - `_execute_job`: success (COMPLETED + result), no handler (FAILED + error message), handler exception (FAILED + traceback), `CancelledError` (CANCELLED)
  - `register_handler`: registers/overrides in `_HANDLERS` dict with state cleanup
  - `get_job_queue()`: singleton pattern, returns `OsintJobQueue` instance
  - `ensure_queue_started()`: starts queue when not running, idempotent when already running
  - `start()`/`stop()`: sets `_running`, initialises semaphore, clears workers; idempotent start
  - **Coverage: 82%** on `app/services/job_queue.py` (270 statements, 49 missed — uncovered: `_get_redis` real Redis init path, `wait_for_job`, `_worker` loop)

### Added (2026-02-28 — test coverage expansion)
- `tests/test_api_storage.py` — 24 tests achieving **100% coverage** on `app/api/storage.py`
  - All 6 endpoints covered: `POST /collections`, `GET /collections`, `DELETE /collections/{name}`, `POST /documents`, `POST /search`, `GET /collections/{name}/count`
  - Happy-path + `StorageError`→500 error paths; validation 422 for empty names, oversized names, empty doc lists, out-of-range `n_results`
  - Patches `app.api.storage.get_chromadb_client`; autouse fixtures for rate-limit disable and `_get_redis` AsyncMock
  - **Coverage: 100%** on `app/api/storage.py` (67 statements, 0 missed)
- `tests/test_api_cases.py` — 59 tests achieving **100% coverage** on `app/api/cases.py`
  - All 19 endpoints covered: CRUD (create/list/get/update/delete), subjects, evidence (add/remove), notes, link endpoints (scan/crawl/fraud-graph/image-intel), timeline, exports (json/csv-timeline/csv-evidence/html/text)
  - Happy-path + 404 not-found paths for every endpoint; 422 validation for title length, missing fields, risk_score range
  - Patches `app.api.cases.get_case_service`; note endpoint uses `svc.get` + `svc._write` pattern matching source implementation
  - **Coverage: 100%** on `app/api/cases.py` (188 statements, 0 missed)
- Fixed `.coveragerc` duplicate `[report]` section that was breaking `--cov` runs

### Added (2026-02-28)
- `tests/test_api_investigations.py` — 23 tests achieving **100% coverage** on `app/api/investigations.py`
  - All 7 endpoints covered: `POST /`, `GET /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/crawls/{crawl_id}`, `POST /{id}/scans/{scan_id}`
  - Happy-path + error paths: 201 create, 404 not found, 422 validation, filter params (status/priority/limit/offset), missing summary skip logic
  - Fixtures: rate-limit disabled, `_get_redis` mocked via `AsyncMock`; service patched at `app.api.investigations.get_investigation_service`
  - **Coverage: 100%** on `app/api/investigations.py` (53 statements, 0 missed)
- `tests/test_api_rag.py` — 26 tests achieving **100% coverage** on `app/api/rag.py`
  - All 5 endpoints covered: `GET /config`, `PUT /config`, `POST /preview-chunking`, `POST /process`, `GET /status/{job_id}`
  - Happy-path + error paths: 400 (no content), 404 (crawl/job not found), 422 (empty content, whitespace-only, no extractable content)
  - `POST /process` branches: raw_content path, crawl_result_id path (found/not-found/empty), extracted_content fallback
  - Fixtures: rate-limit disabled, `_get_redis` mocked via `AsyncMock`; service functions patched individually
  - **Coverage: 100%** on `app/api/rag.py` (47 statements, 0 missed)

### Added
- `tests/test_api_chat.py` — 27 tests achieving **88% coverage** on `app/api/chat.py`
  - All 4 endpoints covered: `POST /completions`, `GET /history/{id}`, `GET /sessions`, `POST /clear`
  - Happy-path + error paths: success response, session persistence, stream=True→500, LM Studio exception→500, error session store, empty choices, multi-turn messages
  - `autouse` fixtures: rate-limit disabled, `_chat_store._fallback` cleared, `manager.send_chat_update` mocked as `AsyncMock`, auth disabled, `_get_redis` mocked to return `None`
  - Root cause fix: `coverage.py` CTracer loses trace for async frames after `await` when `_get_redis()` internally catches a Redis connection exception; patching `_get_redis` to return `None` directly (via `AsyncMock`) bypasses the exception path and restores CTracer tracking
  - `httpx.AsyncClient` + `ASGITransport` wrapped in `asyncio.run()` for async endpoint bodies (no `@pytest.mark.asyncio`)
  - Integration test: POST completion → GET history → GET sessions → POST clear → verify empty
  - **Coverage: 88%** on `app/api/chat.py` (76 statements, 9 missed — auth-enabled branches not exercised)
- `tests/test_api_performance.py` — 52 tests achieving **100% coverage** on `app/api/performance.py`
  - All 17 endpoints covered: storage (stats, artifacts, lifecycle, promote, delete), cache (stats, invalidate), jobs (list, stats, get, enqueue, cancel), chroma (stats, health, prune), governor stats, aggregated health
  - Happy-path + error paths: 400 (invalid enum), 404 (not found), 409 (cannot cancel), 500 (exception), error-dict (never-raise endpoints)
- `tests/test_api_stats.py` — 29 tests achieving **98% coverage** on `app/api/stats.py`
  - All 3 endpoints covered: `GET /dashboard`, `GET /system`, `GET /scheduler`
  - Internal helpers covered: `_redis_status`, `_lm_studio_status`, `_scheduler_status`
  - Error paths: ChromaDB unavailable (falls back to 0), redis disconnected, LM Studio 500, scheduler exception
  - psutil None and psutil exception paths both covered (memory/disk → 0.0)
  - Sync ping (non-coroutine) path for redis covered
  - **Coverage: 98%** on `app/api/stats.py` (93 statements, 2 missed — ImportError branch for psutil)
- `tests/test_api_settings.py` — 36 tests achieving **100% coverage** on `app/api/settings.py`
  - All 3 endpoints covered: `GET /`, `PUT /`, `POST /test-connection`
  - Internal helpers covered: `_load_settings`, `_save_settings`, `_deep_merge`
  - Error paths: corrupt JSON file (falls back to defaults), 422 on invalid Pydantic type, 500 on save failure, httpx timeout, connection error
  - URL normalization (trailing slash stripped before appending /models) verified
  - Deep merge nested dict behaviour verified (partial update preserves other keys)
  - **Coverage: 100%** on `app/api/settings.py` (62 statements, 0 missed)
  - Aggregated `/health` endpoint: all 5 service sections tested including individual exception branches
  - `AsyncMock` for async service methods; `MagicMock` for sync methods
  - `autouse` fixture disabling rate limiting via `_rl_module._config.rate_limit_enabled = False`
  - **Coverage: 100%** on `app/api/performance.py` (223 statements, 0 missed)
- `tests/test_api_data.py` — 46 tests achieving **86% coverage** on `app/api/data.py`
  - All 13 endpoints covered: sets CRUD (create, list, get, migrate, update, delete), export, offload, stats, archive-rules CRUD
  - Happy-path + error paths: 404 (not found), threshold checks (offload below/above), notification assertions
  - `autouse` fixtures: rate-limit disabled, `data_sets` dict cleared, `manager.send_data_notification` mocked as `AsyncMock`, `ARCHIVE_RULES_DIR` patched to `tmp_path`
  - Discovered FastAPI 0.109 list query-param limitation (requires `Query()` annotation); tests assert actual behaviour
  - **Coverage: 86%** on `app/api/data.py` (195 statements, 27 missed — auth branches not exercised)
- `tests/test_api_threat_intel.py` — 45 tests covering all 12 endpoints in `app/api/osint/threat_intel.py`
  - Happy-path tests for every endpoint (WHOIS domain/dns/ip/asn, Shodan, VirusTotal, IP reputation, email breach/verify/reverse/bulk, provider status)
  - `OsintServiceError` path tested for every endpoint (returns `e.status_code`)
  - `ProviderRateLimitError` → 429 for: shodan, vt, email/breach, email/verify, email/reverse
  - `ProviderUnavailableError` → 503 for: shodan, vt, email/breach
  - Generic `Exception` → 500 for every endpoint
  - `GET /providers/status` patching `get_osint_settings()`
  - `autouse` fixture disabling rate limiting via `_rl_module._config.rate_limit_enabled = False`
  - **Coverage: 96%** on `app/api/osint/threat_intel.py` (158 statements, 6 missed — lazy-import lines)
- `tests/test_api_scheduler.py` — 53 tests achieving **100% coverage** on `app/api/scheduler.py`
  - All 7 endpoints covered: `POST /schedules`, `GET /schedules`, `GET /schedules/{id}`, `PUT /schedules/{id}`, `DELETE /schedules/{id}`, `POST /schedules/{id}/toggle`, `POST /schedules/{id}/run`
  - All helper functions covered: `_build_trigger` (all 6 frequencies + unsupported), `_execute_scheduled_crawl` (success + exception paths), `_get_next_run`, `_add_scheduler_job`, `_remove_scheduler_job`
  - Happy-path + error paths: 400 (custom without cron, job failure, reschedule failure, enable failure), 404 (all endpoints), 201/204 status codes
  - `autouse` fixture clearing `_schedules` dict between tests
  - `autouse` fixture mocking `get_scheduler` via `unittest.mock.patch`
  - **Production fix**: added `response_model=None` to `@router.delete` decorator for FastAPI 0.109.2 compatibility (DefaultPlaceholder truthy bug)
  - **Coverage: 100%** on `app/api/scheduler.py` (147 statements, 0 missed)

---

## [0.2.0] — January 2026

### Phase 1 — 10 Improvements (All Complete)
- CI/CD pipeline with GitHub Actions and production Docker Compose
- SSRF protection with DNS resolution validation and security headers middleware
- ChromaDB vector store integration with CRUD collections, document storage, semantic search
- OSINT alias discovery across 8 platforms
- OSINT image search with perceptual hashing and EXIF metadata extraction
- Redis caching layer with fail-open pattern
- Error handling hierarchy with custom exceptions, tenacity retry decorators, circuit breaker
- Model review pipeline with keep/derank/archive decisions
- Integration tests covering crawl→cache, LM cache, alias discovery, ChromaDB, model review workflows
- Knowledge graph API with LM Studio entity/relationship extraction and ChromaDB storage

### Phase 2 — Pipeline & Frontend (All Complete)
- End-to-end OSINT scan orchestrator (5-stage pipeline)
- WebSocket events for OSINT scans, knowledge graphs, and review updates
- OSINT scan API endpoints (background async + synchronous modes)
- React frontend pages: OSINT Dashboard, Storage management, Knowledge Graph viewer
- Full test suite: 114 tests passing

---

## [0.1.0] — January 2026

### Added
- Initial release of Crawl4AI OSINT Container
- FastAPI backend with WebSocket support
- LM Studio integration for AI-powered crawling
- Docker multi-stage build with supervisord
- Comprehensive test suite
- Code quality tools (Ruff, MyPy, Pre-commit)
- Data lifecycle management (hot/warm/cold/archive tiers)
- Watchdog service for monitoring
- React + Vite frontend foundation
- Configurable crawling strategies
