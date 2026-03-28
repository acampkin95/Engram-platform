# Engram Platform — Comprehensive Deployment Status Report

**Date**: 2026-03-28 | **Version**: v1.1.0 | **Branch**: main

---

## Executive Summary

| Area | Status | Details |
|------|--------|---------|
| **Production (dv-syd-host01)** | **NOT DEPLOYED** | No Engram containers running; only LibreChat, Mailcow, Better-Auth |
| **Dev Node (acdev-devnode)** | **PARTIAL** | 7/8 services healthy; **Platform frontend UNHEALTHY** (missing Clerk keys) |
| **Local Builds** | **PASS** | Next.js, MCP TypeScript, all compile clean |
| **Test Suites** | **PASS** | Platform 794 pass, MCP 382 pass |
| **Git** | **DIRTY** | 2 commits ahead of origin, 161+ modified files, 81+ untracked |

### Critical Issues (Action Required)

1. **Platform frontend unhealthy on devnode** — Missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. 4,117 consecutive health check failures (34+ hours).
2. **Engram not deployed to production** — dv-syd-host01 has zero Engram containers. Only Memory API responds (200) — likely from a standalone process, not Docker.
3. **Unpushed commits** — 2 local commits not pushed to origin/main.
4. **Large uncommitted diff** — 161 modified + 81 untracked files in working tree.

---

## 1. Infrastructure Status

### 1.1 Production Server — dv-syd-host01

| Property | Value |
|----------|-------|
| **Tailscale IP** | `100.100.42.6` |
| **Public IP** | `46.250.245.181` (firewalled) |
| **Domain** | `dv-syd-host01.icefish-discus.ts.net` |
| **SSH** | `ssh root@100.100.42.6` (Tailscale only) |
| **Hardware** | Ubuntu, 12 vCPU, 48 GB RAM, 500 GB NVMe |
| **Uptime** | 13 days, 2 hours |
| **Disk** | 268 GB / 484 GB used (56%) |
| **Memory** | 7.5 GB / 48 GB used (16%) |
| **Load** | 1.93, 1.64, 1.34 |

**Running Services (28 containers, 3 compose projects):**

| Project | Containers | Status |
|---------|-----------|--------|
| LibreChat | 5 | Running (AI chat) |
| Better-Auth | 2 | Healthy |
| Mailcow | 11 | Running (email infra) |
| Portainer Agent | 1 | Running |
| **Engram** | **0** | **NOT DEPLOYED** |

**Health Checks from Production:**

| Service | HTTP Status | Verdict |
|---------|-------------|---------|
| Memory API (8000) | 200 | Responding (standalone process?) |
| Crawler API (11235) | — | NOT RUNNING |
| Weaviate (8080) | — | NOT RUNNING |
| Platform (3002) | — | NOT RUNNING |

### 1.2 Dev Node — acdev-devnode

| Property | Value |
|----------|-------|
| **Tailscale IP** | `100.78.187.5` |
| **Domain** | `acdev-devnode.icefish-discus.ts.net` |
| **SSH** | `ssh root@100.78.187.5` (Tailscale only) |
| **Hardware** | Ubuntu, i5 10C, 16 GB RAM, 1 TB NVMe |
| **Uptime** | 11 days, 11 hours |
| **Disk** | 9.6 GB / 843 GB used (2%) — ZFS |
| **Memory** | 5.7 GB / 15 GB used (37%) |
| **Load** | 0.11, 0.11, 0.09 (idle) |

**Engram Containers (8 total):**

| Container | Status | Memory | Uptime |
|-----------|--------|--------|--------|
| engram-memory-api | Healthy | 228 MB / 768 MB | 36 hours |
| engram-crawler-api | Healthy | 638 MB / 2 GB | 2 days |
| engram-weaviate | Healthy | 357 MB / 1 GB | 9 days |
| engram-mcp-server | Healthy | 37 MB / 256 MB | 9 days |
| engram-memory-redis | Healthy | 5 MB / 384 MB | 11 days |
| engram-crawler-redis | Healthy | 5 MB / 512 MB | 11 days |
| engram-nginx | Running | 58 MB / 1.5 GB | 5 days |
| **engram-platform-frontend** | **UNHEALTHY** | 75 MB / 512 MB | 34 hours |

**Root Cause — Frontend Unhealthy:**
```
Error: @clerk/nextjs: Missing publishableKey
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  ← EMPTY
CLERK_SECRET_KEY=                   ← EMPTY
```
**Fix**: Set Clerk keys in the deployed `.env` or pass via `docker compose` environment.

### 1.3 Tailscale Network

| Device | IP | Status |
|--------|----|--------|
| dv-syd-host01 | 100.100.42.6 | Connected |
| acdev-devnode | 100.78.187.5 | Connected |
| alex-macbookm4pro | 100.117.68.96 | Connected (direct) |
| vd-syd-fleet | 100.123.68.95 | Connected |
| ns558336 | 100.118.114.56 | Connected |

---

## 2. Local Build & Test Status

### 2.1 Build Results

| Subproject | Build Command | Result |
|-----------|--------------|--------|
| Platform (Next.js) | `npm run build` | **PASS** |
| MCP (TypeScript) | `npm run build` | **PASS** |
| AiMemory (Python) | `python3 -c "import memory_system"` | FAIL (Python 3.9 local; needs 3.11+) |

### 2.2 Test Results

| Subproject | Tests | Pass | Fail | Skip |
|-----------|-------|------|------|------|
| Platform Frontend | vitest | **794** | 0 | 0 |
| MCP Server | node --test | **382** | 0 | 0 |
| AiMemory (last run) | pytest | 901 | 0 | 3 |
| AiCrawler (last run) | pytest | 2,393 | 0 | 2 |
| **Total** | | **4,470** | **0** | **5** |

### 2.3 Local Tool Versions

| Tool | Version |
|------|---------|
| Node.js | v25.8.2 |
| Python | 3.9.6 (needs 3.11+ for AiMemory) |
| Docker | 29.2.0 |
| Git tag | v1.1.0 |

---

## 3. Access Details & Credentials

### 3.1 Service Endpoints

#### Internal Docker Network (container-to-container)

| Service | Container | Port | URL |
|---------|-----------|------|-----|
| Crawler API | engram-crawler-api | 11235 | `http://crawler-api:11235` |
| Memory API | engram-memory-api | 8000 | `http://memory-api:8000` |
| MCP Server | engram-mcp-server | 3000 | `http://mcp-server:3000` |
| Weaviate | engram-weaviate | 8080 | `http://weaviate:8080` |
| Weaviate gRPC | engram-weaviate | 50051 | `grpc://weaviate:50051` |
| Crawler Redis | engram-crawler-redis | 6379 | `redis://crawler-redis:6379/0` |
| Memory Redis | engram-memory-redis | 6379 | `redis://memory-redis:6379` |
| Frontend | engram-platform-frontend | 3000 | `http://platform-frontend:3000` |

#### Nginx Reverse Proxy Routes

| Route | Target | Rate Limit | TLS |
|-------|--------|-----------|-----|
| `/api/crawler/*` | crawler-api:11235 | 60 req/s | Yes |
| `/api/memory/*` | memory-api:8000 | 60 req/s | Yes |
| `/mcp*` | mcp-server:3000 | 20 req/s | Yes |
| `/ws` | crawler-api:11235 (WebSocket) | — | Yes |
| `/.well-known/oauth-*` | mcp-server:3000 | — | Yes |
| `/*` (static) | platform-frontend:3000 | 120 req/s | 1yr cache |
| `/` (SSR) | platform-frontend:3000 | 120 req/s | 1min cache |

#### Production URLs

| URL | Purpose |
|-----|---------|
| `https://memory.velocitydigi.com` | Production dashboard |
| `https://engram.velocitydigi.com` | Alt production domain |
| `https://dv-syd-host01.icefish-discus.ts.net` | Tailscale direct |
| `http://localhost:3002` | Local development |

### 3.2 Authentication Methods

| Service | Auth Method | Key Variables |
|---------|------------|---------------|
| **Platform (Frontend)** | Clerk v6 (OAuth/email) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| **Memory API** | JWT + API Key | `JWT_SECRET` (≥32 chars), `MEMORY_API_KEY` |
| **MCP Server** | OAuth 2.1 PKCE + Bearer | `MCP_AUTH_TOKEN`, `OAUTH_SECRET`, `OAUTH_REDIS_URL` |
| **Weaviate** | Anonymous (optional key) | `WEAVIATE_API_KEY` (optional) |

**OAuth 2.1 Endpoints (MCP):**
- Discovery: `/.well-known/oauth-authorization-server`
- Registration: `/oauth/register` (RFC 7591)
- Authorize: `/oauth/authorize` (PKCE)
- Token: `/oauth/token`

### 3.3 Required Environment Variables

#### Critical (deployment blocks without these)

| Variable | Purpose | Source |
|----------|---------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth | https://dashboard.clerk.com |
| `CLERK_SECRET_KEY` | Clerk backend auth | https://dashboard.clerk.com |
| `JWT_SECRET` | Memory API token signing | `openssl rand -base64 32` |
| `DEEPINFRA_API_KEY` | Text embeddings | https://deepinfra.com/dash/api_keys |
| `MCP_AUTH_TOKEN` | MCP bearer token | Generated hex |
| `BIND_ADDRESS` | Service bind (NEVER 0.0.0.0) | `127.0.0.1` or Tailscale IP |
| `EMBEDDING_PROVIDER` | Embedding service | `deepinfra` / `openai` / `ollama` |

#### Network & Database

| Variable | Default |
|----------|---------|
| `WEAVIATE_URL` | `http://weaviate:8080` |
| `REDIS_URL` | `redis://crawler-redis:6379/0` |
| `MEMORY_REDIS_URL` | `redis://memory-redis:6379` |
| `LM_STUDIO_URL` | `http://host.docker.internal:1234` |
| `NEXT_PUBLIC_APP_URL` | `https://memory.velocitydigi.com` |
| `CORS_ORIGINS` | localhost + Tailscale + prod domains |

#### Optional

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Alt embedding provider |
| `RESEND_API_KEY` | Email notifications |
| `NTFY_API_KEY` | Push notifications |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | Error tracking |

### 3.4 Secrets Location

| File | Purpose | Status |
|------|---------|--------|
| `/Users/alex/.config/cloud-api-keys.env` | Global API key vault (3.4 KB) | Exists |
| `Engram-Platform/.env` | Platform secrets (4.7 KB) | Exists |
| `Engram-Platform/.env.example` | Template with all vars documented | Exists |

---

## 4. Setup & Deployment Guide

### 4.1 Prerequisites

```
Node.js    ≥ 20.x (current: v25.8.2)
Python     ≥ 3.11 (local mac has 3.9.6 — use pyenv or docker)
Docker     ≥ 24.x (current: 29.2.0)
Tailscale  Active and connected
bun        Latest (preferred package manager)
```

### 4.2 Local Development Setup

#### Clone & Configure
```bash
cd ~/Projects/Dev/LIVE/Production/09_EngramPlatform

# Copy environment template
cp Engram-Platform/.env.example Engram-Platform/.env

# Edit .env with your keys (see Section 3.3)
# Source global API keys
source /Users/alex/.config/cloud-api-keys.env
```

#### Platform Frontend (Next.js 15)
```bash
cd Engram-Platform/frontend
npm install
npm run dev          # http://localhost:3002
npm run test:run     # vitest (794 tests)
npm run build        # production build
npm run lint         # biome check
```

#### MCP Server (TypeScript)
```bash
cd Engram-MCP
npm install
npm run build        # tsc
npm run dev          # tsc --watch
npm test             # 382 tests
npm run start:http   # HTTP transport :3000
npm run start:stdio  # stdio transport
```

#### AiMemory (Python 3.11+)
```bash
cd Engram-AiMemory
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
make test-python     # pytest (901 tests)
make lint            # ruff + mypy
make dev             # dev server
```

#### AiCrawler (Python + React)
```bash
cd Engram-AiCrawler/01_devroot
pip install -r requirements.txt
ruff check app/      # lint
pytest tests/ -v     # 2393 tests
```

### 4.3 Docker Compose Full Stack

```bash
cd Engram-Platform

# Configure environment
cp .env.example .env
# Fill in: CLERK keys, JWT_SECRET, DEEPINFRA_API_KEY, MCP_AUTH_TOKEN

# Validate config
./scripts/validate-env.sh

# Start all services
docker compose up -d

# Include MCP server
docker compose up -d --profile mcp

# Check health
docker compose ps
docker compose logs -f memory-api

# Tail all logs
docker compose logs -f
```

### 4.4 Production Deployment

```bash
# 1. Run quality gate
./scripts/quality-gate.sh

# 2. SSH to target server
ssh root@100.100.42.6    # production
ssh root@100.78.187.5    # devnode

# 3. Transfer files via SFTP
sftp root@100.100.42.6:/opt/engram-platform/

# 4. Deploy using unified script
./scripts/deploy-unified.sh deploy

# Key deploy commands:
./scripts/deploy-unified.sh init      # First-time setup
./scripts/deploy-unified.sh setup     # Configure .env
./scripts/deploy-unified.sh deploy    # Full deploy
./scripts/deploy-unified.sh health    # Health check
./scripts/deploy-unified.sh status    # Resource dashboard
./scripts/deploy-unified.sh backup quick  # Backup
```

### 4.5 Troubleshooting

| Issue | Fix |
|-------|-----|
| Frontend unhealthy (Clerk error) | Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env` then `docker compose restart platform-frontend` |
| Memory API 503 | Check Weaviate: `docker logs engram-weaviate` |
| Curl returns 000 | Service not running or port not exposed; check `docker compose ps` |
| BIND_ADDRESS 0.0.0.0 error | Set to `127.0.0.1` or Tailscale IP — never public |
| Python import fails | Ensure Python 3.11+; local mac has 3.9.6 |
| Embedding errors | Verify `EMBEDDING_PROVIDER` and corresponding API key |
| SSL cert warnings | Self-signed certs; expected over Tailscale |

---

## 5. Docker Resource Configuration

| Service | Memory Limit | CPU | Reserve | Logging |
|---------|-------------|-----|---------|---------|
| crawler-api | 2 GB | 2.0 | 768 MB | json-file 10m x3 |
| memory-api | 768 MB | 1.0 | 256 MB | json-file 10m x3 |
| weaviate | 1536 MB | 1.0 | 384 MB | json-file 10m x3 |
| crawler-redis | 512 MB | 0.5 | 192 MB | json-file 10m x3 |
| memory-redis | 384 MB | 0.5 | 128 MB | json-file 10m x3 |
| mcp-server | 256 MB | 0.5 | 96 MB | json-file 10m x3 |
| platform-frontend | 256 MB | 0.5 | 96 MB | json-file 10m x3 |
| nginx | 128 MB | 0.5 | 48 MB | json-file 10m x3 |

**Total allocation**: ~5.8 GB memory, 6.5 CPUs

---

## 6. Security Posture

| Check | Status |
|-------|--------|
| BIND_ADDRESS not 0.0.0.0 | PASS — enforced by validation script |
| TLS enabled | PASS — TLS 1.2/1.3 with HSTS |
| Security headers | PASS — CSP, X-Frame-Options, nosniff, XSS |
| Rate limiting | PASS — 20-120 req/s per zone |
| Tailscale-only SSH | PASS — public IP firewalled |
| Secrets in .env (not code) | PASS |
| Container resource limits | PASS — all services capped |
| Log rotation | PASS — 10 MB x 3 files per service |
| No public port binding | PASS — Nginx only via BIND_ADDRESS |

---

## 7. Git Status

```
Branch: main
Ahead:  2 commits (not pushed)
Tag:    v1.1.0 (local)
Modified: 161 files
Deleted:  15 files (old changelogs)
Untracked: 81+ files (AGENTS.md, reports, brand assets)
```

**Recent Commits:**
```
4a724f9 docs(automation): create comprehensive engram-automation-scripts skill
c666e69 docs(platform): generate 19 AGENTS.md files for AI agent guidance
8289085 fix(platform): resolve all biome and TypeScript errors
b6096f9 test(platform): comprehensive test coverage
87503ef fix(mcp,memory): add list_memories pagination and scoped cache invalidation
```

---

## 8. Recommended Next Steps

1. **Fix Platform Frontend** — Add Clerk keys to devnode deployment:
   ```bash
   ssh root@100.78.187.5
   cd /opt/engram/Engram-Platform
   # Add CLERK keys to .env, then:
   docker compose restart platform-frontend
   ```

2. **Deploy to Production** — Engram is not on dv-syd-host01 yet:
   ```bash
   ./scripts/deploy-unified.sh init   # on production server
   ```

3. **Push to Origin** — 2 commits + v1.1.0 tag waiting:
   ```bash
   git push origin main --tags
   ```

4. **Clean Working Tree** — Stage/commit the 161 modified + 81 untracked files or stash.

5. **Upgrade Local Python** — macOS has 3.9.6; AiMemory needs 3.11+:
   ```bash
   brew install python@3.12
   ```

---

*Report generated 2026-03-28 by 3 parallel sonnet agents (infra-checker, credentials-auditor, setup-guide-builder)*
*Detailed credentials audit: AUDIT_ACCESS_CREDENTIALS_2026-03-28.md*
