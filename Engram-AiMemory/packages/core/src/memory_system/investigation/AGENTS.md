<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Investigation Module

## Purpose

Document discovery, crawling, parsing, and ingestion pipeline for memory system. Handles web crawling (Crawl4AI), PDF/DOCX parsing (PyMuPDF, python-docx), email extraction, and deduplication. Integrates with memory storage to persist extracted content as vector embeddings.

## Key Files

| File | Description |
|------|-------------|
| `crawler.py` | Crawl4AI wrapper for web crawling with URL deduplication (Redis-backed) |
| `crawler_service.py` | Async crawler orchestration and state management |
| `ingestor.py` | Document ingestor pipeline (crawled content → parsed → vectorized → stored) |
| `ingestor_service.py` | Service layer for ingestion workflows |
| `workers.py` | Async workers for crawling jobs (process queue, track progress) |
| `workers_service.py` | Service layer for worker management |
| `schemas.py` | Pydantic models (CrawlJob, CrawlResult, IngestJob, etc.) |
| `parser.py` | Unified document parser (PDF, DOCX, HTML, email, plaintext) |
| `deduplication.py` | URL and content deduplication logic |
| `evidence_client.py` | HTTP client for evidence storage API |
| `matter_client.py` | HTTP client for matter/investigation API |
| `registry_client.py` | HTTP client for entity registry API |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| (test subdirs under `../../tests/investigation/`) | Test fixtures and investigation test suites |

## For AI Agents

### Working In This Directory

- **Main workflow**: Crawl URLs → Parse documents → Extract text → Generate embeddings → Store in Weaviate
- **Entry point**: `CrawlerService.crawl_urls()` for batch crawling, `IngestorService.ingest_document()` for single doc
- **Deduplication**: Redis-backed URL set prevents re-crawling same pages
- **Error handling**: Crawler catches and logs errors per URL, continues with next batch
- **Async**: All I/O is async (crawling, parsing, API calls) — use `await`

### Testing Requirements

- Test suites in `../../tests/investigation/` (separate from core tests)
- Mocks: CrawlResult fixtures, mock Weaviate responses
- No live web crawling in unit tests (mock HTTP responses)
- Fixtures for PDF, DOCX, email samples

### Common Patterns

- **Crawl job**: `CrawlJob` specifies seed URLs, max depth, max pages; returns `CrawlResult[]`
- **Result**: `CrawlResult` contains URL, markdown, title, metadata, success flag, error message
- **Dedup**: `URLDeduplicator` uses Redis sets to track seen URLs per matter
- **Parser factory**: `DocumentParser.parse()` detects format, routes to specialized parser
- **Evidence API**: Crawled content stored as "evidence" (matter association optional)
- **Rate limiting**: Respects robots.txt and applies backoff on rate limits
- **Progress tracking**: Workers maintain job status (pending, running, completed, failed)

## Dependencies

### Internal

- `memory_system.client`: WeaviateClient for storage
- `memory_system.config`: Settings and API endpoints
- `memory_system.auth`: JWT for inter-service calls
- `memory_system.compat`: Timezone handling

### External

- `crawl4ai` (0.7.8+): Web crawling with Chromium
- `PyMuPDF` (1.24.0+): PDF parsing
- `python-docx` (1.1.0+): DOCX parsing
- `pytesseract`, `pdf2image`: OCR for scanned PDFs
- `openpyxl` (3.1.2+): Excel parsing
- `Pillow` (10.0.0+): Image processing
- `httpx` (0.27.0+): HTTP client for crawling and API calls
- `redis` (5.0.0+): URL deduplication

<!-- MANUAL: -->
