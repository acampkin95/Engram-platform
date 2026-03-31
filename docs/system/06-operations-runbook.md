# 06 — Operations Runbook

> Day-to-day operations, monitoring, incident response, and performance tuning for the Engram Platform.
> Production host: acdev-devnode (100.78.187.5)
> Last updated: 2026-03-31

---

## Table of Contents

1. [Daily Operations Checklist](#daily-operations-checklist)
2. [Monitoring](#monitoring)
3. [Log Locations](#log-locations)
4. [Health Check Endpoints](#health-check-endpoints)
5. [Alert Conditions and Thresholds](#alert-conditions-and-thresholds)
6. [Capacity Planning](#capacity-planning)
7. [Pipeline Validation](#pipeline-validation)
8. [Maintenance Operations](#maintenance-operations)
9. [Incident Response](#incident-response)
10. [Performance Tuning](#performance-tuning)

---

## Daily Operations Checklist

Run from acdev-devnode (`ssh user@100.78.187.5`), working directory `/opt/engram/Engram-Platform`.

### 1. Verify All Containers Are Running

```bash
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"
```

All 8 containers should show `Up` and `healthy`. If any container shows `Restarting` or `unhealthy`, investigate immediately.

### 2. Check Disk Usage

```bash
df -h / /var/lib/docker
```

Action required if `/var/lib/docker` exceeds 80%.

### 3. Check Memory and CPU

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

Flag any container exceeding 90% of its memory limit.

### 4. Review Error Logs (Last 24 Hours)

```bash
docker logs --since 24h engram-memory-api 2>&1 | grep -ci error
docker logs --since 24h engram-crawler-api 2>&1 | grep -ci error
docker logs --since 24h engram-nginx 2>&1 | grep -c " 5[0-9][0-9] "
```

### 5. Check Redis Memory

```bash
docker compose exec -T memory-redis redis-cli info memory | grep used_memory_human
docker compose exec -T crawler-redis redis-cli info memory | grep used_memory_human
```

### 6. Check Audit Log Summary

```bash
curl -s http://100.78.187.5:8000/admin/audit-log/summary?hours=24 \
  -H "X-API-Key: YOUR_KEY" | python3 -m json.tool
```

Review `error_rate` and `top_endpoints` for anomalies.

---

## Monitoring

### What to Watch

| Metric | Source | Check Command | Warning | Critical |
|---|---|---|---|---|
| Container health | Docker | `docker compose ps` | Any `unhealthy` | Any `Restarting` |
| Disk usage | Host | `df -h /var/lib/docker` | >70% | >85% |
| Memory API memory | Docker | `docker stats engram-memory-api` | >600 MB | >700 MB (limit: 768 MB) |
| Weaviate memory | Docker | `docker stats engram-weaviate` | >1200 MB | >1400 MB (limit: 1536 MB) |
| Memory Redis used | Redis | `redis-cli info memory` | >200 MB | >240 MB (max: 256 MB) |
| Crawler Redis used | Redis | `redis-cli info memory` | >300 MB | >360 MB (max: 384 MB) |
| Weaviate object count | Weaviate API | See below | >500K objects | >1M objects |
| API error rate | Audit log | `/admin/audit-log/summary` | >5% | >15% |
| Nginx 5xx rate | Nginx logs | `grep " 5[0-9][0-9] "` | >10/hour | >50/hour |
| Container restarts | Docker | `docker inspect --format` | >2/day | >5/day |

### Weaviate Object Count

```bash
docker compose exec -T weaviate wget -q -O- http://localhost:8080/v1/meta | python3 -m json.tool
```

Or check per-collection counts:

```bash
curl -s http://100.78.187.5:8000/stats \
  -H "X-API-Key: YOUR_KEY" | python3 -m json.tool
```

The response includes `total_memories`, `tier_counts`, and per-tier breakdowns.

### Redis Key Count

```bash
docker compose exec -T memory-redis redis-cli dbsize
docker compose exec -T crawler-redis redis-cli dbsize
```

### Audit Stream Size

```bash
docker compose exec -T memory-redis redis-cli xlen engram:audit_log
```

The stream is capped at approximately 10,000 entries.

### API Key Usage

```bash
curl -s http://100.78.187.5:8000/admin/keys \
  -H "X-API-Key: YOUR_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for k in data['keys']:
    print(f\"{k['id']:24s} {k['name']:30s} reqs={k['request_count']:>6d} last={k.get('last_used_at','never'):>25s} status={k['status']}\")
"
```

---

## Log Locations

| Container | Log Access | Notes |
|---|---|---|
| `engram-memory-api` | `docker logs engram-memory-api` | JSON structured logs, Python uvicorn |
| `engram-crawler-api` | `docker logs engram-crawler-api` | Supervisor manages multiple processes |
| `engram-weaviate` | `docker logs engram-weaviate` | Go structured logs |
| `engram-memory-redis` | `docker logs engram-memory-redis` | Minimal output |
| `engram-crawler-redis` | `docker logs engram-crawler-redis` | Minimal output |
| `engram-mcp-server` | `docker logs engram-mcp-server` | TypeScript/Node logs |
| `engram-platform-frontend` | `docker logs engram-platform-frontend` | Next.js server logs |
| `engram-nginx` | `docker logs engram-nginx` | Access + error logs combined |

### Crawler Internal Logs

The crawler runs multiple processes under supervisord. Access internal process logs:

```bash
docker compose exec crawler-api ls /var/log/supervisor/
docker compose exec crawler-api tail -50 /var/log/supervisor/uvicorn-stdout.log
docker compose exec crawler-api tail -50 /var/log/supervisor/uvicorn-stderr.log
```

### Log Storage

All containers use `json-file` driver with 10 MB max size and 3 file rotation. Maximum 30 MB per container, 240 MB total across all 8 containers.

Log files are stored at `/var/lib/docker/containers/<container-id>/<container-id>-json.log` on the host.

---

## Health Check Endpoints

| Service | Endpoint | Method | Expected Response |
|---|---|---|---|
| Memory API | `http://100.78.187.5:8000/health` | GET | JSON with `status: healthy`, services object |
| Crawler API | `http://crawler-api:11235/` (internal) | GET | 200 OK |
| MCP Server | `http://mcp-server:3000/health` (internal) | GET | 200 OK |
| Platform Frontend | `http://platform-frontend:3000/` (internal) | GET | Status < 500 |
| Weaviate | `http://weaviate:8080/v1/.well-known/ready` (internal) | GET | 200 OK |
| Memory Redis | `redis-cli ping` | CLI | `PONG` |
| Crawler Redis | `redis-cli ping` | CLI | `PONG` |
| Nginx | `http://127.0.0.1:80/health` | GET | `healthy` (plaintext) |

External (via nginx):

| Path | Backend |
|---|---|
| `https://memory.velocitydigi.com/health` | Nginx (direct response) |
| `https://memory.velocitydigi.com/api/memory/health` | Memory API |
| `https://memory.velocitydigi.com/api/crawler/` | Crawler API |
| `https://memory.velocitydigi.com/mcp/health` | MCP Server |

### Docker Health Check Configuration

All containers have built-in health checks with these defaults:
- Interval: 30 seconds
- Timeout: 10 seconds
- Retries: 3-5 (varies by service)
- Start period: 60 seconds (crawler only, due to Chromium startup)

---

## Alert Conditions and Thresholds

### Critical (Immediate Response Required)

| Condition | Detection | Action |
|---|---|---|
| Container in `Restarting` loop | `docker compose ps` | Check logs: `docker logs --tail 50 <name>` |
| Weaviate unhealthy | Health check fails | Check memory: may need to increase `GOMEMLIMIT` |
| Redis OOM | `redis-cli info memory` shows used >= max | Eviction policy is `allkeys-lru`; review key count |
| Disk >90% | `df -h` | Prune Docker: `docker system prune -f` |
| Memory API returning 503 | `/health` shows degraded | Restart: `docker compose restart memory-api` |
| SSL certificate expired | `openssl s_client` shows past notAfter | Replace cert and reload nginx |

### Warning (Investigate Within 24 Hours)

| Condition | Detection | Action |
|---|---|---|
| Container restart count >2/day | `docker inspect` | Review logs for crash patterns |
| API error rate >5% | Audit log summary | Check top error endpoints |
| Memory Redis >80% capacity | `redis-cli info memory` | Review TTLs, run cleanup |
| Disk >70% | `df -h` | Plan cleanup or expand storage |
| Weaviate >500K objects | `/stats` endpoint | Review retention policies |

### Informational

| Condition | Detection | Notes |
|---|---|---|
| Audit log at capacity | `xlen engram:audit_log` near 10,000 | Normal; old entries are trimmed automatically |
| Crawler data tier rotation | Watchdog logs | Automatic; verify data moves to warm/cold correctly |
| Maintenance scheduler running | Memory API startup logs | Background decay/consolidation; no action needed |

---

## Capacity Planning

### Weaviate Vector Storage

Each memory object consumes approximately:
- 768-dimensional embedding (float32): ~3 KB
- Metadata and content: ~1-5 KB average
- Total per object: ~4-8 KB

| Object Count | Estimated Storage | RAM Usage |
|---|---|---|
| 10,000 | ~80 MB | ~200 MB |
| 100,000 | ~800 MB | ~600 MB |
| 500,000 | ~4 GB | ~1.2 GB |
| 1,000,000 | ~8 GB | ~2 GB (exceeds current limit) |

Current Weaviate memory limit is 1536 MB. Plan to increase before reaching 500K objects.

### Redis Memory

Memory Redis (256 MB max) stores:
- API key metadata (~1 KB per key)
- Embedding cache entries
- Audit log stream (capped at ~10K entries, ~5-10 MB)
- Cache entries (SWR patterns)

At current usage patterns, 256 MB is sufficient for approximately 50K cached embeddings.

### Disk Growth

| Volume | Growth Rate (Estimate) | Notes |
|---|---|---|
| `weaviate_data` | ~100 MB/month (light use) | Scales with memory count |
| `memory_redis_data` | Minimal (RDB snapshots) | ~50-100 MB |
| `crawler_redis_data` | Minimal | ~50-100 MB |
| `crawler_chroma_data` | ~200 MB/month (active crawling) | ChromaDB vector storage |
| `crawler_hot/warm/cold` | Self-managing (watchdog) | Data lifecycle auto-tiered |
| Docker logs | Capped at 240 MB total | Via log rotation config |

---

## Pipeline Validation

### End-to-End Memory Pipeline Test

Verify the full write-read-search pipeline:

```bash
API_KEY="YOUR_KEY"
API="http://100.78.187.5:8000"

# 1. Write a test memory
echo "--- Adding test memory ---"
MEM_ID=$(curl -s -X POST "$API/memories" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Pipeline test memory created at '"$(date -Iseconds)"'",
    "tier": 1,
    "memory_type": "fact",
    "tags": ["test", "pipeline-validation"],
    "importance": 0.5
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['memory_id'])")
echo "Created memory: $MEM_ID"

# 2. Read it back
echo "--- Reading memory ---"
curl -s "$API/memories/$MEM_ID?tier=1" \
  -H "X-API-Key: $API_KEY" | python3 -m json.tool

# 3. Search for it
echo "--- Searching ---"
curl -s -X POST "$API/search" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "pipeline test memory", "tier": 1, "limit": 3}' | python3 -m json.tool

# 4. Clean up
echo "--- Deleting test memory ---"
curl -s -X DELETE "$API/memories/$MEM_ID?tier=1" \
  -H "X-API-Key: $API_KEY" | python3 -m json.tool

echo "Pipeline validation complete."
```

### Crawler Pipeline Test

```bash
curl -s -X POST https://memory.velocitydigi.com/api/crawler/crawl \
  -H "Content-Type: application/json" \
  -k \
  -d '{"urls": ["https://example.com"], "priority": 1}' | python3 -m json.tool
```

### MCP Server Test

```bash
docker compose exec -T mcp-server curl -sf http://localhost:3000/health | python3 -m json.tool
```

---

## Maintenance Operations

### Memory Decay

The maintenance scheduler runs automatically in the memory API process. It applies importance decay to memories that have not been accessed within the configured half-life (default: 30 days).

To check if the scheduler is running:

```bash
docker logs engram-memory-api 2>&1 | grep -i "maintenance scheduler"
```

### Memory Consolidation

Trigger consolidation manually via the API. This merges semantically similar memories to reduce redundancy:

```bash
curl -s -X POST http://100.78.187.5:8000/maintenance/consolidate \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "my-project"}' | python3 -m json.tool
```

### Expired Memory Cleanup

Remove memories that have passed their expiration date:

```bash
curl -s -X POST http://100.78.187.5:8000/maintenance/cleanup \
  -H "X-API-Key: YOUR_KEY" | python3 -m json.tool
```

### Confidence Maintenance

Run contradiction detection and confidence scoring:

```bash
curl -s -X POST http://100.78.187.5:8000/maintenance/confidence \
  -H "X-API-Key: YOUR_KEY" | python3 -m json.tool
```

### Safe Execution Guidelines

- Run maintenance during low-traffic periods.
- Consolidation requires an LLM (Ollama or DeepInfra). Verify the LLM endpoint is reachable before triggering.
- Cleanup and decay are safe to run at any time; they do not require external LLM access.
- Monitor memory API logs during maintenance for errors:
  ```bash
  docker logs -f engram-memory-api 2>&1 | grep -i "maintenance\|consolidat\|decay\|cleanup"
  ```

---

## Incident Response

### Service Down: Memory API

**Symptoms**: `/health` returns 503 or connection refused. Frontend shows "Service unavailable".

**Steps**:
1. Check container status:
   ```bash
   docker compose ps memory-api
   ```
2. Check logs for the root cause:
   ```bash
   docker logs --tail 100 engram-memory-api
   ```
3. Common causes:
   - **Weaviate unreachable**: Check `docker compose ps weaviate`. Restart Weaviate if needed.
   - **Redis unreachable**: Check `docker compose ps memory-redis`. Restart Redis.
   - **OOM killed**: Check `docker inspect engram-memory-api --format '{{.State.OOMKilled}}'`. If true, increase memory limit in `docker-compose.yml`.
4. Restart the service:
   ```bash
   docker compose restart memory-api
   ```
5. Verify recovery:
   ```bash
   curl -s http://100.78.187.5:8000/health | python3 -m json.tool
   ```

### Service Down: Weaviate

**Symptoms**: Memory API health shows `weaviate: disconnected`. All memory operations fail.

**Steps**:
1. Check Weaviate logs:
   ```bash
   docker logs --tail 100 engram-weaviate
   ```
2. Common causes:
   - **OOM**: Weaviate exceeds GOMEMLIMIT. Increase `GOMEMLIMIT` in docker-compose.yml or increase the container memory limit.
   - **Corrupt data**: Weaviate fails to start with data errors. Restore from backup.
   - **Schema migration**: If `CLEAN_SCHEMA_MIGRATION=true` was set accidentally, all data is deleted on startup.
3. Restart:
   ```bash
   docker compose restart weaviate
   # Wait for health check to pass (~30s)
   docker compose restart memory-api
   ```

### Service Down: Nginx

**Symptoms**: No external access to any service. `curl https://memory.velocitydigi.com` fails.

**Steps**:
1. Check nginx is running:
   ```bash
   docker compose ps nginx
   ```
2. Check nginx configuration:
   ```bash
   docker compose exec nginx nginx -t
   ```
3. Check logs:
   ```bash
   docker logs --tail 50 engram-nginx
   ```
4. If config is valid, reload:
   ```bash
   docker compose exec nginx nginx -s reload
   ```
5. If config is broken, fix `nginx/nginx.conf` and restart:
   ```bash
   docker compose restart nginx
   ```

### Data Corruption: Embedding Mismatch

**Symptoms**: Search returns irrelevant results. Memories exist but search cannot find them.

**Diagnosis**:
1. Check the embedding provider is consistent:
   ```bash
   docker compose exec -T memory-api env | grep EMBEDDING
   ```
2. If `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, or `EMBEDDING_DIMENSIONS` changed since data was written, existing embeddings are incompatible with new queries.

**Resolution**:
- **Option A**: Revert to the original embedding configuration.
- **Option B**: Re-embed all memories. This requires deleting and re-creating all Weaviate collections (data loss for vector indexes, metadata preserved in Redis if backed up).
- **Prevention**: Never change embedding configuration on a populated database without a migration plan.

### Data Corruption: Redis Data Loss

**Symptoms**: API keys stop working. Audit log is empty. Cache misses spike.

**Steps**:
1. Check Redis health:
   ```bash
   docker compose exec -T memory-redis redis-cli ping
   docker compose exec -T memory-redis redis-cli dbsize
   ```
2. If Redis lost data (dbsize returns 0 or very low), restore from backup:
   ```bash
   docker compose stop memory-redis
   docker compose cp ./backups/latest/memory-redis.rdb memory-redis:/data/dump.rdb
   docker compose start memory-redis
   docker compose restart memory-api
   ```
3. If no backup exists, API keys from the `API_KEYS` env var will be re-migrated on next memory-api restart. Dynamically created keys will be lost.

### High Latency

**Symptoms**: API responses >1 second. Frontend loads slowly.

**Steps**:
1. Check container resource usage:
   ```bash
   docker stats --no-stream
   ```
2. Check Weaviate specifically:
   ```bash
   docker logs --since 5m engram-weaviate 2>&1 | grep -i "slow\|timeout\|GC"
   ```
3. Check Redis latency:
   ```bash
   docker compose exec -T memory-redis redis-cli --latency-history -i 5
   ```
4. If Weaviate is slow, it may be under memory pressure. Check `GOMEMLIMIT` vs actual usage.
5. If Redis is slow, check if it's swapping:
   ```bash
   docker compose exec -T memory-redis redis-cli info memory | grep used_memory_rss
   ```

---

## Performance Tuning

### Embedding Cache

The Memory API caches embeddings in Redis to avoid redundant calls to the embedding provider. Cache behavior is controlled by the Redis `maxmemory-policy`:

- Memory Redis: `allkeys-lru` -- least recently used embeddings are evicted first.
- To increase cache hit rate, increase `maxmemory` in docker-compose.yml:
  ```yaml
  command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
  ```

Monitor cache effectiveness:

```bash
docker compose exec -T memory-redis redis-cli info stats | grep keyspace
```

### Nginx SSR Cache

The nginx proxy caches SSR responses from the Next.js frontend:

```
proxy_cache_path /var/cache/nginx/ssr levels=1:2 keys_zone=ssr_cache:50m max_size=500m inactive=60m
```

- Cache is bypassed for authenticated requests (Cookie or Authorization header present).
- Valid responses are cached for 1 minute.
- Maximum cache size: 500 MB (stored in tmpfs, so it uses RAM).

Check cache hit rate:

```bash
docker logs engram-nginx 2>&1 | grep -o 'X-Cache-Status: [A-Z]*' | sort | uniq -c | sort -rn
```

To increase cache effectiveness for public pages, extend `proxy_cache_valid`:

```nginx
proxy_cache_valid 200 5m;  # Cache for 5 minutes instead of 1
```

### Weaviate Tuning

Current settings in docker-compose.yml:

```yaml
GOMEMLIMIT: "1200MiB"
GOMAXPROCS: "2"
CACHE_SIZE: "384MB"
CACHE_TTL: "3600"
GRPC_MAX_CONCURRENT_STREAMS: "100"
```

If search latency increases with data volume:
- Increase `GOMEMLIMIT` proportionally with data size.
- Increase `CACHE_SIZE` to keep more vectors in memory.
- Increase the container memory limit accordingly.

### Memory API Uvicorn Workers

The Memory API runs 2 uvicorn workers (`UVICORN_WORKERS=2`). On a host with more CPU cores, increase to match available cores (up to 4 for this workload):

```yaml
UVICORN_WORKERS: "4"
UVICORN_LIMIT_CONN: "200"
```

Update the container CPU limit accordingly.

### Nginx Keepalive Connections

Upstream keepalive connections are configured per backend:

| Upstream | Keepalive |
|---|---|
| `platform_frontend` | 64 |
| `crawler_api` | 32 |
| `memory_api` | 32 |
| `mcp_server` | 16 |

If connection churn is observed (many TIME_WAIT sockets), increase keepalive values.

### Docker Shared Memory (Crawler)

The crawler container uses `shm_size: 2g` for Chromium's shared memory. If crawl jobs fail with "out of memory" errors in the browser, increase this value.
