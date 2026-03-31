# 10 — Deployment Guide

> Engram Platform v1.1.0 — Step-by-step deployment from scratch.
> Last updated: 2026-03-31

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone Repository and Configure Environment](#2-clone-repository-and-configure-environment)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Docker Services — Build and Start](#4-docker-services--build-and-start)
5. [Initial Setup and Initialization](#5-initial-setup-and-initialization)
6. [Nginx and SSL Configuration](#6-nginx-and-ssl-configuration)
7. [Service Validation and Health Checks](#7-service-validation-and-health-checks)
8. [Frontend Build — Next.js Standalone Output](#8-frontend-build--nextjs-standalone-output)
9. [MCP Server — Transport Configuration](#9-mcp-server--transport-configuration)
10. [SFTP Deployment Workflow](#10-sftp-deployment-workflow)
11. [Common Mistakes](#11-common-mistakes)
12. [Environment-Specific Adjustments](#12-environment-specific-adjustments)

---

## 1. Prerequisites

### Hardware Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Disk | 50 GB | 100 GB SSD |
| CPU | 4 cores | 8 cores |

Total Docker memory reservations across all services: ~1,854 MB. Total memory limits: ~5,840 MB.

### Software Requirements

| Software | Minimum Version | Verification Command |
|----------|----------------|---------------------|
| Docker CE | 24.0+ | `docker --version` |
| Docker Compose | v2.20+ | `docker compose version` |
| Tailscale | Latest | `tailscale status` |
| Git | 2.30+ | `git --version` |
| curl | Any | `curl --version` |
| openssl | Any | `openssl version` |

### Network Requirements

- Tailscale VPN connected and authenticated
- The deployment host must be reachable via Tailscale MagicDNS
- Ports 80 and 443 available on the host (bound to `127.0.0.1` by default, or Tailscale IP in production)
- Port 8000 available for direct Memory API access (optional)
- Outbound HTTPS access to DeepInfra API (for embeddings), Clerk (for auth), and container registries

---

## 2. Clone Repository and Configure Environment

### Clone the monorepo

```bash
# On the target host (e.g., acdev-devnode)
cd /opt
git clone <repo-url> engram
cd engram
```

### Create the environment file

```bash
cd Engram-Platform
cp .env.example .env
```

Edit `.env` with your actual values. Every variable marked **REQUIRED** below must be set before starting services.

### Generate secrets

```bash
# JWT secret (minimum 32 characters)
openssl rand -base64 32

# MCP auth token
openssl rand -hex 32

# Memory API key
openssl rand -hex 32
```

---

## 3. Environment Variables Reference

All variables are set in `Engram-Platform/.env`. The Docker Compose file reads from this single file.

### Authentication — REQUIRED

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret for Memory API auth. Minimum 32 chars. Generate with `openssl rand -base64 32`. | `aB3d...long-random-string` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key. Obtain from [Clerk Dashboard](https://dashboard.clerk.com). | `pk_live_...` |
| `CLERK_SECRET_KEY` | Clerk backend secret key. Obtain from Clerk Dashboard. | `sk_live_...` |

### Authentication — Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMORY_API_KEY` | API key for programmatic Memory API access. | (empty) |
| `API_KEYS` | Comma-separated list of valid API keys for Memory API. | (empty) |
| `ADMIN_USERNAME` | Admin username for Memory API dashboard. | `admin` |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password. Generate with Python passlib. | (empty) |
| `MCP_AUTH_TOKEN` | Bearer token for MCP server requests. | (empty) |

### Embedding Configuration — REQUIRED

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_PROVIDER` | Embedding backend: `openai`, `deepinfra`, `nomic`, `ollama`, `local`. | `openai` |
| `EMBEDDING_MODEL` | Model name for the chosen provider. | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | Vector dimensions output by the model. **Must match the model.** | `1536` |
| `DEEPINFRA_API_KEY` | API key for DeepInfra. Required when `EMBEDDING_PROVIDER=deepinfra`. | (empty) |
| `OPENAI_API_KEY` | API key for OpenAI. Required when `EMBEDDING_PROVIDER=openai`. | (empty) |
| `OPENAI_BASE_URL` | Custom OpenAI-compatible endpoint (e.g., for local proxy). | (empty) |

**Common embedding configurations:**

| Provider | Model | Dimensions |
|----------|-------|------------|
| `deepinfra` | `BAAI/bge-en-icl` | `1024` |
| `deepinfra` | `BAAI/bge-m3` | `1024` |
| `openai` | `text-embedding-3-small` | `1536` |
| `openai` | `text-embedding-3-large` | `3072` |
| `nomic` | `nomic-embed-text` | `768` |

### Network and Binding

| Variable | Description | Default |
|----------|-------------|---------|
| `BIND_ADDRESS` | IP address for exposed ports (nginx 80/443). Use `127.0.0.1` for local, Tailscale IP for production. **Never `0.0.0.0` in production.** | `127.0.0.1` |
| `MEMORY_API_BIND` | Bind address for Memory API port 8000. | `0.0.0.0` |
| `TAILSCALE_HOSTNAME` | Tailscale MagicDNS hostname for CORS and cert config. | `dv-syd-host01.icefish-discus.ts.net` |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins. | `https://memory.velocitydigi.com,...` |

### Application URLs

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL of the platform frontend. | `https://memory.velocitydigi.com` |
| `NEXT_PUBLIC_CLERK_DOMAIN` | Clerk custom domain for auth. | `clerk.velocitydigi.com` |
| `NEXT_PUBLIC_MEMORY_API_KEY` | API key exposed to frontend for Memory API calls. | (empty) |
| `NEXT_PUBLIC_MEMORY_API_URL` | Memory API URL as seen by the browser. | `http://localhost/api/memory` |
| `NEXT_PUBLIC_CRAWLER_API_URL` | Crawler API URL as seen by the browser. | `http://localhost/api/crawler` |

### Clerk Auth Routing

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` |

### MCP Server

| Variable | Description | Default |
|----------|-------------|---------|
| `OAUTH_ENABLED` | Enable OAuth 2.1 for MCP HTTP transport. | `true` |
| `OAUTH_ISSUER` | OAuth issuer URL. | `https://dv-syd-host01.icefish-discus.ts.net` |
| `OAUTH_SECRET` | OAuth signing secret (min 32 chars). | (empty) |

### Crawler

| Variable | Description | Default |
|----------|-------------|---------|
| `LM_STUDIO_URL` | LM Studio endpoint for AI analysis. | `http://host.docker.internal:1234` |
| `ENGRAM_API_KEY` | API key for crawler-to-memory communication. | (empty) |

### Observability (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for frontend error tracking. | (empty) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps. | (empty) |
| `SENTRY_ORG` | Sentry organization slug. | (empty) |
| `SENTRY_PROJECT` | Sentry project slug. | (empty) |
| `LOG_LEVEL` | Logging level for backend services. | `INFO` |

### Notifications (Optional)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend email API key for alerts. |
| `EMAIL_FROM` | Sender address for alert emails. |
| `NTFY_API_KEY` | ntfy.sh push notification token. |
| `NTFY_TOPIC_URL` | ntfy.sh topic URL. |

---

## 4. Docker Services — Build and Start

### Service Architecture and Dependencies

The Docker Compose file defines seven services with the following dependency chain:

```
weaviate ──┐
           ├── memory-api ──┬── crawler-api
memory-redis ┘              ├── mcp-server
                            │
crawler-redis ──────────────┘
                            │
platform-frontend ──────────┤
                            │
nginx ──────────────────────┘ (depends on crawler-api, memory-api, platform-frontend)
```

**Build order** (Docker Compose resolves this automatically via `depends_on` with health check conditions):

1. **weaviate** and **memory-redis** and **crawler-redis** — no dependencies, start first
2. **memory-api** — waits for weaviate (healthy) and memory-redis (healthy)
3. **crawler-api** — waits for crawler-redis (healthy) and memory-api (healthy)
4. **mcp-server** — waits for memory-api (healthy)
5. **platform-frontend** — no explicit depends_on, builds independently
6. **nginx** — starts after crawler-api, memory-api, and platform-frontend

### Build and start all services

```bash
cd /opt/engram/Engram-Platform

# Build and start (first time — builds all images)
docker compose up -d --build

# Subsequent starts (uses cached images)
docker compose up -d
```

### Build contexts

Each service that requires a build uses a specific Dockerfile and context:

| Service | Build Context | Dockerfile |
|---------|--------------|------------|
| `crawler-api` | `..` (monorepo root) | `Engram-AiCrawler/01_devroot/Dockerfile` |
| `memory-api` | `..` (monorepo root) | `Engram-AiMemory/docker/Dockerfile.memory-api` |
| `mcp-server` | `../Engram-MCP` | `docker/Dockerfile` |
| `platform-frontend` | `./frontend` | `Dockerfile` |

Pre-built images (pulled from registry):

| Service | Image |
|---------|-------|
| `weaviate` | `semitechnologies/weaviate:1.27.0` |
| `crawler-redis` | `redis:7-alpine` |
| `memory-redis` | `redis:7-alpine` |
| `nginx` | `nginx:alpine` |

### Resource limits

| Service | Memory Limit | CPU Limit | Memory Reservation |
|---------|-------------|-----------|-------------------|
| `crawler-api` | 2 GB | 2.0 | 768 MB |
| `memory-api` | 768 MB | 1.0 | 256 MB |
| `weaviate` | 1,536 MB | 1.0 | 384 MB |
| `crawler-redis` | 512 MB | 0.5 | 192 MB |
| `memory-redis` | 384 MB | 0.5 | 128 MB |
| `mcp-server` | 256 MB | 0.5 | 96 MB |
| `platform-frontend` | 256 MB | 0.5 | 96 MB |
| `nginx` | 128 MB | 0.5 | 48 MB |
| **Total** | **5,840 MB** | **6.5** | **1,968 MB** |

### Named volumes

All data is stored in Docker named volumes:

| Volume | Service | Purpose |
|--------|---------|---------|
| `weaviate_data` | weaviate | Vector database persistent storage |
| `memory_redis_data` | memory-redis | Memory cache AOF persistence |
| `crawler_redis_data` | crawler-redis | Crawler cache AOF persistence |
| `crawler_cache` | crawler-api | Crawl4AI page cache |
| `crawler_chroma_data` | crawler-api | ChromaDB vector storage |
| `crawler_hot/warm/cold/archive` | crawler-api | Tiered data lifecycle storage |
| `crawler_logs` | crawler-api | Crawler application logs |
| `crawler_supervisor` | crawler-api | Supervisord logs |

### Security hardening

Several services run with additional security measures:

- `no-new-privileges:true` on crawler-api, memory-api, mcp-server, platform-frontend
- `read_only: true` filesystem on memory-api, mcp-server, platform-frontend
- `tmpfs` mounts for `/tmp` (64 MB) on read-only containers
- All logging capped at `10m` per file, 3 files max (prevents runaway logs)
- `shm_size: 2g` on crawler-api (required for Chromium browser)

---

## 5. Initial Setup and Initialization

### Weaviate schema auto-creation

Weaviate schema is created automatically by the Memory API on first startup. The API checks for existing collections and creates them if missing. No manual schema creation is needed.

To verify schema was created:

```bash
# Check Weaviate collections
curl -s http://localhost:8080/v1/schema | python3 -m json.tool

# Or via docker exec
docker exec engram-weaviate wget -qO- http://localhost:8080/v1/schema | python3 -m json.tool
```

Expected collections: `MemoryTier1`, `MemoryTier2`, `MemoryTier3` (with multi-tenancy enabled).

### Redis initialization

Both Redis instances start with `--appendonly yes` for AOF persistence. No manual initialization is required.

- **memory-redis**: maxmemory 256 MB, allkeys-lru eviction policy
- **crawler-redis**: maxmemory 384 MB, allkeys-lru eviction policy

Verify Redis is running:

```bash
docker exec engram-memory-redis redis-cli ping
# Expected: PONG

docker exec engram-crawler-redis redis-cli ping
# Expected: PONG
```

### Multi-tenancy setup

Multi-tenancy is enabled by default (`MULTI_TENANCY_ENABLED=true`). The default tenant (`default`) is created automatically. Additional tenants can be created via the Memory API:

```bash
curl -X POST http://localhost:8000/tenants \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "my-tenant", "name": "My Tenant"}'
```

### API key creation

Generate and register API keys for programmatic access:

```bash
# Generate a key
openssl rand -hex 32

# Add to .env as comma-separated list
# API_KEYS=key1,key2,key3
# MEMORY_API_KEY=key1
```

After changing `.env`, restart the affected services:

```bash
docker compose up -d memory-api mcp-server
```

---

## 6. Nginx and SSL Configuration

### SSL certificate paths

Nginx expects certificates at:

```
Engram-Platform/certs/velocitydigi.crt    # Certificate (or chain)
Engram-Platform/certs/velocitydigi.key    # Private key
```

These are mounted read-only into the nginx container at `/etc/nginx/certs/`.

### Option A: Self-signed certificate (development/Tailscale)

```bash
mkdir -p Engram-Platform/certs

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout Engram-Platform/certs/velocitydigi.key \
  -out Engram-Platform/certs/velocitydigi.crt \
  -subj "/CN=memory.velocitydigi.com" \
  -addext "subjectAltName=DNS:memory.velocitydigi.com,DNS:engram.velocitydigi.com,DNS:dv-syd-host01.icefish-discus.ts.net"

# Restart nginx to pick up the new cert
docker compose restart nginx
```

### Option B: Let's Encrypt with certbot

The nginx config includes an ACME challenge location at `/.well-known/acme-challenge/`. To use Let's Encrypt:

```bash
# 1. Ensure DNS A records point to the server's public IP
# 2. Temporarily allow port 80 from the internet (or use DNS-01 challenge)

# 3. Run certbot (on the host, not in Docker)
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d memory.velocitydigi.com \
  -d engram.velocitydigi.com

# 4. Copy certs to the project directory
sudo cp /etc/letsencrypt/live/memory.velocitydigi.com/fullchain.pem \
  Engram-Platform/certs/velocitydigi.crt
sudo cp /etc/letsencrypt/live/memory.velocitydigi.com/privkey.pem \
  Engram-Platform/certs/velocitydigi.key

# 5. Restart nginx
docker compose restart nginx
```

### Option C: Wildcard certificate (current production)

The production deployment uses a wildcard certificate for `*.velocitydigi.com` obtained from the domain registrar or a CA. Copy the cert and key to `Engram-Platform/certs/` with the names above.

### Nginx routing summary

| Path | Upstream | Rate Limit |
|------|----------|------------|
| `/api/crawler/` | `crawler-api:11235` | 60 req/s + burst 50 |
| `/api/memory/` | `memory-api:8000` | 60 req/s + burst 50 |
| `/mcp` | `mcp-server:3000` | 60 req/s + burst 20 |
| `/ws` | `crawler-api:11235` (WebSocket) | None |
| `/.well-known/oauth-authorization-server` | `mcp-server:3000` | None |
| `/health` | Direct 200 response | None |
| `*.(js|css|png|...)` | `platform-frontend:3000` | None (cached 1 year) |
| `/` (catch-all) | `platform-frontend:3000` | 120 req/s + burst 100 |

---

## 7. Service Validation and Health Checks

### Automated health checks

Every service has a Docker health check. Check status with:

```bash
docker compose ps
```

All services should show `(healthy)` status. Expected startup times:

| Service | Start Period | Check Interval | Expected Healthy In |
|---------|-------------|----------------|-------------------|
| weaviate | default | 30s | ~30-60s |
| memory-redis | default | 10s | ~5-10s |
| crawler-redis | default | 10s | ~5-10s |
| memory-api | default | 30s | ~30-60s |
| crawler-api | 60s | 30s | ~60-120s |
| mcp-server | default | 30s | ~30-60s |
| platform-frontend | default | 30s | ~30-60s |
| nginx | none | none | immediate |

### Manual health check commands

```bash
# Weaviate readiness
curl -sf http://localhost:8080/v1/.well-known/ready
# Expected: HTTP 200

# Memory API health
curl -sf http://localhost:8000/health
# Expected: {"status":"healthy",...}

# Crawler API health
curl -sf http://localhost:11235/
# Expected: HTTP 200

# MCP Server health
curl -sf http://localhost:3000/health
# Expected: HTTP 200

# Platform Frontend (via nginx)
curl -sf https://localhost/health
# Expected: "healthy"

# Redis ping
docker exec engram-memory-redis redis-cli ping
docker exec engram-crawler-redis redis-cli ping
# Expected: PONG
```

### End-to-end validation

```bash
# Test Memory API search
curl -s http://localhost:8000/memories/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 1}'

# Test MCP endpoint (if token set)
curl -s http://localhost:3000/health \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}"
```

### Using the unified deploy script

The `scripts/deploy-unified.sh` script provides an interactive deployment console:

```bash
# Interactive menu
./scripts/deploy-unified.sh

# Direct commands
./scripts/deploy-unified.sh deploy:devnode   # Deploy to devnode
./scripts/deploy-unified.sh health           # Run health checks
./scripts/deploy-unified.sh status           # Show service status
```

---

## 8. Frontend Build — Next.js Standalone Output

The platform frontend is a Next.js 15 application using the standalone output mode for Docker deployment.

### Build process

The frontend Dockerfile handles the build. Key build args are passed from `docker-compose.yml`:

```yaml
build:
  args:
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}
    NEXT_PUBLIC_MEMORY_API_KEY: ${NEXT_PUBLIC_MEMORY_API_KEY:-}
    NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-https://memory.velocitydigi.com}
    NEXT_PUBLIC_CLERK_DOMAIN: ${NEXT_PUBLIC_CLERK_DOMAIN:-clerk.velocitydigi.com}
    CRAWLER_API_URL: http://crawler-api:11235
    MEMORY_API_URL: http://memory-api:8000
```

`NEXT_PUBLIC_*` variables are baked into the JavaScript bundle at build time. Changing them requires a rebuild.

### Local development build

```bash
cd Engram-Platform/frontend
npm install
npm run build       # next build
npm run dev         # next dev --turbopack on :3002
```

### Docker rebuild

```bash
# Rebuild only the frontend
docker compose build platform-frontend
docker compose up -d platform-frontend

# Force rebuild without cache
docker compose build --no-cache platform-frontend
```

---

## 9. MCP Server — Transport Configuration

The MCP server supports two transport modes: stdio (for local AI tool integration) and HTTP (for remote clients).

### HTTP Transport (Docker default)

The Docker Compose configuration runs the MCP server in HTTP mode on port 3000. This is the default for production.

Key environment variables:

```env
MCP_SERVER_PORT=3000
MCP_AUTH_TOKEN=your-bearer-token
OAUTH_ENABLED=true
OAUTH_ISSUER=https://dv-syd-host01.icefish-discus.ts.net
OAUTH_SECRET=your-oauth-secret-min-32-chars
```

The MCP server is accessible via nginx at `/mcp`.

### stdio Transport (for Claude Code / Claude Desktop)

For local integration with Claude Code or Claude Desktop, configure the MCP server in stdio mode. This runs outside Docker, directly on your machine.

Add to your Claude Code MCP configuration (`~/.claude/mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/Engram-MCP",
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MEMORY_API_URL": "http://100.78.187.5:8000",
        "AI_MEMORY_API_KEY": "your-api-key"
      }
    }
  }
}
```

Build the MCP server before first use:

```bash
cd Engram-MCP
npm install
npm run build   # Compiles TypeScript to dist/
```

### Resilience configuration

The MCP server includes a circuit breaker for Memory API calls:

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_RETRY_MAX` | Maximum retry attempts | `3` |
| `MCP_RETRY_INITIAL_MS` | Initial retry delay | `100` |
| `MCP_CB_FAILURE_THRESHOLD` | Failures before circuit opens | `5` |
| `MCP_CB_RESET_MS` | Time before half-open retry | `30000` |
| `MCP_TIMEOUT_MS` | Request timeout | `30000` |

---

## 10. SFTP Deployment Workflow

For file-based deployments to the devnode (or any remote host), use SFTP over Tailscale.

### Deploy updated files

```bash
# Connect via Tailscale IP (never public IP)
sftp root@100.78.187.5

# Upload updated files
sftp> put -r Engram-Platform/frontend/app /opt/engram/Engram-Platform/frontend/app
sftp> put Engram-Platform/.env /opt/engram/Engram-Platform/.env
sftp> exit
```

### Post-deploy restart

```bash
# SSH to devnode via Tailscale
ssh root@100.78.187.5

# Navigate to project
cd /opt/engram/Engram-Platform

# Rebuild and restart affected service
docker compose build platform-frontend
docker compose up -d platform-frontend

# Verify health
docker compose ps
```

### Using the unified deploy script

The monorepo includes `scripts/deploy-unified.sh` which automates the SFTP + rebuild workflow:

```bash
./scripts/deploy-unified.sh deploy:devnode
```

This script handles pre-flight checks (Docker, Compose, .env, required vars, Tailscale), image pulls, service starts, and health checks.

---

## 11. Common Mistakes

### Wrong embedding dimensions

**Symptom**: Memory API crashes on startup or returns 500 errors on search.
**Cause**: `EMBEDDING_DIMENSIONS` does not match the actual output of `EMBEDDING_MODEL`.
**Fix**: Verify the correct dimensions for your model (see table in section 3). If data already exists with wrong dimensions, you must either re-embed all data or wipe the Weaviate volume:

```bash
docker compose down
docker volume rm engram-platform_weaviate_data
docker compose up -d
```

### Stale embedding cache

**Symptom**: Search returns irrelevant results after changing embedding model/provider.
**Cause**: Redis still holds cached embeddings from the old model.
**Fix**: Flush embedding cache keys:

```bash
docker exec engram-memory-redis redis-cli KEYS 'emb:*' | xargs -I{} docker exec engram-memory-redis redis-cli DEL {}
```

### Missing environment variables

**Symptom**: Services fail to start or crash immediately.
**Cause**: Required variables not set in `.env`.
**Fix**: Check Docker logs for the specific error:

```bash
docker compose logs memory-api --tail 50
docker compose logs platform-frontend --tail 50
```

Ensure at minimum: `JWT_SECRET`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

### NEXT_PUBLIC variables not taking effect

**Symptom**: Frontend shows wrong API URLs or Clerk domain.
**Cause**: `NEXT_PUBLIC_*` values are baked in at build time, not runtime.
**Fix**: Rebuild the frontend image after changing any `NEXT_PUBLIC_*` variable:

```bash
docker compose build --no-cache platform-frontend
docker compose up -d platform-frontend
```

### Bind address misconfiguration

**Symptom**: Services not reachable from Tailscale, or accidentally exposed to public internet.
**Cause**: `BIND_ADDRESS` set incorrectly.
**Fix**: For production, set `BIND_ADDRESS` to the Tailscale IP. Never use `0.0.0.0`.

### Certificates not found

**Symptom**: Nginx fails to start with "no such file" errors.
**Cause**: SSL certificates missing from `Engram-Platform/certs/`.
**Fix**: Generate self-signed certs (see section 6) or copy existing certs to the correct path.

---

## 12. Environment-Specific Adjustments

### Local Development

```env
BIND_ADDRESS=127.0.0.1
NEXT_PUBLIC_APP_URL=http://localhost:3002
EMBEDDING_PROVIDER=nomic       # Use local Ollama for embeddings
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
OAUTH_ENABLED=false
LOG_LEVEL=DEBUG
```

Run the frontend outside Docker for hot reload:

```bash
cd Engram-Platform/frontend
npm run dev    # Port 3002 with Turbopack
```

### Production (acdev-devnode)

```env
BIND_ADDRESS=100.78.187.5      # Tailscale IP only
NEXT_PUBLIC_APP_URL=https://memory.velocitydigi.com
EMBEDDING_PROVIDER=deepinfra
EMBEDDING_MODEL=BAAI/bge-en-icl
EMBEDDING_DIMENSIONS=1024
OAUTH_ENABLED=true
LOG_LEVEL=INFO
```

### Key differences

| Setting | Development | Production |
|---------|-------------|------------|
| `BIND_ADDRESS` | `127.0.0.1` | Tailscale IP |
| `EMBEDDING_PROVIDER` | `nomic` (local) | `deepinfra` (cloud) |
| `OAUTH_ENABLED` | `false` | `true` |
| `LOG_LEVEL` | `DEBUG` | `INFO` |
| SSL | Self-signed | Wildcard or Let's Encrypt |
| Frontend | `npm run dev` (hot reload) | Docker standalone build |
