# Crawl4AI Test Coverage Improvement Plan

**Generated:** 2026-02-27
**Current Tests:** 339 collected
**Python Version:** 3.9.6
**Framework:** pytest + pytest-asyncio + pytest-cov

---

## Executive Summary

### Current State
- **339 tests** across 22 test files
- **4 collection errors** (FIXED - crawl4ai Python 3.10+ type hints patched)
- **30+ high-complexity modules** with zero test coverage
- CI/CD pipeline: lint → typecheck → test → docker

### Coverage Gap Summary

| Priority | Category | Modules | Est. Tests |
|----------|----------|---------|------------|
| P0 | Core Infrastructure | 4 | 50-60 |
| P1 | OSINT Services | 6 | 70-90 |
| P1 | Dark Web | 5 | 60-75 |
| P2 | Business Services | 8 | 80-100 |
| P2 | API Routes | 15 | 100-120 |
| P3 | Pipelines | 2 | 25-30 |
| P3 | Orchestrators | 1 | 15-20 |

**Total Estimated New Tests:** 400-495

---

## Priority 0: Core Infrastructure (Critical)

These modules are foundational - failures here cascade throughout the application.

### 1. `app/core/retry.py` — CircuitBreaker & Retry Logic

**Risk:** HIGH — Resilience patterns for external services
**Complexity:** HIGH
**Estimated Tests:** 15-20

**Test File:** `tests/test_retry.py`

**Test Scenarios:**
```
CircuitBreaker:
  - starts in CLOSED state
  - opens after failure threshold (default: 5)
  - blocks requests when OPEN
  - transitions to HALF_OPEN after recovery timeout
  - closes on success in HALF_OPEN
  - reopens on failure in HALF_OPEN
  - resets failure count on success
  - @call decorator passes through on success
  - @call decorator records failures
  - @call decorator blocks when OPEN
  - concurrent access thread safety
  - custom failure threshold
  - custom recovery timeout

with_retry decorator:
  - retries on specified exceptions
  - respects max_attempts
  - applies exponential backoff
  - respects wait_multiplier
  - raises after max retries exhausted
  - passes through on success

Integration:
  - CircuitBreaker + tenacity retry together
  - Redis retry configuration
  - LM Studio retry configuration
```

**Dependencies:** `tests/test_exceptions.py` (already has CircuitBreaker tests - extend)

---

### 2. `app/services/event_bus.py` — Redis Streams Pub/Sub

**Risk:** HIGH — Core async messaging infrastructure
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/test_event_bus.py` (NEW)

**Test Scenarios:**
```
EventBus:
  - initializes Redis connection
  - publishes event to stream
  - publishes with correct event type
  - publishes with timestamp
  - publishes with payload serialization
  - creates consumer group
  - reads events from consumer group
  - acknowledges processed events
  - handles Redis connection failure gracefully
  - reconnects after connection loss
  - handles event deserialization errors
  - supports multiple event types
  - filters events by type
```

---

### 3. `app/services/job_queue.py` — Async Job Lifecycle

**Risk:** HIGH — Background job management
**Complexity:** HIGH
**Estimated Tests:** 15-20

**Test File:** `tests/test_job_queue.py` (NEW)

**Test Scenarios:**
```
JobQueue:
  - creates job with PENDING status
  - generates unique job ID
  - stores job metadata
  - transitions to RUNNING
  - transitions to COMPLETED
  - transitions to FAILED
  - stores job result
  - stores job error
  - retrieves job by ID
  - lists jobs by status
  - lists jobs by type
  - deletes completed job
  - handles Redis unavailable (file fallback)
  - persists to file when Redis down
  - migrates from file to Redis on recovery
  - handles concurrent job creation
  - enforces max concurrent jobs
```

---

### 4. `app/middleware/auth.py` — Clerk JWT Authentication

**Risk:** CRITICAL — Security
**Complexity:** HIGH
**Estimated Tests:** 15-20

**Test File:** `tests/test_middleware_auth.py` (NEW)

**Test Scenarios:**
```
Clerk Auth Middleware:
  - extracts token from Authorization header
  - rejects missing Authorization header
  - rejects malformed Authorization header
  - validates JWT signature
  - extracts user ID from token
  - extracts user role from token
  - injects user into request state
  - allows request with valid token
  - rejects request with expired token
  - rejects request with invalid signature
  - handles Clerk service unavailable
  - caches validated tokens
  - respects token expiration
  - handles rate limiting on Clerk API
  - supports service account tokens
  - injects user role for admin check
```

---

## Priority 1: OSINT Services (Critical Business Logic)

Core intelligence gathering functionality.

### 5. `app/osint/alias_discovery.py` — Username/Alias Discovery

**Risk:** HIGH — Core OSINT feature
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/osint/test_alias_discovery.py` (NEW)

**Test Scenarios:**
```
AliasDiscovery:
  - queries single platform
  - queries multiple platforms concurrently
  - handles platform timeout gracefully
  - aggregates results from all platforms
  - normalizes username format
  - detects username variations
  - scores confidence of matches
  - handles rate limiting from platforms
  - caches platform responses
  - handles platform unavailable
  - returns structured AliasResult
  - supports custom platform list
```

---

### 6. `app/osint/email_osint_service.py` — Email Intelligence

**Risk:** HIGH — Breach detection & validation
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/osint/test_email_osint.py` (NEW)

**Test Scenarios:**
```
EmailOsintService:
  - validates email format
  - detects disposable email domains
  - queries breach database
  - returns breach details
  - handles no breaches found
  - handles breach API unavailable
  - extracts email metadata
  - correlates email with other data
  - handles rate limiting
  - caches breach results
  - supports multiple breach sources
  - handles invalid email gracefully
```

---

### 7. `app/osint/threat_intel_service.py` — Threat Intelligence

**Risk:** HIGH — Security intelligence
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/osint/test_threat_intel.py` (NEW)

**Test Scenarios:**
```
ThreatIntelService:
  - queries threat feeds
  - aggregates multiple sources
  - scores threat level
  - correlates indicators
  - handles feed unavailable
  - caches threat data
  - respects TTL on cached data
  - normalizes threat indicators
  - supports custom feed configuration
  - handles rate limiting
  - returns structured ThreatResult
```

---

### 8. `app/osint/semantic_tracker.py` — Semantic Entity Tracking

**Risk:** HIGH — Cross-crawl entity correlation
**Complexity:** HIGH
**Estimated Tests:** 10-12

**Test File:** `tests/osint/test_semantic_tracker.py` (NEW)

**Test Scenarios:**
```
SemanticTracker:
  - extracts entities from content
  - tracks entity across crawls
  - correlates entities semantically
  - handles entity disambiguation
  - stores entity vectors
  - queries similar entities
  - handles vector DB unavailable
  - respects similarity threshold
  - merges duplicate entities
  - returns structured tracking results
```

---

### 9. `app/osint/face_recognition_service.py` — Face Recognition

**Risk:** MEDIUM — Image intelligence
**Complexity:** HIGH
**Estimated Tests:** 10-12

**Test File:** `tests/osint/test_face_recognition.py` (NEW)

**Test Scenarios:**
```
FaceRecognitionService:
  - detects faces in image
  - generates face encoding
  - compares face encodings
  - handles no face detected
  - handles multiple faces
  - handles invalid image
  - stores reference encodings
  - matches against references
  - returns confidence score
  - handles encoding failures
```

---

### 10. `app/osint/platform_crawler.py` — Platform-Specific Crawling

**Risk:** HIGH — Multi-platform OSINT
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/osint/test_platform_crawler.py` (NEW)

**Test Scenarios:**
```
PlatformCrawler:
  - selects crawler for platform
  - executes platform-specific strategy
  - handles platform timeout
  - handles platform blocking
  - rotates user agents
  - handles CAPTCHA detection
  - respects robots.txt
  - handles rate limiting
  - returns structured PlatformResult
  - supports proxy configuration
  - handles authentication
```

---

## Priority 1: Dark Web Services (Critical Business Logic)

### 11-15. `app/osint/darkweb/` — All 5 Modules

**Risk:** CRITICAL — Sensitive intelligence operations
**Complexity:** HIGH
**Estimated Tests:** 60-75 (12-15 per module)

**Test File:** `tests/osint/darkweb/test_darkweb.py` (NEW)

**Test Scenarios (Tor Crawler):**
```
TorCrawler:
  - connects via Tor proxy
  - fetches .onion URL
  - handles Tor connection failure
  - respects timeout
  - handles invalid .onion address
  - returns TorCrawlResult
  - handles large responses
  - supports session persistence
```

**Test Scenarios (Breach Scanner):**
```
BreachScanner:
  - queries breach databases
  - searches by email
  - searches by username
  - returns breach details
  - handles API unavailable
  - caches results
  - respects rate limits
```

**Test Scenarios (Crypto Tracer):**
```
CryptoTracer:
  - traces Bitcoin address
  - traces Ethereum address
  - identifies exchange addresses
  - calculates transaction volume
  - handles invalid address
  - handles API unavailable
  - returns structured trace result
```

**Test Scenarios (Entity Correlator):**
```
EntityCorrelator:
  - correlates entities across sources
  - identifies same entity
  - builds entity graph
  - handles partial data
  - returns correlation confidence
```

**Test Scenarios (Marketplace Monitor):**
```
MarketplaceMonitor:
  - monitors marketplace listings
  - detects keyword matches
  - alerts on new matches
  - handles marketplace downtime
  - respects crawl delays
```

---

## Priority 2: Business Services

### 16. `app/services/fraud_detection.py` — Fraud Signal Detection

**Risk:** HIGH — Business-critical detection
**Complexity:** HIGH
**Estimated Tests:** 10-15

**Test File:** `tests/services/test_fraud_detection.py` (NEW)

**Test Scenarios:**
```
FraudDetection:
  - analyzes entity for fraud signals
  - detects suspicious patterns
  - scores fraud risk
  - handles multiple signal types
  - correlates signals
  - returns structured FraudResult
  - handles missing data
  - respects confidence threshold
```

---

### 17. `app/services/entity_deduplication.py` — Entity Deduplication

**Risk:** MEDIUM — Data quality
**Complexity:** HIGH
**Estimated Tests:** 10-12

**Test File:** `tests/services/test_entity_deduplication.py` (NEW)

**Test Scenarios:**
```
EntityDeduplication:
  - identifies duplicate entities
  - merges duplicate entities
  - handles fuzzy matching
  - respects similarity threshold
  - handles large entity sets
  - returns deduplicated results
  - preserves entity history
```

---

### 18. `app/services/rag_service.py` — RAG Pipeline

**Risk:** MEDIUM — AI feature
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/services/test_rag_service.py` (NEW)

**Test Scenarios:**
```
RAGService:
  - chunks documents
  - generates embeddings
  - stores in vector DB
  - queries similar chunks
  - handles large documents
  - respects chunk size
  - handles embedding failures
  - returns structured RAGResult
```

---

### 19. `app/services/scheduler_service.py` — Job Scheduling

**Risk:** MEDIUM — Automation
**Complexity:** MEDIUM
**Estimated Tests:** 10-12

**Test File:** `tests/services/test_scheduler_service.py` (NEW)

**Test Scenarios:**
```
SchedulerService:
  - schedules one-time job
  - schedules recurring job
  - cancels scheduled job
  - lists scheduled jobs
  - handles job failure
  - respects timezone
  - handles concurrent jobs
  - persists schedules
```

---

### 20. `app/services/case_service.py` — Case Management

**Risk:** MEDIUM — Business logic
**Complexity:** MEDIUM
**Estimated Tests:** 10-12

**Test File:** `tests/services/test_case_service.py` (NEW)

**Test Scenarios:**
```
CaseService:
  - creates case
  - updates case
  - deletes case
  - lists cases
  - filters by status
  - assigns case
  - handles concurrent updates
  - returns structured CaseResult
```

---

### 21. `app/services/investigation_service.py` — Investigation Management

**Risk:** MEDIUM — Business logic
**Complexity:** MEDIUM
**Estimated Tests:** 10-12

**Test File:** `tests/services/test_investigation_service.py` (NEW)

**Test Scenarios:**
```
InvestigationService:
  - creates investigation
  - links entities to investigation
  - updates investigation status
  - lists investigations
  - filters by case
  - handles concurrent updates
  - returns structured InvestigationResult
```

---

### 22. `app/services/dedup.py` — Content Deduplication

**Risk:** LOW — Data quality
**Complexity:** MEDIUM
**Estimated Tests:** 8-10

**Test File:** `tests/services/test_dedup.py` (NEW)

**Test Scenarios:**
```
DedupService:
  - identifies duplicate content
  - calculates content hash
  - handles near-duplicates
  - respects similarity threshold
  - handles large content
```

---

### 23. `app/services/concurrency_governor.py` — Concurrency Control

**Risk:** MEDIUM — Resource management
**Complexity:** MEDIUM
**Estimated Tests:** 8-10

**Test File:** `tests/services/test_concurrency_governor.py` (NEW)

**Test Scenarios:**
```
ConcurrencyGovernor:
  - limits concurrent operations
  - queues excess requests
  - respects timeout
  - handles semaphore release
  - provides metrics
```

---

## Priority 2: API Routes

### 24-38. `app/api/*.py` — 15 Route Modules

**Risk:** MEDIUM — HTTP interface
**Complexity:** MEDIUM per module
**Estimated Tests:** 100-120 (7-8 per module)

**Test Files:** Extend `tests/test_api.py` or create `tests/api/test_*.py`

**Modules needing test coverage:**
- `api/cases.py` — Case CRUD endpoints
- `api/investigations.py` — Investigation endpoints
- `api/scheduler.py` — Job scheduling endpoints
- `api/extraction.py` — Template extraction endpoints
- `api/rag.py` — RAG query endpoints
- `api/performance.py` — Metrics endpoints
- `api/darkweb.py` — Dark web scan endpoints
- `api/settings.py` — Settings endpoints

**Test Pattern (for each):**
```
API Route Tests:
  - GET /resource returns list
  - GET /resource/{id} returns item
  - POST /resource creates item
  - PUT /resource/{id} updates item
  - DELETE /resource/{id} deletes item
  - handles validation errors
  - handles not found
  - handles unauthorized
  - handles rate limiting
```

---

## Priority 3: Pipelines

### 39. `app/pipelines/entity_enrichment.py` — Entity Enrichment Pipeline

**Risk:** MEDIUM — Data enhancement
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/pipelines/test_entity_enrichment.py` (NEW)

**Test Scenarios:**
```
EntityEnrichmentPipeline:
  - enriches entity with OSINT data
  - handles enrichment failure
  - aggregates enrichment sources
  - respects timeout
  - returns structured EnrichmentResult
```

---

### 40. `app/pipelines/model_review.py` — LLM Model Review Pipeline

**Risk:** MEDIUM — AI feature
**Complexity:** HIGH
**Estimated Tests:** 12-15

**Test File:** `tests/pipelines/test_model_review.py` (NEW)

**Test Scenarios:**
```
ModelReviewPipeline:
  - reviews crawled content
  - scores relevance
  - recommends keep/derank/archive
  - handles LLM unavailable
  - handles invalid content
  - returns structured ReviewResult
```

---

## Priority 3: Orchestrators

### 41. `app/orchestrators/deep_crawl_orchestrator.py` — Deep Crawl Logic

**Risk:** MEDIUM — Complex crawl orchestration
**Complexity:** HIGH
**Estimated Tests:** 15-20

**Test File:** `tests/orchestrators/test_deep_crawl_orchestrator.py` (NEW)

**Test Scenarios:**
```
DeepCrawlOrchestrator:
  - executes deep crawl with depth limit
  - respects max pages limit
  - follows internal links
  - handles redirect chains
  - detects crawl loops
  - handles rate limiting
  - aggregates results
  - returns structured DeepCrawlResult
```

---

## Implementation Roadmap

### Phase 1: Critical Infrastructure (Week 1)
1. `test_retry.py` — CircuitBreaker & retry logic
2. `test_event_bus.py` — Redis Streams
3. `test_job_queue.py` — Job lifecycle
4. `test_middleware_auth.py` — Authentication

### Phase 2: OSINT Core (Week 2)
5. `osint/test_alias_discovery.py`
6. `osint/test_email_osint.py`
7. `osint/test_threat_intel.py`
8. `osint/test_semantic_tracker.py`

### Phase 3: Dark Web & Advanced OSINT (Week 3)
9. `osint/test_face_recognition.py`
10. `osint/test_platform_crawler.py`
11. `osint/darkweb/test_darkweb.py`

### Phase 4: Business Services (Week 4)
12. `services/test_fraud_detection.py`
13. `services/test_entity_deduplication.py`
14. `services/test_rag_service.py`
15. `services/test_scheduler_service.py`

### Phase 5: API & Pipelines (Week 5)
16. API route tests (extend `test_api.py`)
17. `pipelines/test_entity_enrichment.py`
18. `pipelines/test_model_review.py`
19. `orchestrators/test_deep_crawl_orchestrator.py`

---

## Test Quality Standards

### Required for All Tests:
- [ ] Async tests use `@pytest.mark.asyncio`
- [ ] Mocks use `unittest.mock.AsyncMock` for async methods
- [ ] Each test has clear arrange/act/assert structure
- [ ] Error cases tested alongside happy paths
- [ ] Tests are isolated (no shared state)
- [ ] Fixtures defined in `conftest.py` when shared

### Test Naming Convention:
```python
def test_<action>_<expected_result>():
    """Test description of what is being tested."""
    pass

# Examples:
def test_circuit_breaker_opens_after_threshold()
def test_alias_discovery_handles_platform_timeout()
def test_job_queue_transitions_to_completed()
```

### Coverage Targets:
- **P0 modules:** 90%+ coverage
- **P1 modules:** 80%+ coverage
- **P2 modules:** 70%+ coverage
- **P3 modules:** 60%+ coverage

---

## Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific module tests
pytest tests/test_retry.py -v

# Run only P0 tests (critical)
pytest tests/test_retry.py tests/test_event_bus.py tests/test_job_queue.py tests/test_middleware_auth.py -v

# Run OSINT tests
pytest tests/osint/ -v

# Run services tests
pytest tests/services/ -v
```

---

## Maintenance Notes

### Python 3.9 Compatibility
The `crawl4ai` library uses Python 3.10+ type hints (`X | None`). These have been patched in the virtual environment:
- `.venv/lib/python3.9/site-packages/crawl4ai/browser_manager.py`
- `.venv/lib/python3.9/site-packages/crawl4ai/utils.py`

If `crawl4ai` is reinstalled, these patches must be reapplied by adding:
```python
from __future__ import annotations
```
to the top of each affected file.

### Missing Dependencies
The following were installed during test setup:
- `python-multipart` — Required for form data endpoints
- `apscheduler` — Required for scheduler endpoints

---

## Summary

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Test Files | 22 | 40+ |
| Total Tests | 339 | 740-830 |
| P0 Coverage | 0% | 90%+ |
| P1 Coverage | 20% | 80%+ |
| P2 Coverage | 40% | 70%+ |

**Estimated Effort:** 5 weeks for complete coverage improvement
**Highest ROI:** P0 infrastructure tests (prevent cascading failures)
