# Environment Variables Reference

**Version:** 1.0.0 | **Last Updated:** March 2026

---

## Core Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | JWT signing secret (32+ chars) |
| `MEMORY_API_KEY` | Yes | - | API key for Memory API |
| `MCP_AUTH_TOKEN` | No | - | Static auth token for MCP |
| `API_KEYS` | No | - | Comma-separated API keys |

---

## Embedding Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMBEDDING_PROVIDER` | No | `openai` | Provider: `openai`, `deepinfra`, `nomic`, `ollama`, `local` |
| `OPENAI_API_KEY` | Conditional | - | OpenAI API key |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI API base URL |
| `DEEPINFRA_API_KEY` | Conditional | - | DeepInfra API key |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | No | `1536` | Vector dimensions |

---

## Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEAVIATE_URL` | No | `http://localhost:8080` | Weaviate HTTP URL |
| `WEAVIATE_GRPC_URL` | No | `http://localhost:50051` | Weaviate gRPC URL |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |

---

## Authentication (Clerk)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | - | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | - | Clerk secret key |
| `NEXT_PUBLIC_CLERK_DOMAIN` | No | - | Clerk domain |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | `/sign-in` | Sign-in URL path |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | `/sign-up` | Sign-up URL path |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | No | `/dashboard` | Post sign-in redirect |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | No | `/dashboard` | Post sign-up redirect |

---

## Application URLs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | No | `https://memory.velocitydigi.com` | Public app URL |
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins (comma-separated) |
| `MEMORY_API_BIND` | No | `0.0.0.0` | Memory API bind address |
| `BIND_ADDRESS` | No | `127.0.0.1` | Nginx bind address |

---

## Admin Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_USERNAME` | No | `admin` | Admin username |
| `ADMIN_PASSWORD_HASH` | Yes | - | Bcrypt hash of admin password |

---

## MCP Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_TRANSPORT` | No | `http` | Transport: `stdio` or `http` |
| `MCP_SERVER_PORT` | No | `3000` | MCP HTTP port |
| `MCP_SERVER_NAME` | No | `engram-mcp` | Server name |
| `MCP_SERVER_VERSION` | No | `1.0.0` | Server version |

---

## OAuth Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OAUTH_ENABLED` | No | `false` | Enable OAuth 2.1 |
| `OAUTH_ISSUER` | No | `http://localhost:3000` | OAuth issuer URL |
| `OAUTH_SECRET` | Conditional | - | OAuth signing secret |
| `OAUTH_ACCESS_TOKEN_TTL` | No | `3600` | Access token TTL (seconds) |
| `OAUTH_REFRESH_TOKEN_TTL` | No | `86400` | Refresh token TTL (seconds) |

---

## Crawler Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENGRAM_ENABLED` | No | `true` | Enable Engram integration |
| `ENGRAM_API_URL` | No | `http://memory-api:8000` | Memory API URL |
| `ENGRAM_AUTO_STORE` | No | `true` | Auto-store crawl results |
| `BROWSER_TYPE` | No | `chromium` | Browser: `chromium`, `firefox` |
| `HEADLESS` | No | `true` | Headless browser mode |
| `PAGE_TIMEOUT` | No | `60000` | Page load timeout (ms) |

---

## Performance Tuning

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UVICORN_WORKERS` | No | `2` | Uvicorn worker processes |
| `UVICORN_LIMIT_CONN` | No | `100` | Connection limit |
| `UVICORN_KEEPALIVE` | No | `5` | Keepalive timeout (seconds) |
| `LOG_LEVEL` | No | `INFO` | Log level: DEBUG, INFO, WARNING, ERROR |
| `RATE_LIMIT_PER_MINUTE` | No | `60` | API rate limit |

---

## Multi-Tenancy

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MULTI_TENANCY_ENABLED` | No | `true` | Enable multi-tenancy |
| `DEFAULT_TENANT_ID` | No | `default` | Default tenant ID |
| `CLEAN_SCHEMA_MIGRATION` | No | `false` | Clean schema on migration |

---

## Weaviate Configuration (Docker)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QUERY_DEFAULTS_LIMIT` | No | `100` | Default query limit |
| `AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED` | No | `true` | Allow anonymous access |
| `PERSISTENCE_DATA_PATH` | No | `/var/lib/weaviate` | Data directory |
| `DEFAULT_VECTORIZER_MODULE` | No | `none` | Default vectorizer |
| `CLUSTER_HOSTNAME` | No | `weaviate` | Cluster hostname |

---

## Redis Configuration (Docker)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_MAX_CONNECTIONS` | No | `50` | Max connections |
| `REDIS_SOCKET_TIMEOUT` | No | `5` | Socket timeout (seconds) |

---

## Generating Secrets

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# API Key (hex)
openssl rand -hex 32

# OAuth Secret (256-bit)
openssl rand -base64 32

# Bcrypt Password Hash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"
```

---

## Environment File Template

```bash
# =============================================================================
# ENGRAM PLATFORM - ENVIRONMENT CONFIGURATION
# =============================================================================

# CORE SECRETS
JWT_SECRET=
MEMORY_API_KEY=
MCP_AUTH_TOKEN=

# EMBEDDING PROVIDER
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# DATABASES
WEAVIATE_URL=http://weaviate:8080
REDIS_URL=redis://memory-redis:6379

# AUTHENTICATION (CLERK)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_APP_URL=https://memory.velocitydigi.com

# ADMIN
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=

# CORS
CORS_ORIGINS=https://memory.velocitydigi.com,https://engram.velocitydigi.com

# LOGGING
LOG_LEVEL=INFO
```
