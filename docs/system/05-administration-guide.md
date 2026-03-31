# 05 — Administration Guide

> Operational procedures for managing the Engram Platform on acdev-devnode (100.78.187.5).
> Last updated: 2026-03-31

---

## Table of Contents

1. [Access](#access)
2. [System Startup](#system-startup)
3. [System Shutdown](#system-shutdown)
4. [Service Management](#service-management)
5. [Health Checks](#health-checks)
6. [API Key Management](#api-key-management)
7. [Credential Rotation](#credential-rotation)
8. [Disk Management](#disk-management)
9. [Backup Procedures](#backup-procedures)
10. [Restore Procedures](#restore-procedures)
11. [Log Management](#log-management)
12. [Container Monitoring](#container-monitoring)
13. [SSL Certificate Renewal](#ssl-certificate-renewal)

---

## Access

All SSH access is via Tailscale only. Never use public IP addresses.

```bash
ssh user@100.78.187.5    # acdev-devnode via Tailscale
```

The Engram Platform is deployed at `/opt/engram/Engram-Platform` on acdev-devnode. All `docker compose` commands in this guide must be run from that directory.

```bash
cd /opt/engram/Engram-Platform
```

---

## System Startup

Start all services:

```bash
cd /opt/engram/Engram-Platform
docker compose up -d
```

Expected startup order (enforced by `depends_on` with health checks):

1. `engram-weaviate` and `engram-memory-redis` and `engram-crawler-redis` (no dependencies)
2. `engram-memory-api` (waits for weaviate + memory-redis healthy)
3. `engram-crawler-api` (waits for crawler-redis + memory-api healthy)
4. `engram-mcp-server` (waits for memory-api healthy)
5. `engram-platform-frontend` (no service dependencies)
6. `engram-nginx` (waits for crawler-api, memory-api, platform-frontend)

Verify all containers are running:

```bash
docker compose ps
```

Expected output shows 8 containers, all with status `Up` and health `healthy`.

---

## System Shutdown

Graceful shutdown of all services:

```bash
cd /opt/engram/Engram-Platform
docker compose down
```

This stops containers in reverse dependency order. Data volumes are preserved.

To also remove named volumes (destroys all data):

```bash
docker compose down -v
```

**Warning**: The `-v` flag deletes Weaviate data, Redis persistence, crawler cache, and ChromaDB storage. Use only when performing a full reset.

---

## Service Management

### Restart a Single Service

```bash
cd /opt/engram/Engram-Platform

# Restart memory API
docker compose restart memory-api

# Restart crawler
docker compose restart crawler-api

# Restart frontend
docker compose restart platform-frontend

# Restart nginx (picks up config changes)
docker compose restart nginx

# Restart MCP server
docker compose restart mcp-server
```

### Rebuild and Restart a Service

After code changes, rebuild the image before restarting:

```bash
cd /opt/engram/Engram-Platform

# Rebuild and restart memory API
docker compose up -d --build memory-api

# Rebuild and restart frontend
docker compose up -d --build platform-frontend

# Rebuild and restart crawler
docker compose up -d --build crawler-api
```

### Stop a Single Service

```bash
docker compose stop crawler-api       # Stop without removing
docker compose start crawler-api      # Start again
```

### View Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## Health Checks

### Memory API

```bash
curl -s http://100.78.187.5:8000/health | python3 -m json.tool
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "weaviate": "connected",
    "redis": "connected"
  }
}
```

### Crawler API

```bash
curl -sf http://localhost:11235/ && echo "Crawler healthy"
```

Note: The crawler API is not exposed on the host network. Check from within the Docker network or via nginx:

```bash
curl -s https://memory.velocitydigi.com/api/crawler/ -k
```

### MCP Server

```bash
docker compose exec mcp-server curl -sf http://localhost:3000/health
```

### Platform Frontend

```bash
docker compose exec platform-frontend node -e "require('http').get('http://localhost:3000', (r) => { console.log('Status:', r.statusCode); process.exit(r.statusCode < 500 ? 0 : 1) }).on('error', (e) => { console.error(e.message); process.exit(1) })"
```

### Nginx

```bash
curl -sf http://127.0.0.1:80/health && echo "Nginx healthy"
```

Or via HTTPS:

```bash
curl -sf -k https://127.0.0.1:443/health && echo "Nginx HTTPS healthy"
```

### Weaviate

```bash
docker compose exec weaviate wget -q -O- http://localhost:8080/v1/.well-known/ready
```

### Redis (Memory)

```bash
docker compose exec memory-redis redis-cli ping
# Expected: PONG
```

### Redis (Crawler)

```bash
docker compose exec crawler-redis redis-cli ping
# Expected: PONG
```

### Full Stack Health Check

Run all checks in sequence:

```bash
#!/bin/bash
echo "=== Engram Health Check ==="
echo -n "Weaviate:  "; docker compose exec -T weaviate wget -q -O- http://localhost:8080/v1/.well-known/ready 2>/dev/null && echo "OK" || echo "FAIL"
echo -n "Mem Redis: "; docker compose exec -T memory-redis redis-cli ping 2>/dev/null | grep -q PONG && echo "OK" || echo "FAIL"
echo -n "Crw Redis: "; docker compose exec -T crawler-redis redis-cli ping 2>/dev/null | grep -q PONG && echo "OK" || echo "FAIL"
echo -n "Memory API:"; curl -sf http://100.78.187.5:8000/health >/dev/null && echo " OK" || echo " FAIL"
echo -n "MCP Server:"; docker compose exec -T mcp-server curl -sf http://localhost:3000/health >/dev/null 2>&1 && echo " OK" || echo " FAIL"
echo -n "Frontend:  "; docker compose exec -T platform-frontend node -e "require('http').get('http://localhost:3000',(r)=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))" 2>/dev/null && echo " OK" || echo " FAIL"
echo -n "Nginx:     "; curl -sf http://127.0.0.1:80/health >/dev/null && echo " OK" || echo " FAIL"
```

---

## API Key Management

All key management requires authentication. Use an existing API key or JWT token.

### Create a New API Key

```bash
curl -s -X POST http://100.78.187.5:8000/admin/keys \
  -H "X-API-Key: YOUR_EXISTING_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "MCP Server Key"}' | python3 -m json.tool
```

Response includes the raw key (shown only once):
```json
{
  "id": "ek_a1b2c3d4e5f6a7b8",
  "name": "MCP Server Key",
  "key": "AbCdEfGh...48chars...",
  "prefix": "AbCdEfGh...rs48",
  "created_at": "2026-03-31T12:00:00+00:00"
}
```

**Save the `key` value immediately.** It cannot be retrieved after this response.

### List All API Keys

```bash
curl -s http://100.78.187.5:8000/admin/keys \
  -H "X-API-Key: YOUR_KEY" | python3 -m json.tool
```

Returns key metadata (name, prefix, created_at, last_used_at, request_count, status). Never returns the key hash.

### Revoke an API Key

```bash
curl -s -X DELETE http://100.78.187.5:8000/admin/keys/ek_a1b2c3d4e5f6a7b8 \
  -H "X-API-Key: YOUR_KEY" | python3 -m json.tool
```

Response:
```json
{
  "status": "revoked",
  "key_id": "ek_a1b2c3d4e5f6a7b8"
}
```

Revoked keys are soft-deleted and remain in Redis for audit purposes.

### Update a Key Name

```bash
curl -s -X PATCH http://100.78.187.5:8000/admin/keys/ek_a1b2c3d4e5f6a7b8 \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Renamed Key"}' | python3 -m json.tool
```

---

## Credential Rotation

### Rotate an API Key

1. Create a new key:
   ```bash
   curl -s -X POST http://100.78.187.5:8000/admin/keys \
     -H "X-API-Key: CURRENT_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name": "Replacement for old key"}'
   ```
2. Update all clients to use the new key.
3. Revoke the old key:
   ```bash
   curl -s -X DELETE http://100.78.187.5:8000/admin/keys/OLD_KEY_ID \
     -H "X-API-Key: NEW_KEY"
   ```

### Rotate JWT Secret

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```
2. Edit `/opt/engram/Engram-Platform/.env` and set `JWT_SECRET` to the new value.
3. Restart the memory API:
   ```bash
   cd /opt/engram/Engram-Platform
   docker compose restart memory-api
   ```
4. All existing JWT tokens are immediately invalidated. Users and services must re-authenticate.

### Rotate Clerk Keys

1. Generate new keys in the Clerk Dashboard at https://dashboard.clerk.com.
2. Edit `/opt/engram/Engram-Platform/.env`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_new_value
   CLERK_SECRET_KEY=sk_live_new_value
   ```
3. Rebuild and restart the frontend:
   ```bash
   cd /opt/engram/Engram-Platform
   docker compose up -d --build platform-frontend
   ```

### Rotate Memory API Key Used by Other Services

The `ENGRAM_API_KEY` (used by the crawler to talk to the memory API) and `AI_MEMORY_API_KEY` (used by MCP server) must be updated in `.env` and the respective containers restarted:

```bash
cd /opt/engram/Engram-Platform
# Edit .env with new values
vim .env
# Restart affected services
docker compose restart crawler-api mcp-server
```

---

## Disk Management

### Check Disk Usage

```bash
df -h /var/lib/docker
```

### Docker Volume Usage

```bash
docker system df -v
```

### Weaviate Data

Weaviate stores vector data in the `weaviate_data` volume, mounted at `/var/lib/weaviate` inside the container.

Check volume size:
```bash
docker volume inspect engram-platform_weaviate_data --format '{{ .Mountpoint }}' | xargs sudo du -sh
```

### Redis Memory Usage

Memory Redis:
```bash
docker compose exec memory-redis redis-cli info memory | grep used_memory_human
```

Crawler Redis:
```bash
docker compose exec crawler-redis redis-cli info memory | grep used_memory_human
```

Redis is configured with memory limits:
- Memory Redis: `maxmemory 256mb` with `allkeys-lru` eviction
- Crawler Redis: `maxmemory 384mb` with `allkeys-lru` eviction

### Prune Unused Docker Resources

```bash
# Remove dangling images
docker image prune -f

# Remove all unused images (not just dangling)
docker image prune -a -f

# Remove unused build cache
docker builder prune -f
```

### Crawler Data Tiers

The crawler stores data in tiered volumes:

| Volume | Mount | Max Age |
|---|---|---|
| `crawler_hot` | `/app/data/tiers/hot` | 24 hours |
| `crawler_warm` | `/app/data/tiers/warm` | 7 days |
| `crawler_cold` | `/app/data/tiers/cold` | 30 days |
| `crawler_archive` | `/app/data/tiers/archive` | Permanent (10 GB threshold) |

The crawler watchdog manages data lifecycle automatically. Manual cleanup is rarely needed.

---

## Backup Procedures

### Redis Backup (Memory Redis)

Redis is configured with AOF persistence (`appendonly yes`). Data is stored in the `memory_redis_data` volume.

**Trigger an RDB snapshot:**
```bash
docker compose exec memory-redis redis-cli BGSAVE
```

**Copy the RDB file out:**
```bash
docker compose cp memory-redis:/data/dump.rdb ./backups/memory-redis-$(date +%Y%m%d).rdb
```

**Copy the AOF file:**
```bash
docker compose cp memory-redis:/data/appendonly.aof ./backups/memory-redis-$(date +%Y%m%d).aof
```

### Redis Backup (Crawler Redis)

```bash
docker compose exec crawler-redis redis-cli BGSAVE
docker compose cp crawler-redis:/data/dump.rdb ./backups/crawler-redis-$(date +%Y%m%d).rdb
```

### Weaviate Backup

Weaviate supports backup via its API. Create a backup to the filesystem:

```bash
curl -s -X POST http://100.78.187.5:8000/../weaviate:8080/v1/backups/filesystem \
  -H "Content-Type: application/json" \
  -d '{"id": "backup-'$(date +%Y%m%d)'"}'
```

Since Weaviate is not exposed on the host, use docker exec:

```bash
docker compose exec weaviate wget -q -O- --post-data='{"id":"backup-'$(date +%Y%m%d)'"}' \
  --header='Content-Type: application/json' \
  http://localhost:8080/v1/backups/filesystem
```

Alternatively, back up the entire volume:

```bash
# Stop weaviate first for consistency
docker compose stop weaviate
sudo tar czf ./backups/weaviate-data-$(date +%Y%m%d).tar.gz \
  -C $(docker volume inspect engram-platform_weaviate_data --format '{{ .Mountpoint }}') .
docker compose start weaviate
```

### Full Platform Backup Script

```bash
#!/bin/bash
set -euo pipefail
BACKUP_DIR="/opt/engram/backups/$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"
cd /opt/engram/Engram-Platform

echo "Backing up Redis (memory)..."
docker compose exec -T memory-redis redis-cli BGSAVE
sleep 2
docker compose cp memory-redis:/data/dump.rdb "$BACKUP_DIR/memory-redis.rdb"

echo "Backing up Redis (crawler)..."
docker compose exec -T crawler-redis redis-cli BGSAVE
sleep 2
docker compose cp crawler-redis:/data/dump.rdb "$BACKUP_DIR/crawler-redis.rdb"

echo "Backing up .env..."
cp .env "$BACKUP_DIR/dot-env.bak"

echo "Backing up nginx config..."
cp nginx/nginx.conf "$BACKUP_DIR/nginx.conf.bak"

echo "Backing up certs..."
cp -r certs/ "$BACKUP_DIR/certs/"

echo "Backup complete: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
```

---

## Restore Procedures

### Restore Redis Data

1. Stop the service:
   ```bash
   cd /opt/engram/Engram-Platform
   docker compose stop memory-api
   docker compose stop memory-redis
   ```

2. Copy the backup into the volume:
   ```bash
   docker compose cp ./backups/memory-redis-20260331.rdb memory-redis:/data/dump.rdb
   ```

3. Restart:
   ```bash
   docker compose start memory-redis
   docker compose start memory-api
   ```

### Restore Weaviate Data

1. Stop Weaviate and Memory API:
   ```bash
   docker compose stop memory-api mcp-server crawler-api
   docker compose stop weaviate
   ```

2. Clear and restore the volume:
   ```bash
   MOUNT=$(docker volume inspect engram-platform_weaviate_data --format '{{ .Mountpoint }}')
   sudo rm -rf "$MOUNT"/*
   sudo tar xzf ./backups/weaviate-data-20260331.tar.gz -C "$MOUNT"
   ```

3. Restart the stack:
   ```bash
   docker compose up -d
   ```

### Restore Environment

```bash
cp ./backups/20260331-1200/dot-env.bak /opt/engram/Engram-Platform/.env
cp ./backups/20260331-1200/nginx.conf.bak /opt/engram/Engram-Platform/nginx/nginx.conf
cp -r ./backups/20260331-1200/certs/ /opt/engram/Engram-Platform/certs/
cd /opt/engram/Engram-Platform
docker compose restart nginx
```

---

## Log Management

### View Logs for a Specific Container

```bash
cd /opt/engram/Engram-Platform

# Follow logs in real time
docker logs -f engram-memory-api
docker logs -f engram-crawler-api
docker logs -f engram-weaviate
docker logs -f engram-nginx
docker logs -f engram-mcp-server
docker logs -f engram-platform-frontend
docker logs -f engram-memory-redis
docker logs -f engram-crawler-redis

# Last 100 lines
docker logs --tail 100 engram-memory-api

# Logs since a specific time
docker logs --since 1h engram-memory-api

# Logs with timestamps
docker logs -t --tail 50 engram-memory-api
```

### Search Logs

```bash
docker logs engram-memory-api 2>&1 | grep -i error
docker logs engram-nginx 2>&1 | grep "status=5"
```

### Log Rotation

All containers use the `json-file` driver with `max-size: 10m` and `max-file: 3`. Total disk per container is capped at 30 MB. No manual rotation is needed.

### Crawler Supervisor Logs

The crawler runs multiple processes under supervisord. Internal logs are in the `crawler_supervisor` volume:

```bash
docker compose exec crawler-api ls /var/log/supervisor/
docker compose exec crawler-api cat /var/log/supervisor/uvicorn-stdout.log
```

---

## Container Monitoring

### Live Resource Usage

```bash
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
```

### Check Container Restart Counts

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | sort
```

Look for `Restarting` status or high restart counts (e.g., `Up 5 minutes (3 restarts)`).

### Inspect a Container

```bash
docker inspect engram-memory-api --format '{{.State.Status}} | Started: {{.State.StartedAt}} | Restarts: {{.RestartCount}}'
```

---

## SSL Certificate Renewal

### Current Setup

SSL certificates are stored at `/opt/engram/Engram-Platform/certs/` and mounted read-only into the nginx container. The current certificate is a wildcard cert for `*.velocitydigi.com`.

Certificate files:
- `velocitydigi.crt` -- certificate (PEM)
- `velocitydigi.key` -- private key (PEM)

### Replacing Certificates

1. Place new certificate files:
   ```bash
   cp /path/to/new/fullchain.pem /opt/engram/Engram-Platform/certs/velocitydigi.crt
   cp /path/to/new/privkey.pem /opt/engram/Engram-Platform/certs/velocitydigi.key
   chmod 644 /opt/engram/Engram-Platform/certs/velocitydigi.crt
   chmod 600 /opt/engram/Engram-Platform/certs/velocitydigi.key
   ```

2. Reload nginx (no downtime):
   ```bash
   docker compose exec nginx nginx -s reload
   ```

3. Verify the new certificate:
   ```bash
   echo | openssl s_client -connect 127.0.0.1:443 -servername memory.velocitydigi.com 2>/dev/null | openssl x509 -noout -dates
   ```

### Let's Encrypt (If Migrating from Self-Signed)

The nginx config includes an ACME challenge location block for Let's Encrypt:

```bash
# From acdev-devnode:
certbot certonly --webroot -w /var/www/certbot \
  -d memory.velocitydigi.com \
  -d engram.velocitydigi.com
```

Then copy the generated certs to the expected paths and reload nginx.
