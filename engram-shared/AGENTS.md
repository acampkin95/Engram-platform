<!-- Generated: 2026-03-22 -->

# engram-shared/

## Purpose

Shared Python library for cross-service utilities. Used by Engram-AiMemory and Engram-AiCrawler to standardize logging, configuration, HTTP clients, authentication, and health checks. Reduces code duplication and enforces consistent patterns across microservices.

## Key Files

| File | Description |
|------|-------------|
| `pyproject.toml` | Build config, dependencies, version (0.1.0) |
| `README.md` | Package overview and usage examples |
| `QUICKSTART.md` | Quick reference with code examples |
| `INDEX.md` | Comprehensive module reference |
| `src/engram_shared/__init__.py` | Public API exports (6 functions, 1 class) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/engram_shared/` | Public modules (logging, config, http, auth, health) |
| `tests/` | Unit tests with 80% coverage threshold |
| `build/` | Build artifacts (wheel, sdist) |

## Module Reference

| Module | Exports | Purpose |
|--------|---------|---------|
| `logging.py` | `get_logger()`, `configure_root_logging()` | Structured logging with silenced noisy libraries |
| `config.py` | `BaseEngramSettings` | Pydantic settings base class with service defaults |
| `http.py` | `create_http_client()`, `fetch_with_retry()` | Async HTTP with connection pooling and backoff |
| `auth.py` | `create_jwt_token()`, `verify_jwt_token()`, `extract_bearer_token()` | JWT utilities (HS256, includes exp/iat) |
| `health.py` | `build_health_response()` | Standard health endpoint responses |

## For AI Agents

### Working In This Directory

1. **Adding New Utilities**
   - Keep modules focused (one concern per file)
   - All public functions must have type hints and docstrings (Google style)
   - All public exports must appear in `__init__.py`
   - No new dependencies — reuse existing (httpx, pydantic, pyjwt, python-dotenv)

2. **Updating Existing Code**
   - Backward compatibility is critical — never remove or rename exported symbols
   - Deprecation requires 2 release cycles before removal
   - Document all parameter changes
   - Include migration examples in docstrings

3. **Testing Coverage**
   - All public functions must have unit tests
   - Minimum 80% coverage (enforced in `quality-gate.sh`)
   - Use pytest fixtures for setup/teardown
   - Mock external dependencies (HTTP, Redis)

### Testing Requirements

- Run `pytest tests/ -v --cov=src/engram_shared --cov-fail-under=80`
- All HTTP tests use `httpx` mock (no real network calls)
- All JWT tests verify expiry and invalid signature handling
- All config tests verify env var loading and defaults

### Common Patterns

**Adding a new utility module:**
```python
# src/engram_shared/my_module.py
"""Module docstring (one-liner)."""

from typing import Optional

def my_function(param: str, timeout: Optional[int] = None) -> dict:
  """Function docstring.

  Args:
    param: Description.
    timeout: Description. Defaults to None.

  Returns:
    Dictionary with results.
  """
  ...

# Always export in __init__.py
from .my_module import my_function
__all__ = [..., "my_function"]
```

**Service integration:**
```python
# In Engram-AiMemory or Engram-AiCrawler
from engram_shared import (
    get_logger,
    BaseEngramSettings,
    create_http_client,
)

logger = get_logger(__name__)

class Settings(BaseEngramSettings):
    my_api_key: str = ""

settings = Settings()
```

## Dependencies

### Internal
- Used by `Engram-AiMemory/packages/core/` (pip install -e)
- Used by `Engram-AiCrawler/01_devroot/` (pip install -e)
- Version pinned in both services' requirements.txt

### External
- `pydantic` (2.0+) — settings, validation
- `httpx` (0.24+) — async HTTP client
- `pyjwt` (2.8+) — JWT encoding/decoding
- `python-dotenv` (1.0+) — .env file loading

## Installation & Development

```bash
# Development install (from service root)
pip install -e ../../engram-shared[dev]

# Testing
pytest tests/ -v

# Linting
ruff check src/ && ruff format src/

# Type checking
mypy src/

# Build
python -m build
```

<!-- MANUAL: This library is shared infrastructure. Changes here affect all services. Never break backward compatibility. Test thoroughly. -->
