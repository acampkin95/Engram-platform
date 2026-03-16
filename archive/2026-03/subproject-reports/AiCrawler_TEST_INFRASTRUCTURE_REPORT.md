# Engram-AiCrawler Test Infrastructure Report

**Generated:** 2026-03-14  
**Current Coverage:** 57.82% (Python)  
**Target Coverage:** 75% (enforced minimum), 85% (stretch)

---

## EXECUTIVE SUMMARY

The Engram-AiCrawler project has a **comprehensive test infrastructure** with **72 Python test files** and **19 TypeScript test files**, but coverage is currently at **57.82%** — below the enforced 75% minimum. The test suite is well-structured with:

- ✅ Centralized pytest configuration with package-scoped fixtures
- ✅ E2E test infrastructure with mocked external dependencies
- ✅ CI/CD pipeline with coverage reporting
- ✅ Organized test structure (unit, integration, E2E, OSINT-specific)
- ⚠️ Coverage gap: **~17% gap to reach 75% minimum**
- ⚠️ Missing test utilities for some complex modules

---

## TEST FILE INVENTORY

### Python Tests (72 files, ~25,742 LOC)

**Location:** `/01_devroot/tests/`

#### Core Test Files (60 files)
- **API Tests (15 files):** test_api*.py covering crawl, chat, darkweb, data, extraction, performance, RAG, scheduler, settings, stats, storage, threat_intel
- **Service Tests (8 files):** auth, cache, case_service, chromadb_integration, concurrency_governor, dedup, entity_deduplication, entity_enrichment
- **Infrastructure Tests (12 files):** job_queue, job_queue_service, job_store_redis, redis_client, rate_limit, retry, websocket, whois_dns, image_intelligence, image_search, face_recognition_service, knowledge_graph_api
- **Orchestration Tests (3 files):** deep_crawl_orchestrator, osint_scan_orchestrator, scheduler_service
- **Utility Tests (7 files):** auth_utils, cache, config, docker, exceptions, fraud_detection, models
- **Other Tests (15 files):** api, api_cases, api_investigations, api_storage, chromadb_optimizer, event_bus, integration, investigation_service, middleware_auth, osint_scan_api, osint_scan_endpoint, platforms, rag_service, security, storage_optimizer

#### OSINT Tests (6 files)
- `tests/osint/test_alias_discovery.py`
- `tests/osint/test_darkweb.py`
- `tests/osint/test_email_osint.py`
- `tests/osint/test_platform_crawler.py`
- `tests/osint/test_semantic_tracker.py`
- `tests/osint/test_threat_intel.py`

#### Service Tests (4 files)
- `tests/services/test_data_lifecycle.py`
- `tests/services/test_lm_studio_bridge.py`
- `tests/services/test_supervisord.py`
- `tests/services/test_watchdog.py`

#### Orchestrator Tests (1 file)
- `tests/orchestrators/test_crawl_orchestrator.py`

#### Addon Tests (2 files)
- `addons/crawl4ai_darkweb_osint/tests/test_integration.py`
- `01_devroot/addons/crawl4ai_darkweb_osint/tests/test_integration.py`

### TypeScript Tests (19 files)

**Location:** `/01_devroot/frontend/`

#### Unit Tests (12 files)
- `src/stores/__tests__/notificationStore.test.ts`
- `src/stores/__tests__/crawlStore.test.ts`
- `src/hooks/__tests__/useApiRequest.test.ts`
- `src/hooks/__tests__/useCancelToken.test.ts`
- `src/hooks/__tests__/useWebSocketSubscription.test.ts`
- `src/hooks/__tests__/useNotifications.test.ts`
- `src/hooks/__tests__/useOnlineStatus.test.ts`
- `src/hooks/__tests__/useDashboardStats.test.ts`
- `src/hooks/__tests__/useCrawlConfig.test.ts`
- `src/hooks/__tests__/useCrawlHistory.test.ts`
- `src/__tests__/integration/api-store.test.ts`
- `src/__tests__/integration/websocket-notifications.test.ts`

#### E2E Tests (7 files)
- `e2e/navigation.spec.ts`
- `e2e/smoke.spec.ts`
- `e2e/error-states.spec.ts`
- `e2e/osint-dashboard.spec.ts`
- `e2e/pages-smoke.spec.ts`
- `e2e/dashboard.spec.ts`
- `e2e/crawl-config.spec.ts`

---

## COVERAGE CONFIGURATION

### Python Coverage (.coveragerc)

**Location:** `/01_devroot/.coveragerc`

```ini
[run]
concurrency = thread
source = app
fail_under = 75

[report]
show_missing = True

exclude_lines =
    # pragma: no cover
    async def execute_crawl
```

**Key Settings:**
- **Source:** `app/` directory only
- **Fail Under:** 75% (enforced minimum)
- **Concurrency:** Thread-based
- **Excluded:** `async def execute_crawl` (marked with pragma)

### TypeScript/Vitest Configuration

**Location:** `/01_devroot/frontend/vitest.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Key Settings:**
- **Environment:** jsdom (browser simulation)
- **Setup Files:** `src/test/setup.ts`
- **Excluded:** E2E tests (run separately)

---

## TEST FIXTURES & UTILITIES

### Core Fixtures (E2E conftest.py)

**Location:** `/01_devroot/tests/e2e/conftest.py`

#### Package-Scoped Fixtures
1. **`_base_patches`** — Mocks all external I/O (Redis, ChromaDB, LM Studio, auth)
2. **`app_client`** — TestClient with all dependencies mocked, auth disabled
3. **`fresh_app_client`** — Function-scoped TestClient for state-mutating tests

#### Auth Fixtures
1. **`_rsa_key_pair`** — Session-scoped RSA key pair for JWT generation
2. **`auth_headers`** — Valid Bearer JWT for regular users
3. **`admin_auth_headers`** — Valid Bearer JWT for admin users

#### Mock Fixtures
1. **`mock_crawl_result`** — Reusable AsyncWebCrawler result mock
2. **`mock_crawler_context`** — Patches AsyncWebCrawler to prevent real browser calls

### Unit Test Conftest

**Location:** `/01_devroot/tests/conftest.py`

```python
"""
Pytest configuration for test discovery
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
```

**Purpose:** Adds project root to sys.path for module imports

---

## CI/CD PIPELINE

### Workflow File

**Location:** `/.github/workflows/ci.yml`

### Pipeline Stages

#### 1. Python Lint & Type Check
- **Tool:** Ruff (linting) + MyPy (type checking)
- **Timeout:** 10 minutes
- **Status:** Blocking (type check is non-blocking until coverage improves)

#### 2. Python Tests with Coverage
- **Tool:** pytest + pytest-cov
- **Timeout:** 20 minutes
- **Depends On:** python-lint
- **Coverage Threshold:** 75% (enforced)
- **Artifacts:** Coverage report

#### 3. Frontend Lint
- **Tool:** ESLint
- **Timeout:** 10 minutes

#### 4. Frontend Build
- **Tool:** Vite
- **Timeout:** 15 minutes
- **Artifacts:** frontend-build

#### 5. Frontend Tests
- **Tool:** Vitest
- **Timeout:** 15 minutes
- **Depends On:** frontend-lint

#### 6. Docker Build
- **Tool:** Docker Buildx
- **Timeout:** 30 minutes
- **Cache:** GitHub Actions cache (gha)

#### 7. E2E Tests (Conditional)
- **Tool:** Playwright
- **Timeout:** 30 minutes
- **Condition:** Only runs on main branch pushes (resource-intensive)
- **Services:** Redis 7-alpine
- **Artifacts:** playwright-report

#### 8. Security Scan
- **Tools:** safety (Python), npm audit (Node.js)
- **Timeout:** 10 minutes
- **Status:** Non-blocking (until dependencies updated)

#### 9. CI Summary
- **Status:** Aggregates all job results
- **Fails If:** Any critical job fails

### Concurrency & Caching

- **Concurrency Group:** `${{ github.workflow }}-${{ github.ref }}`
- **Cancel In Progress:** Yes (newer pushes cancel older runs)
- **Python Cache:** pip dependencies
- **Node Cache:** npm dependencies
- **Docker Cache:** GitHub Actions cache (gha)

---

## CURRENT COVERAGE STATUS

### Python Coverage: 57.82%

**Gap to 75% Minimum:** 17.18 percentage points

**Estimated Tests Needed:** 400-495 new tests (based on TEST_COVERAGE_PLAN.md)

### Coverage by Priority (from TEST_COVERAGE_PLAN.md)

| Priority | Category | Modules | Est. Tests | Status |
|----------|----------|---------|------------|--------|
| P0 | Core Infrastructure | 4 | 50-60 | ⚠️ Partial |
| P1 | OSINT Services | 6 | 70-90 | ⚠️ Partial |
| P1 | Dark Web | 5 | 60-75 | ⚠️ Partial |
| P2 | Business Services | 8 | 80-100 | ⚠️ Partial |
| P2 | API Routes | 15 | 100-120 | ⚠️ Partial |
| P3 | Pipelines | 2 | 25-30 | ⚠️ Partial |
| P3 | Orchestrators | 1 | 15-20 | ⚠️ Partial |

### TypeScript Coverage

- **Unit Tests:** 12 files
- **E2E Tests:** 7 files
- **Coverage Reporting:** Configured in vitest.config.ts
- **Status:** Baseline not yet established

---

## TEST STRUCTURE ORGANIZATION

```
01_devroot/
├── tests/
│   ├── conftest.py                    # Unit test configuration
│   ├── TEST_COVERAGE_PLAN.md          # Coverage improvement roadmap
│   ├── e2e/
│   │   ├── conftest.py                # E2E fixtures (mocks, auth, crawl results)
│   │   ├── navigation.spec.ts
│   │   ├── smoke.spec.ts
│   │   ├── error-states.spec.ts
│   │   ├── osint-dashboard.spec.ts
│   │   ├── pages-smoke.spec.ts
│   │   ├── dashboard.spec.ts
│   │   └── crawl-config.spec.ts
│   ├── osint/
│   │   ├── __init__.py
│   │   ├── test_alias_discovery.py
│   │   ├── test_darkweb.py
│   │   ├── test_email_osint.py
│   │   ├── test_platform_crawler.py
│   │   ├── test_semantic_tracker.py
│   │   └── test_threat_intel.py
│   ├── services/
│   │   ├── test_data_lifecycle.py
│   │   ├── test_lm_studio_bridge.py
│   │   ├── test_supervisord.py
│   │   └── test_watchdog.py
│   ├── orchestrators/
│   │   └── test_crawl_orchestrator.py
│   ├── test_api*.py                   # 15 API endpoint tests
│   ├── test_auth*.py                  # 2 auth tests
│   ├── test_cache*.py                 # 2 cache tests
│   ├── test_*_service.py              # 8 service tests
│   └── test_*.py                      # 20+ infrastructure/utility tests
│
├── frontend/
│   ├── vitest.config.ts               # Vitest configuration
│   ├── src/
│   │   ├── test/
│   │   │   └── setup.ts               # Vitest setup
│   │   ├── stores/__tests__/          # 2 store tests
│   │   ├── hooks/__tests__/           # 8 hook tests
│   │   └── __tests__/integration/     # 2 integration tests
│   └── e2e/                           # 7 Playwright E2E specs
│
└── .coveragerc                        # Coverage configuration (75% minimum)
```

---

## KEY INSIGHTS

### Strengths

1. **Comprehensive Test Suite:** 72 Python + 19 TypeScript test files
2. **Well-Organized Structure:** Clear separation of unit, integration, E2E, and OSINT tests
3. **Robust Fixtures:** Package-scoped mocks prevent external I/O and cross-test pollution
4. **CI/CD Integration:** Full pipeline with coverage reporting and artifact uploads
5. **E2E Infrastructure:** Mocked dependencies (Redis, ChromaDB, LM Studio) for fast, reliable tests
6. **Auth Testing:** Real JWT generation with RSA key pairs for auth-enabled tests

### Gaps

1. **Coverage Below Minimum:** 57.82% vs. 75% enforced threshold (17.18 pp gap)
2. **Missing Test Utilities:** Some complex modules lack dedicated test helpers
3. **TypeScript Coverage Baseline:** Not yet established (vitest configured but baseline unknown)
4. **E2E Resource Constraints:** Only runs on main branch pushes (resource-intensive)
5. **Incomplete Addon Testing:** Darkweb addon has minimal test coverage

### Coverage Improvement Roadmap

**From TEST_COVERAGE_PLAN.md:**
- **P0 (Critical):** Core infrastructure (retry, circuit breaker, job store) — 50-60 tests
- **P1 (High):** OSINT services + dark web modules — 130-165 tests
- **P2 (Medium):** Business services + API routes — 180-220 tests
- **P3 (Low):** Pipelines + orchestrators — 40-50 tests

**Total Estimated New Tests:** 400-495

---

## NEXT STEPS

1. **Establish TypeScript Coverage Baseline** — Run vitest with coverage reporting
2. **Prioritize P0 Infrastructure Tests** — Focus on retry logic, circuit breaker, job store
3. **Expand OSINT Test Coverage** — Add tests for alias discovery, dark web, email OSINT
4. **Add Missing API Route Tests** — Cover all 15 API endpoint files
5. **Implement Test Utilities** — Create helpers for complex modules (orchestrators, services)
6. **Enable E2E on All Branches** — Optimize resource usage to run on develop/feature branches
7. **Document Test Patterns** — Create TESTING.md with examples for new contributors

---

## REFERENCES

- **Coverage Configuration:** `/01_devroot/.coveragerc`
- **E2E Fixtures:** `/01_devroot/tests/e2e/conftest.py`
- **CI/CD Pipeline:** `/.github/workflows/ci.yml`
- **Coverage Plan:** `/01_devroot/tests/TEST_COVERAGE_PLAN.md`
- **Vitest Config:** `/01_devroot/frontend/vitest.config.ts`

