# engram-shared

Shared Python utilities used across all Engram microservices.

## Installation

Install as editable in each service's virtual environment:

```bash
pip install -e /path/to/engram-shared
# or from monorepo root:
pip install -e ./engram-shared
```

## Modules

| Module | Purpose |
|--------|---------|
| `engram_shared.logging` | Structured logging config (`get_logger`, `configure_root_logging`) |
| `engram_shared.config` | `BaseEngramSettings` — pydantic-settings base class |
| `engram_shared.http` | `create_http_client`, `fetch_with_retry` |
| `engram_shared.auth` | `create_jwt_token`, `verify_jwt_token`, `extract_bearer_token` |
| `engram_shared.health` | `build_health_response` for health endpoints |

## Usage

```python
from engram_shared import (
    get_logger,
    BaseEngramSettings,
    create_http_client,
    verify_jwt_token,
)

logger = get_logger(__name__)

class MyServiceSettings(BaseEngramSettings):
    my_api_key: str = ""

settings = MyServiceSettings()

# Create HTTP client
client = create_http_client(base_url="http://api.example.com")

# Verify JWT token
payload = verify_jwt_token(token, secret="my-secret")
```

## Services Using This Package

- `Engram-AiMemory` — Memory API
- `Engram-AiCrawler` — OSINT Crawler API

## Contributing

All code must follow project style:
- 100 character line width
- Type hints on public functions
- Double quotes for strings
- PEP 8 compliance
