# engram-shared Quick Start Guide

## Installation

```bash
# In your service's virtual environment
pip install -e /path/to/engram-shared[dev]
```

## Quick Examples

### 1. Logging

```python
from engram_shared import get_logger

logger = get_logger(__name__)
logger.info("Server started")
logger.error("Something went wrong")
```

### 2. Configuration

```python
from engram_shared import BaseEngramSettings
from pydantic import Field

class Settings(BaseEngramSettings):
    # Inherited: service_name, environment, log_level, debug
    # Inherited: redis_url, jwt_secret, jwt_algorithm, jwt_expiry_hours
    # Inherited: cors_origins

    # Add service-specific settings
    database_url: str = Field(default="sqlite:///app.db")
    api_key: str = Field(default="")

settings = Settings()
print(settings.redis_url)  # From .env or default
```

### 3. HTTP Client

```python
from engram_shared import create_http_client, fetch_with_retry

# Create client
client = create_http_client(
    base_url="http://api.example.com",
    timeout=30.0
)

# Use with automatic retry
response = await fetch_with_retry(
    client, "GET", "/users",
    params={"id": 123}
)
data = response.json()

await client.aclose()
```

### 4. JWT Authentication

```python
from engram_shared import create_jwt_token, verify_jwt_token

# Create token
token = create_jwt_token(
    {"sub": "user@example.com", "role": "admin"},
    secret="my-secret-key",
    expiry_hours=24
)

# Verify token
try:
    payload = verify_jwt_token(token, secret="my-secret-key")
    print(payload["sub"])  # "user@example.com"
except ValueError as e:
    print(f"Invalid token: {e}")
```

### 5. Bearer Token Extraction

```python
from engram_shared import extract_bearer_token

auth_header = "Bearer eyJhbGciOiJIUzI1NiIs..."
token = extract_bearer_token(auth_header)
# token = "eyJhbGciOiJIUzI1NiIs..."
```

### 6. Health Checks

```python
from fastapi import FastAPI
from engram_shared import build_health_response

app = FastAPI()

@app.get("/health")
def health():
    return build_health_response(
        "my-service",
        version="1.0.0",
        extra={"db": "connected"}
    )
    # Returns:
    # {
    #   "status": "ok",
    #   "service": "my-service",
    #   "version": "1.0.0",
    #   "timestamp": "2026-03-08T10:30:45.123456+00:00",
    #   "db": "connected"
    # }
```

## Module Overview

| Module | Main Functions |
|--------|----------------|
| `logging` | `get_logger()`, `configure_root_logging()` |
| `config` | `BaseEngramSettings` (base class) |
| `http` | `create_http_client()`, `fetch_with_retry()` |
| `auth` | `create_jwt_token()`, `verify_jwt_token()`, `extract_bearer_token()` |
| `health` | `build_health_response()` |

## Full API Import

```python
from engram_shared import (
    # Logging
    get_logger,
    configure_root_logging,

    # Config
    BaseEngramSettings,

    # HTTP
    create_http_client,
    fetch_with_retry,

    # Auth
    create_jwt_token,
    verify_jwt_token,
    extract_bearer_token,

    # Health
    build_health_response,
)
```

## Troubleshooting

### ImportError: No module named 'engram_shared'

```bash
# Reinstall package
pip install -e /path/to/engram-shared

# Verify installation
python3 -c "from engram_shared import get_logger; print('OK')"
```

### Missing Dependencies

```bash
# Install with dev dependencies
pip install -e /path/to/engram-shared[dev]

# Or install all dependencies
pip install pydantic pydantic-settings python-dotenv httpx tenacity python-jose[cryptography]
```

### Configuration Not Loading

Ensure `.env` file exists in working directory:

```bash
# Create .env
cat > .env << EOF
SERVICE_NAME=my-service
ENVIRONMENT=development
LOG_LEVEL=DEBUG
JWT_SECRET=my-secret-key
REDIS_URL=redis://localhost:6379
EOF
```

## Environment Variables

All settings can be configured via environment:

```bash
export SERVICE_NAME=my-api
export LOG_LEVEL=DEBUG
export JWT_SECRET=super-secret-key
export REDIS_URL=redis://prod-redis:6379
```

Or in `.env`:
```
SERVICE_NAME=my-api
LOG_LEVEL=DEBUG
JWT_SECRET=super-secret-key
REDIS_URL=redis://prod-redis:6379
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

## Full FastAPI Example

```python
from fastapi import FastAPI, Depends
from engram_shared import (
    get_logger,
    BaseEngramSettings,
    build_health_response,
    create_http_client,
)

logger = get_logger(__name__)

class Settings(BaseEngramSettings):
    api_key: str = ""

settings = Settings()
app = FastAPI()

@app.on_event("startup")
async def startup():
    logger.info("Starting %s", settings.service_name)

@app.on_event("shutdown")
async def shutdown():
    logger.info("Shutting down %s", settings.service_name)

@app.get("/health")
def health():
    return build_health_response(
        settings.service_name,
        version="1.0.0"
    )

@app.get("/items")
async def get_items():
    logger.info("Fetching items")
    return {"items": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Learn More

- **Full Documentation:** See `README.md` in this directory
- **Migration Guide:** See `aistore/reports/SHARED_LIBRARY_REPORT.md`
- **Architecture Details:** See `ENGRAM_SHARED_SUMMARY.md`

---

*Last updated: 2026-03-08*
