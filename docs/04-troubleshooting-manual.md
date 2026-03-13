# Engram Platform Troubleshooting Manual

**Version:** 1.0.0
**Last Updated:** March 2026
**Classification:** Internal Operations Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Diagnostic Methodology](#diagnostic-methodology)
3. [Service Health Checks](#service-health-checks)
4. [Common Issues and Solutions](#common-issues-and-solutions)
5. [Database Troubleshooting](#database-troubleshooting)
6. [Network Troubleshooting](#network-troubleshooting)
7. [Container Troubleshooting](#container-troubleshooting)
8. [Performance Issues](#performance-issues)
9. [Authentication Issues](#authentication-issues)
10. [API Error Reference](#api-error-reference)
11. [Log Analysis](#log-analysis)
12. [Emergency Procedures](#emergency-procedures)

---

## Overview

This manual provides systematic guidance for diagnosing and resolving issues in the Engram Platform. It covers common problems, their root causes, and step-by-step solutions.

### Troubleshooting Philosophy

1. **Isolate**: Identify which component is affected
2. **Diagnose**: Determine the root cause
3. **Resolve**: Apply the appropriate fix
4. **Verify**: Confirm the issue is resolved
5. **Document**: Record the incident for future reference

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| Critical | System down, data loss risk | 15 minutes |
| High | Major functionality impaired | 1 hour |
| Medium | Partial functionality affected | 4 hours |
| Low | Minor issues, workarounds exist | 24 hours |

---

## Diagnostic Methodology

### Step 1: Verify the Problem

```bash
# Check if the issue is reproducible
# Document the exact error message or behavior
# Note the time the issue started
# Identify affected users/tenants
```

### Step 2: Check System Status

```bash
# Quick system health check
cd /opt/engram/Engram-Platform
docker compose ps

# Check recent logs
docker compose logs --tail=50

# Check resource usage
docker stats --no-stream
```

### Step 3: Isolate the Component

```
┌─────────────────┐
│  User Reports   │
│  "Not Working"  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Can access     │ YES │  Check          │
│  dashboard?     │────▶│  Backend APIs   │
└────────┬────────┘     └─────────────────┘
         │ NO
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Tailscale      │ YES │  Check          │
│  connected?     │────▶│  Nginx/Frontend │
└────────┬────────┘     └─────────────────┘
         │ NO
         ▼
┌─────────────────┐
│  Fix Network    │
│  Connectivity   │
└─────────────────┘
```

### Step 4: Check Dependencies

```bash
# Check Weaviate
curl -sf http://localhost:8080/v1/.well-known/ready || echo "Weaviate DOWN"

# Check Redis
docker compose exec memory-redis redis-cli ping || echo "Redis DOWN"

# Check Memory API
curl -sf http://localhost:8000/health || echo "Memory API DOWN"
```

---

## Service Health Checks

For standard release verification, run the smoke path in `plans/2026-03-11-release-checklist.md` first, then use the deeper checks in this manual if any endpoint fails.

### Memory API Health

```bash
# Basic health
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","weaviate":true,"redis":true,"initialized":true}

# Detailed health (requires auth)
curl -H "Authorization: Bearer $MEMORY_API_KEY" \
  http://localhost:8000/health/detailed
```

### Weaviate Health

```bash
# Readiness check
curl http://localhost:8080/v1/.well-known/ready

# Expected: empty 200 OK response

# Check schema
curl http://localhost:8080/v1/schema | jq '.'

# Check object counts
curl "http://localhost:8080/v1/objects?limit=0" | jq '.totalResults'
```

### Redis Health

```bash
# Ping test
docker compose exec memory-redis redis-cli ping
# Expected: PONG

# Check replication status
docker compose exec memory-redis redis-cli INFO replication

# Check memory usage
docker compose exec memory-redis redis-cli INFO memory | grep used_memory_human
```

### Crawler API Health

```bash
# Basic health
curl http://localhost:11235/

# Check Redis connection
docker compose exec crawler-redis redis-cli ping
```

### MCP Server Health

```bash
# HTTP transport health
curl http://localhost:3000/health

# stdio transport (manual test)
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  MCP_TRANSPORT=stdio node /opt/engram/Engram-MCP/dist/index.js
```

---

## Common Issues and Solutions

### Issue: Service Won't Start

**Symptoms:**
- Container exits immediately
- Health checks fail repeatedly
- "Connection refused" errors

**Diagnosis:**
```bash
# Check container logs
docker compose logs memory-api

# Check exit code
docker compose ps -a | grep memory-api

# Check for port conflicts
netstat -tlnp | grep 8000
```

**Solutions:**

1. **Port conflict:**
```bash
# Find process using port
lsof -i :8000
# Kill or reconfigure
```

2. **Missing dependencies:**
```bash
# Ensure Weaviate and Redis are healthy first
docker compose up -d weaviate memory-redis
sleep 30
docker compose up -d memory-api
```

3. **Configuration error:**
```bash
# Validate environment variables
docker compose config | grep -A5 memory-api

# Check for missing secrets
grep -E "^[A-Z_]+=$" .env
```

### Issue: Weaviate Connection Refused

**Symptoms:**
- "Connection refused to http://weaviate:8080"
- Memory API health shows weaviate: false

**Diagnosis:**
```bash
# Check if Weaviate is running
docker compose ps weaviate

# Check Weaviate logs
docker compose logs weaviate --tail=100

# Test connectivity from Memory API container
docker compose exec memory-api curl -sf http://weaviate:8080/v1/.well-known/ready
```

**Solutions:**

1. **Weaviate not started:**
```bash
docker compose up -d weaviate
```

2. **Network issue:**
```bash
# Recreate network
docker compose down
docker network rm engram-platform-network
docker compose up -d
```

3. **Weaviate crash:**
```bash
# Check for OOM
dmesg | grep -i "out of memory"

# Increase memory limit
# Edit docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 4G
```

### Issue: Redis Memory Full

**Symptoms:**
- "OOM command not allowed when used_memory > maxmemory"
- Writes failing

**Diagnosis:**
```bash
# Check memory usage
docker compose exec memory-redis redis-cli INFO memory

# Check maxmemory setting
docker compose exec memory-redis redis-cli CONFIG GET maxmemory
```

**Solutions:**

1. **Increase maxmemory:**
```bash
docker compose exec memory-redis redis-cli CONFIG SET maxmemory 1gb
# Update docker-compose.yml for persistence
```

2. **Clear cache:**
```bash
# Warning: This clears all cached data
docker compose exec memory-redis redis-cli FLUSHALL
```

3. **Adjust eviction policy:**
```bash
docker compose exec memory-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Issue: SSL Certificate Errors

**Symptoms:**
- "NET::ERR_CERT_AUTHORITY_INVALID"
- "certificate has expired"

**Diagnosis:**
```bash
# Check certificate expiry
certbot certificates

# Check nginx certificate config
docker compose exec nginx cat /etc/nginx/conf.d/default.conf | grep ssl_certificate
```

**Solutions:**

1. **Renew certificate:**
```bash
certbot renew
docker compose restart nginx
```

2. **Fix certificate path:**
```bash
# Ensure correct path in nginx config
ssl_certificate /etc/letsencrypt/live/velocitydigi.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/velocitydigi.com/privkey.pem;
```

### Issue: Memory Search Returns No Results

**Symptoms:**
- Search returns empty array
- "No memories found" despite data existing

**Diagnosis:**
```bash
# Check memory count
curl -H "Authorization: Bearer $MEMORY_API_KEY" \
  http://localhost:8000/stats | jq '.total_memories'

# Check Weaviate objects
curl "http://localhost:8080/v1/objects?class=MemoryTier1&limit=0" | jq '.totalResults'

# Test search directly
curl -X POST http://localhost:8000/memories/search \
  -H "Authorization: Bearer $MEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 10}'
```

**Solutions:**

1. **Wrong tenant/project filter:**
```bash
# Search without filters to verify data exists
curl -X POST http://localhost:8000/memories/search \
  -H "Authorization: Bearer $MEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 10}'
```

2. **Embedding provider issue:**
```bash
# Check OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test embedding generation
curl https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "test", "model": "text-embedding-3-small"}'
```

### Issue: Crawler Timeout

**Symptoms:**
- "Page timeout exceeded"
- Crawler hangs indefinitely

**Diagnosis:**
```bash
# Check crawler logs
docker compose logs crawler-api --tail=100 | grep -i timeout

# Check browser process
docker compose exec crawler-api ps aux | grep chromium
```

**Solutions:**

1. **Increase timeout:**
```yaml
# docker-compose.yml
crawler-api:
  environment:
    PAGE_TIMEOUT: "120000"  # 2 minutes
```

2. **Check target site:**
```bash
# Test manually
curl -I https://target-site.com
# Check if site is blocking automated requests
```

3. **Restart crawler:**
```bash
docker compose restart crawler-api
```

---

## Database Troubleshooting

### Weaviate Issues

#### Schema Corruption

**Symptoms:**
- "class not found" errors
- Inconsistent query results

**Diagnosis:**
```bash
# Export current schema
curl http://localhost:8080/v1/schema > schema-backup.json

# Check for inconsistencies
cat schema-backup.json | jq '.classes[].class'
```

**Solution:**
```bash
# WARNING: Destructive - backup first
# Delete and recreate schema
curl -X DELETE http://localhost:8080/v1/schema/MemoryTier1

# Recreate via Memory API
curl -X POST http://localhost:8000/tenants \
  -H "Authorization: Bearer $MEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "default"}'
```

#### Vector Index Issues

**Symptoms:**
- Slow searches
- High CPU usage

**Diagnosis:**
```bash
# Check index stats
curl http://localhost:8080/v1/meta | jq '.'
```

**Solution:**
```bash
# Trigger reindex (if supported)
# Or restart Weaviate for cleanup
docker compose restart weaviate
```

### Redis Issues

#### Persistence Failure

**Symptoms:**
- Data lost after restart
- "BGSAVE failed" in logs

**Diagnosis:**
```bash
# Check last save time
docker compose exec memory-redis redis-cli LASTSAVE

# Check for save errors
docker compose exec memory-redis redis-cli INFO persistence
```

**Solutions:**

1. **Disk full:**
```bash
df -h
# Clear space or move data
```

2. **Permission issue:**
```bash
# Check data directory permissions
docker compose exec memory-redis ls -la /data
```

3. **Manual save:**
```bash
docker compose exec memory-redis redis-cli BGSAVE
```

---

## Network Troubleshooting

### Tailscale Connectivity

**Symptoms:**
- Cannot connect to server
- "Host unreachable"

**Diagnosis:**
```bash
# Check Tailscale status
tailscale status

# Ping via Tailscale
tailscale ping acdev-node01.tail4da6b7.ts.net

# Check routes
tailscale status --json | jq '.Peer'
```

**Solutions:**

1. **Restart Tailscale:**
```bash
sudo tailscale down
sudo tailscale up
```

2. **Check ACLs:**
```bash
# Verify ACL allows your access
# Check Tailscale admin console
```

3. **Firewall:**
```bash
# Check UFW status
sudo ufw status
# Allow Tailscale traffic
sudo ufw allow from 100.0.0.0/8
```

### Docker Network Issues

**Symptoms:**
- "network engram-platform-network not found"
- Intermittent connectivity between containers

**Diagnosis:**
```bash
# List networks
docker network ls

# Inspect network
docker network inspect engram-platform-network

# Test container connectivity
docker compose exec memory-api ping weaviate
```

**Solutions:**

1. **Recreate network:**
```bash
docker compose down
docker network prune
docker compose up -d
```

2. **DNS resolution:**
```bash
# Use container names, not IPs
# Verify in docker-compose.yml:
# networks:
#   - engram-platform-network
```

---

## Container Troubleshooting

### Container Exited Unexpectedly

**Diagnosis:**
```bash
# Check exit code
docker compose ps -a

# View logs before exit
docker compose logs --tail=100 memory-api

# Check OOM
dmesg | grep -i "killed process"
```

**Exit Code Reference:**

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 0 | Graceful exit | Normal shutdown |
| 1 | Application error | Unhandled exception |
| 137 | SIGKILL | OOM killed |
| 139 | Segmentation fault | Memory corruption |
| 143 | SIGTERM | Normal stop |

**Solutions:**

1. **OOM (Exit 137):**
```bash
# Increase memory limit in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
```

2. **Application error (Exit 1):**
```bash
# Check logs for stack trace
docker compose logs memory-api | grep -A20 "Error"
```

### Container Stuck in Restart Loop

**Diagnosis:**
```bash
# Watch restart count
watch 'docker compose ps'

# Check health check
docker inspect engram-memory-api | jq '.[0].State.Health'
```

**Solutions:**

1. **Fix health check:**
```bash
# Temporarily disable health check
docker compose up -d --no-deps --health-cmd "true" memory-api
```

2. **Increase start period:**
```yaml
healthcheck:
  start_period: 120s  # Increase from 60s
```

---

## Performance Issues

### Slow API Response

**Diagnosis:**
```bash
# Check response time
curl -w "%{time_total}" -o /dev/null -s http://localhost:8000/health

# Check system load
top -bn1 | head -5

# Check database latency
curl -w "%{time_total}" -o /dev/null -s http://localhost:8080/v1/.well-known/ready
```

**Solutions:**

1. **Enable caching:**
```yaml
# Already enabled, but verify
weaviate:
  environment:
    CACHE_ENABLED: "true"
```

2. **Scale workers:**
```yaml
memory-api:
  environment:
    UVICORN_WORKERS: "4"  # Increase from 2
```

3. **Check for N+1 queries:**
```bash
# Enable query logging
# Review slow queries in logs
docker compose logs memory-api | grep -i "slow"
```

### High Memory Usage

**Diagnosis:**
```bash
# Container memory usage
docker stats --no-stream

# Weaviate memory
docker compose exec weaviate cat /sys/fs/cgroup/memory/memory.usage_in_bytes

# Redis memory
docker compose exec memory-redis redis-cli INFO memory
```

**Solutions:**

1. **Clear Redis cache:**
```bash
docker compose exec memory-redis redis-cli FLUSHALL
```

2. **Restart Weaviate:**
```bash
docker compose restart weaviate
```

3. **Add memory limits:**
```yaml
deploy:
  resources:
    limits:
      memory: 2G
```

---

## Authentication Issues

### JWT Token Invalid

**Symptoms:**
- "401 Unauthorized"
- "Invalid token"

**Diagnosis:**
```bash
# Decode JWT (without verification)
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.'

# Check expiry
# Look for "exp" field
```

**Solutions:**

1. **Token expired:**
```bash
# Refresh token
curl -X POST http://localhost:8000/auth/refresh \
  -H "Authorization: Bearer $OLD_TOKEN"
```

2. **Wrong secret:**
```bash
# Verify JWT_SECRET matches across services
grep JWT_SECRET .env
docker compose exec memory-api env | grep JWT_SECRET
```

### API Key Not Working

**Symptoms:**
- "401 Unauthorized"
- "Invalid API key"

**Diagnosis:**
```bash
# Test API key
curl -H "Authorization: Bearer $MEMORY_API_KEY" \
  http://localhost:8000/stats
```

**Solutions:**

1. **Verify key format:**
```bash
# Should be in .env as:
MEMORY_API_KEY=your-key-here
# Not:
# MEMORY_API_KEY="your-key-here"  # No quotes needed
```

2. **Restart services after key change:**
```bash
docker compose restart memory-api mcp-server
```

---

## API Error Reference

### HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Invalid JSON, missing fields |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Valid auth, insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server bug, check logs |
| 502 | Bad Gateway | Upstream service down |
| 503 | Service Unavailable | System not initialized |

### Error Response Format

```json
{
  "error": "HTTPException",
  "detail": "Memory not found",
  "request_id": null
}
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "System not initialized" | Memory API starting | Wait 30s, retry |
| "Weaviate connection failed" | Weaviate down | Check Weaviate health |
| "Redis connection refused" | Redis down | Check Redis health |
| "Rate limit exceeded" | Too many requests | Wait or increase limit |
| "Invalid embedding dimensions" | Wrong embedding model | Check EMBEDDING_DIMENSIONS |

---

## Log Analysis

### Useful Log Patterns

```bash
# Find all errors
docker compose logs 2>&1 | grep -i "error\|exception\|failed" | tail -50

# Find slow requests
docker compose logs memory-api 2>&1 | grep -E "took [0-9]{4,}ms"

# Find authentication failures
docker compose logs 2>&1 | grep -i "unauthorized\|invalid.*token"

# Find memory-related issues
docker compose logs 2>&1 | grep -i "oom\|out of memory\|killed"

# Find Weaviate issues
docker compose logs weaviate 2>&1 | grep -i "error\|warn"
```

### Log Levels

| Level | When to Use |
|-------|-------------|
| DEBUG | Development, detailed tracing |
| INFO | Normal operations |
| WARNING | Recoverable issues |
| ERROR | Failures requiring attention |
| CRITICAL | System-wide failures |

### Enabling Debug Logs

```yaml
# docker-compose.yml
memory-api:
  environment:
    LOG_LEVEL: DEBUG
```

---

## Emergency Procedures

### Complete System Recovery

```bash
#!/bin/bash
# emergency-recovery.sh

echo "=== EMERGENCY RECOVERY STARTED ==="

# 1. Stop all services
docker compose down

# 2. Check for data corruption
docker volume ls | grep engram

# 3. Restore from latest backup
LATEST_BACKUP=$(ls -t /opt/engram/backups/full/*.tar.gz | head -1)
echo "Restoring from: $LATEST_BACKUP"

# 4. Extract backup
tar -xzf "$LATEST_BACKUP" -C /tmp/

# 5. Restore volumes (CAUTION)
# docker run --rm -v engram_weaviate_data:/data -v /tmp/backup:/backup alpine sh -c "rm -rf /data/* && tar -xzf /backup/weaviate-data.tar.gz -C /data"

# 6. Start services
docker compose up -d

# 7. Verify
sleep 60
curl -sf http://localhost:8000/health || echo "RECOVERY FAILED"

echo "=== EMERGENCY RECOVERY COMPLETED ==="
```

### Force Restart All Services

```bash
# Nuclear option - restart everything
docker compose down --timeout 30
docker compose up -d --force-recreate
```

### Contact Escalation

| Issue Type | First Contact | Escalation |
|------------|---------------|------------|
| Infrastructure | DevOps Team | Infrastructure Lead |
| Application | Development Team | Tech Lead |
| Security | Security Team | CISO |
| Data Loss | DBA Team | CTO |

---

**Document Control**
| Author | Review Date | Next Review |
|--------|-------------|-------------|
| Engram Team | March 2026 | September 2026 |
