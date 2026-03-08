# engram-shared Package Index

**Version:** 0.1.0
**Status:** Production Ready ✅
**Created:** 2026-03-08
**Python:** 3.11+

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Package overview and installation |
| [QUICKSTART.md](QUICKSTART.md) | Code examples and quick reference |
| [../ENGRAM_SHARED_SUMMARY.md](../ENGRAM_SHARED_SUMMARY.md) | Executive summary |
| [../aistore/reports/SHARED_LIBRARY_REPORT.md](../aistore/reports/SHARED_LIBRARY_REPORT.md) | Comprehensive technical report |

---

## Public API

### Logging
```python
from engram_shared import get_logger, configure_root_logging
```

### Configuration
```python
from engram_shared import BaseEngramSettings
```

### HTTP
```python
from engram_shared import create_http_client, fetch_with_retry
```

### Authentication
```python
from engram_shared import create_jwt_token, verify_jwt_token, extract_bearer_token
```

### Health Checks
```python
from engram_shared import build_health_response
```

---

## Directory Structure

```
engram-shared/
├── src/engram_shared/
│   ├── __init__.py              # Public API exports
│   ├── logging.py               # Logging utilities (2 functions)
│   ├── config.py                # Pydantic settings base (1 class)
│   ├── http.py                  # HTTP client factory (2 functions)
│   ├── auth.py                  # JWT utilities (3 functions)
│   └── health.py                # Health check builder (1 function)
├── pyproject.toml               # Build configuration
├── README.md                    # Package documentation
├── QUICKSTART.md                # Quick reference guide
└── INDEX.md                     # This file
```

---

## Installation

### For AiMemory
```bash
pip install -e ../../../engram-shared[dev]
```

### For AiCrawler
```bash
pip install -e ../../engram-shared[dev]
```

---

## Services Using This Package

- ✅ **Engram-AiMemory** — Memory API
- ✅ **Engram-AiCrawler** — OSINT Crawler API
- 🔄 **Engram-MCP** — Future TypeScript migration
- 🔄 **Engram-Platform** — Future backend utilities

---

## Development

### Run Tests
```bash
pytest tests/ -v --cov=src/engram_shared --cov-fail-under=80
```

### Lint Code
```bash
ruff check src/
ruff format src/
```

### Type Check
```bash
mypy src/
```

---

## Module Reference

### `logging.py` — Logging Utilities

**Functions:**
- `get_logger(name: str, level: Optional[str] = None) -> Logger`
  - Get a configured logger instance
  - Default format: `{timestamp} | {level} | {name} | {message}`

- `configure_root_logging(level: str = "INFO") -> None`
  - Configure root logging for service startup
  - Quiets noisy libraries (httpx, httpcore, uvicorn.access)

---

### `config.py` — Configuration Base Class

**Classes:**
- `BaseEngramSettings(BaseSettings)`
  - Inherits from `pydantic.settings.BaseSettings`
  - Loads from `.env` files
  - Common fields for all services:
    - `service_name` (default: "engram-service")
    - `environment` (default: "development")
    - `log_level` (default: "INFO")
    - `debug` (default: False)
    - `redis_url` (default: "redis://localhost:6379")
    - `redis_ttl` (default: 3600)
    - `jwt_secret` (default: "")
    - `jwt_algorithm` (default: "HS256")
    - `jwt_expiry_hours` (default: 24)
    - `cors_origins` (default: ["http://localhost:3002", "http://localhost:3000"])

**Usage:**
```python
class MySettings(BaseEngramSettings):
    my_api_key: str = ""
```

---

### `http.py` — HTTP Client Factory

**Functions:**
- `create_http_client(base_url: str = "", timeout: float = 30.0, max_connections: int = 10, headers: dict | None = None) -> AsyncClient`
  - Create a configured httpx.AsyncClient
  - Includes connection pooling, timeouts, and redirect following

- `fetch_with_retry(client: AsyncClient, method: str, url: str, **kwargs) -> Response`
  - Make HTTP request with automatic retry
  - 3 attempts, exponential backoff (1s → 10s)
  - Raises on 4xx/5xx after retries exhausted

---

### `auth.py` — JWT Authentication

**Functions:**
- `create_jwt_token(data: dict, secret: str, algorithm: str = "HS256", expiry_hours: int = 24) -> str`
  - Create signed JWT token
  - Includes `exp` and `iat` claims

- `verify_jwt_token(token: str, secret: str, algorithm: str = "HS256") -> dict`
  - Verify and decode JWT token
  - Raises ValueError if expired or invalid

- `extract_bearer_token(authorization: str) -> str`
  - Parse "Bearer <token>" Authorization header
  - Raises ValueError if format invalid

---

### `health.py` — Health Check Builder

**Functions:**
- `build_health_response(service_name: str, version: str = "unknown", extra: dict | None = None) -> dict`
  - Build standard health check response
  - Includes: status, service, version, timestamp, and any extra fields

---

## Code Quality

✅ **100% Type Hints** — All public functions fully typed
✅ **Google Style Docstrings** — Every function documented
✅ **100 Character Line Width** — Configured in ruff
✅ **PEP 8 Compliant** — 4-space indentation, double quotes
✅ **Async Ready** — Full asyncio support
✅ **Zero New Dependencies** — Uses existing dependencies

---

## Migration Phases

### Phase 1: Logging (Week 1)
Replace all service logging with `get_logger()`.

### Phase 2: Configuration (Week 2)
Subclass `BaseEngramSettings` in both services.

### Phase 3: Authentication (Week 3)
Use `create_jwt_token()` and `verify_jwt_token()`.

### Phase 4: HTTP Client (Week 4)
Use `create_http_client()` and `fetch_with_retry()`.

### Phase 5: Health Checks (Week 5)
Use `build_health_response()` in all endpoints.

See [../ENGRAM_SHARED_SUMMARY.md](../ENGRAM_SHARED_SUMMARY.md) for complete migration guide.

---

## FAQ

**Q: How do I install this in my service?**
A: Run `pip install -e /path/to/engram-shared[dev]` in your virtual environment.

**Q: Can I use this alongside existing code?**
A: Yes! Both old and new code can coexist during migration.

**Q: Are there any breaking changes?**
A: No. This is purely additive.

**Q: What if I find a bug?**
A: Fix it here, then update all services using that module.

**Q: How do I add new utilities?**
A: Add them to engram-shared, bump version in pyproject.toml, update services.

---

## Support

- **Issues:** Create an issue in the main Engram repository
- **Questions:** See the [Comprehensive Report](../aistore/reports/SHARED_LIBRARY_REPORT.md)
- **Examples:** See [QUICKSTART.md](QUICKSTART.md)

---

## Related Files

**Configuration:**
- `pyproject.toml` — Build and dependency configuration
- `src/engram_shared/__init__.py` — Public API exports

**Documentation:**
- `README.md` — Full package documentation
- `QUICKSTART.md` — Quick reference with examples
- `INDEX.md` — This file

**Project Documentation:**
- `../ENGRAM_SHARED_SUMMARY.md` — Executive summary
- `../aistore/reports/SHARED_LIBRARY_REPORT.md` — Comprehensive technical report

---

**Last Updated:** 2026-03-08
**Status:** ✅ Production Ready
