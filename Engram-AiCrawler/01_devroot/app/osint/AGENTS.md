<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# osint

## Purpose

OSINT (Open Source Intelligence) services and tools. Implements alias discovery across 8 platforms, threat intelligence, email/WHOIS/DNS lookup, image search, face recognition, semantic tracking, and darkweb monitoring.

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker |
| `alias_discovery.py` | AliasDiscoveryService — discovers aliases across 8 platforms |
| `platform_crawler.py` | PlatformCrawlRouter — routes searches to platform-specific adapters |
| `platforms.py` | Platform registry and base class for platform adapters |
| `threat_intel_service.py` | ThreatIntelService — breach checks, vulnerability data |
| `image_intelligence.py` | ImageIntelligenceService — AI image analysis and search |
| `image_search.py` | Reverse image search across multiple services |
| `email_osint_service.py` | Email lookup and validation |
| `whois_dns_service.py` | WHOIS, DNS, and domain OSINT |
| `face_recognition_service.py` | Face detection and recognition |
| `semantic_tracker.py` | Semantic similarity tracking for entities |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `platforms/` | Platform-specific crawlers (social media, people search, etc.) |
| `darkweb/` | Darkweb monitoring (Tor, breach databases, marketplace crawlers) |

## For AI Agents

### Working In This Directory

1. **Adding a new platform**: Create adapter in `platforms/` inheriting from `BaseAdapter`.
2. **Adding a new OSINT service**: Create class in new file (e.g., `new_service.py`) with async methods.
3. **Using alias discovery**: Instantiate `AliasDiscoveryService` and call `discover()` with username.
4. **Error handling**: Catch and log external API errors; use fallback data or skip failed platforms.

### Testing Requirements

- Mock all external API calls (no live HTTP requests in tests).
- Test each platform adapter independently.
- Test error cases: timeout, rate limit, invalid input.
- Test alias discovery with mixed success/failure (some platforms fail, others succeed).

### Common Patterns

- **Platform adapter**: Inherit `BaseAdapter`, implement `async def search(query: str) -> List[Result]`
- **Error handling**: Log and skip failed platforms; return partial results
- **Rate limiting**: Implement backoff strategies to respect API rate limits
- **Async concurrency**: Use `asyncio.gather()` to search multiple platforms in parallel

## Dependencies

### Internal
- `app.models` — Pydantic request/response schemas
- `app.services.cache` — Result caching
- `app.services.lm_studio_bridge` — AI analysis

### External
- aiohttp, httpx (HTTP clients)
- External OSINT APIs (social media, people search, breach databases, threat intel)
- Tor proxy (for darkweb access)
- LM Studio (image analysis)

<!-- MANUAL: -->
