# QA Framework Plan - Engram Monorepo

## Current Coverage Status

| Component | Current | Target | Gap |
|-----------|---------|--------|-----|
| AiMemory | 79.8% | 85% | +5.2% |
| AiCrawler | 57.82% | 75% | +17.18% |
| Platform | Mixed | 80% | Varies |
| MCP | Unknown | 80% | TBD |

## Implementation Phases

### Phase 1: Tooling (Days 1-2)
- Install jest-axe, pytest-xdist, pytest-html
- Configure coverage reporting
- Set up artifact capture

### Phase 2: Critical Tests (Days 3-7)
- AiMemory: test_config.py, test_context.py, test_memory.py
- AiCrawler: Expand retry, circuit breaker tests
- Platform: Add 15 route tests

### Phase 3: E2E Tests (Week 2)
- Login → Dashboard flow
- Memory CRUD operations
- Investigation creation flow
- Crawler job submission

### Phase 4: Smoke Tests (Week 3)
- Health check validation
- API endpoint testing
- Frontend smoke tests
- Artifact capture on failure

### Phase 5: CI/CD (Week 3-4)
- Coverage thresholds: 85% Python, 80% TS
- PR comments with coverage delta
- Post-deploy smoke tests
- Automated artifact upload

## Success Criteria
- All components meet coverage targets
- Critical paths have E2E coverage
- Smoke tests run in under 5 minutes
- Zero flaky tests
