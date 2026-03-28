<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# orchestrators

## Purpose

High-level workflow coordinators that compose multiple services and steps into complete pipelines. Examples: CrawlOrchestrator (generates crawl plans), DeepCrawlOrchestrator (multi-stage OSINT), OsintScanOrchestrator (alias discovery → crawl → analysis).

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker |
| `crawl_orchestrator.py` | Crawl planning and execution via LM Studio + Crawl4AI |

## For AI Agents

### Working In This Directory

1. **Adding an orchestrator**: Create class with `__init__` for dependency injection and async methods for workflow steps.
2. **Async workflows**: Use `asyncio.gather()`, `asyncio.Semaphore` for concurrency control.
3. **Error handling**: Catch and log service errors; use circuit breaker patterns for external calls.
4. **Testing**: Mock all service dependencies; test happy path and error scenarios.

### Testing Requirements

- All orchestrator methods must have unit tests with mocked services.
- Test both sequential and concurrent execution paths.
- Test error cases: service timeout, invalid input, partial failures.

### Common Patterns

- **Dependency injection**: Accept services in `__init__` (LMStudioBridge, CrawlService, etc.)
- **Semaphore for concurrency**: `async with self.semaphore: await service_call()`
- **Error handling**: Try-except with logging; fail gracefully or raise custom exceptions
- **Workflow steps**: Break complex workflows into named async methods (e.g., `_discover_aliases()`, `_crawl_results()`)

## Dependencies

### Internal
- `app.services.lm_studio_bridge` — LM Studio inference
- `app.osint` — OSINT services
- `app.pipelines` — Data processing

### External
- asyncio, Crawl4AI

<!-- MANUAL: -->
