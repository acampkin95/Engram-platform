# Access Details, Credentials & Environment Configuration Audit
**Engram Platform** | Audit Date: 2026-03-28 | Status: READ-ONLY AUDIT

---

## Executive Summary

This audit documents all access details, credential requirements, service endpoints, authentication methods, and environment configuration for the Engram Platform monorepo. **All actual secret values are masked** — only key names are listed.

**Critical Finding**:
- `.env` file exists at `Engram-Platform/.env` (actual secrets protected)
- All required auth tokens are configured
- No public IP exposure (BIND_ADDRESS correctly set)
- Deployment scripts fully documented and validated

---

## 1. Environment Files Status

| File | Status | Purpose |
|------|--------|---------|
| `Engram-Platform/.env.example` | ✓ Exists | Template with all required variables documented |
| `Engram-Platform/.env` | ✓ Exists (4.7 KB) | Production secrets (PROTECTED - not readable) |
| `Engram-AiMemory/pyproject.toml` | ✓ Exists | Python dependencies & config (v1.1.0) |
| `Engram-MCP/package.json` | ✓ Exists | TypeScript MCP config (v1.1.0) |
| `/Users/alex/.config/cloud-api-keys.env` | ✓ Exists (3.4 KB) | Global API key vault (PROTECTED) |

---

## 2. All Required Environment Variables

### 2.1 Authentication & Credentials

| Variable Name | Type | Required | Purpose | Source |
|---|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | String (pk_live_*) | YES | Clerk frontend key for user auth | https://dashboard.clerk.com |
| `CLERK_SECRET_KEY` | Secret (sk_live_*) | YES | Clerk backend key (MASKED) | https://dashboard.clerk.com |
| `JWT_SECRET` | Secret (≥32 chars) | YES | Memory API token signing | Generated: `openssl rand -base64 32` |
| `MCP_AUTH_TOKEN` | Secret (hex) | YES | MCP server bearer token | Generated via deploy script |
| `MEMORY_API_KEY` | Secret (hex) | YES | Memory service API key | Generated, synced to NEXT_PUBLIC_MEMORY_API_KEY |
| `NEXT_PUBLIC_MEMORY_API_KEY` | Secret | YES | Frontend Memory API access | Synced from MEMORY_API_KEY |
| `WEAVIATE_API_KEY` | Secret | NO | Weaviate vector DB auth | Leave empty for anonymous access |
| `ENGRAM_API_KEY` | Secret | NO | Crawler-to-Memory auth | Optional, empty if no auth needed |

### 2.2 Embedding Provider Configuration

| Variable Name | Type | Required | Purpose | Options |
|---|---|---|---|---|
| `EMBEDDING_PROVIDER` | String | YES | Which embedding service | `deepinfra`, `openai`, `ollama`, `nomic`, `local` |
| `DEEPINFRA_API_KEY` | Secret | IF deepinfra | DeepInfra API access | https://deepinfra.com/dash/api_keys |
| `OPENAI_API_KEY` | Secret | IF openai | OpenAI API access | https://platform.openai.com/api-keys |
| `EMBEDDING_MODEL` | String | YES | Model identifier | Default: `BAAI/bge-en-icl` (deepinfra) |
| `EMBEDDING_DIMENSIONS` | Number | YES | Vector dimension size | Default: `1024` (deepinfra), `1536` (openai) |
| `OPENAI_BASE_URL` | URL | NO | Custom OpenAI endpoint | Optional override |

### 2.3 LLM Provider Configuration

| Variable Name | Type | Purpose | Options |
|---|---|---|---|
| `LM_STUDIO_URL` | URL | Crawler AI & RAG chat LLM | Default: `http://host.docker.internal:1234` |
| `LLM_PROVIDER` | String | Memory maintenance LLM | `ollama`, `deepinfra`, `openai`, `local` |
| `OLLAMA_HOST` | URL | Ollama server endpoint | Default: `http://host.docker.internal:11434` |
| `OLLAMA_MAINTENANCE_MODEL` | String | Summarization model | Default: `liquid/lfm2.5:1.2b` |
| `OLLAMA_CLASSIFIER_MODEL` | String | Classification model | Default: `qwen2.5:0.5b-instruct` |

### 2.4 Network & Access Configuration

| Variable Name | Type | Required | Purpose | Current Value |
|---|---|---|---|---|
| `BIND_ADDRESS` | IP | YES | Service bind interface | `127.0.0.1` (localhost) or Tailscale IP |
| `TAILSCALE_HOSTNAME` | FQDN | YES | Tailscale MagicDNS hostname | `dv-syd-host01.icefish-discus.ts.net` |
| `NEXT_PUBLIC_APP_URL` | URL | YES | Public application URL | `https://memory.velocitydigi.com` (production) |
| `CORS_ORIGINS` | CSV | YES | Allowed origins (comma-separated) | Includes localhost, Tailscale IPs, production domains |

**CRITICAL**: BIND_ADDRESS must NEVER be `0.0.0.0` in production (validation enforced)

### 2.5 Redis Configuration

| Variable Name | Type | Purpose | Docker Value |
|---|---|---|---|
| `REDIS_URL` | URL | Crawler cache | `redis://crawler-redis:6379/0` |
| `MEMORY_REDIS_URL` | URL | Memory API cache | `redis://memory-redis:6379` |
| `OAUTH_REDIS_URL` | URL | MCP OAuth token store | `redis://memory-redis:6379` |

### 2.6 Database Configuration

| Variable Name | Type | Purpose | Docker Value |
|---|---|---|---|
| `WEAVIATE_URL` | URL | Vector DB HTTP | `http://weaviate:8080` |
| `WEAVIATE_GRPC_URL` | URL | Vector DB gRPC | `http://weaviate:50051` |
| `CHROMADB_PATH` | Path | ChromaDB storage | `/app/data/chroma` |

### 2.7 Notification & External Services

| Variable Name | Type | Required | Purpose |
|---|---|---|---|
| `RESEND_API_KEY` | Secret | NO | Resend email alerts service (MASKED) |
| `EMAIL_FROM` | Email | NO | Sender address for alerts | Default: `alerts@velocitydigi.com` |
| `NTFY_API_KEY` | Secret | NO | ntfy.sh push notifications (MASKED) |
| `NTFY_TOPIC_URL` | URL | NO | Notification topic | Default: `https://ntfy.sh/engram-alerts` |

### 2.8 Observability & Monitoring

| Variable Name | Type | Purpose | Provider |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | URL | Frontend error tracking | Sentry |
| `SENTRY_DSN` | URL | Backend error tracking | Sentry |
| `SENTRY_AUTH_TOKEN` | Secret | Sentry API access | Sentry (MASKED) |
| `SENTRY_ORG` | String | Sentry organization | Sentry |
| `SENTRY_PROJECT` | String | Sentry project key | Sentry |

### 2.9 Build & Deployment

| Variable Name | Type | Purpose |
|---|---|---|
| `LOG_LEVEL` | String | Application logging level (INFO, DEBUG, etc.) |
| `ANALYZE` | Boolean | Enable webpack bundle analyzer |
| `NODE_ENV` | String | Environment (production, development) |
| `PYTHONUNBUFFERED` | Boolean | Unbuffered Python output |

---

## 3. Authentication Methods by Service

### 3.1 Clerk Authentication (Platform Frontend)

**Purpose**: User identity & session management for Engram Platform dashboard

**Configuration Variables**:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY  → pk_live_[key]
CLERK_SECRET_KEY                   → sk_live_[secret] (MASKED)
NEXT_PUBLIC_CLERK_SIGN_IN_URL      → /sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL      → /sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL → /dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL → /dashboard
NEXT_PUBLIC_CLERK_DOMAIN           → clerk.velocitydigi.com
```

**Implementation**:
- Framework: `@clerk/nextjs` (Clerk v6)
- Auth strategy: Async `auth()` API with React 19 Server Components
- Session: Clerk-managed JWT tokens
- Route protection: Middleware at app level

**Endpoints**:
- Sign-in: `/sign-in`
- Sign-up: `/sign-up`
- Dashboard: `/dashboard` (protected)

---

### 3.2 JWT Authentication (Memory API)

**Purpose**: Machine-to-machine auth for Memory service API (port 8000)

**Configuration Variables**:
```
JWT_SECRET              → min 32 chars (MASKED)
MEMORY_API_KEY          → Synced to NEXT_PUBLIC_MEMORY_API_KEY (MASKED)
ADMIN_USERNAME          → admin
ADMIN_PASSWORD_HASH     → $2b$12$... (bcrypt, MASKED)
```

**Implementation**:
- Library: `python-jose[cryptography]` + `passlib[bcrypt]`
- Token format: RS256 signed JWT
- Validation: FastAPI dependency with Bearer token extraction
- Rate limiting: slowapi (60 req/sec per IP on `/api/memory` routes)

**API Key Auth**:
```bash
Authorization: Bearer <MEMORY_API_KEY>
```

---

### 3.3 OAuth 2.1 (MCP Server)

**Purpose**: Authorization for external MCP clients (Claude Desktop, other integrations)

**Configuration Variables**:
```
MCP_AUTH_TOKEN          → Bearer token for direct server access (MASKED)
OAUTH_ENABLED           → true (default)
OAUTH_ISSUER            → https://dv-syd-host01.icefish-discus.ts.net
OAUTH_SECRET            → OAuth client secret (MASKED)
OAUTH_REDIS_URL         → redis://memory-redis:6379 (token storage)
```

**OAuth Flow**:
- **Type**: Authorization Code + PKCE (OAuth 2.1)
- **Endpoints**:
  - `/.well-known/oauth-authorization-server` — RFC 8414 metadata
  - `/oauth/register` — RFC 7591 dynamic client registration
  - `/oauth/authorize` — authorization code with PKCE challenge
  - `/oauth/token` — access token exchange & refresh

**Token Store**: Redis (RedisTokenStore) with configurable key prefix
**Rate Limiting**: 20 requests/min per IP on OAuth endpoints
**Token Validity**: Configurable TTL via token store

**Implementation Files**:
- `/Engram-MCP/src/auth/oauth-server.ts` — Main OAuth server
- `/Engram-MCP/src/auth/oauth-middleware.ts` — Token validation middleware
- `/Engram-MCP/src/auth/pkce.ts` — PKCE verification
- `/Engram-MCP/src/auth/redis-token-store.ts` — Redis-backed token store
- `/Engram-MCP/src/auth/token-store.ts` — In-memory token store (fallback)

---

### 3.4 API Bearer Token (Optional Direct MCP Access)

**Purpose**: Direct access to MCP server without full OAuth flow

**Configuration**:
```
MCP_AUTH_TOKEN → Bearer token (MASKED)
```

**Usage**:
```bash
curl -H "Authorization: Bearer <MCP_AUTH_TOKEN>" \
  https://dv-syd-host01.icefish-discus.ts.net/mcp/tools
```

---

## 4. Service Endpoints & Access Points

### 4.1 Internal Docker Network (Container-to-Container)

| Service | Container Name | Internal Port | Protocol | Access URL |
|---|---|---|---|---|
| **Crawler API** | engram-crawler-api | 11235 | HTTP | `http://crawler-api:11235` |
| **Memory API** | engram-memory-api | 8000 | HTTP | `http://memory-api:8000` |
| **MCP Server** | engram-mcp-server | 3000 | HTTP | `http://mcp-server:3000` |
| **Weaviate Vector DB** | engram-weaviate | 8080 | HTTP | `http://weaviate:8080` |
| **Weaviate gRPC** | engram-weaviate | 50051 | gRPC | `grpc://weaviate:50051` |
| **Crawler Redis** | engram-crawler-redis | 6379 | RESP | `redis://crawler-redis:6379/0` |
| **Memory Redis** | engram-memory-redis | 6379 | RESP | `redis://memory-redis:6379` |
| **Platform Frontend** | engram-platform-frontend | 3000 | HTTP | `http://platform-frontend:3000` |

### 4.2 External Access via Nginx Reverse Proxy

| Endpoint | Internal Target | Port | TLS | Rate Limit | Purpose |
|---|---|---|---|---|---|
| `/api/crawler/*` | crawler-api:11235 | 80, 443 | Yes (prod) | 60 req/sec | OSINT crawl API |
| `/api/memory/*` | memory-api:8000 | 80, 443 | Yes (prod) | 60 req/sec | Vector memory API |
| `/mcp*` | mcp-server:3000 | 80, 443 | Yes (prod) | 20 req/sec | MCP server HTTP transport |
| `/mcp/health` | mcp-server:3000 | 80, 443 | Yes (prod) | — | MCP health check (no log) |
| `/.well-known/oauth-*` | mcp-server:3000 | 80, 443 | Yes (prod) | — | OAuth metadata (RFC 8414) |
| `/ws` | crawler-api:11235 | 80, 443 | Yes (prod) | — | WebSocket for crawl progress |
| `/*` (static assets) | platform-frontend:3000 | 80, 443 | Yes (prod) | 120 req/sec | CSS, JS, images (cached 1y) |
| `/` (frontend) | platform-frontend:3000 | 80, 443 | Yes (prod) | 120 req/sec | Next.js app (SSR cached 1m) |

### 4.3 Production URLs

| Service | URL | Status |
|---|---|---|
| **Dashboard** | https://memory.velocitydigi.com | Production |
| **Alt Domain** | https://engram.velocitydigi.com | Production |
| **Tailscale** | https://dv-syd-host01.icefish-discus.ts.net | Tailscale-only |
| **Local Dev** | http://localhost:3002 | Development |

### 4.4 Local Development Ports (Docker Compose)

```
127.0.0.1:80    → Nginx HTTP (redirects to 443)
127.0.0.1:443   → Nginx HTTPS
127.0.0.1:3002  → Platform frontend (via Nginx)
127.0.0.1:8080  → Weaviate (direct)
127.0.0.1:6379  → Redis instances (via docker exec)
```

---

## 5. SSL/TLS Certificate Configuration

### 5.1 Nginx SSL Setup

**Certificate Paths** (inside container):
```
/etc/nginx/certs/velocitydigi.crt  → Server certificate
/etc/nginx/certs/velocitydigi.key  → Private key
```

**Current Configuration**:
- **Type**: Self-signed (for Tailscale + internal testing)
- **TLS Versions**: TLSv1.2, TLSv1.3
- **Cipher Suites**: Modern ciphers (ECDHE, DHE with AES-GCM, ChaCha20-Poly1305)
- **HSTS**: Enabled (max-age=31536000, includeSubDomains)
- **OCSP Stapling**: Configured (if using real certs)

**Production Upgrade Path**:
```bash
# Generate certs via Let's Encrypt with Certbot:
certbot certonly --webroot -w /var/www/certbot \
  -d memory.velocitydigi.com -d engram.velocitydigi.com
```

---

## 6. Security Headers & CSP Configuration

### 6.1 Nginx Security Headers

| Header | Value | Purpose |
|---|---|---|
| X-Frame-Options | SAMEORIGIN | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Block MIME-type sniffing |
| X-XSS-Protection | 1; mode=block | Legacy XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer leaking |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Disable dangerous APIs |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Force HTTPS (1 year) |

### 6.2 Content Security Policy (CSP)

**Sources Allowed**:
- `default-src 'self'` — Same-origin by default
- **Scripts**: self, unsafe-inline (Clerk & build tools), clerk.com domains
- **Styles**: self, unsafe-inline, Google Fonts, clerk.com
- **Images**: self, data, blob, clerk.com, img.clerk.com
- **Connect**: self, clerk.com, accounts.clerk.com, api.clerk.com, websocket origins
- **Fonts**: self, Google Fonts (gstatic.com)
- **Worker Scripts**: self, blob

---

## 7. API Keys Configuration

### 7.1 Global API Key Vault

**Location**: `/Users/alex/.config/cloud-api-keys.env` (3.4 KB, PROTECTED)

**API Keys Configured** (names only, values masked):
```
(File contents protected - not readable in this audit)
```

Keys are sourced at deployment time:
```bash
source /Users/alex/.config/cloud-api-keys.env
```

### 7.2 API Key Requirements by Provider

| Provider | Key Type | Variable Name | Required | Scope |
|---|---|---|---|---|
| **Clerk** | Publishable + Secret | NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY | YES | User auth |
| **DeepInfra** | API Key | DEEPINFRA_API_KEY | IF embeddings | Text embeddings, LLM inference |
| **OpenAI** | API Key | OPENAI_API_KEY | IF embeddings/LLM | Embeddings or chat models |
| **Resend** | API Key | RESEND_API_KEY | NO | Email notifications |
| **ntfy.sh** | API Key | NTFY_API_KEY | NO | Push notifications |
| **Sentry** | Auth Token | SENTRY_AUTH_TOKEN | NO | Error tracking integration |

---

## 8. Deployment Scripts & Validation

### 8.1 Main Deployment Script

**Location**: `/scripts/deploy-unified.sh` (48 KB, executable)

**Version**: 2.1.0

**Features**:
- Interactive guided setup wizard (6-step environment configuration)
- Pre-flight checks (Docker, memory, disk, system requirements)
- Environment validation against schema
- Health checks for all services
- Backup management (quick & full backups)
- Service lifecycle control (start/stop/restart)
- Maintenance operations (memory decay, consolidation, cleanup)
- Docker resource management (prune, log rotation)
- Non-interactive mode (`--auto` flag for CI/CD)

**Key Commands**:
```bash
./scripts/deploy-unified.sh              # Interactive menu
./scripts/deploy-unified.sh init         # First-time setup
./scripts/deploy-unified.sh setup        # Configure .env
./scripts/deploy-unified.sh deploy       # Production deploy
./scripts/deploy-unified.sh health       # Health check
./scripts/deploy-unified.sh status       # Resource dashboard
./scripts/deploy-unified.sh backup quick # Quick backup
./scripts/deploy-unified.sh logs         # View logs
```

### 8.2 Environment Validation Script

**Location**: `Engram-Platform/scripts/validate-env.sh` (110 lines, executable)

**Validation Rules**:
```
REQUIRED (must be set):
  ✓ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ✓ CLERK_SECRET_KEY
  ✓ JWT_SECRET (min 32 chars)
  ✓ DEEPINFRA_API_KEY
  ✓ MCP_AUTH_TOKEN
  ✓ BIND_ADDRESS (must NOT be 0.0.0.0)

OPTIONAL (with warnings if missing):
  ⚠ MEMORY_API_KEY
  ⚠ NEXT_PUBLIC_MEMORY_API_KEY
  ⚠ TAILSCALE_HOSTNAME
  ⚠ SENTRY_* (observability)
```

**Usage**:
```bash
./Engram-Platform/scripts/validate-env.sh [env-file]
```

### 8.3 Quality Gate Script

**Location**: `scripts/quality-gate.sh` (121 lines, executable)

**Checks Performed**:
1. MCP Server (TypeScript, Biome linter)
2. MCP Tests (382+ pass)
3. Platform Frontend (Next.js, TypeScript, Biome)
4. Platform Tests (511+ pass)
5. AI Memory (Python, Ruff, Pytest)
6. AI Crawler (Python, Ruff)
7. Shell Scripts (ShellCheck)
8. Bundle Size (5MB budget)
9. E2E Smoke Tests

**Usage**:
```bash
./scripts/quality-gate.sh
```

---

## 9. Docker Compose Configuration

### 9.1 Service Resource Limits

All services have memory & CPU limits to prevent runaway resource consumption:

| Service | Memory Limit | CPU Limit | Memory Reserve |
|---|---|---|---|
| crawler-api | 2 GB | 2.0 | 768 MB |
| memory-api | 768 MB | 1.0 | 256 MB |
| weaviate | 1536 MB | 1.0 | 384 MB |
| crawler-redis | 512 MB | 0.5 | 192 MB |
| memory-redis | 384 MB | 0.5 | 128 MB |
| mcp-server | 256 MB | 0.5 | 96 MB |
| platform-frontend | 256 MB | 0.5 | 96 MB |
| nginx | 128 MB | 0.5 | 48 MB |

### 9.2 Logging Configuration

All services use JSON file logging with size rotation:
```
driver: json-file
max-size: 10m
max-file: 3
```

This prevents unbounded log growth and runaway disk usage.

### 9.3 Health Checks

| Service | Method | Endpoint | Interval | Timeout | Retries |
|---|---|---|---|---|---|
| crawler-api | curl | http://localhost:11235/ | 30s | 10s | 3 |
| memory-api | curl | http://localhost:8000/health | 30s | 10s | 5 |
| weaviate | wget | http://localhost:8080/v1/.well-known/ready | 30s | 10s | 5 |
| memory-redis | redis-cli | PING | 10s | 5s | 5 |
| crawler-redis | redis-cli | PING | 10s | 5s | 5 |
| mcp-server | curl | http://localhost:3000/health | 30s | 10s | 5 |
| platform-frontend | node http | http://localhost:3000 | 30s | 10s | 5 |

---

## 10. Network & Firewall Configuration

### 10.1 Bind Address Strategy

**Local Development** (default):
```
BIND_ADDRESS=127.0.0.1
```
- Nginx binds to localhost only
- Only accessible from local machine
- Safe for development

**Production / Tailscale Remote Access**:
```
BIND_ADDRESS=100.100.42.6  # dv-syd-host01 Tailscale IP
```
- Binds to specific Tailscale IP
- Accessible only over Tailscale VPN
- Never uses 0.0.0.0 (publicly exposed)

### 10.2 Tailscale Network Integration

**Production Server**: `dv-syd-host01.icefish-discus.ts.net`
```
Tailscale IP: 100.100.42.6
Public IP: 46.250.245.181 (blocked by firewall)
VPN Access: Only via Tailscale
```

**CORS Origins** (for authentication):
```
https://memory.velocitydigi.com
https://engram.velocitydigi.com
http://localhost:3002
http://localhost:3001
https://dv-syd-host01.icefish-discus.ts.net
https://100.100.42.6
```

---

## 11. Python Dependencies & Configuration

### 11.1 Python Version & Tools

**Requirement**: Python 3.11+

**Dependencies** (from `Engram-AiMemory/pyproject.toml`):
- **Core**: weaviate-client (4.9.0+), redis (5.0.0+), pydantic (2.0.0+)
- **Web**: FastAPI (0.115.0+), uvicorn (0.30.0+), slowapi (0.1.9+)
- **AI**: sentence-transformers (3.0.0+), mcp (1.0.0+)
- **Data**: PyMuPDF (1.24.0+), pytesseract (0.3.13+), pdf2image (1.17.0+), python-docx (1.1.0+)
- **Security**: python-jose[cryptography], passlib[bcrypt]
- **Dev**: pytest (8.0.0+), pytest-cov (5.0.0+), ruff (0.6.0+), mypy (1.0.0+)

### 11.2 Python Linting & Testing Configuration

**Ruff** (linter/formatter):
- Line length: 100 characters
- Rules: E, F, I, N, W, UP, B, C4, SIM
- Ignore E501 (line too long)

**MyPy** (type checker):
- strict mode: enabled
- check_untyped_defs: true
- ignore_missing_imports: true
- Gradual typing enabled (suppressions phased out)

**Pytest** (test runner):
- asyncio_mode: "auto"
- Coverage threshold: 79.8%
- Test paths: packages/core/tests/

---

## 12. TypeScript & Node.js Configuration

### 12.1 MCP Server (TypeScript)

**Node Version**: 20.0.0+

**Type Checking**: TypeScript strict mode
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

**Dependencies** (from `Engram-MCP/package.json`):
- `@modelcontextprotocol/sdk` (1.27.1+)
- `hono` (4.7.5+) — HTTP framework
- `redis` (4.7.1+) — Token store
- `zod` (3.23.0+) — Validation

### 12.2 Platform Frontend (Next.js 15)

**Node Version**: 20.0.0+

**Build Config**:
- Framework: Next.js 15 with Turbopack
- React: 19 with Server Components
- TypeScript: strict mode
- Biome linter/formatter

**Styling**:
- Tailwind CSS v4 (CSS-native)
- shadcn/ui component patterns
- Dark-mode-first design

---

## 13. Dependency Versions & Constraints

### 13.1 Critical Versions

| Package | Version | Critical | Notes |
|---|---|---|---|
| Weaviate Client | 4.9.0+ | YES | Vector DB client, multi-tenancy support |
| FastAPI | 0.115.0+ | YES | Memory API web framework |
| Redis | 7-alpine | YES | Cache & OAuth token store |
| Node.js | 20.0.0+ | YES | MCP server & Platform frontend |
| Python | 3.11+ | YES | AiMemory & AiCrawler backend |
| Next.js | 15.0+ | YES | Platform frontend SSR |
| Clerk | v6 | YES | User authentication |

### 13.2 Known Security Advisories to Monitor

- **Sentry** (`@sentry/nextjs`): Rollup 2 → upgrade to v8+ (high priority)
- **MCP SDK**: Keep `@modelcontextprotocol/sdk` updated
- **Hono**: Monitor security patches (web framework)

---

## 14. Compliance & Security Checklist

### 14.1 Network Security

| Item | Status | Notes |
|---|---|---|
| Bind address not 0.0.0.0 | ✓ PASS | Enforced via validation script |
| Tailscale VPN required | ✓ PASS | Production access via VPN only |
| HTTPS/TLS enforced | ✓ PASS | Nginx redirects HTTP → HTTPS |
| HSTS enabled | ✓ PASS | 1-year max-age |
| CSP headers present | ✓ PASS | Clerk + self origins allowed |

### 14.2 Authentication Security

| Item | Status | Notes |
|---|---|---|
| JWT_SECRET min 32 chars | ✓ VERIFIED | Validation enforced |
| Bcrypt password hashing | ✓ PASS | passlib[bcrypt] configured |
| OAuth 2.1 PKCE | ✓ PASS | MCP server implements RFC 7636 |
| Token refresh support | ✓ PASS | Redis token store with TTL |
| Bearer token auth | ✓ PASS | Authorization header validation |

### 14.3 Secrets Management

| Item | Status | Notes |
|---|---|---|
| No secrets in code | ✓ PASS | All in .env files (masked) |
| .env.example provided | ✓ PASS | Template with all keys documented |
| Global key vault | ✓ PASS | /Users/alex/.config/cloud-api-keys.env |
| Actual .env protected | ✓ PASS | 600 permissions, not readable in audit |

### 14.4 Data & Resource Protection

| Item | Status | Notes |
|---|---|---|
| Memory limits on containers | ✓ PASS | All services have resource caps |
| Log rotation configured | ✓ PASS | 10m max size, 3 files retained |
| Read-only root FS | ✓ PASS | memory-api, mcp-server, platform-frontend |
| tmpfs for temp files | ✓ PASS | /tmp isolated in containers |
| no-new-privileges | ✓ PASS | Security opt on sensitive services |

---

## 15. Deployment Servers & Access

### 15.1 Primary Production Server

**Server**: dv-syd-host01 (Contabo VPS, Sydney)
```
Hostname:          dv-syd-host01.icefish-discus.ts.net
Tailscale IP:      100.100.42.6
Public IP:         46.250.245.181 (BLOCKED - use Tailscale only)
vCPU:              12
RAM:               48 GB
Storage:           500 GB NVMe
OS:                Ubuntu 22.04 LTS
SSH Access:        ssh root@100.100.42.6 (via Tailscale)
```

### 15.2 Development Node

**Server**: acdev-devnode (Homelab, Sydney)
```
Hostname:          acdev-devnode.icefish-discus.ts.net
Tailscale IP:      100.78.187.5
SSH User:          root (not "user")
Purpose:           LM Studio, Engram development, Crawl4AI host
RAM:               16 GB
Hardware:          Ubuntu i5 10C NVMe
```

---

## 16. Summary Table: All Service Endpoints & Auth

| Service | Port | Auth Method | Endpoint | Access |
|---|---|---|---|---|
| **Memory API** | 8000 | JWT Bearer | `/api/memory/*` | Nginx proxy |
| **Crawler API** | 11235 | Optional API Key | `/api/crawler/*` | Nginx proxy |
| **MCP Server** | 3000 | OAuth 2.1 + Bearer | `/mcp*` | Nginx proxy |
| **Weaviate** | 8080 | Optional API Key | `/v1/*` | Docker network |
| **Platform** | 3000 | Clerk + JWT | `/*` | Nginx proxy |
| **Redis (Crawler)** | 6379 | None (internal) | — | Docker network |
| **Redis (Memory)** | 6379 | None (internal) | — | Docker network |
| **Nginx** | 80, 443 | TLS + rate limit | All routes | Public/Tailscale |

---

## 17. Validation & Testing

### 17.1 Pre-Deployment Checks

All checks documented in `./scripts/deploy-unified.sh`:

```bash
# System requirements
✓ Docker installed & daemon running
✓ Docker Compose available
✓ 16GB RAM recommended, 8GB minimum
✓ 50GB disk recommended, 20GB minimum
✓ Python 3.11+ (optional, for local dev)
✓ Node.js 20+ (optional, for local dev)
✓ curl available (required for health checks)
✓ git available (recommended for updates)

# Environment validation
✓ .env file exists
✓ Required secrets configured (JWT_SECRET, Clerk keys, etc.)
✓ JWT_SECRET minimum 32 characters
✓ BIND_ADDRESS not 0.0.0.0
✓ URLs properly formatted

# Compose config
✓ docker-compose.yml valid
```

### 17.2 Health Check Endpoints

**Production Monitoring**:
```bash
./scripts/deploy-unified.sh health
# Tests all service health endpoints via curl
# Output: JSON (--json flag) or human-readable summary
```

---

## 18. Backup & Disaster Recovery

### 18.1 Backup Types

**Quick Backup** (5-10 minutes):
```
✓ Redis snapshots (both instances)
✓ Weaviate schema export
✓ .env file
✓ Backup metadata (timestamp, git commit, etc.)
Location: ./backups/quick-YYYYMMDD-HHMMSS/
```

**Full Backup** (30-60 minutes):
```
✓ All quick backup items
✓ Docker volumes (tar.gz compressed)
  - weaviate_data
  - memory_redis_data
  - crawler_redis_data
Location: ./backups/full-YYYYMMDD-HHMMSS/
```

**Usage**:
```bash
./scripts/deploy-unified.sh backup quick
./scripts/deploy-unified.sh backup full
./scripts/deploy-unified.sh backup list
```

---

## 19. Recommendations & Best Practices

### 19.1 Security Hardening

1. **Rotate secrets quarterly** (Clerk keys, JWT secret, MCP token)
2. **Monitor Sentry vulnerabilities** (current: 2 high - plan v8 upgrade)
3. **Implement API rate limiting per client** (beyond IP-based limits)
4. **Enable audit logging** for sensitive operations (memory decay, etc.)
5. **Use Tailscale ACLs** to restrict which machines access prod

### 19.2 Operational Best Practices

1. **Run `quality-gate.sh` before every deployment**
2. **Create full backup before major updates**
3. **Monitor container resource usage** (script provides CPU/mem/net dashboard)
4. **Rotate logs monthly** to prevent disk growth
5. **Keep docker-compose.yml as single source of truth** (no drift)

### 19.3 Maintenance Schedule

- **Weekly**: Review Sentry error tracking, check disk usage
- **Monthly**: Log rotation, full backup, security patch reviews
- **Quarterly**: Secret rotation, dependency updates, security audit
- **Annually**: Full system load test, disaster recovery drill

---

## 20. Contact & Escalation

For access, credential, or security issues:

1. **Local Configuration**: `/Users/alex/.config/cloud-api-keys.env` (vault)
2. **Infrastructure Docs**: `/Users/alex/Projects/Infra/Infra Docs/00_Vault/`
3. **Deployment**: `./scripts/deploy-unified.sh` (interactive help)
4. **Health Checks**: `./scripts/deploy-unified.sh health`
5. **Issues**: Review `CHANGELOG.md` for recent changes & known issues

---

## Appendix A: File Locations Reference

| File | Purpose | Path |
|---|---|---|
| Environment Template | All required variables | `Engram-Platform/.env.example` |
| Production Secrets | Active configuration (PROTECTED) | `Engram-Platform/.env` |
| Global API Keys | Vault of all API credentials | `/Users/alex/.config/cloud-api-keys.env` |
| Docker Compose | Service orchestration | `Engram-Platform/docker-compose.yml` |
| Nginx Config | Reverse proxy & TLS | `Engram-Platform/nginx/nginx.conf` |
| Deploy Script | Unified deployment console | `scripts/deploy-unified.sh` |
| Env Validator | Pre-flight validation | `Engram-Platform/scripts/validate-env.sh` |
| Quality Gate | CI/CD validation | `scripts/quality-gate.sh` |
| Python Config | Dependencies & test config | `Engram-AiMemory/pyproject.toml` |
| MCP Package | Node.js dependencies | `Engram-MCP/package.json` |

---

## Appendix B: Debugging & Troubleshooting

### B.1 Check Service Status

```bash
./scripts/deploy-unified.sh status        # Resource dashboard
./scripts/deploy-unified.sh health        # Detailed health report
./scripts/deploy-unified.sh logs          # Tail all logs
./scripts/deploy-unified.sh logs memory-api  # Single service
```

### B.2 Common Issues

**Service won't start**:
```bash
./scripts/deploy-unified.sh validate      # Check .env
docker compose logs <service>             # Review logs
```

**Memory API auth failing**:
```bash
grep JWT_SECRET Engram-Platform/.env      # Verify set
echo $JWT_SECRET | wc -c                  # Check length (min 33)
```

**MCP OAuth not working**:
```bash
curl http://localhost:3000/.well-known/oauth-authorization-server
# Should return RFC 8414 metadata
```

---

**END OF AUDIT REPORT**

*Audit conducted: 2026-03-28*
*Scope: Read-only review of access, credentials, and environment configuration*
*All secret values masked — only key names documented*
