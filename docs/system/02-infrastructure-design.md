# Engram Platform — Infrastructure Design

**Version**: 1.1.0
**Last Updated**: 2026-03-31
**Status**: Production

---

## 1. Production Host

| Property | Value |
|---|---|
| Hostname | `acdev-devnode` |
| Tailscale FQDN | `acdev-devnode.icefish-discus.ts.net` |
| Tailscale IP | `100.78.187.5` |
| OS | Ubuntu (i5 10-core, 16 GB RAM, 1 TB storage) |
| Role | Homelab — Engram Platform, Crawl4AI |
| Public IP exposure | None — all access via Tailscale VPN only |

**Access**:
```
ssh user@100.78.187.5
```

There is no public IP. All traffic reaches the host exclusively through Tailscale. The Docker Nginx container binds to the host's Tailscale interface, which terminates TLS and routes to internal services.

---

## 2. Docker Compose Orchestration

**Compose file**: `Engram-Platform/docker-compose.yml`
**Network**: Single bridge network `engram-platform-network`
**Restart policy**: `unless-stopped` on all services

### 2.1 Container Inventory

| Container Name | Image | Internal Port | Host Port Binding | Memory Limit | CPU Limit |
|---|---|---|---|---|---|
| `engram-memory-api` | `engram-memory-api:latest` | 8000 | `0.0.0.0:8000` (Tailscale direct) | 768 MB | 1.0 |
| `engram-crawler-api` | `crawl4ai-engram:latest` | 11235 | None (via Nginx) | 2 GB | 2.0 |
| `engram-mcp-server` | `engram-mcp-server:latest` | 3000 | None (via Nginx) | 256 MB | 0.5 |
| `engram-platform-frontend` | `engram-platform-frontend:latest` | 3000 | None (via Nginx) | 256 MB | 0.5 |
| `engram-weaviate` | `semitechnologies/weaviate:1.27.0` | 8080, 50051 | None | 1,536 MB | 1.0 |
| `engram-memory-redis` | `redis:7-alpine` | 6379 | None | 384 MB | 0.5 |
| `engram-crawler-redis` | `redis:7-alpine` | 6379 | None | 512 MB | 0.5 |
| `engram-nginx` | `nginx:alpine` | 80, 443 | `${BIND_ADDRESS:-127.0.0.1}:80`, `${BIND_ADDRESS:-127.0.0.1}:443` | 128 MB | 0.5 |

**Total resource allocation**: 5,890 MB memory limit, 6.5 CPU cores limit.

### 2.2 Memory Reservations

| Container | Reservation |
|---|---|
| `engram-memory-api` | 256 MB |
| `engram-crawler-api` | 768 MB |
| `engram-mcp-server` | 96 MB |
| `engram-platform-frontend` | 96 MB |
| `engram-weaviate` | 384 MB |
| `engram-memory-redis` | 128 MB |
| `engram-crawler-redis` | 192 MB |
| `engram-nginx` | 48 MB |

**Total reservation**: 1,968 MB — fits within the 16 GB host with headroom for the OS and Tailscale.

### 2.3 Startup Order (depends_on with healthchecks)

```
1. weaviate         (no dependencies)
   memory-redis     (no dependencies)
   crawler-redis    (no dependencies)

2. memory-api       (waits for: weaviate healthy, memory-redis healthy)

3. crawler-api      (waits for: crawler-redis healthy, memory-api healthy)
   mcp-server       (waits for: memory-api healthy)
   platform-frontend (no service dependencies)

4. nginx            (waits for: crawler-api, memory-api, platform-frontend started)
```

### 2.4 Health Checks

| Service | Method | Endpoint/Command | Interval | Timeout | Retries | Start Period |
|---|---|---|---|---|---|---|
| `memory-api` | curl | `http://localhost:8000/health` | 30s | 10s | 5 | — |
| `crawler-api` | curl | `http://localhost:11235/` | 30s | 10s | 3 | 60s |
| `mcp-server` | curl | `http://localhost:3000/health` | 30s | 10s | 5 | — |
| `platform-frontend` | node script | HTTP GET `http://localhost:3000` (status < 500) | 30s | 10s | 5 | — |
| `weaviate` | wget | `http://localhost:8080/v1/.well-known/ready` | 30s | 10s | 5 | — |
| `memory-redis` | redis-cli | `ping` | 10s | 5s | 5 | — |
| `crawler-redis` | redis-cli | `ping` | 10s | 5s | 5 | — |

### 2.5 Logging

All containers use the `json-file` log driver with `max-size: 10m` and `max-file: 3`, capping total log storage at 30 MB per container (240 MB worst case across all 8 containers).

### 2.6 Security Hardening

| Measure | Applied To |
|---|---|
| `no-new-privileges:true` | memory-api, crawler-api, mcp-server, platform-frontend |
| `read_only: true` filesystem | memory-api, mcp-server, platform-frontend |
| `tmpfs` for writable paths | memory-api (`/tmp:64m`), mcp-server (`/tmp:64m`), platform-frontend (`/tmp:64m`, `/app/.next/cache:32m`) |
| Shared memory limit | crawler-api: `shm_size: 2g` (required for Chromium) |

---

## 3. Volumes

### 3.1 Named Volumes

| Volume | Used By | Container Path | Purpose |
|---|---|---|---|
| `weaviate_data` | weaviate | `/var/lib/weaviate` | Vector database persistence |
| `memory_redis_data` | memory-redis | `/data` | Memory cache AOF persistence |
| `crawler_redis_data` | crawler-redis | `/data` | Crawler cache AOF persistence |
| `crawler_cache` | crawler-api | `/app/data/cache` | Crawl4AI page cache |
| `crawler_logs` | crawler-api | `/app/data/logs` | Application logs |
| `crawler_hot` | crawler-api | `/app/data/tiers/hot` | Hot tier data (24h) |
| `crawler_warm` | crawler-api | `/app/data/tiers/warm` | Warm tier data (7d) |
| `crawler_cold` | crawler-api | `/app/data/tiers/cold` | Cold tier data (30d) |
| `crawler_archive` | crawler-api | `/app/data/tiers/archive` | Archive tier (10 GB threshold) |
| `crawler_chroma_data` | crawler-api | `/app/data/chroma` | ChromaDB vector storage |
| `crawler_supervisor` | crawler-api | `/var/log/supervisor` | Supervisord logs |

### 3.2 Bind Mounts

| Host Path | Container | Container Path | Mode |
|---|---|---|---|
| `./nginx/nginx.conf` | nginx | `/etc/nginx/conf.d/default.conf` | read-only |
| `./certs/` | nginx | `/etc/nginx/certs/` | read-only |

### 3.3 tmpfs Mounts

| Container | Path | Size |
|---|---|---|
| nginx | `/var/cache/nginx` | 256 MB |
| memory-api | `/tmp` | 64 MB |
| mcp-server | `/tmp` | 64 MB |
| platform-frontend | `/tmp` | 64 MB |
| platform-frontend | `/app/.next/cache` | 32 MB |

---

## 4. Nginx Reverse Proxy

**Config file**: `Engram-Platform/nginx/nginx.conf`
**Bind mount**: `./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro`

### 4.1 Upstream Definitions

| Upstream Name | Backend | Keepalive Connections |
|---|---|---|
| `crawler_api` | `crawler-api:11235` | 32 |
| `memory_api` | `memory-api:8000` | 32 |
| `platform_frontend` | `platform-frontend:3000` | 64 |
| `mcp_server` | `mcp-server:3000` | 16 |

### 4.2 Route Table

| Location | Upstream | Rate Limit Zone | Notes |
|---|---|---|---|
| `/api/crawler/` | `crawler_api` | `api` (60r/s, burst 50) | Proxy headers, WebSocket upgrade, 300s read timeout |
| `/api/memory/` | `memory_api` | `api` (60r/s, burst 50) | Proxy headers, 300s read timeout |
| `/mcp` | `mcp_server` | `api` (60r/s, burst 20) | MCP HTTP streaming, buffering off |
| `/mcp/health` | `mcp_server` | None | Health check, access log off |
| `/.well-known/oauth-authorization-server` | `mcp_server` | None | OAuth discovery |
| `/ws` | `crawler_api` | None | WebSocket upgrade, 3600s read timeout |
| `~* \.(js\|css\|png\|...)$` | `platform_frontend` | None | 1 year cache, `public, immutable` |
| `/` (catch-all) | `platform_frontend` | `general` (120r/s, burst 100) | SSR cache (1 min), cookie/auth bypass |
| `/health` | Inline 200 | None | Nginx self-health |

### 4.3 Rate Limiting Zones

| Zone | Shared Memory | Rate | Applied To |
|---|---|---|---|
| `api` | 10 MB | 60 requests/second per IP | `/api/crawler/`, `/api/memory/`, `/mcp` |
| `general` | 10 MB | 120 requests/second per IP | `/` (frontend) |
| `write` | 10 MB | 20 requests/second per IP | Defined but not currently applied |

### 4.4 SSR Cache

```
proxy_cache_path /var/cache/nginx/ssr
    levels=1:2
    keys_zone=ssr_cache:50m
    max_size=500m
    inactive=60m
    use_temp_path=off
```

Applied to the frontend catch-all route with:
- `proxy_cache_valid 200 1m` — cache successful responses for 1 minute
- `proxy_cache_bypass $http_cookie` — bypass cache for authenticated requests
- `proxy_cache_bypass $http_authorization` — bypass cache for API-authenticated requests

### 4.5 TLS Configuration

| Property | Value |
|---|---|
| Certificate | `/etc/nginx/certs/velocitydigi.crt` (wildcard `*.velocitydigi.com`) |
| Private Key | `/etc/nginx/certs/velocitydigi.key` |
| Protocols | TLSv1.2, TLSv1.3 |
| Ciphers | ECDHE-ECDSA/RSA-AES128/256-GCM-SHA256/384, CHACHA20-POLY1305, DHE-RSA-AES128/256-GCM-SHA384 |
| Session cache | `shared:SSL:10m` |
| Session timeout | 1 day |
| Session tickets | Disabled |
| HSTS | `max-age=31536000; includeSubDomains` |
| OCSP stapling | Enabled |

### 4.6 Security Headers

| Header | Value |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | Clerk domains, Tailscale origins, WebSocket (see nginx.conf for full policy) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

### 4.7 Compression

Gzip enabled at compression level 5 for responses over 1,024 bytes. Compressed types: `text/plain`, `text/css`, `application/json`, `application/javascript`, `text/xml`, `application/xml`, `text/javascript`, `image/svg+xml`, `application/wasm`.

### 4.8 Client Limits

`client_max_body_size 100M` — supports large document uploads for the investigation/evidence pipeline.

---

## 5. Networking

### 5.1 Docker Network

Single bridge network: `engram-platform-network`. All containers communicate by service name over this network.

Nginx has network aliases:
- `memory.velocitydigi.com`
- `engram.velocitydigi.com`
- `${TAILSCALE_HOSTNAME:-dv-syd-host01.icefish-discus.ts.net}`

### 5.2 Port Exposure to Host

| Host Binding | Container | Purpose |
|---|---|---|
| `${BIND_ADDRESS:-127.0.0.1}:80` | nginx:80 | HTTP (redirects to HTTPS) |
| `${BIND_ADDRESS:-127.0.0.1}:443` | nginx:443 | HTTPS (main entry point) |
| `${MEMORY_API_BIND:-0.0.0.0}:8000` | memory-api:8000 | Direct API access for MCP stdio clients via Tailscale |

Only three ports are exposed to the host. The Memory API port 8000 is bound to `0.0.0.0` intentionally so that MCP stdio clients (Claude Code running on other Tailscale machines) can reach it directly at `http://100.78.187.5:8000` without going through Nginx.

### 5.3 Tailscale Integration

- All SSH access uses Tailscale IP `100.78.187.5`
- No public IP is assigned or used
- Tailscale subnet routes `192.168.0.0/24` from this node
- MCP clients on the Tailnet configure `ENGRAM_API_URL=http://100.78.187.5:8000`
- Browser access via `https://memory.velocitydigi.com` resolves through Cloudflare DNS to the Tailscale network (or direct Tailscale FQDN access)

### 5.4 DNS Configuration

| Domain | Type | Target | Purpose |
|---|---|---|---|
| `memory.velocitydigi.com` | A (Cloudflare) | Tailscale/proxy IP | Marketing/landing site + platform |
| `app.velocitydigi.com` | A (Cloudflare) | Pending configuration | Dashboard direct access |
| `clerk.velocitydigi.com` | CNAME (Cloudflare) | Clerk custom domain | Authentication provider |
| `*.velocitydigi.com` | Wildcard SSL cert | N/A | Covers all single-level subdomains |

---

## 6. Environment Variables

### 6.1 Memory API

| Variable | Default | Description |
|---|---|---|
| `WEAVIATE_URL` | `http://weaviate:8080` | Weaviate HTTP endpoint |
| `WEAVIATE_GRPC_URL` | `http://weaviate:50051` | Weaviate gRPC endpoint |
| `REDIS_URL` | `redis://memory-redis:6379` | Memory Redis connection |
| `EMBEDDING_PROVIDER` | `openai` | Provider: openai, deepinfra, nomic, ollama, local |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | `1536` | Vector dimensions |
| `MULTI_TENANCY_ENABLED` | `true` | Weaviate multi-tenancy |
| `JWT_SECRET` | Required | JWT signing secret |
| `MEMORY_API_KEY` | Optional | API key for authentication |
| `UVICORN_WORKERS` | `2` | Uvicorn worker processes |
| `UVICORN_LIMIT_CONN` | `100` | Max concurrent connections |
| `CORS_ORIGINS` | Multiple Engram domains | Allowed CORS origins |

### 6.2 Crawler API

| Variable | Default | Description |
|---|---|---|
| `ENGRAM_API_URL` | `http://memory-api:8000` | Memory API for cross-service storage |
| `REDIS_URL` | `redis://crawler-redis:6379/0` | Crawler Redis connection |
| `LM_STUDIO_URL` | `http://host.docker.internal:1234` | LM Studio inference endpoint |
| `CRAWL4AI_VERSION` | `0.5.0` | Crawl4AI engine version |
| `BROWSER_TYPE` | `chromium` | Headless browser type |
| `CHROMADB_PATH` | `/app/data/chroma` | ChromaDB storage path |
| `CHROMADB_SIMILARITY_THRESHOLD` | `0.7` | Vector similarity threshold |
| `DATA_HOT_MAX_AGE_HOURS` | `24` | Hot tier retention |
| `DATA_WARM_MAX_AGE_DAYS` | `7` | Warm tier retention |
| `DATA_COLD_MAX_AGE_DAYS` | `30` | Cold tier retention |
| `WATCHDOG_MEMORY_THRESHOLD_PERCENT` | `85` | Memory usage alert threshold |
| `WATCHDOG_DISK_THRESHOLD_PERCENT` | `90` | Disk usage alert threshold |

### 6.3 MCP Server

| Variable | Default | Description |
|---|---|---|
| `MEMORY_API_URL` | `http://memory-api:8000` | Memory API endpoint |
| `MCP_SERVER_PORT` | `3000` | HTTP transport port |
| `MCP_AUTH_TOKEN` | Optional | Bearer token auth |
| `OAUTH_ENABLED` | `true` | Enable OAuth 2.1 |
| `OAUTH_REDIS_URL` | `redis://memory-redis:6379` | OAuth token storage |

### 6.4 Platform Frontend

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://memory.velocitydigi.com` | Public app URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required | Clerk auth public key |
| `CLERK_SECRET_KEY` | Required | Clerk auth secret key |
| `CRAWLER_API_URL` | `http://crawler-api:11235` | Crawler API (server-side) |
| `MEMORY_API_URL` | `http://memory-api:8000` | Memory API (server-side) |

### 6.5 Weaviate

| Variable | Value | Description |
|---|---|---|
| `QUERY_DEFAULTS_LIMIT` | `100` | Default query result limit |
| `QUERY_MAXIMUM_TIMEOUT` | `60s` | Maximum query timeout |
| `AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED` | `true` | No auth (internal network only) |
| `MULTI_TENANCY_ENABLED` | `true` | Per-tenant data isolation |
| `GOMEMLIMIT` | `1200MiB` | Go runtime memory limit |
| `GOMAXPROCS` | `2` | Go runtime CPU limit |
| `CACHE_SIZE` | `384MB` | Internal query cache |
| `CACHE_TTL` | `3600` | Cache TTL in seconds |

### 6.6 Redis Configuration

| Instance | `maxmemory` | Eviction Policy | AOF | Keepalive |
|---|---|---|---|---|
| Memory Redis | 256 MB | `allkeys-lru` | Yes | 300s |
| Crawler Redis | 384 MB | `allkeys-lru` | Yes | 300s |

---

## 7. Build Contexts

Docker images are built from sibling directories relative to the compose file:

| Service | Build Context | Dockerfile |
|---|---|---|
| `memory-api` | `..` (monorepo root) | `Engram-AiMemory/docker/Dockerfile.memory-api` |
| `crawler-api` | `..` (monorepo root) | `Engram-AiCrawler/01_devroot/Dockerfile` (target: `production`) |
| `mcp-server` | `../Engram-MCP` | `docker/Dockerfile` |
| `platform-frontend` | `./frontend` | `Dockerfile` |

---

## 8. Backup and Recovery Considerations

**Stateful volumes requiring backup**:
1. `weaviate_data` — All vector memory data. Primary data store. Loss means total memory loss.
2. `memory_redis_data` — Cache with AOF. Reconstructable from Weaviate, but loss causes cache cold-start.
3. `crawler_redis_data` — Crawler cache with AOF. Reconstructable; loss causes crawl session loss.
4. `crawler_chroma_data` — ChromaDB vectors from crawled content. Loss means re-crawl required.
5. `crawler_hot` through `crawler_archive` — Tiered crawl data. Loss severity depends on tier age.

**Stateless containers** (no backup needed): nginx, platform-frontend, mcp-server.

**Recovery procedure**: `docker compose down && docker compose up -d` restarts the full stack. Healthcheck-based startup order ensures correct initialization sequence.
