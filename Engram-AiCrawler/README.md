# Crawl4AI OSINT Container

A production-ready, containerized web crawling platform designed for OSINT (Open Source Intelligence) operations with AI-powered analysis.

**Version:** 0.2.0
**Python:** 3.11
**Crawl4AI:** 0.7.8

---

## Quick Start

### Prerequisites

- **Docker** 20.10+ or Docker Compose 2.0+
- **LM Studio** - Local LLM server running on `http://localhost:1234/v1`
- **8GB RAM** minimum (16GB recommended for production)
- **3GB shared memory** for Chromium

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd Crawl4AI

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# - LM_STUDIO_URL: Point to your LM Studio instance
# - API keys for external services (optional)

# Start all services
docker-compose up -d

# Verify services are healthy
docker-compose ps
curl http://localhost:11235/health

# View logs
docker-compose logs -f crawl4ai
docker-compose logs -f redis
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev

# Access at http://localhost:3000
```

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                Nginx / Port 80                 │
│            (Reverse Proxy - Planned)             │
├──────────────────────┬─────────────────────────────┤
│                      │                      │
│           FastAPI Application          │
│          (Port 11235)            │
│  ┌────────────────────────────────┐  │
│  │ API Endpoints           │  │
│  │ WebSocket Manager      │  │
│  │ ┌──────────────────┐   │  │
│  │ │ LM Studio Bridge │   │  │
│  │ │  Orchestrators   │   │  │
│  │ │ Services        │   │  │
│  │ │ OSINT Module    │   │  │
│  │ │ Scan Pipeline   │   │  │
│  │ └──────────────────┘   │  │
│  │                         │  │
│  │ Data Storage Layer     │  │
│  │ ┌──────────────┐     │  │
│  │ │ ChromaDB    │     │  │
│  │ │ Redis Cache  │     │  │
│  │ │ File System  │     │  │
│  │ └──────────────┘     │  │
│  │                     │      │
│  └─────────────────────┘      │
│                      │                      │
└──────────────────────┴─────────────────────────────┘

External Services:
├─ LM Studio (LLM API)
├─ Crawl4AI Library (Web Crawler)
└─ Target Websites (OSINT sources)
```

### Directory Structure

```
Crawl4AI/
├── 01_devroot/              # Main application code
│   ├── app/
│   │   ├── main.py           # FastAPI application entry
│   │   ├── api/            # API routers (crawl, chat, data)
│   │   ├── models/          # Pydantic data models
│   │   ├── services/        # Business logic services
│   │   ├── orchestrators/   # Crawl orchestration
│   │   ├── websocket/       # WebSocket manager
│   │   ├── core/            # Security, exceptions, retry policies
│   │   ├── storage/         # ChromaDB vector store client
│   │   ├── osint/           # Alias discovery, image search, semantic tracker
│   │   ├── orchestrators/   # OSINT scan pipeline orchestrator
│   │   └── pipelines/       # Model review pipeline
│   ├── frontend/             # React + Vite frontend
│   ├── tests/               # Test suite
│   ├── config.yml            # Application configuration
│   ├── supervisord.conf      # Process management
│   ├── Dockerfile            # Container build
│   ├── docker-compose.yml     # Multi-service orchestration
│   ├── ruff.toml           # Linting configuration
│   ├── mypy.ini            # Type checking configuration
│   └── .pre-commit-config.yaml # Git hooks
├── data/                   # Data directories (gitignored)
│   ├── cache/              # Crawl cache
│   ├── logs/               # Application logs
│   ├── tiers/              # Hot/warm/cold/archive storage
│   └── chroma/             # Vector database data
└── scripts/               # Utility scripts
    ├── start.sh             # Container startup
    └── healthcheck.sh        # Health monitoring
```

---

## Configuration

### Environment Variables

```bash
# Application
APP_NAME=crawl4ai-osint
APP_VERSION=0.1.0
DEBUG=false
LOG_LEVEL=INFO

# API Configuration
API_HOST=0.0.0.0
API_PORT=11235
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Crawl4AI Configuration
CRAWL4AI_VERSION=0.7.8
BROWSER_TYPE=chromium
HEADLESS=true
VIEWPORT_WIDTH=1920
VIEWPORT_HEIGHT=1080
CACHE_ENABLED=true
CACHE_MODE=enabled
WORD_COUNT_THRESHOLD=50
PAGE_TIMEOUT=30000

# LM Studio Configuration
LM_STUDIO_URL=http://host.docker.internal:1234/v1
LM_STUDIO_MODEL=local-model
LM_STUDIO_TIMEOUT=60
LM_STUDIO_MAX_RETRIES=3
LM_STUDIO_RETRY_DELAY=5
LM_STUDIO_TEMPERATURE=0.7

# Redis Configuration
REDIS_URL=redis://redis:6379/0
REDIS_MAX_CONNECTIONS=10
REDIS_SOCKET_TIMEOUT=5
REDIS_SOCKET_CONNECT_TIMEOUT=5

# ChromaDB Configuration
CHROMADB_PATH=/app/data/chroma
CHROMADB_COLLECTION_PREFIX=scan_
CHROMADB_SIMILARITY_THRESHOLD=0.75
CHROMADB_EMBEDDING_BATCH_SIZE=32

# Data Lifecycle
DATA_HOT_PATH=/app/data/tiers/hot
DATA_WARM_PATH=/app/data/tiers/warm
DATA_COLD_PATH=/app/data/tiers/cold
DATA_ARCHIVE_PATH=/app/data/tiers/archive
DATA_HOT_MAX_AGE_HOURS=24
DATA_WARM_MAX_AGE_DAYS=3
DATA_COLD_MAX_AGE_DAYS=7
DATA_OFFLOAD_THRESHOLD_DAYS=3
DATA_ARCHIVE_THRESHOLD_GB=50

# Watchdog Configuration
WATCHDOG_CHECK_INTERVAL_SECONDS=30
WATCHDOG_ORPHAN_AGE_MINUTES=60
WATCHDOG_MEMORY_THRESHOLD_PERCENT=90
WATCHDOG_DISK_THRESHOLD_PERCENT=85
WATCHDOG_MEMORY_CHECK_ENABLED=true
WATCHDOG_DISK_CHECK_ENABLED=true
```

---

## API Documentation

### Endpoints

#### Health & Status

- `GET /health` - Health check endpoint
- `GET /stats` - Service statistics
- `GET /` - Root endpoint

#### Crawl API

- `POST /api/crawl/start` - Start single crawl
  ```json
  {
    "url": "https://example.com",
    "extraction_type": "llm",
    "word_count_threshold": 50,
    "wait_for": ".content",
    "screenshot": false,
    "pdf": false
  }
  ```

- `POST /api/crawl/batch` - Batch crawl multiple URLs
  ```json
  {
    "urls": ["https://example.com", "https://example.org"],
    "max_concurrent": 5
  }
  ```

- `POST /api/crawl/deep` - Deep crawl with depth control
  ```json
  {
    "start_url": "https://example.com",
    "max_depth": 2,
    "max_pages": 10
  }
  ```

- `GET /api/crawl/status/{crawl_id}` - Get crawl status
- `GET /api/crawl/list` - List all crawls
- `DELETE /api/crawl/cancel/{crawl_id}` - Cancel running crawl

#### Chat API

- `POST /api/chat/completions` - LM Studio chat completion
  ```json
  {
    "messages": [
      {"role": "user", "content": "Find information about..."}
    ],
    "model": "local-model",
    "temperature": 0.7
  }
  ```

- `GET /api/chat/sessions` - List chat sessions
- `GET /api/chat/history/{message_id}` - Get chat message
- `DELETE /api/chat/clear` - Clear all sessions

#### Data Management API

- `POST /api/data/sets` - Create data set
- `GET /api/data/sets` - List all data sets
- `GET /api/data/sets/{data_set_id}` - Get data set details
- `PUT /api/data/sets/{data_set_id}` - Update data set
- `DELETE /api/data/sets/{data_set_id}` - Delete data set
- `POST /api/data/sets/{data_set_id}/migrate` - Migrate data set between tiers
- `POST /api/data/export` - Export data sets
- `POST /api/data/offload` - Trigger archive offload
- `GET /api/data/stats` - Data statistics

#### OSINT API

- `POST /api/osint/alias/discover` - Discover aliases across platforms
- `POST /api/osint/alias/search` - Comprehensive username search
- `GET /api/osint/platforms` - List supported OSINT platforms
- `POST /api/osint/image/analyze` - Analyze image hashes and metadata
- `POST /api/osint/image/search` - Reverse image search queries
- `POST /api/osint/scan` - Launch background OSINT scan pipeline
- `POST /api/osint/scan/sync` - Synchronous full scan pipeline
- `GET /api/osint/scan/list` - List completed scans
- `GET /api/osint/scan/{scan_id}` - Get specific scan result

#### Storage API (ChromaDB)

- `POST /api/storage/collections` - Create collection
- `GET /api/storage/collections` - List collections
- `DELETE /api/storage/collections/{name}` - Delete collection
- `POST /api/storage/collections/{name}/documents` - Add documents
- `POST /api/storage/collections/{name}/search` - Semantic search
- `GET /api/storage/collections/{name}/count` - Document count

#### Knowledge Graph API

- `POST /api/knowledge-graph/build` - Build knowledge graph from crawled content
- `GET /api/knowledge-graph/{scan_id}` - Retrieve knowledge graph
- `POST /api/knowledge-graph/search` - Search entities

#### WebSocket

- `WS /ws?client_id={client_id}` - Real-time updates
  - Subscribe to topics: `crawl:*`, `chat:*`, `data_changes`
  - Receive crawl progress updates
  - Receive chat message updates
  - Ping/pong for keepalive

---

## Development

### Code Quality Tools

```bash
# Install development dependencies
pip install -U ruff mypy pre-commit

# Run linter
ruff check app/

# Run type checker
mypy app/

# Run tests
pytest tests/ -v

# Format code
ruff format app/

# Check with pre-commit
pre-commit run --all-files
```

### Testing

```bash
# Run all tests
python3 run_tests.py

# Run specific test module
pytest tests/test_api.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

### Debugging

```bash
# Attach to running container
docker exec -it crawl4ai-osint bash

# View supervisord status
supervisorctl status

# View service logs
supervisorctl tail -f crawl4ai
supervisorctl tail -f lm_bridge
supervisorctl tail -f watchdog

# Check Python processes
ps aux | grep python
```

---

## Deployment

### Docker Deployment

```bash
# Build image
docker build -t crawl4ai-osint:latest .

# Run container
docker run -d \
  --name crawl4ai-osint \
  -p 11235:11235 \
  --shm-size=3g \
  -e LM_STUDIO_URL=http://host.docker.internal:1234/v1 \
  crawl4ai-osint:latest

# View logs
docker logs -f crawl4ai-osint
```

### Docker Compose Deployment

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart crawl4ai

# View logs
docker-compose logs -f
```

### Production Configuration

**Environment:**
- Set `DEBUG=false` in production
- Use strong secrets for API keys
- Configure proper CORS origins (not `*`)
- Set appropriate resource limits
- Enable log rotation

**Docker Compose:**
- Use versioned image tags (not `latest`)
- Configure resource limits
- Set restart policies
- Configure health checks
- Use separate production database
- Configure backup strategy

---

## Monitoring

### Health Checks

The container includes built-in health monitoring:

```bash
# Manual health check
curl http://localhost:11235/health

# Automated health checks (in healthcheck.sh script)
# - API health endpoint
# - Root endpoint
# - Stats endpoint
# - Critical process monitoring
# - LM Studio connectivity
# - Redis connectivity
```

### Logging

Logs are written to:

- **Application logs:** `/var/log/supervisor/crawl4ai-*.log`
- **Service logs:** `/var/log/supervisor/{service-name}*.log`
- **Data logs:** `/app/data/logs/app.log`

Log rotation: 50MB per file, 10 backups

### Metrics

Planned metrics to track:

- Crawl success/failure rates
- Average crawl duration
- Memory usage trends
- Disk usage trends
- LLM API call latency
- WebSocket connection counts

---

### Rate Limiting

The Crawl4AI OSINT Container includes built-in rate limiting to prevent abuse and ensure fair resource allocation across users.

#### Configuration

Rate limiting is configured via environment variables:

```bash
# Enable/disable rate limiting (default: true)
RATE_LIMIT_ENABLED=true

# User limits
USER_REQUESTS_PER_MINUTE=60
USER_DAILY_QUOTA=1000

# Admin limits (2x user limits)
ADMIN_REQUESTS_PER_MINUTE=120
ADMIN_DAILY_QUOTA=10000

# Redis connection (for distributed rate limiting)
REDIS_URL=redis://redis:6379/0
```

#### Tiered Limits

Rate limits are automatically tiered based on user role:

| Tier | Requests/Minute | Daily Quota |
|------|-----------------|-------------|
| User | 60 | 1,000 |
| Admin | 120 | 10,000 |

Admin users receive 2x the per-minute limit and 10x the daily quota of standard users.

#### Rate Limit Headers

All API responses include rate limit headers when rate limiting is enabled:

```
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 45
X-RateLimit-Reset-Minute: 30
X-RateLimit-Limit-Hour: 1000
X-RateLimit-Remaining-Hour: 850
X-RateLimit-Reset-Hour: 2700
```

#### Handling 429 Errors

When a rate limit is exceeded, the API returns HTTP 429 (Too Many Requests):

```json
{
  "detail": "Per-minute rate limit exceeded (60 requests/minute)",
  "retry_after": 30,
  "limit_type": "minute"
}
```

Headers included:
- `Retry-After`: Seconds to wait before retrying
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

#### Exempted Paths

The following paths are exempted from rate limiting:
- `/health` - Health check endpoint
- `/` - Root endpoint
- `/docs` - API documentation
- `/redoc` - ReDoc documentation
- `/openapi.json` - OpenAPI schema
- `/ws` - WebSocket endpoint

#### Daily Quota Reset

Daily quotas reset at midnight UTC. The `X-RateLimit-Reset-Day` header indicates when the daily quota will reset.

#### Disabling Rate Limiting

To disable rate limiting for development:

```bash
RATE_LIMIT_ENABLED=false
```

Note: When disabled, all requests are allowed without counting toward limits.

## Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check shared memory
docker run --shm-size=3g ...

# Check supervisord status
docker exec crawl4ai-osint supervisorctl status

# Check logs
docker logs crawl4ai-osint
```

**Crawls failing:**
- Verify LM Studio is running: `curl http://host.docker.internal:1234/v1/models`
- Check network connectivity
- Review crawl configuration
- Increase timeouts for slow websites
- Check browser logs for errors

**High memory usage:**
- Reduce `MAX_CONCURRENT_CRAWLS`
- Enable `text_mode` and `light_mode` in browser config
- Decrease shared memory size
- Enable memory monitoring in watchdog

**Tests failing:**
```bash
# Run specific test with verbose output
pytest tests/test_api.py::TestCrawlAPI::test_start_crawl -vvs

# Run with coverage report
pytest tests/ --cov=app --cov-report=html

# Check for import errors
python3 -m pytest --collect-only
```

**Type errors:**
```bash
# Run mypy with error details
mypy app/ --show-error-codes

# Check specific file
mypy app/main.py
```

---

## Contributing

### Development Workflow

1. Create feature branch from `main`
2. Make changes with tests
3. Run linter and type checker: `ruff check app/ && mypy app/`
4. Run tests: `pytest tests/ -v`
5. Ensure all tests pass
6. Create pull request with description

### Code Style

- Follow PEP 8 style guide
- Use type hints on all public functions
- Write docstrings for complex functions
- Keep functions focused and single-purpose
- Use descriptive variable names
- Maximum line length: 100 characters
- Maximum function length: 50 lines

### Commit Messages

```
type(scope): subject

Description: Detailed explanation of the change.

Footer: Issue #123
```

---

## License

[Specify your license here]

---

## Support

For issues, questions, or contributions:

- Create an issue on the project repository
- Check existing documentation in `01_devroot/TASK*_REPORT.md`
- Review the `STATUS_REVIEW.md` for current project status

---

## Changelog

### Version 0.2.0 (January 2026)

**Phase 1 — 10 Improvements (All Complete):**
- CI/CD pipeline with GitHub Actions and production Docker Compose
- SSRF protection with DNS resolution validation and security headers middleware
- ChromaDB vector store integration with CRUD collections, document storage, semantic search
- OSINT alias discovery across 8 platforms (Twitter, LinkedIn, GitHub, Instagram, Facebook, Reddit, TikTok, Mastodon)
- OSINT image search with perceptual hashing (pHash, dHash, wHash, aHash), EXIF metadata extraction
- Redis caching layer with fail-open pattern for crawl results and LM Studio responses
- Error handling hierarchy with custom exceptions, tenacity retry decorators, circuit breaker
- Model review pipeline with keep/derank/archive decisions and relevance scoring
- Integration tests covering crawl→cache, LM cache, alias discovery, ChromaDB, model review workflows
- Knowledge graph API with LM Studio entity/relationship extraction and ChromaDB storage

**Phase 2 — Pipeline & Frontend (All Complete):**
- End-to-end OSINT scan orchestrator (5-stage pipeline: alias→crawl→review→store→graph)
- WebSocket events for OSINT scans, knowledge graphs, and review updates
- OSINT scan API endpoints (background async + synchronous modes)
- React frontend pages: OSINT Dashboard (Full Scan tab), Storage management, Knowledge Graph viewer
- Navigation updated with Storage link
- Zod validation schemas for scan request/result types
- Full test suite: 114 tests passing

**Test Suite:** 114 tests passing (18 cache + 22 exceptions + 20 security + 19 integration + 19 orchestrator + 16 LM Studio bridge)

### Version 0.1.0 (January 2026)

**Added:**
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
