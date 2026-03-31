# 04 — Security and Compliance

> Engram Platform security architecture, authentication model, and data protection controls.
> Last updated: 2026-03-31

---

## Table of Contents

1. [Authentication Model](#authentication-model)
2. [API Key Lifecycle](#api-key-lifecycle)
3. [JWT Authentication](#jwt-authentication)
4. [Clerk Frontend Authentication](#clerk-frontend-authentication)
5. [Security Headers](#security-headers)
6. [Cache Security](#cache-security)
7. [Audit Logging](#audit-logging)
8. [Rate Limiting](#rate-limiting)
9. [CORS Configuration](#cors-configuration)
10. [Network Security](#network-security)
11. [Data Integrity](#data-integrity)
12. [Container Security](#container-security)
13. [TLS Configuration](#tls-configuration)
14. [Trust Boundaries](#trust-boundaries)

---

## Authentication Model

The Memory API implements dual authentication -- callers present either an API key or a JWT bearer token. Both are evaluated by the `require_auth` FastAPI dependency defined in `Engram-AiMemory/packages/core/src/memory_system/auth.py`.

### Resolution Order

1. **X-API-Key header** -- checked first.
   - The key is validated against Redis-managed keys via `KeyManager.validate_key()`.
   - If no Redis match, falls back to static keys from the `API_KEYS` environment variable.
   - Comparison uses `hmac.compare_digest()` to prevent timing attacks.
   - On success, returns identity string `apikey:{key_id}:{key_name}`.

2. **Authorization: Bearer {token}** -- checked second.
   - The JWT is decoded with `python-jose` using HS256 and the `JWT_SECRET`.
   - On success, returns the `sub` claim as the identity.

3. **No credentials** -- returns HTTP 401 with a message explaining that either `X-API-Key` or `Authorization: Bearer` is required.

If `API_KEYS` is empty and `ADMIN_PASSWORD_HASH` is not set, the API returns 401 explaining that authentication is not configured. There is no "open to everyone" fallback.

### Identity Format

The authenticated identity string is passed downstream and recorded in audit logs:

| Auth method | Identity format |
|---|---|
| Redis-managed API key | `apikey:{ek_id}:{name}` |
| Static env API key | `apikey:{first4}...` |
| JWT bearer | Value of `sub` claim (typically username) |

---

## API Key Lifecycle

API keys are managed by `KeyManager` in `Engram-AiMemory/packages/core/src/memory_system/key_manager.py`. Keys are stored in Redis with SHA-256 hashing, following the same pattern as GitHub Personal Access Tokens.

### Key Generation

- 48-character cryptographically random string using `secrets.choice()` from the alphabet `[a-zA-Z0-9-_]`.
- Key IDs are prefixed with `ek_` followed by 16 hex characters (e.g., `ek_a1b2c3d4e5f6a7b8`).

### Storage

Each key is stored as a Redis hash at `engram:api_keys:{key_id}` with the following fields:

| Field | Description |
|---|---|
| `id` | Unique key ID (`ek_` prefix) |
| `name` | Human-readable label |
| `key_hash` | SHA-256 hex digest of the raw key |
| `prefix` | Display prefix (`first8...last4`) |
| `created_at` | ISO 8601 timestamp |
| `created_by` | Creator identity (e.g., `admin`, `system (env migration)`) |
| `last_used_at` | ISO 8601 timestamp of last use |
| `status` | `active` or `revoked` |
| `request_count` | Integer usage counter |
| `source` | `api` (created via endpoint) or `env` (migrated from env var) |

A Redis set at `engram:api_keys:index` tracks all key IDs for enumeration.

### Validation

When an API key is presented:

1. The raw key is SHA-256 hashed.
2. All key IDs from the index set are iterated.
3. Each stored hash is compared against the request hash.
4. If a match is found and the key status is `active`, the key metadata is returned.
5. If the key status is `revoked`, `None` is returned (treated as invalid).

### Usage Tracking

On each successful validation, `KeyManager.record_usage()` is called:
- Sets `last_used_at` to the current UTC timestamp.
- Atomically increments `request_count` via `HINCRBY` in a Redis pipeline.

### Revocation

Revocation is a soft-delete -- the key hash remains in Redis but `status` is set to `revoked`. Revoked keys fail validation immediately. There is no hard-delete; the key metadata is retained for audit trail purposes.

### Environment Variable Migration

On startup, `KeyManager.migrate_env_keys()` reads comma-separated keys from the `API_KEYS` environment variable and creates Redis entries for any that do not already exist. This is idempotent -- migrated keys are tagged with `source: env` and are not re-migrated on subsequent restarts.

### Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/keys` | List all keys with metadata (hashes never exposed) |
| `POST` | `/admin/keys` | Create a new key; returns the raw key once |
| `PATCH` | `/admin/keys/{key_id}` | Update key name or status |
| `DELETE` | `/admin/keys/{key_id}` | Soft-revoke a key |

All admin endpoints require authentication via `require_auth`.

---

## JWT Authentication

### Token Structure

- Algorithm: HS256
- Signing secret: `JWT_SECRET` environment variable (validated at startup; must not be empty or `change-me-in-production`)
- Default expiry: 24 hours (configurable via `JWT_EXPIRE_HOURS`)
- Claims: `sub` (username), `exp` (expiry), `iat` (issued at)

### Login Flow

`POST /auth/login` accepts `username` and `password`:
1. Validates `ADMIN_PASSWORD_HASH` is configured (returns 401 if not).
2. Checks username matches `ADMIN_USERNAME` (default: `admin`).
3. Verifies password against the bcrypt hash using `bcrypt.checkpw()`.
4. Returns a signed JWT and its TTL in seconds.

Rate limited to 10 requests per minute per IP.

### Token Refresh

`POST /auth/refresh` requires a valid existing token or API key and issues a fresh JWT with a new expiry.

---

## Clerk Frontend Authentication

The Engram Platform frontend uses Clerk v6 for user authentication. Configuration is in `Engram-Platform/frontend/src/server/admin-access.ts`.

### Admin Access Control

The `requireAdminAccess()` function enforces admin authorization through three mechanisms, evaluated in order:

1. **Allowlist** -- Clerk user IDs listed in `ENGRAM_ADMIN_USER_IDS` (comma-separated). If the authenticated user's ID is in this list, access is granted with `mode: 'allowlist'`.

2. **Session metadata** -- If the user's Clerk session claims contain `metadata.role === 'admin'`, access is granted with `mode: 'metadata'`.

3. **Organization role** -- If the user's Clerk org role is `org:admin` or `org:owner`, access is granted with `mode: 'org-role'`.

If none match, a `Forbidden` error is thrown.

When Clerk is not enabled (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is empty), admin access is disabled entirely and returns `mode: 'disabled'` with `userId: null`.

### Clerk Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Clerk backend key |
| `NEXT_PUBLIC_CLERK_DOMAIN` | Custom domain (e.g., `clerk.velocitydigi.com`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` |
| `ENGRAM_ADMIN_USER_IDS` | Comma-separated Clerk user IDs for admin allowlist |

---

## Security Headers

Security headers are applied at two layers: nginx (reverse proxy) and Next.js (application).

### Nginx Headers (applied to all HTTPS responses)

| Header | Value |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

### Next.js Headers (applied by `next.config.ts`)

| Header | Value |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-DNS-Prefetch-Control` | `on` |

The `poweredByHeader` option is set to `false` in Next.js config. Nginx also strips `X-Powered-By` from proxied responses via `proxy_hide_header X-Powered-By`.

### Content Security Policy

The CSP is defined in both nginx and Next.js. The nginx CSP is authoritative in production (it overwrites the Next.js header). Key directives:

| Directive | Allowed Sources |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` + Clerk domains |
| `style-src` | `'self' 'unsafe-inline'` + Google Fonts |
| `font-src` | `'self'` + Google Fonts + `data:` |
| `img-src` | `'self' data: blob:` + Clerk image domains |
| `connect-src` | `'self'` + Clerk + WebSocket + Tailscale origins |
| `frame-src` | Clerk domains |
| `worker-src` | `'self' blob:` |

**Note**: `unsafe-inline` and `unsafe-eval` in `script-src` are required by Clerk's JavaScript SDK and Next.js runtime. This is a known trade-off documented in Clerk's CSP guidance.

---

## Cache Security

### API Routes

All `/api/*` routes in Next.js return:
```
Cache-Control: private, no-cache, no-store, must-revalidate
```

This prevents browsers and intermediate proxies from caching authenticated API responses.

### Nginx SSR Cache

The nginx reverse proxy caches SSR responses from the frontend with these safeguards:

- Cache is bypassed when `Cookie` or `Authorization` headers are present:
  ```
  proxy_cache_bypass $http_cookie;
  proxy_cache_bypass $http_authorization;
  ```
- Cached responses expire after 1 minute (`proxy_cache_valid 200 1m`).
- The `X-Cache-Status` response header indicates cache hit/miss for debugging.

### Static Assets

Static files (JS, CSS, images, fonts) use aggressive caching:
```
Cache-Control: public, max-age=31536000, immutable
```

This is safe because Next.js uses content-hashed filenames for static assets.

### Service Worker

The service worker file (`/sw.js`) is explicitly set to:
```
Cache-Control: public, max-age=0, must-revalidate
```

---

## Audit Logging

The audit system is implemented in `Engram-AiMemory/packages/core/src/memory_system/audit.py` using Redis Streams.

### Stream Configuration

- Stream key: `engram:audit_log`
- Maximum entries: 10,000 (approximate trimming via `XADD ... MAXLEN ~`)
- Storage: Redis (memory-redis container)

### Recorded Fields

Each audit entry contains:

| Field | Description |
|---|---|
| `timestamp` | ISO 8601 UTC timestamp |
| `key_id` | API key ID (if applicable) |
| `key_name` | API key name (if applicable) |
| `identity` | Authenticated identity string |
| `method` | HTTP method (GET, POST, etc.) |
| `path` | Request path |
| `status_code` | HTTP response status code |
| `ip` | Client IP address |
| `latency_ms` | Request processing time in milliseconds |
| `tenant_id` | Multi-tenancy tenant identifier |

### Excluded Paths

The following paths are excluded from audit logging to reduce noise:
- `/health`
- `/metrics`
- `/openapi.json`
- `/docs`
- `/redoc`

### Audit is Non-Blocking

Audit logging is wrapped in a bare `except` clause in the middleware. If the audit logger fails (e.g., Redis is down), the request still completes normally. Audit failures are silently ignored.

### Query API

| Endpoint | Purpose |
|---|---|
| `GET /admin/audit-log` | Paginated query with filters: `key_id`, `path`, `method`, `limit`, `offset` |
| `GET /admin/audit-log/summary` | Aggregated stats for the last N hours: total requests, error count/rate, top endpoints, top keys |

---

## Rate Limiting

Rate limiting is applied at two layers.

### Nginx Layer (per IP, outer boundary)

Defined in `Engram-Platform/nginx/nginx.conf`:

| Zone | Rate | Burst | Applied To |
|---|---|---|---|
| `api` | 60 req/s | 50 | `/api/crawler/`, `/api/memory/`, `/mcp` |
| `general` | 120 req/s | 100 | `/` (frontend catch-all) |
| `write` | 20 req/s | -- | Reserved for write-heavy endpoints |

All zones use `$binary_remote_addr` as the key (per client IP).

### Application Layer (per IP, inner boundary)

The Memory API uses `slowapi` (Python) with `get_remote_address` as the key function:

| Endpoint Pattern | Rate Limit |
|---|---|
| `POST /auth/login` | 10/minute |
| `POST /memories`, `POST /memories/batch` | `RATE_LIMIT_PER_MINUTE`/minute (default: 100) |
| `POST /search`, `POST /rag/query` | `RATE_LIMIT_PER_MINUTE`/minute |
| Destructive operations (e.g., bulk delete) | 10/minute |

When a rate limit is exceeded, the API returns HTTP 429 with:
```json
{"detail": "Rate limit exceeded. Please slow down."}
```

---

## CORS Configuration

### Memory API

CORS is configured via FastAPI middleware in `api.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=_api_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

The `CORS_ORIGINS` environment variable accepts a comma-separated list. Default production origins:

```
https://memory.velocitydigi.com
https://engram.velocitydigi.com
http://localhost:3002
http://localhost:3001
http://localhost
http://100.100.42.6:3002
http://dv-syd-host01.icefish-discus.ts.net:3002
https://dv-syd-host01.icefish-discus.ts.net
```

### Crawler API

The crawler uses the same `CORS_ORIGINS` pattern via its own FastAPI CORS middleware.

---

## Network Security

### Tailscale-Only SSH

All SSH access to production infrastructure is via Tailscale IP addresses only. Public IPs are never used for SSH:

| Host | Tailscale IP | Role |
|---|---|---|
| `acdev-devnode` | `100.78.187.5` | Production (Engram services) |
| `dv-syd-host01` | `100.100.42.6` | Decommissioning |

### Docker Network Isolation

All Engram containers communicate on a private bridge network (`engram-platform-network`). Only nginx exposes ports to the host:

| Container | Exposed Port | Bind Address |
|---|---|---|
| `engram-nginx` | 80, 443 | `${BIND_ADDRESS:-127.0.0.1}` (loopback by default) |
| `engram-memory-api` | 8000 | `${MEMORY_API_BIND:-0.0.0.0}` (Tailscale direct access) |

All other containers (Weaviate, Redis, crawler, MCP, frontend) have no host port bindings and are only reachable within the Docker bridge network.

### Container Hardening

Production containers apply:

```yaml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp:size=64m
```

Containers with `read_only: true`: `memory-api`, `mcp-server`, `platform-frontend`.

---

## Data Integrity

### Embedding Vectors

Memory content is embedded on write and stored in Weaviate. The embedding vector is tied to the content at creation time. There is no mechanism to modify a memory's content after creation -- memories are immutable once stored. To correct content, the original memory must be deleted and a new one created.

### Multi-Tenancy Isolation

Weaviate multi-tenancy is enabled (`MULTI_TENANCY_ENABLED=true`). Each tenant's data is stored in a separate partition within Weaviate collections. Tenant ID is passed with every query and is enforced at the Weaviate level.

### Memory Decay

The decay system (`decay.py`) reduces importance scores over time for memories that are not accessed. This is a controlled data lifecycle mechanism:
- Half-life: 30 days (configurable via `DECAY_HALF_LIFE_DAYS`)
- Access boost: +0.1 importance per access
- Minimum floor: 0.1 (memories never decay to zero)

---

## Container Security

### Resource Limits

Every container has explicit memory and CPU limits to prevent runaway resource consumption:

| Container | Memory Limit | CPU Limit |
|---|---|---|
| `engram-crawler-api` | 2 GB | 2.0 |
| `engram-memory-api` | 768 MB | 1.0 |
| `engram-weaviate` | 1536 MB | 1.0 |
| `engram-crawler-redis` | 512 MB | 0.5 |
| `engram-memory-redis` | 384 MB | 0.5 |
| `engram-mcp-server` | 256 MB | 0.5 |
| `engram-platform-frontend` | 256 MB | 0.5 |
| `engram-nginx` | 128 MB | 0.5 |

### Log Rotation

All containers use the `json-file` log driver with:
```yaml
max-size: "10m"
max-file: "3"
```

This caps log storage at 30 MB per container.

---

## TLS Configuration

TLS is terminated at nginx. Configuration in `nginx.conf`:

- Protocols: TLSv1.2 and TLSv1.3 only
- Ciphers: ECDHE-based suites (AEAD ciphers only: AES-128-GCM, AES-256-GCM, CHACHA20-POLY1305)
- Server cipher preference: off (client chooses, as all offered ciphers are strong)
- Session cache: shared SSL zone, 10 MB
- Session timeout: 1 day
- Session tickets: disabled
- OCSP stapling: enabled (when using real certificates)

Certificate files are mounted from `./certs/` into the nginx container:
```
ssl_certificate /etc/nginx/certs/velocitydigi.crt;
ssl_certificate_key /etc/nginx/certs/velocitydigi.key;
```

HTTP to HTTPS redirect is enforced for all server names.

---

## Trust Boundaries

### Trusted Data

- **API keys**: Generated server-side with cryptographic randomness; stored as SHA-256 hashes.
- **JWT tokens**: Signed server-side with a secret known only to the Memory API.
- **Clerk session claims**: Verified by Clerk's SDK against Clerk's infrastructure.
- **Weaviate data**: Internal service, no direct external access.
- **Redis data**: Internal service, no direct external access.

### Derived / Untrusted Data

- **User-supplied memory content**: Stored as-is. No server-side sanitization beyond Pydantic validation of field types and sizes.
- **Embedding vectors**: Generated from user content via external providers (OpenAI, DeepInfra, Nomic). The embedding provider is trusted but the source content is user-controlled.
- **Client IP addresses**: Derived from `X-Real-IP` / `X-Forwarded-For` headers set by nginx. Trustworthy only because nginx is the sole entry point.
- **Crawler-discovered content**: Web content ingested by the crawler is untrusted external data. It passes through AI analysis before storage but is not sanitized for XSS or injection.
