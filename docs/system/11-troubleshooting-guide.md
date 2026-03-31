# 11 — Troubleshooting Guide

> Engram Platform v1.1.0 — Known issues, diagnostics, and resolution procedures.
> Last updated: 2026-03-31

---

## Table of Contents

1. [Weaviate Vector Dimension Mismatch](#1-weaviate-vector-dimension-mismatch)
2. [Memory API Not Starting](#2-memory-api-not-starting)
3. [Embedding API 401 Unauthorized](#3-embedding-api-401-unauthorized)
4. [decay_factor Validation Error](#4-decay_factor-validation-error)
5. [SonarQube Scan Failures](#5-sonarqube-scan-failures)
6. [Frontend Build Type Errors on Devnode](#6-frontend-build-type-errors-on-devnode)
7. [MCP Server Unauthorized](#7-mcp-server-unauthorized)
8. [Redis Connection Refused](#8-redis-connection-refused)
9. [Docker Compose "dq" Variable Warning](#9-docker-compose-dq-variable-warning)
10. [Platform 307 Redirect on Unauthenticated Request](#10-platform-307-redirect-on-unauthenticated-request)
11. [Stale Embedding Cache Causing Wrong Vectors](#11-stale-embedding-cache-causing-wrong-vectors)
12. [Crawler API Unhealthy or Restarting](#12-crawler-api-unhealthy-or-restarting)
13. [Nginx 502 Bad Gateway](#13-nginx-502-bad-gateway)
14. [General Diagnostic Commands](#14-general-diagnostic-commands)

---

## 1. Weaviate Vector Dimension Mismatch

### Symptoms

- Memory API returns HTTP 500 on `/memories/search` or `/memories` POST endpoints
- Weaviate logs show errors like: `vector has X dimensions, but the schema expects Y`
- Common dimension mismatches: 4096 vs 768, 1024 vs 1536, 768 vs 1024

### Root Cause

The embedding model produces vectors of a dimension that does not match what Weaviate's schema expects. This happens when:

1. `EMBEDDING_DIMENSIONS` in `.env` does not match the actual model output
2. The embedding model was changed but Weaviate schema was not recreated
3. Stale cached embeddings from a previous model remain in Redis

### Diagnostic Commands

```bash
# Check current embedding config
docker exec engram-memory-api env | rg 'EMBEDDING'

# Check Weaviate schema to see configured dimensions
curl -s http://localhost:8080/v1/schema | python3 -m json.tool | rg -A2 'vectorIndexConfig'

# Check Memory API logs for dimension errors
docker compose logs memory-api --tail 100 | rg -i 'dimension'
```

### Fix

**If no data exists yet (fresh deployment):**

```bash
# 1. Fix EMBEDDING_DIMENSIONS in .env to match your model
# 2. Delete Weaviate data and restart
docker compose down
docker volume rm engram-platform_weaviate_data
docker compose up -d
```

**If data exists and must be preserved:**

```bash
# 1. Export existing memories via the API
curl -s http://localhost:8000/memories/export > memories_backup.json

# 2. Fix EMBEDDING_DIMENSIONS in .env
# 3. Wipe Weaviate, restart, re-import
docker compose down
docker volume rm engram-platform_weaviate_data
docker compose up -d
# 4. Re-import data (memories will be re-embedded with the new model)
```

**Clear the Redis embedding cache:**

```bash
docker exec engram-memory-redis redis-cli KEYS 'emb:*' | xargs -I{} docker exec engram-memory-redis redis-cli DEL {}
```

### Correct dimension values

| Provider/Model | Dimensions |
|----------------|-----------|
| `BAAI/bge-en-icl` (DeepInfra) | 1024 |
| `BAAI/bge-m3` (DeepInfra) | 1024 |
| `text-embedding-3-small` (OpenAI) | 1536 |
| `text-embedding-3-large` (OpenAI) | 3072 |
| `nomic-embed-text` (Ollama/Nomic) | 768 |

---

## 2. Memory API Not Starting

### Symptoms

- `engram-memory-api` container exits immediately or enters restart loop
- `docker compose ps` shows `Restarting` or `Exit 1`
- Other services dependent on memory-api (crawler-api, mcp-server) also fail to start

### Root Cause

Common causes include:

1. **Invalid Python dependency or import error** — missing module after image rebuild
2. **Invalid `Depends()` kwargs** — FastAPI dependency injection misconfiguration
3. **Weaviate not ready** — memory-api starts before Weaviate is healthy
4. **Invalid environment variables** — bad `JWT_SECRET`, missing required vars

### Diagnostic Commands

```bash
# Check exit code and status
docker compose ps memory-api

# Read the full startup log
docker compose logs memory-api --tail 200

# Check if Weaviate is healthy (memory-api depends on it)
docker inspect engram-weaviate --format='{{.State.Health.Status}}'

# Check environment variables are set
docker exec engram-memory-api env | rg 'JWT_SECRET|WEAVIATE|REDIS|EMBEDDING'
```

### Fix

**For import/module errors:**

```bash
# Rebuild the image from scratch
docker compose build --no-cache memory-api
docker compose up -d memory-api
```

**For Weaviate dependency timing:**

```bash
# Restart just memory-api (Weaviate should be healthy by now)
docker compose restart memory-api

# If Weaviate itself is unhealthy
docker compose restart weaviate
# Wait 30-60 seconds, then
docker compose restart memory-api
```

**For environment variable issues:**

```bash
# Verify .env has all required vars
rg '^JWT_SECRET=.+' Engram-Platform/.env
rg '^EMBEDDING_PROVIDER=.+' Engram-Platform/.env

# Ensure JWT_SECRET is at least 32 characters
```

---

## 3. Embedding API 401 Unauthorized

### Symptoms

- Memory API logs show: `401 Unauthorized` or `403 Forbidden` when calling the embedding provider
- Memory creation and search both fail
- Error in logs referencing DeepInfra, OpenAI, or the configured embedding provider

### Root Cause

The API key for the embedding provider is missing, truncated, or expired. Common scenario: `.env` file has the key truncated due to copy-paste error or shell escaping.

### Diagnostic Commands

```bash
# Check the key length (should be > 20 chars typically)
docker exec engram-memory-api env | rg 'DEEPINFRA_API_KEY|OPENAI_API_KEY' | awk -F= '{print $1"=["length($2)" chars]"}'

# Test the key directly
curl -s https://api.deepinfra.com/v1/inference/BAAI/bge-en-icl \
  -H "Authorization: Bearer $(rg '^DEEPINFRA_API_KEY=' Engram-Platform/.env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"inputs": ["test"]}'
```

### Fix

1. Verify the full API key in your `.env` file — ensure no trailing whitespace or line breaks
2. Re-copy the key from the provider dashboard (DeepInfra: https://deepinfra.com/dash/api_keys)
3. Restart memory-api:

```bash
docker compose restart memory-api
```

**Tip**: If your API key contains special characters, wrap the value in single quotes in `.env`:

```env
DEEPINFRA_API_KEY='your-key-with-special-chars'
```

---

## 4. decay_factor Validation Error

### Symptoms

- Memory API returns a Pydantic validation error on memory operations
- Error message: `ensure this value is less than or equal to 1.0` (or similar) referencing `decay_factor`
- Triggered during memory access boost operations

### Root Cause

The memory decay system applies an access boost that can push the `decay_factor` above the validation maximum of 1.0. This is a boundary condition in the decay logic.

### Diagnostic Commands

```bash
docker compose logs memory-api --tail 100 | rg -i 'decay_factor\|validation'
```

### Fix

The validation bound was raised to `le=2.0` in the codebase to accommodate access boosts. If you encounter this on an older version:

1. Update to the latest codebase
2. Rebuild the memory-api image:

```bash
docker compose build memory-api
docker compose up -d memory-api
```

---

## 5. SonarQube Scan Failures

### Symptoms

- `sonar-scanner` CLI fails with authentication errors
- Error: `Not authorized` or `401` when pushing results
- Scan runs but quality gate fails to evaluate

### Root Cause

SonarQube v2 API requires token-based authentication. Username/password authentication is no longer accepted on newer versions. The token must be passed via the `SONAR_TOKEN` environment variable.

### Diagnostic Commands

```bash
# Verify the scanner can reach SonarQube
curl -s http://100.114.241.115:9000/api/system/status

# Check if token is set
echo $SONAR_TOKEN | wc -c   # Should be > 1
```

### Fix

```bash
# 1. Generate a token in SonarQube UI:
#    Administration > Security > Users > Tokens > Generate

# 2. Export the token before running the scan
export SONAR_TOKEN="squ_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 3. Run the scan
sonar-scanner \
  -Dsonar.host.url=http://100.114.241.115:9000 \
  -Dsonar.token="${SONAR_TOKEN}"
```

The project uses `sonar-project.properties` in the monorepo root for configuration.

---

## 6. Frontend Build Type Errors on Devnode

### Symptoms

- `docker compose build platform-frontend` fails with TypeScript compilation errors
- Errors reference files that were recently modified locally but not deployed
- Stale `system-client.ts` or other generated files on the devnode

### Root Cause

The devnode has an outdated copy of source files. When the Docker build runs on the devnode, it picks up stale files that have type errors compared to the current state of other files.

### Diagnostic Commands

```bash
# SSH to devnode and check file modification dates
ssh root@100.78.187.5 'ls -la /opt/engram/Engram-Platform/frontend/app/'

# Compare a specific file
ssh root@100.78.187.5 'md5sum /opt/engram/Engram-Platform/frontend/src/lib/system-client.ts'
md5sum Engram-Platform/frontend/src/lib/system-client.ts
```

### Fix

Upload the updated files via SFTP before building:

```bash
# From your local machine
sftp root@100.78.187.5 <<'EOF'
put -r Engram-Platform/frontend/src /opt/engram/Engram-Platform/frontend/src
put -r Engram-Platform/frontend/app /opt/engram/Engram-Platform/frontend/app
EOF

# Then rebuild on devnode
ssh root@100.78.187.5 'cd /opt/engram/Engram-Platform && docker compose build platform-frontend && docker compose up -d platform-frontend'
```

Or use the unified deploy script:

```bash
./scripts/deploy-unified.sh deploy:devnode
```

---

## 7. MCP Server Unauthorized

### Symptoms

- Claude Code or Claude Desktop reports "Unauthorized" when connecting to the Engram MCP server
- MCP server logs show `401` responses
- MCP tools are not available in the AI client

### Root Cause

1. `ENGRAM_API_KEY` or `AI_MEMORY_API_KEY` not set in the MCP server environment
2. `MCP_AUTH_TOKEN` not matching between the client config and the server
3. MCP server `dist/` directory is stale after code changes — TypeScript was not recompiled

### Diagnostic Commands

```bash
# Check MCP server env vars
docker exec engram-mcp-server env | rg 'API_KEY\|AUTH_TOKEN'

# Test MCP health endpoint
curl -s http://localhost:3000/health

# Test with auth
curl -s http://localhost:3000/health -H "Authorization: Bearer YOUR_TOKEN"

# Check MCP server logs
docker compose logs mcp-server --tail 50
```

### Fix

**For Docker deployment:**

```bash
# 1. Ensure .env has matching tokens
rg 'MCP_AUTH_TOKEN\|MEMORY_API_KEY' Engram-Platform/.env

# 2. Rebuild and restart
docker compose build mcp-server
docker compose up -d mcp-server
```

**For stdio transport (local Claude Code):**

```bash
# 1. Rebuild the TypeScript
cd Engram-MCP
npm run build

# 2. Verify dist/ exists and is current
ls -la dist/index.js

# 3. Restart Claude Code to pick up the new MCP server
```

Ensure your MCP client configuration has the correct `AI_MEMORY_API_KEY` matching one of the keys in `API_KEYS` on the Memory API.

---

## 8. Redis Connection Refused

### Symptoms

- Memory API or Crawler API logs show `ConnectionRefusedError` or `Error: connect ECONNREFUSED`
- Services that depend on Redis enter restart loops

### Root Cause

1. Redis container not started or still starting
2. Docker network issue — service cannot resolve the Redis hostname
3. Redis hit OOM and was killed

### Diagnostic Commands

```bash
# Check Redis container status
docker compose ps crawler-redis memory-redis

# Check Redis health
docker inspect engram-memory-redis --format='{{.State.Health.Status}}'
docker inspect engram-crawler-redis --format='{{.State.Health.Status}}'

# Check Redis memory usage
docker exec engram-memory-redis redis-cli INFO memory | rg 'used_memory_human\|maxmemory_human'

# Check for OOM kills
docker inspect engram-memory-redis --format='{{.State.OOMKilled}}'
```

### Fix

```bash
# If container is stopped, start it
docker compose up -d memory-redis crawler-redis

# Wait for health check to pass, then restart dependent services
sleep 10
docker compose restart memory-api

# If OOM killed, check what is consuming memory
docker exec engram-memory-redis redis-cli INFO keyspace
docker exec engram-memory-redis redis-cli DBSIZE

# Emergency: flush all data (destructive)
docker exec engram-memory-redis redis-cli FLUSHALL
```

---

## 9. Docker Compose "dq" Variable Warning

### Symptoms

- Docker Compose outputs a warning like: `WARN[0000] The "dq" variable is not set. Defaulting to a blank string.`
- Appears during `docker compose up` or `docker compose build`

### Root Cause

This is a harmless warning caused by shell escaping in the Compose file or in variable interpolation. The `dq` is an artifact of double-quote escaping in the YAML.

### Fix

No action required. This warning does not affect functionality. It can be suppressed by ensuring all variable interpolations in `docker-compose.yml` use the `${VAR:-default}` format without unescaped quotes.

---

## 10. Platform 307 Redirect on Unauthenticated Request

### Symptoms

- Accessing `https://memory.velocitydigi.com/dashboard` returns HTTP 307 redirect
- Browser redirects to `/sign-in`
- Curl shows `307 Temporary Redirect` with `Location: /sign-in`

### Root Cause

This is **expected behavior**. Clerk middleware intercepts unauthenticated requests to protected routes and redirects to the sign-in page. The `/dashboard` and all sub-routes require authentication.

### Verification

```bash
# This should return 307 (correct — auth required)
curl -sI https://memory.velocitydigi.com/dashboard | head -3

# This should return 200 (public route)
curl -sI https://memory.velocitydigi.com/ | head -3
curl -sI https://memory.velocitydigi.com/health | head -3
```

### Non-issue

If you see 307 on protected routes, the auth system is working correctly. If you see 307 on public routes (like `/` or `/sign-in`), check the Clerk middleware configuration in `middleware.ts`.

---

## 11. Stale Embedding Cache Causing Wrong Vectors

### Symptoms

- Search results are irrelevant or nonsensical
- Memory API returns results but they do not match the query semantically
- Issue appears after changing `EMBEDDING_PROVIDER` or `EMBEDDING_MODEL`

### Root Cause

Redis caches embedding vectors keyed by content hash. When the embedding model changes, the cached vectors are from the old model but are still served as if they match the new model's vector space.

### Diagnostic Commands

```bash
# Check how many embedding cache entries exist
docker exec engram-memory-redis redis-cli KEYS 'emb:*' | wc -l

# Check the current embedding config
docker exec engram-memory-api env | rg 'EMBEDDING_MODEL\|EMBEDDING_PROVIDER\|EMBEDDING_DIMENSIONS'
```

### Fix

Flush all embedding cache keys:

```bash
# Delete all cached embeddings
docker exec engram-memory-redis redis-cli --scan --pattern 'emb:*' | \
  xargs -L 100 docker exec -i engram-memory-redis redis-cli DEL

# Restart memory-api to ensure fresh state
docker compose restart memory-api
```

After flushing, the next search or memory operation will re-generate embeddings using the current model.

---

## 12. Crawler API Unhealthy or Restarting

### Symptoms

- `engram-crawler-api` shows `unhealthy` or is in a restart loop
- Other services that depend on it (nginx routing) return 502

### Root Cause

1. **Chromium browser not installed** — the Docker image needs a working Chromium installation for Crawl4AI
2. **Shared memory too small** — Chromium requires adequate `/dev/shm` (configured as `shm_size: 2g`)
3. **Memory limit exceeded** — the 2 GB limit may be insufficient for concurrent crawls
4. **Redis not available** — crawler depends on `crawler-redis` being healthy

### Diagnostic Commands

```bash
# Full logs
docker compose logs crawler-api --tail 200

# Check memory usage
docker stats engram-crawler-api --no-stream

# Check if Chromium is available inside container
docker exec engram-crawler-api which chromium-browser || echo "Chromium not found"

# Check shm
docker exec engram-crawler-api df -h /dev/shm
```

### Fix

```bash
# If shared memory issue:
# Verify docker-compose.yml has shm_size: 2g (it does by default)

# If memory limit issue — increase in docker-compose.yml:
# deploy.resources.limits.memory: 4G

# Rebuild if Chromium is missing
docker compose build --no-cache crawler-api
docker compose up -d crawler-api
```

---

## 13. Nginx 502 Bad Gateway

### Symptoms

- Browser shows `502 Bad Gateway` on any Engram URL
- Some routes work but others return 502

### Root Cause

The upstream service for that route is not running or not healthy. Nginx cannot connect to the backend.

### Diagnostic Commands

```bash
# Check which services are actually running
docker compose ps

# Check nginx error log
docker exec engram-nginx cat /var/log/nginx/error.log | tail -20

# Test upstream connectivity from inside nginx
docker exec engram-nginx wget -qO- http://memory-api:8000/health 2>&1
docker exec engram-nginx wget -qO- http://crawler-api:11235/ 2>&1
docker exec engram-nginx wget -qO- http://platform-frontend:3000/ 2>&1
```

### Fix

```bash
# Restart the failing upstream service
docker compose restart memory-api   # if /api/memory/ returns 502
docker compose restart crawler-api  # if /api/crawler/ returns 502
docker compose restart platform-frontend  # if / returns 502

# If all upstreams are down, restart everything
docker compose down && docker compose up -d

# Reload nginx config without restart
docker exec engram-nginx nginx -s reload
```

---

## 14. General Diagnostic Commands

### Quick Status Check

```bash
# All services at a glance
docker compose ps

# Resource usage
docker stats --no-stream

# Disk usage by Docker
docker system df

# Volume sizes
docker system df -v | rg 'engram'
```

### Log Inspection

```bash
# Follow all logs
docker compose logs -f

# Specific service, last 100 lines
docker compose logs memory-api --tail 100

# Filter for errors
docker compose logs memory-api 2>&1 | rg -i 'error\|exception\|traceback'
```

### Network Debugging

```bash
# Check Docker network
docker network inspect engram-platform_engram-platform-network

# DNS resolution inside a container
docker exec engram-memory-api python3 -c "import socket; print(socket.getaddrinfo('weaviate', 8080))"

# Test inter-service connectivity
docker exec engram-mcp-server wget -qO- http://memory-api:8000/health
```

### Data Inspection

```bash
# Weaviate schema
curl -s http://localhost:8080/v1/schema | python3 -m json.tool

# Weaviate object count
curl -s http://localhost:8080/v1/objects?limit=0 | python3 -c "import sys,json; print(json.load(sys.stdin).get('totalResults', 'N/A'))"

# Redis key count
docker exec engram-memory-redis redis-cli DBSIZE
docker exec engram-crawler-redis redis-cli DBSIZE

# Redis memory info
docker exec engram-memory-redis redis-cli INFO memory | rg 'used_memory_human'
```

### Emergency Procedures

```bash
# Hard restart all services
docker compose down && docker compose up -d

# Remove all containers and rebuild
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

# Nuclear option: wipe all data (DESTRUCTIVE)
docker compose down -v   # Removes all named volumes
docker compose up -d     # Fresh start
```
