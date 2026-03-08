# Crawler System Skill

**Version:** 1.0.0 | **Purpose:** Comprehensive skill for Engram Crawler API operations with full API coverage

---

## SKILL OVERVIEW

This skill provides comprehensive guidance for working with the Engram Crawler API. It includes complete API coverage, data tier management, browser automation patterns, and integration with the Memory System.

---

## ACTIVATION TRIGGERS

This skill activates when:
- Performing web crawling operations
- Extracting content from URLs
- Managing crawl data tiers
- Running OSINT operations
- Processing crawled documents

---

## CRAWLER API OVERVIEW

### Base URL

```
Development: http://localhost:11235
Production: https://memory.velocitydigi.com/crawler
```

### Authentication

```bash
# API Key authentication
curl -H "X-API-Key: your-api-key" http://localhost:11235/api/endpoint

# Or via Authorization header
curl -H "Authorization: Bearer your-api-key" http://localhost:11235/api/endpoint
```

### Health Check

```bash
# Basic health
curl http://localhost:11235/

# Expected response
{
  "status": "healthy",
  "version": "1.0.0",
  "browser": "chromium",
  "redis": "connected"
}
```

---

## COMPLETE API REFERENCE

### Crawl Endpoints

#### POST /crawl

**Purpose:** Crawl a single URL and extract content.

**Request:**
```json
{
  "url": "https://example.com",
  "extract_type": "markdown",
  "wait_for": "networkidle",
  "timeout": 60000,
  "include_links": true,
  "include_images": true,
  "include_metadata": true,
  "custom_selector": null,
  "javascript": true,
  "user_agent": null,
  "headers": {},
  "cookies": [],
  "screenshot": false,
  "pdf": false
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | URL to crawl |
| `extract_type` | string | No | `markdown` | Output format: `markdown`, `text`, `html`, `json` |
| `wait_for` | string | No | `networkidle` | Wait condition: `load`, `domcontentloaded`, `networkidle` |
| `timeout` | integer | No | 60000 | Page timeout in milliseconds |
| `include_links` | boolean | No | true | Extract links from page |
| `include_images` | boolean | No | true | Extract image URLs |
| `include_metadata` | boolean | No | true | Extract page metadata |
| `custom_selector` | string | No | null | CSS selector for content extraction |
| `javascript` | boolean | No | true | Execute JavaScript |
| `user_agent` | string | No | null | Custom user agent |
| `headers` | object | No | {} | Custom HTTP headers |
| `cookies` | array | No | [] | Cookies to set |
| `screenshot` | boolean | No | false | Capture screenshot |
| `pdf` | boolean | No | false | Generate PDF |

**Response:**
```json
{
  "url": "https://example.com",
  "status": "success",
  "content": "# Page Title\n\nPage content in markdown...",
  "metadata": {
    "title": "Page Title",
    "description": "Meta description",
    "keywords": ["keyword1", "keyword2"],
    "author": "Author Name",
    "published_date": "2026-01-15",
    "modified_date": "2026-03-01"
  },
  "links": [
    {"text": "Link Text", "url": "https://example.com/page", "type": "internal"}
  ],
  "images": [
    {"alt": "Image Alt", "src": "https://example.com/image.jpg"}
  ],
  "screenshot": "base64-encoded-image",
  "pdf": "base64-encoded-pdf",
  "crawl_time_ms": 2345,
  "timestamp": "2026-03-02T10:00:00Z"
}
```

**Example Usage:**
```bash
# Basic crawl
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# With screenshot
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "screenshot": true,
    "extract_type": "markdown"
  }'

# With custom selector
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "custom_selector": "article.main-content",
    "include_metadata": true
  }'
```

#### POST /crawl/batch

**Purpose:** Crawl multiple URLs in batch.

**Request:**
```json
{
  "urls": [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3"
  ],
  "extract_type": "markdown",
  "concurrency": 3,
  "delay_ms": 1000,
  "stop_on_error": false,
  "common_options": {
    "timeout": 30000,
    "javascript": true
  }
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `urls` | array | Yes | - | URLs to crawl (max 50) |
| `concurrency` | integer | No | 3 | Parallel crawls |
| `delay_ms` | integer | No | 1000 | Delay between requests |
| `stop_on_error` | boolean | No | false | Stop on first error |
| `common_options` | object | No | {} | Options for all URLs |

**Response:**
```json
{
  "job_id": "job-uuid",
  "status": "processing",
  "total": 3,
  "completed": 0,
  "failed": 0,
  "results_url": "/crawl/batch/job-uuid/results"
}
```

**Check Status:**
```bash
curl http://localhost:11235/crawl/batch/job-uuid/status
```

**Get Results:**
```bash
curl http://localhost:11235/crawl/batch/job-uuid/results
```

#### POST /crawl/sitemap

**Purpose:** Crawl URLs from a sitemap.

**Request:**
```json
{
  "sitemap_url": "https://example.com/sitemap.xml",
  "max_urls": 100,
  "url_pattern": ".*blog.*",
  "extract_type": "markdown",
  "store_in_memory": true,
  "project_id": "my-project"
}
```

**Response:**
```json
{
  "job_id": "sitemap-job-uuid",
  "sitemap_url": "https://example.com/sitemap.xml",
  "urls_found": 250,
  "urls_matched": 45,
  "urls_queued": 45,
  "status": "processing"
}
```

#### POST /crawl/domain

**Purpose:** Crawl entire domain with depth control.

**Request:**
```json
{
  "start_url": "https://example.com",
  "max_depth": 2,
  "max_pages": 100,
  "allowed_domains": ["example.com"],
  "exclude_patterns": [".*/admin.*", ".*/login.*"],
  "include_patterns": [".*/blog.*", ".*/docs.*"],
  "respect_robots_txt": true,
  "extract_type": "markdown",
  "store_in_memory": true,
  "project_id": "my-project"
}
```

**Response:**
```json
{
  "job_id": "domain-job-uuid",
  "start_url": "https://example.com",
  "status": "processing",
  "pages_queued": 0,
  "pages_crawled": 0,
  "pages_failed": 0,
  "current_depth": 0
}
```

### Data Tier Endpoints

#### GET /data/tiers

**Purpose:** List data tiers and their status.

**Response:**
```json
{
  "tiers": {
    "hot": {
      "path": "/app/data/tiers/hot",
      "file_count": 125,
      "size_bytes": 52428800,
      "oldest_file": "2026-03-02T00:00:00Z",
      "newest_file": "2026-03-02T10:00:00Z"
    },
    "warm": {
      "path": "/app/data/tiers/warm",
      "file_count": 450,
      "size_bytes": 209715200,
      "oldest_file": "2026-02-23T00:00:00Z",
      "newest_file": "2026-03-01T00:00:00Z"
    },
    "cold": {
      "path": "/app/data/tiers/cold",
      "file_count": 1200,
      "size_bytes": 524288000,
      "oldest_file": "2026-01-01T00:00:00Z",
      "newest_file": "2026-02-22T00:00:00Z"
    },
    "archive": {
      "path": "/app/data/tiers/archive",
      "file_count": 5000,
      "size_bytes": 2147483648,
      "oldest_file": "2025-01-01T00:00:00Z",
      "newest_file": "2025-12-31T00:00:00Z"
    }
  }
}
```

#### POST /data/offload

**Purpose:** Manually trigger data offloading between tiers.

**Request:**
```json
{
  "source_tier": "hot",
  "target_tier": "warm",
  "older_than_hours": 24,
  "dry_run": false
}
```

**Response:**
```json
{
  "status": "completed",
  "files_offloaded": 45,
  "bytes_moved": 10485760,
  "errors": []
}
```

#### GET /data/search

**Purpose:** Search across crawled data in all tiers.

**Request:**
```json
{
  "query": "authentication tutorial",
  "tiers": ["hot", "warm"],
  "limit": 20,
  "include_content": true
}
```

**Response:**
```json
{
  "results": [
    {
      "url": "https://example.com/auth-tutorial",
      "title": "Authentication Tutorial",
      "tier": "hot",
      "crawl_date": "2026-03-02T08:00:00Z",
      "relevance_score": 0.95,
      "snippet": "...comprehensive guide to implementing authentication..."
    }
  ],
  "total": 15
}
```

### OSINT Endpoints

#### POST /osint/domain

**Purpose:** Gather OSINT data for a domain.

**Request:**
```json
{
  "domain": "example.com",
  "include_subdomains": true,
  "include_dns": true,
  "include_ssl": true,
  "include_whois": true,
  "include_technologies": true,
  "store_in_memory": true,
  "project_id": "investigation-001"
}
```

**Response:**
```json
{
  "domain": "example.com",
  "dns": {
    "a": ["93.184.216.34"],
    "aaaa": ["2606:2800:220:1:248:1893:25c8:1946"],
    "mx": ["mail.example.com"],
    "ns": ["ns1.example.com", "ns2.example.com"],
    "txt": ["v=spf1 include:_spf.example.com ~all"]
  },
  "ssl": {
    "issuer": "Let's Encrypt",
    "valid_from": "2026-01-01",
    "valid_to": "2026-04-01",
    "san": ["example.com", "www.example.com"]
  },
  "whois": {
    "registrar": "Example Registrar",
    "created": "2020-01-01",
    "expires": "2027-01-01",
    "nameservers": ["ns1.example.com"]
  },
  "technologies": ["Nginx", "React", "Node.js"],
  "subdomains": ["www", "api", "mail", "blog"]
}
```

#### POST /osint/social

**Purpose:** Gather social media presence data.

**Request:**
```json
{
  "query": "company-name",
  "platforms": ["twitter", "linkedin", "github"],
  "store_in_memory": true,
  "project_id": "investigation-001"
}
```

#### POST /osint/document

**Purpose:** Ingest and analyze documents.

**Request:**
```json
{
  "source_type": "url",
  "source": "https://example.com/document.pdf",
  "extract_text": true,
  "extract_metadata": true,
  "ocr_enabled": true,
  "store_in_memory": true,
  "project_id": "investigation-001"
}
```

### WebSocket Endpoints

#### WS /ws/crawl/{job_id}

**Purpose:** Real-time crawl progress updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:11235/ws/crawl/job-uuid');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Progress:', update.progress);
  console.log('Current URL:', update.current_url);
};
```

**Message Format:**
```json
{
  "type": "progress",
  "job_id": "job-uuid",
  "current_url": "https://example.com/page2",
  "progress": 0.45,
  "pages_completed": 45,
  "pages_total": 100,
  "errors": 2,
  "timestamp": "2026-03-02T10:00:00Z"
}
```

---

## DATA TIER MANAGEMENT

### Tier Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOT TIER                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Age: Last 24 hours                                    │   │
│  │  • Storage: SSD, fastest access                          │   │
│  │  • Access Pattern: Immediate retrieval                   │   │
│  │  • Data: Active crawls, recent results                   │   │
│  │  • Offload Trigger: Age > 24h                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Offload after 24h
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WARM TIER                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Age: 1-7 days                                         │   │
│  │  • Storage: Standard disk                                │   │
│  │  • Access Pattern: Cached retrieval                      │   │
│  │  • Data: Recent crawls, still active                     │   │
│  │  • Offload Trigger: Age > 7 days                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Offload after 7d
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       COLD TIER                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Age: 8-30 days                                        │   │
│  │  • Storage: Compressed                                   │   │
│  │  • Access Pattern: On-demand retrieval                   │   │
│  │  • Data: Historical, infrequent access                   │   │
│  │  • Offload Trigger: Age > 30 days                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Archive after 30d
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ARCHIVE TIER                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Age: > 30 days                                        │   │
│  │  • Storage: S3-compatible, compressed                    │   │
│  │  • Access Pattern: Slowest retrieval                     │   │
│  │  • Data: Long-term retention                             │   │
│  │  • Retention: Configurable (default: 1 year)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Automatic Tier Management

```bash
# Configuration via environment
DATA_HOT_MAX_AGE_HOURS=24
DATA_WARM_MAX_AGE_DAYS=7
DATA_COLD_MAX_AGE_DAYS=30
DATA_OFFLOAD_THRESHOLD_DAYS=14
DATA_ARCHIVE_THRESHOLD_GB=10
DATA_CLEANUP_INTERVAL_MINUTES=60
```

### Manual Tier Operations

```bash
# Check tier status
curl http://localhost:11235/data/tiers

# Offload hot to warm
curl -X POST http://localhost:11235/data/offload \
  -H "Content-Type: application/json" \
  -d '{
    "source_tier": "hot",
    "target_tier": "warm",
    "older_than_hours": 24
  }'

# Search all tiers
curl -X POST http://localhost:11235/data/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "search term",
    "tiers": ["hot", "warm", "cold"],
    "limit": 20
  }'
```

---

## BROWSER AUTOMATION PATTERNS

### Playwright Configuration

```python
# Browser configuration
BROWSER_CONFIG = {
    "type": "chromium",  # chromium, firefox, webkit
    "headless": True,
    "viewport": {
        "width": 1920,
        "height": 1080
    },
    "user_agent": None,  # Use default
    "locale": "en-US",
    "timezone": "UTC",
    "ignore_https_errors": False,
    "java_script_enabled": True,
    "bypass_csp": False,
    "slow_mo": 0,  # Slow down operations (ms)
}
```

### Common Crawl Patterns

#### Pattern 1: Basic Page Crawl

```python
async def crawl_basic(url: str) -> dict:
    """Basic page crawl with content extraction."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto(url, wait_until="networkidle")
        content = await page.content()
        title = await page.title()

        await browser.close()

        return {
            "url": url,
            "title": title,
            "content": content
        }
```

#### Pattern 2: Wait for Dynamic Content

```python
async def crawl_dynamic(url: str, selector: str) -> dict:
    """Wait for specific element to load."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto(url)
        await page.wait_for_selector(selector, timeout=30000)

        content = await page.inner_text(selector)

        await browser.close()

        return {"content": content}
```

#### Pattern 3: Handle Authentication

```python
async def crawl_authenticated(url: str, credentials: dict) -> dict:
    """Crawl page requiring authentication."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Login first
        await page.goto(credentials["login_url"])
        await page.fill('input[name="username"]', credentials["username"])
        await page.fill('input[name="password"]', credentials["password"])
        await page.click('button[type="submit"]')
        await page.wait_for_url("**/dashboard**")

        # Now crawl protected page
        await page.goto(url)
        content = await page.content()

        await browser.close()

        return {"content": content}
```

#### Pattern 4: Screenshot and PDF

```python
async def crawl_with_assets(url: str) -> dict:
    """Crawl with screenshot and PDF generation."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto(url, wait_until="networkidle")

        # Screenshot
        screenshot = await page.screenshot(full_page=True)

        # PDF
        pdf = await page.pdf(format="A4")

        content = await page.content()

        await browser.close()

        return {
            "content": content,
            "screenshot": base64.b64encode(screenshot).decode(),
            "pdf": base64.b64encode(pdf).decode()
        }
```

---

## MEMORY INTEGRATION

### Automatic Memory Storage

```python
# Crawler automatically stores in memory when:
# - store_in_memory=true in request
# - project_id is provided

async def crawl_and_store(url: str, project_id: str):
    """Crawl URL and store in memory system."""
    response = await client.post("/crawl", json={
        "url": url,
        "extract_type": "markdown",
        "store_in_memory": True,
        "project_id": project_id
    })

    # This automatically:
    # 1. Crawls the URL
    # 2. Extracts content
    # 3. Stores in Memory API
    # 4. Returns memory_id
```

### Manual Memory Storage

```python
async def store_crawl_result(crawl_result: dict, project_id: str):
    """Manually store crawl result in memory."""
    memory_data = {
        "content": f"""CRAWL RESULT: {crawl_result['url']}

## Content
{crawl_result['content'][:5000]}

## Metadata
- Title: {crawl_result['metadata']['title']}
- Description: {crawl_result['metadata']['description']}
- Crawl Time: {crawl_result['crawl_time_ms']}ms

## Links Found
{len(crawl_result['links'])} links

## Images Found
{len(crawl_result['images'])} images
""",
        "tier": 1,
        "memory_type": "fact",
        "source": "crawler",
        "project_id": project_id,
        "importance": 0.5,
        "tags": ["crawl", "web", "content", "extracted"],
        "metadata": {
            "url": crawl_result["url"],
            "crawl_timestamp": crawl_result["timestamp"],
            "content_length": len(crawl_result["content"])
        }
    }

    # Store via Memory API
    await memory_client.add_memory(**memory_data)
```

---

## ERROR HANDLING

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `TIMEOUT` | Page load exceeded timeout | Increase timeout or check URL |
| `NAVIGATION_FAILED` | Could not navigate to URL | Check URL validity, DNS |
| `BROWSER_CRASH` | Browser process crashed | Reduce concurrency, check memory |
| `ROBOTS_TXT_BLOCKED` | Blocked by robots.txt | Respect or override (carefully) |
| `RATE_LIMITED` | Too many requests | Add delay between requests |
| `CONTENT_EXTRACTION_FAILED` | Could not extract content | Check selector, page structure |

### Error Recovery Pattern

```python
async def crawl_with_retry(url: str, max_retries: int = 3):
    """Crawl with automatic retry on failure."""
    for attempt in range(max_retries):
        try:
            result = await crawl(url)
            return result
        except TimeoutError:
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
                continue
            raise
        except NavigationError as e:
            if "403" in str(e):
                # Don't retry forbidden
                raise
            if attempt < max_retries - 1:
                await asyncio.sleep(5)
                continue
            raise
```

---

## PERFORMANCE TUNING

### Concurrency Settings

```bash
# Environment variables
CRAWLER_MAX_CONCURRENCY=5
CRAWLER_BROWSER_POOL_SIZE=3
CRAWLER_REQUEST_TIMEOUT=60000
CRAWLER_PAGE_TIMEOUT=30000
```

### Resource Limits

```yaml
# docker-compose.yml
crawler-api:
  deploy:
    resources:
      limits:
        memory: 3G
        cpus: '2.0'
      reservations:
        memory: 1G
```

### Caching

```bash
# Redis cache settings
CRAWLER_CACHE_ENABLED=true
CRAWLER_CACHE_MODE=aggressive
CRAWLER_CACHE_TTL=3600
```

---

## QUICK REFERENCE

```
╔══════════════════════════════════════════════════════════════╗
║            CRAWLER SYSTEM SKILL QUICK REFERENCE              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  BASIC CRAWL:                                                ║
║  POST /crawl {"url": "..."}                                  ║
║                                                              ║
║  BATCH CRAWL:                                                ║
║  POST /crawl/batch {"urls": [...], "concurrency": 3}         ║
║                                                              ║
║  DOMAIN CRAWL:                                               ║
║  POST /crawl/domain {"start_url": "...", "max_depth": 2}     ║
║                                                              ║
║  SITEMAP CRAWL:                                              ║
║  POST /crawl/sitemap {"sitemap_url": "..."}                  ║
║                                                              ║
║  OSINT:                                                      ║
║  POST /osint/domain {"domain": "..."}                        ║
║  POST /osint/social {"query": "..."}                         ║
║                                                              ║
║  DATA TIERS:                                                 ║
║  GET /data/tiers                                             ║
║  POST /data/offload                                          ║
║  POST /data/search                                           ║
║                                                              ║
║  WEBSOCKET:                                                  ║
║  WS /ws/crawl/{job_id}                                       ║
║                                                              ║
║  TIERS: hot (24h) → warm (7d) → cold (30d) → archive        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

**Document Control**

| Author | Purpose | Version |
|--------|---------|---------|
| Engram Team | Crawler skill reference | 1.0.0 |
