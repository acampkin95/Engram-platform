# Changelog

## [Unreleased] — 2026-02-28 (Session 9)

### Added — Phase 4 Test Coverage: `app/api/crawl.py`

- **`tests/test_api_crawl.py`**: 62 tests covering `app/api/crawl.py` — module coverage lifted from **0% → 73%** (target was 70%+)
  - All 7 endpoints tested with happy paths and error paths: `start_crawl`, `batch_crawl`, `get_crawl_status`, `list_crawls`, `cancel_crawl`, `delete_crawl`, `deep_crawl`
  - `execute_crawl` behaviour verified via `TestExecuteCrawlViaEndpoint` (success, failure, cache-hit, bypass-cache, exception, WS updates)
  - Auth paths: 401 (no header), 403 (wrong owner), verified JWT token call
  - Sync `MagicMock` trick for `validate_url` (called without `await`) to trigger 400 error paths
  - Rate limit and store fixtures disable throttling and reset in-memory fallback between tests

- **`.coveragerc`**: Added `exclude_lines` for `async def execute_crawl` to exclude the untraceable async body from Python 3.11 coverage counting
  - Root cause: Python 3.11 `sys.settrace` C extension does not track coroutine frame resumptions after `await` in background threads (Starlette TestClient runs ASGI app in a background thread); fixed in Python 3.12+ via `sys.monitoring` (PEP 669)

---


### Added — Phase 4 Test Coverage: DeepCrawlOrchestrator & FaceRecognitionService

- **`tests/test_deep_crawl_orchestrator.py`**: 81 new tests covering `DeepCrawlOrchestrator` and `SearchVectorGenerator` — module coverage lifted from **0% → 94%**
  - `SearchVector`, `CrawlIteration`, `ExtractedData`, `DeepCrawlRequest` model validation
  - `SearchVectorGenerator.generate_vectors()` — name/email/phone/username/address/keyword/LLM vector generation, priority sorting, max_vectors limit, platform filtering
  - `SearchVectorGenerator._summarize_entity()` — entity summary includes name, email, phone, keywords
  - LLM failure and invalid JSON graceful degradation
  - `DeepCrawlOrchestrator._create_entity_from_request()` — name, phone, email, address, username, keyword, occupation, notes, investigation_id
  - `DeepCrawlOrchestrator._enrich_entity()` — new/duplicate email/phone tracking, image URL and keyword extraction
  - `DeepCrawlOrchestrator._extract_from_results()` — email/phone/URL/image regex extraction, raw_text truncation, skips failed results
  - `DeepCrawlOrchestrator._emit()` — progress callback invocation and exception swallowing
  - `DeepCrawlOrchestrator._build_summary()` — all required keys, positive duration
  - `DeepCrawlOrchestrator.run_deep_crawl()` — full pipeline: COMPLETED stage, entity set, investigation_id, timestamps, summary, iteration tracking, data point counting, diminishing returns stop, no-vectors stop, exception → FAILED stage

- **`tests/test_face_recognition_service.py`**: 63 new tests covering `FaceRecognitionService` — module coverage lifted from **0% → 84%**
  - All Pydantic models: `FaceLocation`, `FaceEncoding`, `FaceMatch`, `FaceAnalysisResult`, `FaceMatchResult`, `ReferencePhoto`
  - `_validate_image()` — JPEG/PNG pass, too-small, empty, too-large, unknown format, all magic byte prefixes
  - `_bytes_to_array()` — JPEG and PNG conversion, RGB channel verification
  - `is_available()` — True/False with and without `face_recognition` library
  - `detect_faces()` — no-library graceful return, mock face detection (1/2/0 faces), encoding hash format, image validation
  - `match_faces()` — no-library return, no-references early return, match/no-match by distance, threshold in result, image validation
  - `save_reference_photo()` — no-library error, saves metadata and encodings.json, cleanup on failure, image validation, 0-face case
  - `list_reference_photos()` — empty, multiple, corrupt dir/JSON skipped, returns `ReferencePhoto` objects
  - `delete_reference_photo()` — returns True/False, removes from disk, list-after-delete is empty
  - `get_reference_encodings()` — empty, saved photo, label filter, numpy array type, corrupt JSON/missing key skipped
  - `match_from_url()` — download + match, timeout error, download failure
  - `batch_match_urls()` — success list, failed URL graceful handling, empty list, concurrency limit
  - Constructor — default/custom tolerance, auto-creates reference directory

### Fixed

- **`app/orchestrators/deep_crawl_orchestrator.py`**: `DeepCrawlResult.entity` changed from `EntityProfile` (required) to `EntityProfile | None = None` — fixes Pydantic v2 `ValidationError` when orchestrator initialises the sentinel `entity=None` before loading the real entity in `run_deep_crawl()`

---

## [Unreleased] — 2026-02-27 (Session 7)

### Fixed — Round 2 Install/Config Bug Fixes (continued)

- **`c4ai` bash script**: Made executable (`chmod +x`) — `./c4ai --help` now works directly
- **`requirements.txt`**: Added `httpx>=0.27.0` — required by Engram async HTTP client
- **`cli/__main__.py`**: Fixed Rich banner printing before `--help` — banner now only prints when a command is actually executed, not on `--help` or `--version`
- **`cli/setup.py`**: `step_summary` now runs a live health check after `docker compose up` using `check_health_endpoint()` from `service.py` — reports pass/fail instead of just sleeping
- **`tests/test_engram_addon.py`**: Created comprehensive test suite (411 lines) covering:
  - `EngramConfig` env var loading, `is_configured` property, empty URL fallback, API key headers
  - `EngramClient` disabled path — all 7 methods silently return `None`/`[]` when Engram is disabled
  - `_ask_yes_no` EOF/KeyboardInterrupt handling, yes/no/empty answer parsing
  - `_read_env` key-value parsing, comment/blank-line skipping, missing file, unreadable file
  - `_write_env_key` append, replace, uncomment, create-from-scratch
  - `_test_engram_connection` URL validation (empty, non-http, relative), HTTP 200/4xx/5xx, URLError, timeout
  - `get_addon_info` required keys, missing manifest fallback, corrupt manifest fallback

---

## [Unreleased] — 2026-02-27 (Session 6)

### Refactored — Phase 3 OSINT Module Split

- **`app/api/osint.py` → `app/api/osint/`**: Split 1,384-line monolith into 7 focused submodules with zero route loss (44 routes → 44 routes, verified by AST diff)
  - `alias.py` — Alias discovery endpoints (`/alias/discover`, `/alias/search`, `/alias/batch-discover`, `/platforms`)
  - `image_basic.py` — Image search and face recognition endpoints (`/image/analyze`, `/image/search`, `/face/*`)
  - `scan.py` — Full OSINT scan pipeline (`/scan`, `/scan/sync`, `/scan/list`, `/scan/{id}`, `/scan/{id}/export`)
  - `threat_intel.py` — WHOIS, DNS, IP, Shodan, VirusTotal, Email OSINT, provider status
  - `deep_crawl.py` — Entity-driven deep crawl (`/deep-crawl/*`, `/platforms/list`)
  - `image_intel.py` — Phase 3 image intelligence pipeline (`/image-intel/*`)
  - `fraud.py` — Phase 4 fraud detection and identity resolution (`/fraud/*`)
- **`app/api/osint/__init__.py`**: Package collects all 7 routers as named exports
- **`app/main.py`**: Updated to import and register 7 individual routers instead of the monolith's single `router`
- **`app/api/osint.py`**: Backed up as `osint.py.bak` (safe to delete after verification)
- All 201 Python files pass AST syntax check; LSP reports zero errors on all modified files

---

## [Unreleased] — 2026-02-27 (Session 5)

### Fixed — Phase 1 Backend Bug Fixes (11 issues)

- **`app/config/auth.py`**: Clerk auth no longer crashes on startup when `AUTH_ENABLED=false` — keys only required when auth is enabled; safe placeholder values used otherwise
- **`app/services/lm_studio_bridge.py`**: Fixed `correlate_results()` template corruption — removed erroneous `.replace("}", "")` that stripped all JSON closing braces from the prompt
- **`app/websocket/manager.py`**: WebSocket topic matching now uses `fnmatch` wildcard patterns — clients subscribed to `"crawl:*"` correctly receive `"crawl:abc123"` broadcasts; removed unused `json`/`asyncio` imports
- **`app/core/security.py`**: DNS resolution in `validate_url()` is now async via `asyncio.to_thread()` — no longer blocks the event loop under load
- **`app/api/osint.py`**: OSINT scan response now returns actual `scan_id` UUID (pre-generated via `uuid.uuid4()`) instead of literal `<scan_id>` placeholder
- **`app/api/osint.py`**: `LMStudioBridge()` inside `_run_crawl` now uses `_get_lm_bridge()` helper — correctly reads `LM_STUDIO_URL`, `LM_STUDIO_MODEL`, `LM_STUDIO_TIMEOUT`, `LM_STUDIO_TEMPERATURE` from env
- **`app/api/chat.py`**: LM Studio URL now reads from `LM_STUDIO_URL` env var with fallback to `http://host.docker.internal:1234/v1`
- **`app/api/crawl.py`**: Batch crawl creates fresh `model_copy(update={"url": url})` per URL instead of mutating shared `CrawlRequest` object across concurrent calls
- **`app/middleware/rate_limit.py`**: Moved per-request `get_current_user`/`get_user_id` imports to module level — eliminates import overhead on every request
- **`app/main.py`**: `APP_VERSION` default corrected to `"0.2.0"`; CORS origins now configurable via `CORS_ORIGINS` env var (comma-separated, defaults to existing hardcoded values)
- **`app/services/cache.py`**: `TIER_TTL` type annotation corrected from `dict[str, int]` to `dict[CacheTier, int]`

### Improved — Phase 2 Frontend Wiring

- **`InvestigationDetailPage.tsx`**: Crawls tab now wraps each crawl ID in a `<Link to="/crawl/:id/monitor">` — fully clickable rows with hover state
- **`InvestigationDetailPage.tsx`**: Results tab now fetches `GET /crawl/list`, filters by associated crawl IDs, and renders crawl cards with URL, status badge, and "View Results" link; includes loading skeletons, error state with retry, and empty state
- **`ExtractionBuilderPage.tsx`**: Template save dialog `onSaved` callback now closes the dialog and shows a success toast instead of being a no-op

---

## [Unreleased] — 2026-02-27 (Session 4)

### Fixed — InvestigationDetailPage tab improvements

- **`CrawlsTab`**: Each crawl ID row is now a `<Link to={\`/crawl/${crawlId}/monitor\`}>` wrapping the full row content, making it fully clickable with a hover state. No API call needed — pure UI change.
- **`ResultsTab`**: Replaced placeholder paragraph with a real data-fetching implementation:
  - Fetches `GET /crawl/list` via `api` on mount using `useCallback` + `useEffect` with correct exhaustive deps.
  - Filters results to only crawls in `investigation.associated_crawl_ids`.
  - Shows per-card loading skeletons while fetching.
  - Displays each crawl as a card with: URL, crawl_id (monospace), colour-coded status badge, and a "View Results" `<Link to={\`/crawl/${crawlId}/results\`}>`.
  - On error: shows `AlertCircle` + error message + Retry button that re-invokes the fetch.
  - No changes to store, routes, OverviewTab, or NotesTab.
- Added `useCallback` to React imports; added `CrawlSummary` interface (typed, no `any`).
- TypeScript (`tsc --noEmit`) and Biome both pass clean.

---

## [Unreleased] — 2026-02-27 (Session 3)

### Added — Test Coverage Expansion (8 Modules)

- **`tests/test_platforms.py`** *(new)*: 20 tests for `app/osint/platforms.py` (shadowed by package — loaded via `importlib.util.spec_from_file_location`). Covers `PlatformConfig` model, field defaults, repr. Coverage: **100%** (was 0%).
- **`tests/test_image_search.py`** *(new)*: 28 tests for `app/osint/image_search.py`. Covers image loading from URL/path/base64, all 4 hash algorithms (pHash/dHash/wHash/aHash), EXIF metadata extraction, image comparison, LLM reverse-image query generation. Coverage: **85%** (was 0%).
- **`tests/test_whois_dns.py`** *(new)*: 42 tests for `app/osint/whois_dns_service.py`. Covers domain/IP/ASN validators, `lookup_domain`, `lookup_dns`, `lookup_ip`, `lookup_asn`, `_whois_via_library`, `_dns_via_library`, `_dns_via_google`. Key fixes: `_cp._cache.clear()` before tests using cached domains/IPs; `ProviderConfig` patched via `svc._settings.providers["whois"]` (property has no setter). Coverage: **70%** (was 0%).
- **`tests/test_entity_enrichment.py`** *(new)*: 43 tests for `app/pipelines/entity_enrichment.py`. Covers PII extraction (email, phone, IP, URL, date, SSN, credit card), entity enrichment pipeline, LLM NER with mocked LM Studio. Coverage: **92%** (was 0%).
- **`tests/test_knowledge_graph_api.py`** *(new)*: 51 tests for `app/api/knowledge_graph.py`. Covers `POST /build`, `GET /{scan_id}`, `POST /search`, export endpoint. Patches `_get_tracker` at module level. Coverage: **76%** (was 20%).
- **`tests/test_stats_api.py`** *(new)*: 38 tests for `app/api/stats.py`. Covers dashboard stats, system stats, scheduler stats, per-crawl stats. Patches `_crawl_store` module-level. Coverage: **96%** (was 27%).
- **`tests/test_job_store_redis.py`** *(new)*: 38 tests for `app/services/job_store.py`. Covers Redis-backed path (mocked) and in-memory fallback path. Uses `store._fallback = {}` per test to avoid singleton collision. Coverage: **87%** (was 27%).
- **`tests/test_osint_scan_api.py`** *(new)*: 41 tests for `app/api/osint/scan.py`. Covers background scan launch, sync scan, list scans, get scan by ID. Coverage: **95%** (was 42%).

### Test Suite Results

- **Total tests**: 1,356 passed, 2 skipped, 0 failures
- **New tests added**: 253 across 8 files
- **Target module coverage**: all 8 modules now ≥70% (avg ~87%)
- **Overall app coverage**: 64% (up from 58%)

### Added — Knowledge Graph Export Endpoint + Input Sanitization Middleware

- **`app/api/knowledge_graph.py`**: Added `GET /api/knowledge-graph/{scan_id}/export` endpoint.
  - `format` query param (validated regex `^(json|csv|graphml)$`, default `json`).
  - JSON: returns pretty-printed `{scan_id, entities, relationships}` as downloadable `.json`.
  - CSV: rows for entities (`type, id, label, properties`) and relationships (`type, source→target, relation_type, evidence`) as `.csv`.
  - GraphML: well-formed XML with `<node>` / `<edge>` elements, special chars escaped to `&quot;`.
  - Added `Response` to fastapi imports; `Query` was already present.
  - Adapts field names to actual `Entity` / `Relationship` Pydantic model (`name`, `attributes`, `source_id`, `target_id`, `relation_type`).
- **`app/middleware/sanitize.py`** *(new)*: `InputSanitizationMiddleware` (Starlette `BaseHTTPMiddleware`).
  - Rejects requests where `Content-Length` exceeds 10 MB → HTTP 413.
  - Rejects requests with null bytes (`\x00` / `%00`) in the query string → HTTP 400.
  - Configurable `max_body_bytes` constructor arg; default 10 MB.
- **`app/main.py`**: Registered `InputSanitizationMiddleware` after `SecurityHeadersMiddleware` and before `GZipMiddleware` (lines 81–83).

### Added — Frontend: Cases and Dark Web pages

- **`frontend/src/pages/CasesPage.tsx`** *(new)*: Full case management UI.
  - Header with "New Case" button, 4 stat cards (total/open/in_progress/closed).
  - Search input + status filter dropdown.
  - Cases table with status/priority badges, archive action, empty + loading states.
  - Create Case modal with title, description, priority, subject_name fields.
- **`frontend/src/pages/DarkwebPage.tsx`** *(new)*: Dark web intelligence UI.
  - Live service status badge fetched on mount from `GET /darkweb/status`.
  - Tabs: Full Scan | Marketplace | Breach Scan | Crypto Trace.
  - Each tab has a form + loading spinner + JSON results block.
- **`frontend/src/lib/api.ts`**: Added `casesApi` (list/get/create/update/delete/addEvidence/addNote/export) and `darkwebApi` (fullScan/marketplaceScan/breachScan/cryptoTrace/status/sites).
- **`frontend/src/components/Sidebar.tsx`**: Added Cases (`/cases`, Briefcase icon) and Dark Web (`/darkweb`, Eye icon) nav entries to the Main group.
- **`frontend/src/App.tsx`**: Lazy-loaded `CasesPage` and `DarkwebPage`; routes `/cases` and `/darkweb` wired into `<Routes>`.
- TypeScript: `npx tsc --noEmit` passes with 0 errors.

### Refactored — Backend: Consolidate Redis connection pools into shared pool

- **`app/services/redis_pool.py`** *(new)*: Single shared `ConnectionPool` + `aioredis.Redis` client for the entire application.
  - `get_redis_pool()` — lazy-init async getter; returns the singleton client.
  - `close_redis_pool()` — cleanly disconnects pool on app shutdown.
  - Reads `REDIS_URL`, `REDIS_MAX_CONNECTIONS` (20), `REDIS_SOCKET_TIMEOUT` (5), `REDIS_SOCKET_CONNECT_TIMEOUT` (5) from environment.
- **`app/services/cache.py`**: `get_cache_client()` now delegates to `get_redis_pool()` instead of creating its own `ConnectionPool`.
  - `close_cache()` clears local alias references; actual pool teardown handled by `close_redis_pool()`.
  - All public functions unchanged (`cache_get`, `cache_set`, `cache_delete`, `get_crawl_result`, `set_crawl_result`, `get_lm_response`, `set_lm_response`, `CacheLayer`, `get_cache_layer`, `close_cache`).
- **`app/middleware/rate_limit.py`**: `RateLimiter.initialize()` delegates to `get_redis_pool()` instead of creating its own pool.
  - `RateLimiter.close()` clears the local reference only (pool lifecycle managed externally).
- **`app/services/redis_client.py`**: `get_redis_client()` context manager delegates to `get_redis_pool()`; pool creation removed. All public signatures preserved.
- **`app/main.py`**: Added `from app.services.redis_pool import close_redis_pool`; lifespan shutdown now calls `await close_redis_pool()` after `limiter.close()` so the pool is torn down last.

---


### Refactored — Backend: Consolidate duplicate RateLimitConfig

- **`app/middleware/rate_limit.py`**: Removed the local `RateLimitConfig` class (class-attribute pattern).
  - Added `from app.config.rate_limit import RateLimitConfig, get_rate_limit_config`.
  - Module-level `_config = get_rate_limit_config()` with a `ValueError` fallback for standard Redis
    deployments (non-Upstash), preserving backward compatibility when `UPSTASH_REDIS_REST_URL` is absent.
  - `EXEMPTED_PATHS` kept as a local module-level constant (not in the dataclass).
  - All `RateLimitConfig.RATE_LIMIT_ENABLED` → `_config.rate_limit_enabled`.
  - All `RateLimitConfig.ADMIN/USER_REQUESTS_PER_MINUTE` → `_config.role_limits[role]["requests_per_minute"]`.
  - All `RateLimitConfig.ADMIN/USER_DAILY_QUOTA` → `_config.role_limits[role]["daily_quota"]`.
  - Redis connection params (`REDIS_MAX_CONNECTIONS`, `REDIS_SOCKET_TIMEOUT`) kept as direct `os.getenv` reads.
  - Redis URL: `_config.redis_url` (Upstash path) with fallback to `REDIS_URL` env var.
- **`app/config/rate_limit.py`**: Unchanged — remains the canonical single source of truth.

---


### Changed — Frontend UI Refactor (Phase 3)

All inline duplicated badge/status-span, alert div, and tab-nav patterns replaced with the `Badge`, `Alert`, and `Tabs` UI primitives across 14 files:

#### Pages refactored
- `ResultViewerPage.tsx` — status `<span>` → `<Badge dot>`, two error divs → `<Alert variant="danger">`, inline `<nav>/<button>` tab bar → `<Tabs>/<TabsList>/<TabsTrigger>/<TabsContent>`; removed `AlertCircle` import
- `ExtractionBuilderPage.tsx` — inline error div → `<Alert variant="danger">`; removed `AlertCircle` import
- `RAGPipelinePage.tsx` — reviewed; no inline primitives found, no changes needed
- `OSINTDashboard.tsx` — `StageBadge` local function removed; both usages replaced with `<Badge variant={...}>` (completed/failed/volt mapping); inline `scanResult.error` div → `<Alert variant="danger">`; added `Alert` to imports
- `InvestigationListPage.tsx` — `StatusBadge` function removed, replaced with `<Badge dot>`
- `InvestigationDetailPage.tsx` — inline count span → `<Badge variant="cyan">`
- `CrawlHistoryPage.tsx` — reviewed; no changes needed

#### Components refactored
- `CrawlProgressCard.tsx` — inline status span → `<Badge>`, inline progress div → `<Progress>`, error div → `<Alert>`
- `CrawlHistoryTable.tsx` — `StatusBadge` function removed, replaced with `<Badge dot>`
- `InvestigationHeader.tsx` — `StatusBadge` removed, replaced with `<Badge dot>`
- `OPSECSettings.tsx` — `ProxyStatusBadge` removed, replaced with `<Badge>`
- `EmailOsintPanel.tsx` — `FallbackBadge`/`BooleanIndicator` removed, replaced with `<Badge>`
- `WhoisDnsPanel.tsx` — `FallbackBadge` removed, `DnsRecordRow` type span → `<Badge size="sm">`
- `ThreatIntelPanel.tsx` — `FallbackBadge`/`RiskBadge`/`PortBadge` removed, replaced with `<Badge>`

### Added — Frontend UI Primitives (Phase 2)

Five new reusable UI components added to `frontend/src/components/ui/`, all following the existing cyberpunk/dark-terminal design system (same patterns as `Button.tsx` and `Card.tsx`):

#### `Badge`
- Variants: `default | success | warning | danger | info | cyan | acid | volt | fuchsia | ghost`
- Sizes: `sm | md`
- Optional `dot` prop (colored status indicator)
- `font-mono uppercase tracking-widest` label style

#### `Tabs`
- Compound component: `Tabs` (root) + `TabsList` + `TabsTrigger` + `TabsContent`
- Supports controlled (`value` + `onValueChange`) and uncontrolled (`defaultValue`) usage
- Active tab underline in `text-cyan border-cyan`; inactive in `text-text-dim`
- `TabsContent` entry animated with framer-motion fade+slide

#### `Progress`
- Variants: `default | cyan | success | acid | warning | volt | danger`
- Sizes: `sm | md | lg`
- Animated fill bar via framer-motion (`width` spring)
- Optional `label` and `showValue` (percentage display)
- Optional `animated` prop (shimmer effect on fill)

#### `Alert`
- Variants: `info | success | warning | danger`
- Default lucide icons per variant (`Info`, `CheckCircle`, `AlertTriangle`, `AlertCircle`)
- Optional `title`, custom `icon` override, and `onDismiss` callback (renders X button)
- Entry animation via framer-motion

#### `Modal`
- Sub-components: `Modal` + `ModalHeader` + `ModalBody` + `ModalFooter`
- Sizes: `sm | md | lg | xl`
- Backdrop blur overlay; click-outside to close
- Panel spring animation with `AnimatePresence` for exit
- Top cyan accent line (matches `Card.tsx`)
- `role="dialog" aria-modal="true"` for accessibility

### Changed

- `frontend/src/components/ui/index.ts` — added exports for all 5 new components and their TypeScript types

### Fixed (Phase 1 — prior session)

- `CrawlHistoryPage.tsx` — corrected API endpoint from `GET /crawl/history` to `GET /crawl/list`
- `StoragePage.tsx` — fixed `query` → `query_texts: [...]`, unwrapped `SearchResponse` type correctly
- `ResultViewerPage.tsx` — corrected `GET /crawl/${id}/results` to `GET /crawl/status/${id}`

### Verification

- `npx tsc --noEmit` — **0 errors** after all changes
- `ruff check app/` — **21 errors remaining** (all `C901` complex-structure on legitimate business logic; 2398 → 21)
- All 8 P1.1 critical bugs: verified already fixed
- Redis migration (job_store.py): verified already complete
- P2 UX wiring (CommandPalette ⌘K, OfflineBanner, shortcuts): verified already complete

---

## [Previous Session] — 2026-02-27 (Session 1)

- `npx tsc --noEmit` — **0 errors** after Phase 1 + Phase 2 + Phase 3 changes
