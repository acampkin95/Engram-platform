<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# osint

## Purpose

OSINT-specific API endpoints for alias discovery, threat intelligence, fraud detection, image intelligence, and deep crawling.

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker; exports routers |
| `alias.py` | POST /alias/discover, /alias/search, /alias/batch-discover; GET /platforms |
| `threat_intel.py` | POST /osint/threat endpoints (breach check, vulnerability data) |
| `fraud.py` | POST /osint/fraud endpoints (card validation, fraud scoring) |
| `image_intel.py` | POST /osint/image/intelligence endpoints (advanced image analysis) |
| `image_basic.py` | POST /osint/image/basic endpoints (basic reverse image search) |
| `deep_crawl.py` | POST /osint/deep-crawl endpoints (multi-stage OSINT pipeline) |

## For AI Agents

### Working In This Directory

1. **Adding OSINT endpoint**: Create new file `feature.py` with an `APIRouter`.
2. **Use AliasDiscoveryService**: For alias search across 8 platforms (see `alias.py`).
3. **Use ThreatIntelService**: For breach/vuln data (see `threat_intel.py`).
4. **Use ImageIntelligenceService**: For image-based OSINT (see `image_intel.py`).
5. **LM Studio bridge**: Use `LMStudioBridge` for local LLM analysis (e.g., prompt engineering).

### Testing Requirements

- Mock external OSINT APIs (breach databases, image search, etc.) with `unittest.mock`.
- Use pytest `autouse` fixtures to disable rate limiting and auth.
- Test error cases: network timeout, invalid input, API errors.

### Common Patterns

- **Service injection**: Get service instance from `get_service()` or instantiate in endpoint
- **Async workflows**: Chain multiple OSINT services (discover → crawl → analyze)
- **Batch operations**: Support bulk queries for efficiency
- **Rate limiting**: Already enforced at middleware; respect backoff headers from external APIs

## Dependencies

### Internal
- `app.osint` — OSINT service implementations
- `app.models` — Pydantic schemas for requests/responses
- `app.services.lm_studio_bridge` — Local LLM inference

### External
- External OSINT APIs (breach databases, people search platforms, threat intel feeds)
- LM Studio for local inference

<!-- MANUAL: -->
