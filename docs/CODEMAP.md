# Engram Monorepo - Comprehensive Code Map

**Generated:** 2026-03-17  
**Total Source Files:** 328 (excluding node_modules, dist, __pycache__)

---

## 1. ENGRAM-AIMEMORY (Python FastAPI + TypeScript MCP Bridge)

### Overview
- **Type:** Python FastAPI backend + TypeScript MCP client bridge
- **Purpose:** Vector memory system with Weaviate, Redis caching, investigation workflows
- **Entry Point:** `packages/core/src/memory_system/api.py` (1,884 LOC)
- **Total Source Files:** 40 Python + 6 TypeScript

### Directory Structure

```
Engram-AiMemory/
├── packages/core/src/memory_system/          # Core memory system (40 files)
│   ├── api.py                                # FastAPI app (1,884 LOC) ⭐ ENTRY POINT
│   ├── system.py                             # Memory orchestration (1,349 LOC)
│   ├── client.py                             # Weaviate client (1,312 LOC)
│   ├── workers.py                            # Background workers (928 LOC)
│   ├── memory.py                             # Memory models (321 LOC)
│   ├── auth.py                               # JWT/API key auth
│   ├── cache.py                              # Redis caching layer
│   ├── config.py                             # Configuration management
│   ├── context.py                            # Context building
│   ├── embeddings.py                         # Embedding providers
│   ├── analyzer.py                           # Memory analysis
│   ├── credibility.py                        # Credibility scoring
│   ├── decay.py                              # Relevance decay algorithm
│   ├── contradiction.py                      # Contradiction detection
│   ├── temporal.py                           # Temporal reasoning
│   ├── propagation.py                        # Memory propagation
│   ├── rag.py                                # RAG pipeline
│   ├── ai_provider.py                        # AI provider abstraction
│   ├── ollama_client.py                      # Ollama integration
│   ├── compat.py                             # Compatibility layer
│   ├── investigation_router.py                # Investigation routing
│   ├── update_weaviate_schema.py             # Schema management
│   ├── investigation/                        # Investigation subsystem (11 files)
│   │   ├── ingestor.py                       # Document ingestion
│   │   ├── models.py                         # Investigation models
│   │   ├── evidence_client.py                # Evidence management
│   │   ├── matter_client.py                  # Matter/case management
│   │   ├── crawler.py                        # Crawler integration
│   │   ├── crawler_service.py                # Crawler service
│   │   ├── workers.py                        # Investigation workers
│   │   ├── workers_service.py                # Worker orchestration
│   │   ├── registry_client.py                # Registry client
│   │   └── schemas.py                        # Pydantic schemas
│   ├── mcp/                                  # MCP bridge (6 files)
│   │   ├── __main__.py                       # MCP entry point
│   │   ├── bridge.py                         # MCP bridge logic
│   │   ├── client.py                         # MCP client
│   │   ├── config.py                         # MCP config
│   │   ├── models.py                         # MCP models
│   │   └── __init__.py
│   ├── prompts/                              # LLM prompts (5 files)
│   │   ├── consolidation.txt
│   │   ├── contradiction_detection.txt
│   │   ├── entity_extraction.txt
│   │   ├── importance_scoring.txt
│   │   └── summarization.txt
│   └── __init__.py
├── packages/core/tests/                      # Test suite (29 files)
│   ├── conftest.py                           # Pytest fixtures
│   ├── test_api_integration.py
│   ├── test_memory_system.py
│   ├── test_client.py
│   ├── test_system.py
│   ├── test_workers.py
│   ├── test_auth.py
│   ├── test_cache.py
│   ├── test_embeddings.py
│   ├── test_credibility.py
│   ├── test_analyzer.py
│   ├── test_analytics_endpoints.py
│   ├── test_context.py
│   ├── test_context_builder.py
│   ├── test_context_fixed.py
│   ├── test_decay_ext.py
│   ├── test_memory.py
│   ├── test_rag.py
│   ├── test_config.py
│   ├── test_weaviate_unit.py
│   ├── test_weaviate_live.py
│   ├── test_weaviate_performance.py
│   ├── test_weaviate_stability.py
│   └── investigation/                       # Investigation tests (5 files)
│       ├── test_ingestor.py
│       ├── test_models.py
│       ├── test_crawler.py
│       ├── test_workers.py
│       └── test_e2e.py
├── pyproject.toml                            # Python dependencies
├── pytest.ini                                # Pytest configuration
└── package.json                              # Node.js dependencies (MCP bridge)
```

### Key Entry Points

| File | LOC | Purpose |
|------|-----|---------|
| `api.py` | 1,884 | FastAPI application, REST endpoints |
| `system.py` | 1,349 | Memory system orchestration |
| `client.py` | 1,312 | Weaviate vector DB client |
| `workers.py` | 928 | Background job processing |
| `mcp/__main__.py` | — | MCP server entry point |

### Configuration Files

- **pyproject.toml** — Python dependencies, build config
- **pytest.ini** — Test runner configuration
- **package.json** — Node.js dependencies for MCP bridge

### Test Coverage

- **29 Python test files** in `packages/core/tests/`
- **Target:** 95% (currently baseline refresh needed per AGENTS.md)
- **Test runner:** pytest
- **Coverage config:** `.coveragerc` (80% minimum)

---

## 2. ENGRAM-AICRAWLER (Python FastAPI + React Frontend)

### Overview
- **Type:** Python FastAPI backend + React 18 frontend
- **Purpose:** OSINT platform with web crawling, dark web monitoring, threat intelligence
- **Entry Point:** `01_devroot/app/main.py` (322 LOC)
- **Total Source Files:** 104 Python + 50+ TypeScript/React

### Directory Structure

```
Engram-AiCrawler/
├── 01_devroot/app/                           # FastAPI application (104 files)
│   ├── main.py                               # FastAPI entry point (322 LOC) ⭐
│   ├── __init__.py
│   ├── api/                                  # API endpoints (24 files)
│   │   ├── crawl.py                          # Web crawling endpoints
│   │   ├── osint/                            # OSINT endpoints (8 files)
│   │   │   ├── alias.py                      # Alias discovery
│   │   │   ├── deep_crawl.py                 # Deep crawling
│   │   │   ├── fraud.py                      # Fraud detection
│   │   │   ├── image_basic.py                # Image OSINT
│   │   │   ├── image_intel.py                # Image intelligence
│   │   │   ├── scan.py                       # OSINT scanning
│   │   │   ├── threat_intel.py               # Threat intelligence
│   │   │   └── __init__.py
│   │   ├── cases.py                          # Case management
│   │   ├── chat.py                           # Chat endpoints
│   │   ├── darkweb.py                        # Dark web endpoints
│   │   ├── data.py                           # Data endpoints
│   │   ├── extraction.py                     # Data extraction
│   │   ├── investigations.py                 # Investigation endpoints
│   │   ├── knowledge_graph.py                # Knowledge graph
│   │   ├── rag.py                            # RAG endpoints
│   │   ├── scheduler.py                      # Job scheduling
│   │   ├── settings.py                       # Settings endpoints
│   │   ├── stats.py                          # Statistics
│   │   ├── storage.py                        # Storage management
│   │   ├── performance.py                    # Performance metrics
│   │   └── __init__.py
│   ├── osint/                                # OSINT modules (20+ files)
│   │   ├── alias_discovery.py                # Alias discovery service
│   │   ├── email_osint_service.py            # Email OSINT
│   │   ├── image_intelligence.py             # Image analysis
│   │   ├── image_search.py                   # Image search
│   │   ├── platform_crawler.py               # Platform crawling
│   │   ├── semantic_tracker.py               # Semantic tracking
│   │   ├── threat_intel_service.py           # Threat intelligence
│   │   ├── whois_dns_service.py              # WHOIS/DNS lookup
│   │   ├── face_recognition_service.py       # Face recognition
│   │   ├── darkweb/                          # Dark web modules (5 files)
│   │   │   ├── breach_scanner.py             # Breach scanning
│   │   │   ├── crypto_tracer.py              # Crypto tracing
│   │   │   ├── entity_correlator.py          # Entity correlation
│   │   │   ├── marketplace_monitor.py        # Marketplace monitoring
│   │   │   ├── tor_crawler.py                # Tor crawling
│   │   │   └── __init__.py
│   │   ├── platforms/                        # Platform integrations (4 files)
│   │   │   ├── base.py                       # Base platform class
│   │   │   ├── social_media.py               # Social media platforms
│   │   │   ├── people_search.py              # People search platforms
│   │   │   ├── registry.py                   # Platform registry
│   │   │   └── __init__.py
│   │   └── __init__.py
│   ├── services/                             # Business logic (20+ files)
│   │   ├── cache.py                          # Redis caching (311 LOC)
│   │   ├── concurrency_governor.py           # Concurrency control (181 LOC)
│   │   ├── case_service.py                   # Case management
│   │   ├── investigation_service.py          # Investigation service
│   │   ├── rag_service.py                    # RAG service
│   │   ├── job_queue.py                      # Job queue management
│   │   ├── job_store.py                      # Job persistence
│   │   ├── scheduler_service.py              # Scheduler service
│   │   ├── entity_deduplication.py           # Entity dedup
│   │   ├── dedup.py                          # Deduplication
│   │   ├── fraud_detection.py                # Fraud detection
│   │   ├── event_bus.py                      # Event bus
│   │   ├── data_lifecycle.py                 # Data lifecycle
│   │   ├── chromadb_optimizer.py             # ChromaDB optimization
│   │   ├── storage_optimizer.py              # Storage optimization
│   │   ├── lm_studio_bridge.py               # LM Studio integration
│   │   ├── redis_client.py                   # Redis client
│   │   ├── redis_pool.py                     # Redis connection pool
│   │   ├── watchdog.py                       # System watchdog
│   │   └── __init__.py
│   ├── models/                               # Pydantic models (11 files)
│   │   ├── auth.py
│   │   ├── case.py
│   │   ├── crawl.py
│   │   ├── entity.py
│   │   ├── extraction_template.py
│   │   ├── investigation.py
│   │   ├── osint.py
│   │   ├── rag.py
│   │   ├── scheduler.py
│   │   ├── settings.py
│   │   └── __init__.py
│   ├── config/                               # Configuration (4 files)
│   │   ├── auth.py
│   │   ├── osint_providers.py
│   │   ├── rate_limit.py
│   │   └── __init__.py
│   ├── middleware/                           # Middleware (4 files)
│   │   ├── auth.py
│   │   ├── basic_auth.py
│   │   ├── rate_limit.py
│   │   └── sanitize.py
│   ├── core/                                 # Core utilities (4 files)
│   │   ├── exceptions.py
│   │   ├── retry.py
│   │   ├── security.py
│   │   └── __init__.py
│   ├── orchestrators/                        # Orchestration (3 files)
│   │   ├── crawl_orchestrator.py
│   │   ├── deep_crawl_orchestrator.py
│   │   ├── osint_scan_orchestrator.py
│   │   └── __init__.py
│   ├── pipelines/                            # Data pipelines (2 files)
│   │   ├── entity_enrichment.py
│   │   ├── model_review.py
│   │   └── __init__.py
│   ├── storage/                              # Storage layer (2 files)
│   │   ├── chromadb_client.py
│   │   └── __init__.py
│   ├── websocket/                            # WebSocket support (2 files)
│   │   ├── manager.py
│   │   └── __init__.py
│   ├── workers/                              # Background workers (2 files)
│   │   ├── arq_worker.py
│   │   └── __init__.py
│   └── utils/                                # Utilities (2 files)
│       ├── auth.py
│       └── __init__.py
├── 01_devroot/frontend/                      # React frontend (50+ files)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/                       # React components (40+ files)
│   │   │   ├── AliasCard.tsx
│   │   │   ├── AppHeader.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── charts/                       # Chart components (10 files)
│   │   │   │   ├── ActivityHeatmap.tsx
│   │   │   │   ├── BreachTimelineChart.tsx
│   │   │   │   ├── ConfidenceHistogram.tsx
│   │   │   │   ├── PerformanceMetricsCard.tsx
│   │   │   │   ├── PlatformDistributionChart.tsx
│   │   │   │   ├── ThreatLevelGauge.tsx
│   │   │   │   ├── TimelineActivityChart.tsx
│   │   │   │   ├── VendorDetectionChart.tsx
│   │   │   │   ├── BaseChart.tsx
│   │   │   │   └── index.ts
│   │   │   ├── crawl/                        # Crawl components (8 files)
│   │   │   │   ├── BrowserConfigPanel.tsx
│   │   │   │   ├── CrawlOptionsPanel.tsx
│   │   │   │   ├── CrawlProgressCard.tsx
│   │   │   │   ├── CrawlQueueTable.tsx
│   │   │   │   ├── ExtractionStrategySelector.tsx
│   │   │   │   ├── LiveLogViewer.tsx
│   │   │   │   ├── URLInput.tsx
│   │   │   │   └── WaitConditionBuilder.tsx
│   │   │   ├── __tests__/                    # Component tests (6 files)
│   │   │   └── [other components]
│   │   └── __tests__/                        # Integration tests (3 files)
│   │       ├── api-store.test.ts
│   │       ├── navigation-flow.test.tsx
│   │       └── websocket-notifications.test.ts
├── tests/                                    # Python tests (72 files)
└── docker-compose.yml                        # Docker configuration
```

### Key Entry Points

| File | LOC | Purpose |
|------|-----|---------|
| `main.py` | 322 | FastAPI application |
| `cache.py` | 311 | Redis caching layer |
| `concurrency_governor.py` | 181 | Concurrency control |

### Configuration Files

- **No pyproject.toml at root** (uses setup.py or requirements.txt)
- **Frontend:** `01_devroot/frontend/package.json`
- **Docker:** `docker-compose.yml`, `docker-compose.prod.yml`

### Test Coverage

- **72 Python test files**
- **22 TypeScript test files**
- **7 E2E specs (Playwright)**
- **Current:** 57.82%
- **Target:** 75% enforced minimum, 85% stretch
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`)

---

## 3. ENGRAM-MCP (TypeScript Model Context Protocol Server)

### Overview
- **Type:** TypeScript/Node.js MCP server
- **Purpose:** Model Context Protocol server with OAuth 2.1, 30+ tools, dual transports
- **Entry Point:** `src/index.ts` (67 LOC)
- **Total Source Files:** 34 TypeScript

### Directory Structure

```
Engram-MCP/
├── src/                                      # TypeScript source (34 files)
│   ├── index.ts                              # Entry point (67 LOC) ⭐
│   ├── server.ts                             # MCP server factory (247 LOC)
│   ├── schemas.ts                            # Zod validation (284 LOC)
│   ├── config.ts                             # Configuration
│   ├── errors.ts                             # Error hierarchy (187 LOC)
│   ├── logger.ts                             # Logging
│   ├── client.ts                             # MCP client
│   ├── retry.ts                              # Retry logic
│   ├── circuit-breaker.ts                    # Circuit breaker pattern
│   ├── prompts.ts                            # MCP prompts
│   ├── auth/                                 # OAuth 2.1 (5 files)
│   │   ├── oauth-server.ts                   # OAuth server (543 LOC)
│   │   ├── oauth-middleware.ts               # OAuth middleware
│   │   ├── token-store.ts                    # Token storage interface
│   │   ├── redis-token-store.ts              # Redis token store
│   │   └── pkce.ts                           # PKCE implementation
│   ├── tools/                                # Tool definitions (5 files)
│   │   ├── tool-definitions.ts               # All 30+ tools (384 LOC)
│   │   ├── memory-tools.ts                   # Memory operations (10 tools)
│   │   ├── entity-tools.ts                   # Entity operations (4 tools)
│   │   ├── investigation-tools.ts            # Investigation ops (3 tools)
│   │   ├── health-tools.ts                   # Health/admin tools (13 tools)
│   │   └── [index exports]
│   ├── transports/                           # Transport layers (2 files)
│   │   ├── stdio.ts                          # Stdio transport
│   │   └── http.ts                           # HTTP streaming transport
│   ├── resources/                            # Resource definitions (2 files)
│   │   ├── memory-resources.ts               # Memory resources
│   │   └── enhanced-resources.ts             # Enhanced resources
│   ├── hooks/                                # Hook system (3 files)
│   │   ├── hook-manager.ts                   # Hook orchestration
│   │   ├── memory-hooks.ts                   # Memory-specific hooks
│   │   └── types.ts                          # Hook type definitions
│   ├── installer/                            # Installation utilities (6 files)
│   │   ├── cli.ts                            # CLI installer
│   │   ├── detect-client.ts                  # Client detection
│   │   ├── inject-config.ts                  # Config injection
│   │   ├── inject-claude-md.ts               # CLAUDE.md injection
│   │   ├── create-hookify-rules.ts           # Hookify rule creation
│   │   └── validate.ts                       # Validation
│   ├── utils/                                # Utilities (1 file)
│   │   └── read-body.ts                      # Body reading utility
│   └── [other files]
├── src/__tests__/                            # Test suite (10 files)
│   ├── [test files]
│   └── [161 tests passing]
├── dist/                                     # Compiled output
├── package.json                              # Dependencies
├── tsconfig.json                             # TypeScript config
├── vitest.config.ts                          # Test configuration
└── docker/                                   # Docker files
    ├── docker-compose.yml
    └── docker-compose.prod.yml
```

### Key Entry Points

| File | LOC | Purpose |
|------|-----|---------|
| `index.ts` | 67 | Entry point, transport selection |
| `server.ts` | 247 | MCP server factory |
| `schemas.ts` | 284 | Zod input validation (all 27 tools) |
| `auth/oauth-server.ts` | 543 | OAuth 2.1 server |
| `tools/tool-definitions.ts` | 384 | 30+ tool definitions |

### Tool Categories

**Memory Tools (10):**
- add_memory, search_memory, get_memory, delete_memory
- batch_add_memories, consolidate_memories, decay_memories, cleanup_memories
- export_memories, bulk_delete_memories

**Entity Tools (4):**
- add_entity, add_relation, query_graph, health_check

**Investigation Tools (3):**
- create_matter, ingest_document, search_matter

**Analytics/Admin Tools (13):**
- export_data, analytics, metrics, system_status, etc.

### Configuration Files

- **package.json** — Dependencies, scripts
- **tsconfig.json** — TypeScript configuration
- **vitest.config.ts** — Test runner configuration

### Test Coverage

- **10 TypeScript test files**
- **161 tests passing**
- **Test runner:** Node.js native (--test)
- **CI/CD:** GitHub Actions configured

### MCP Framework Compliance

- ✅ Dual transport (stdio + HTTP)
- ✅ OAuth 2.1 with PKCE
- ✅ Error hierarchy
- ✅ Input validation via Zod
- ❌ No pagination support
- ❌ Resource content not fully implemented

---

## 4. ENGRAM-PLATFORM (Next.js 15 + React 19 Dashboard)

### Overview
- **Type:** Next.js 15 App Router + React 19 frontend
- **Purpose:** Unified dashboard for memory, crawler, and intelligence systems
- **Entry Point:** `frontend/app/layout.tsx` (9,433 LOC)
- **Total Source Files:** 150 TypeScript/TSX

### Directory Structure

```
Engram-Platform/
├── frontend/
│   ├── app/                                  # Next.js App Router (80+ files)
│   │   ├── layout.tsx                        # Root layout (9,433 LOC) ⭐
│   │   ├── page.tsx                          # Home page
│   │   ├── manifest.ts                       # PWA manifest
│   │   ├── instrumentation.ts                # Instrumentation
│   │   ├── global-error.tsx                  # Global error boundary
│   │   ├── critical.css                      # Critical CSS
│   │   ├── globals.css                       # Global styles (16,322 LOC)
│   │   ├── api/                              # API routes (7 files)
│   │   │   └── system/
│   │   │       ├── health/route.ts           # Health check
│   │   │       ├── control/route.ts          # System control
│   │   │       ├── history/route.ts          # History
│   │   │       ├── logs/route.ts             # Logs
│   │   │       ├── logs/stream/route.ts      # Log streaming
│   │   │       ├── maintenance/route.ts      # Maintenance
│   │   │       └── notifications/route.ts    # Notifications
│   │   ├── dashboard/                        # Dashboard routes (60+ files)
│   │   │   ├── layout.tsx                    # Dashboard layout
│   │   │   ├── page.tsx                      # Dashboard home
│   │   │   ├── DashboardClient.tsx           # Dashboard client component
│   │   │   ├── loading.tsx                   # Loading state
│   │   │   ├── error.tsx                     # Error boundary
│   │   │   ├── home/                         # Home section (4 files)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── HomeContent.tsx
│   │   │   │   ├── HomeContent.test.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── memory/                       # Memory section (20+ files)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   ├── home/                     # Memory home (4 files)
│   │   │   │   ├── memories/                 # Memories view (4 files)
│   │   │   │   ├── matters/                  # Matters view (4 files)
│   │   │   │   ├── graph/                    # Memory graph (4 files)
│   │   │   │   ├── analytics/                # Analytics (4 files)
│   │   │   │   └── timeline/                 # Timeline (3 files)
│   │   │   ├── crawler/                      # Crawler section (20+ files)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   ├── home/                     # Crawler home (4 files)
│   │   │   │   ├── crawl/                    # Crawl view (4 files)
│   │   │   │   ├── osint/                    # OSINT view (4 files)
│   │   │   │   ├── investigations/           # Investigations (4 files)
│   │   │   │   └── knowledge-graph/          # Knowledge graph (4 files)
│   │   │   ├── intelligence/                 # Intelligence section (20+ files)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   ├── chat/                     # Chat view (4 files)
│   │   │   │   ├── search/                   # Search view (4 files)
│   │   │   │   ├── investigations/           # Investigations (4 files)
│   │   │   │   └── knowledge-graph/          # Knowledge graph (4 files)
│   │   │   └── system/                       # System section (3 files)
│   │   │       ├── layout.tsx
│   │   │       └── health/                   # Health view (3 files)
│   │   ├── sign-in/                          # Clerk sign-in (1 file)
│   │   │   └── [[...sign-in]]/page.tsx
│   │   └── sign-up/                          # Clerk sign-up (1 file)
│   │       └── [[...sign-up]]/page.tsx
│   ├── src/                                  # React source (70+ files)
│   │   ├── components/                       # React components (60+ files)
│   │   │   ├── Animations.tsx
│   │   │   ├── DraggableGrid.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── OptimizedImage.tsx
│   │   │   ├── Skeletons.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── WidgetToolbar.tsx
│   │   │   ├── ui/                           # ShadCN UI components (40+ files)
│   │   │   │   ├── accordion.tsx
│   │   │   │   ├── alert.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── checkbox.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── popover.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── textarea.tsx
│   │   │   │   ├── tooltip.tsx
│   │   │   │   └── [30+ more]
│   │   │   ├── animations/                   # Animation components (4 files)
│   │   │   │   ├── PageTransition.tsx
│   │   │   │   ├── stagger.tsx
│   │   │   │   ├── index.ts
│   │   │   │   └── __tests__/
│   │   │   ├── forms/                        # Form components (2 files)
│   │   │   │   ├── FormInput.tsx
│   │   │   │   └── __tests__/
│   │   │   └── __tests__/                    # Component tests (4 files)
│   │   ├── design-system/                    # Design system (42 components)
│   │   │   ├── EngramLogo.tsx
│   │   │   ├── components/
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   ├── ErrorState.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── LoadingState.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── NavItem.tsx
│   │   │   │   ├── SearchInput.tsx
│   │   │   │   ├── SectionHeader.tsx
│   │   │   │   ├── SidebarGroup.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── StatCard.tsx
│   │   │   │   ├── StatusDot.tsx
│   │   │   │   ├── Tabs.tsx
│   │   │   │   ├── Tag.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   ├── Tooltip.tsx
│   │   │   │   └── [22+ more]
│   │   │   └── __tests__/                    # Design system tests (21 files)
│   │   ├── stores/                           # Zustand stores (1 file)
│   │   │   └── uiStore.ts                    # UI state management
│   │   ├── providers/                        # React providers (1 file)
│   │   │   └── Providers.tsx                 # Clerk, SWR, Toast providers
│   │   ├── lib/                              # Utilities (5+ files)
│   │   │   ├── performance.ts                # Web Vitals tracking
│   │   │   ├── [other utilities]
│   │   │   └── __tests__/
│   │   ├── config/                           # Configuration (4 files)
│   │   │   ├── widget-registry.ts            # Widget registry
│   │   │   └── __tests__/
│   │   └── hooks/                            # Custom hooks (if any)
│   ├── package.json                          # Dependencies
│   ├── tsconfig.json                         # TypeScript config
│   ├── vitest.config.ts                      # Test configuration
│   ├── next.config.js                        # Next.js config
│   └── tailwind.config.ts                    # Tailwind CSS config
├── docker-compose.yml                        # Master Docker Compose
└── scripts/                                  # Deployment scripts
    └── deploy-production.sh
```

### Key Entry Points

| File | LOC | Purpose |
|------|-----|---------|
| `app/layout.tsx` | 9,433 | Root layout, providers |
| `app/globals.css` | 16,322 | Global styles |
| `app/dashboard/layout.tsx` | — | Dashboard layout |
| `src/stores/uiStore.ts` | — | Zustand state management |
| `src/providers/Providers.tsx` | — | Client providers |

### Design System

- **42 custom components** in `/src/design-system/components/`
- **40+ ShadCN UI components** in `/src/components/ui/`
- **Tailwind CSS v4** with CSS-native design tokens
- **Dark mode first** with next-themes
- **Color palette:** Void (#03020A), Amber (#F2A93B), Violet (#7C5CBF), Teal (#2EC4C4)

### State Management

- **Zustand v5** — Single store: `uiStore` (sidebar, service status)
- **SWR v2** — Data fetching with deduplication
- **Missing:** nuqs (URL state management)

### Configuration Files

- **package.json** — Dependencies, scripts
- **tsconfig.json** — TypeScript configuration
- **vitest.config.ts** — Test runner configuration
- **next.config.js** — Next.js configuration
- **tailwind.config.ts** — Tailwind CSS configuration

### Test Coverage

- **15 TypeScript test files**
- **2 E2E specs (Playwright)**
- **Coverage:** ~0% (reporting issue)
- **Target:** 80%
- **CI/CD:** GitHub Actions configured

### 2026 Standards Gaps

- ❌ No nuqs (URL state management)
- ❌ No Sentry (error tracking)
- ❌ Inconsistent memoization
- ❌ No Storybook (component docs)
- ❌ No accessibility audit (WCAG 2.1 AA)
- ❌ No Google Lighthouse testing

---

## SUMMARY TABLE

| Subproject | Type | Entry Point | Source Files | Tests | Coverage Target |
|-----------|------|-------------|--------------|-------|-----------------|
| **AiMemory** | Python FastAPI | `api.py` (1,884 LOC) | 40 Python + 6 TS | 29 Python | 95% |
| **AiCrawler** | Python FastAPI + React | `main.py` (322 LOC) | 104 Python + 50+ React | 72 Python + 22 TS + 7 E2E | 85% |
| **MCP** | TypeScript Node.js | `index.ts` (67 LOC) | 34 TypeScript | 10 TS (161 tests) | — |
| **Platform** | Next.js 15 + React 19 | `layout.tsx` (9,433 LOC) | 150 TypeScript/TSX | 15 TS + 2 E2E | 80% |
| **TOTAL** | — | — | **328 source files** | **~150 test files** | — |

---

## CONFIGURATION FILES INVENTORY

### Root Level
- `.pre-commit-config.yaml` — Pre-commit hooks
- `package.json` — Root workspace config
- `AGENTS.md` — Architecture documentation
- `CLAUDE.md` — Claude Code configuration
- `PROJECT_ROADMAP.md` — 12-week roadmap

### AiMemory
- `pyproject.toml` — Python dependencies
- `pytest.ini` — Pytest configuration
- `package.json` — Node.js dependencies (MCP bridge)

### AiCrawler
- `01_devroot/frontend/package.json` — Frontend dependencies
- `docker-compose.yml` — Docker configuration
- `docker-compose.prod.yml` — Production Docker config

### MCP
- `package.json` — Dependencies
- `tsconfig.json` — TypeScript configuration
- `vitest.config.ts` — Test configuration

### Platform
- `frontend/package.json` — Dependencies
- `frontend/tsconfig.json` — TypeScript configuration
- `frontend/vitest.config.ts` — Test configuration
- `frontend/next.config.js` — Next.js configuration
- `frontend/tailwind.config.ts` — Tailwind CSS configuration

---

## NOTES

1. **File counts exclude:**
   - `node_modules/` directories
   - `dist/` and `build/` output
   - `__pycache__/` directories
   - `.pytest_cache/` directories
   - Generated files

2. **Entry points are the primary files to understand each system:**
   - AiMemory: `api.py` for REST API, `mcp/__main__.py` for MCP bridge
   - AiCrawler: `main.py` for FastAPI, `01_devroot/frontend/src/App.tsx` for React
   - MCP: `index.ts` for transport selection, `server.ts` for MCP factory
   - Platform: `app/layout.tsx` for root layout, `dashboard/layout.tsx` for dashboard

3. **Test infrastructure:**
   - Python: pytest with coverage tracking
   - TypeScript: vitest + Playwright for E2E
   - All projects have CI/CD via GitHub Actions

4. **Critical gaps per AGENTS.md:**
   - AiMemory: Test coverage baseline refresh needed
   - AiCrawler: 57.82% → need 75% minimum
   - Platform: Coverage reporting exists but baseline not established
   - MCP: OAuth state in process memory (should be Redis)

