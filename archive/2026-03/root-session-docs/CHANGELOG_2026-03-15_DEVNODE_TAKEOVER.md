# Operation Takeover - Devnode Full Deployment Report

**Date:** 2026-03-15
**Node:** ACDEV-DEVNODE (100.78.187.5)
**Operator:** Claude Code (automated)

---

## Executive Summary

Full takeover and rebuild of Devnode completed. All 8 Docker services deployed from latest codebase. 7 of 8 services fully healthy; the Platform Frontend (Next.js) runs but returns 500 because Clerk authentication keys are not yet configured -- this is the only remaining action item.

---

## Actions Performed

### Phase 1: User & Runtime Setup
- Created `engramservice` user (uid 1001) with `sudo` + `docker` group membership
- Configured passwordless sudo via `/etc/sudoers.d/engramservice`
- Copied root SSH authorized_keys to engramservice
- Installed Node.js 20.20.1 LTS via NodeSource
- Transferred ownership of `/opt/engram/` to `engramservice`

### Phase 2: System Cleanup
- Cleaned apt cache (62KB remaining)
- Vacuumed journald (104.5MB -> 96.5MB, 3-day retention)
- Cleaned /tmp (108MB -> 28KB)
- Purged old compressed/rotated logs
- Purged pip cache (50MB freed)
- Cleaned npm cache
- Removed all `__pycache__`, `.pyc`, `.ruff_cache`, `.pytest_cache`, `.mypy_cache`, `.DS_Store`, `.coverage` from /opt

### Phase 3: Docker Cleanup
- Pruned unused Docker images, volumes, networks
- Cleaned Docker build cache
- Left NVR containers untouched (nvr-detection, go2rtc)

### Phase 4: Code Deployment
- Rsynced all 5 components from local Mac to `/opt/engram/`:
  - `Engram-AiMemory/`
  - `Engram-AiCrawler/`
  - `Engram-MCP/`
  - `Engram-Platform/`
  - `engram-shared/`
- Excluded `.git`, `node_modules`, `.venv*`, `__pycache__`, `.next`, `dist`

### Phase 5: Configuration
- Restored production `.env` from backup (DeepInfra embeddings, API keys, JWT secret)
- Updated `LM_STUDIO_URL` to WS01 Tailscale IP (100.114.241.115:1234)
- Set `BIND_ADDRESS=0.0.0.0` for Tailscale accessibility
- Generated self-signed TLS certificate for nginx
- Removed brotli directives from nginx config (not in nginx:alpine)
- Stopped and disabled host nginx to free ports 80/443

### Phase 6: Docker Image Builds
Fixed three build issues:
1. **engram-shared path**: Both AiMemory and AiCrawler Dockerfiles referenced `../../engram-shared[dev]` -- invalid inside Docker. Fixed by copying engram-shared into build contexts and patching Dockerfiles.
2. **Weaviate GOMEMLIMIT**: `1.2GiB` is malformed Go format. Changed to `1228MiB`.
3. **Crawler CACHE_ENABLED**: `sed` cleanup accidentally removed `CACHE_ENABLED` from docker-compose. Restored it.

Built images:
| Image | Size |
|-------|------|
| `crawl4ai-engram:latest` | 11.1 GB |
| `engram-memory-api:latest` | 243 MB |
| `engram-mcp-server:latest` | 156 MB |
| `engram-platform-platform-frontend:latest` | 226 MB |

### Phase 7: Service Startup
All 8 Docker Compose services started via `docker compose up -d`:
- Dependency chain: Redis -> Weaviate -> Memory API -> (MCP Server + Crawler API) -> Nginx
- Platform Frontend starts independently (no backend dependency)

### Phase 8: End-to-End Validation

| Test | Result | Details |
|------|--------|---------|
| Memory API /health | PASS | `{"status":"healthy","weaviate":true,"redis":true,"initialized":true}` |
| Memory API /docs | PASS | HTTP 200 |
| Weaviate v1 meta | PASS | Version 1.27.0 |
| MCP Server /health | PASS | `{"status":"ok","service":"engram-mcp","version":"1.0.0"}` |
| Crawler API / | PASS | "Crawl4AI OSINT Container Running" |
| Crawler Redis | PASS | PONG |
| Memory Redis | PASS | PONG |
| Nginx HTTPS | PASS | Listening on 80/443 |
| Memory API via Tailscale | PASS | HTTP 200 on 100.78.187.5:8000 |
| Platform Frontend | WARN | HTTP 500 (Clerk key missing) |

---

## Resource Usage (Steady State)

| Container | CPU | Memory | Limit |
|-----------|-----|--------|-------|
| engram-nginx | 0.00% | 16 MiB | 128 MiB |
| engram-mcp-server | 0.01% | 22 MiB | 256 MiB |
| engram-crawler-api | 0.25% | 451 MiB | 2 GiB |
| engram-memory-api | 0.43% | 212 MiB | 512 MiB |
| engram-memory-redis | 0.31% | 4 MiB | 384 MiB |
| engram-crawler-redis | 0.33% | 4 MiB | 512 MiB |
| engram-platform-frontend | 0.00% | 68 MiB | 256 MiB |
| engram-weaviate | 0.60% | 45 MiB | 1.5 GiB |
| **Total** | **~2%** | **~822 MiB** | **~5.5 GiB** |

Total memory usage: ~822 MiB of 14 GiB system RAM (5.7%).

---

## Credentials & Access

### System Accounts

| User | Password | Purpose |
|------|----------|---------|
| `root` | (existing SSH key) | Initial admin |
| `engramservice` | `EngramSvc2026!` | Service account (sudo, docker) |

### API Keys (from .env)

| Key | Value | Purpose |
|-----|-------|---------|
| Memory API Key | `TjXBBnxiBZJbPyL6VbOkPopKyY50EdLR` | X-API-Key header for Memory API |
| JWT Secret | `iocAbBas5FN7QCSLou5MRTOZzXgNLtcsdnqWRLTKQILNV9rs` | Auth token signing |
| MCP Auth Token | `kONfQCQqhgHojRQit7zEtHwqwNXptMb3` | MCP server bearer token |
| DeepInfra API Key | `qEcg16aUm1XLr4yIbJ3FhH0OrgjTXSKe` | Embedding provider |
| Admin Username | `admin` | Memory API admin |

### Clerk (NOT CONFIGURED - action required)
| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | *empty - needs Clerk dashboard key* |
| `CLERK_SECRET_KEY` | *empty - needs Clerk dashboard key* |

---

## Key Paths

| Path | Purpose |
|------|---------|
| `/opt/engram/` | Main deployment root |
| `/opt/engram/Engram-Platform/` | Docker Compose orchestration |
| `/opt/engram/Engram-Platform/.env` | Production environment file |
| `/opt/engram/Engram-Platform/docker-compose.yml` | Service definitions |
| `/opt/engram/Engram-Platform/nginx/` | Nginx reverse proxy config |
| `/opt/engram/Engram-Platform/certs/` | TLS certificates |
| `/opt/engram/env-backups/` | Backed up original .env files |

---

## Service Ports

| Service | Internal Port | External Port | URL |
|---------|--------------|---------------|-----|
| Platform Frontend | 3000 | (via nginx) | https://memory.velocitydigi.com/ |
| Memory API | 8000 | 8000 | http://100.78.187.5:8000 |
| Crawler API | 11235 | (via nginx) | https://memory.velocitydigi.com/api/crawler/ |
| MCP Server | 3000 | (via nginx) | https://memory.velocitydigi.com/api/mcp/ |
| Weaviate | 8080 | (internal) | http://engram-weaviate:8080 |
| Crawler Redis | 6379 | (internal) | redis://engram-crawler-redis:6379 |
| Memory Redis | 6379 | (internal) | redis://engram-memory-redis:6379 |
| Nginx | 80/443 | 80/443 | https://memory.velocitydigi.com |

---

## Administration Guide

### Start all services
```bash
ssh engramservice@100.78.187.5
cd /opt/engram/Engram-Platform
docker compose up -d
```

### Stop all services
```bash
cd /opt/engram/Engram-Platform
docker compose down
```

### View logs
```bash
docker compose logs -f memory-api       # Single service
docker compose logs -f --tail=50        # All services, last 50 lines
docker logs engram-crawler-api 2>&1     # Raw container logs
```

### Check status
```bash
docker compose ps
docker stats --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
```

### Restart a single service
```bash
docker compose restart memory-api
```

### Rebuild after code change
```bash
# Sync code from Mac
rsync -az --delete --exclude='.git' --exclude='node_modules' --exclude='.venv*' \
  /Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-AiMemory/ \
  engramservice@100.78.187.5:/opt/engram/Engram-AiMemory/

# Rebuild specific service
docker compose build memory-api
docker compose up -d memory-api
```

### Update .env
```bash
vi /opt/engram/Engram-Platform/.env
docker compose down && docker compose up -d
```

---

## Remaining Action Items

1. **Configure Clerk Keys**: Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `/opt/engram/Engram-Platform/.env` and restart: `docker compose restart platform-frontend`
2. **TLS Certificates**: Replace self-signed certs in `/opt/engram/Engram-Platform/certs/` with Let's Encrypt or proper certs
3. **WS01 LM Studio**: Verify LM Studio is running on 100.114.241.115:1234 for AI model support
4. **DNS**: Ensure `memory.velocitydigi.com` and `engram.velocitydigi.com` point to the correct IP/Tailscale
