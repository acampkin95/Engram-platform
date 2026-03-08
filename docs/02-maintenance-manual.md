# Engram Platform Maintenance Manual

**Version:** 1.0.0
**Last Updated:** March 2026
**Classification:** Internal Operations Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Routine Maintenance Schedule](#routine-maintenance-schedule)
3. [Backup Procedures](#backup-procedures)
4. [Database Maintenance](#database-maintenance)
5. [Log Management](#log-management)
6. [Resource Monitoring](#resource-monitoring)
7. [Update Procedures](#update-procedures)
8. [Performance Tuning](#performance-tuning)
9. [Memory System Maintenance](#memory-system-maintenance)
10. [Container Maintenance](#container-maintenance)
11. [Security Maintenance](#security-maintenance)
12. [Disaster Recovery](#disaster-recovery)

---

## Overview

This manual provides comprehensive guidance for maintaining the Engram Platform in production environments. Regular maintenance ensures system reliability, optimal performance, and data integrity.

### Maintenance Philosophy

- **Proactive**: Regular checks prevent issues before they impact users
- **Automated**: Script routine tasks to reduce human error
- **Documented**: All procedures are recorded for audit trails
- **Reversible**: Changes can be rolled back safely

### System Components Requiring Maintenance

| Component | Maintenance Type | Frequency |
|-----------|------------------|-----------|
| Weaviate | Backup, compaction | Daily/Weekly |
| Redis | Memory management | Daily |
| Memory API | Log rotation, updates | Weekly |
| Crawler API | Cache cleanup, updates | Weekly |
| MCP Server | Updates, health checks | Weekly |
| Platform Frontend | Builds, updates | Weekly |
| Docker | Image pruning, updates | Monthly |
| SSL Certificates | Renewal | Every 90 days |

---

## Routine Maintenance Schedule

### Daily Tasks

```bash
#!/bin/bash
# daily-maintenance.sh
# Run at 02:00 UTC via cron

LOG_FILE="/var/log/engram/daily-maintenance-$(date +%Y%m%d).log"

echo "=== Daily Maintenance Started: $(date) ===" >> "$LOG_FILE"

# 1. Health check all services
echo "Checking service health..." >> "$LOG_FILE"
cd /opt/engram/Engram-Platform
docker compose ps >> "$LOG_FILE"

# 2. Check disk usage
echo "Disk usage:" >> "$LOG_FILE"
df -h >> "$LOG_FILE"

# 3. Check memory usage
echo "Memory usage:" >> "$LOG_FILE"
free -h >> "$LOG_FILE"

# 4. Redis memory check
echo "Redis memory:" >> "$LOG_FILE"
docker compose exec memory-redis redis-cli INFO memory >> "$LOG_FILE"

# 5. Weaviate stats
echo "Weaviate objects count:" >> "$LOG_FILE"
curl -s http://localhost:8080/v1/meta | jq '.objectsCount' >> "$LOG_FILE"

echo "=== Daily Maintenance Completed: $(date) ===" >> "$LOG_FILE"
```

**Cron Configuration:**
```bash
0 2 * * * /opt/engram/scripts/daily-maintenance.sh
```

### Weekly Tasks

```bash
#!/bin/bash
# weekly-maintenance.sh
# Run at 03:00 UTC on Sundays

LOG_FILE="/var/log/engram/weekly-maintenance-$(date +%Y%m%d).log"

echo "=== Weekly Maintenance Started: $(date) ===" >> "$LOG_FILE"

# 1. Clean up expired memories
echo "Cleaning expired memories..." >> "$LOG_FILE"
curl -X POST http://localhost:8000/memories/cleanup \
  -H "Authorization: Bearer $MEMORY_API_KEY" >> "$LOG_FILE"

# 2. Run memory consolidation
echo "Consolidating memories..." >> "$LOG_FILE"
curl -X POST http://localhost:8000/memories/consolidate \
  -H "Authorization: Bearer $MEMORY_API_KEY" >> "$LOG_FILE"

# 3. Docker image cleanup
echo "Pruning unused Docker images..." >> "$LOG_FILE"
docker image prune -af --filter "until=168h" >> "$LOG_FILE"

# 4. Log rotation check
echo "Checking log sizes..." >> "$LOG_FILE"
du -sh /var/lib/docker/containers/*/*.log >> "$LOG_FILE"

# 5. Backup verification
echo "Verifying backups..." >> "$LOG_FILE"
ls -la /opt/engram/backups/ >> "$LOG_FILE"

echo "=== Weekly Maintenance Completed: $(date) ===" >> "$LOG_FILE"
```

### Monthly Tasks

```bash
#!/bin/bash
# monthly-maintenance.sh
# Run at 04:00 UTC on the 1st of each month

LOG_FILE="/var/log/engram/monthly-maintenance-$(date +%Y%m).log"

echo "=== Monthly Maintenance Started: $(date) ===" >> "$LOG_FILE"

# 1. Full system backup
echo "Creating full backup..." >> "$LOG_FILE"
/opt/engram/scripts/full-backup.sh >> "$LOG_FILE"

# 2. Security updates
echo "Checking for security updates..." >> "$LOG_FILE"
apt update && apt list --upgradable >> "$LOG_FILE"

# 3. SSL certificate check
echo "Checking SSL certificates..." >> "$LOG_FILE"
certbot certificates >> "$LOG_FILE"

# 4. Docker system prune
echo "Full Docker system cleanup..." >> "$LOG_FILE"
docker system prune -af --volumes --filter "until=720h" >> "$LOG_FILE"

# 5. Performance report
echo "Generating performance report..." >> "$LOG_FILE"
/opt/engram/scripts/performance-report.sh >> "$LOG_FILE"

echo "=== Monthly Maintenance Completed: $(date) ===" >> "$LOG_FILE"
```

---

## Backup Procedures

### Backup Strategy Overview

| Data Type | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| Weaviate Data | S3 Export + Local | Daily | 30 days |
| Redis Data | RDB Snapshot | Every 6 hours | 7 days |
| Configuration | Git + Archive | On change | 90 days |
| Docker Volumes | Tar Archive | Weekly | 14 days |
| SSL Certificates | Encrypted Backup | Monthly | 1 year |

### Weaviate Backup

```bash
#!/bin/bash
# backup-weaviate.sh

BACKUP_DIR="/opt/engram/backups/weaviate"
DATE=$(date +%Y%m%d-%H%M%S)
S3_BUCKET="s3://engram-backups/weaviate"

mkdir -p "$BACKUP_DIR"

echo "Starting Weaviate backup: $DATE"

# Method 1: S3 Offload (if configured)
curl -X POST "http://localhost:8080/v1/backups/s3" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "backup-'$DATE'",
    "include": ["MemoryTier1", "MemoryTier2", "MemoryTier3", "KnowledgeEntity", "KnowledgeRelation"]
  }'

# Method 2: Local export via API
curl -s "http://localhost:8080/v1/schema" > "$BACKUP_DIR/schema-$DATE.json"

# Export each collection
for collection in MemoryTier1 MemoryTier2 MemoryTier3 KnowledgeEntity KnowledgeRelation; do
  curl -s "http://localhost:8080/v1/objects?class=$collection&limit=10000" \
    > "$BACKUP_DIR/${collection,,}-$DATE.json"
done

# Compress backup
tar -czf "$BACKUP_DIR/weaviate-backup-$DATE.tar.gz" "$BACKUP_DIR"/*.json

# Upload to S3 (if configured)
if command -v aws &> /dev/null; then
  aws s3 cp "$BACKUP_DIR/weaviate-backup-$DATE.tar.gz" "$S3_BUCKET/"
fi

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "Weaviate backup completed: $DATE"
```

### Redis Backup

```bash
#!/bin/bash
# backup-redis.sh

BACKUP_DIR="/opt/engram/backups/redis"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Trigger RDB save for both Redis instances
docker compose exec memory-redis redis-cli BGSAVE
docker compose exec crawler-redis redis-cli BGSAVE

# Wait for save to complete
sleep 5

# Copy RDB files
docker compose cp memory-redis:/data/dump.rdb "$BACKUP_DIR/memory-redis-$DATE.rdb"
docker compose cp crawler-redis:/data/dump.rdb "$BACKUP_DIR/crawler-redis-$DATE.rdb"

# Compress
tar -czf "$BACKUP_DIR/redis-backup-$DATE.tar.gz" "$BACKUP_DIR"/*.rdb

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Redis backup completed: $DATE"
```

### Full System Backup

```bash
#!/bin/bash
# full-backup.sh

BACKUP_DIR="/opt/engram/backups/full"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/engram-full-$DATE"

mkdir -p "$BACKUP_PATH"

echo "Starting full system backup: $DATE"

# 1. Export all Docker volumes
docker run --rm \
  -v engram_weaviate_data:/data \
  -v "$BACKUP_PATH":/backup \
  alpine tar -czf /backup/weaviate-data.tar.gz -C /data .

docker run --rm \
  -v engram_memory_redis_data:/data \
  -v "$BACKUP_PATH":/backup \
  alpine tar -czf /backup/memory-redis-data.tar.gz -C /data .

docker run --rm \
  -v engram_crawler_redis_data:/data \
  -v "$BACKUP_PATH":/backup \
  alpine tar -czf /backup/crawler-redis-data.tar.gz -C /data .

# 2. Backup configuration
cp /opt/engram/Engram-Platform/.env "$BACKUP_PATH/.env"
cp -r /opt/engram/Engram-Platform/nginx "$BACKUP_PATH/nginx"
cp -r /opt/engram/Engram-Platform/certs "$BACKUP_PATH/certs"

# 3. Export container images
docker save engram-memory-api:latest | gzip > "$BACKUP_PATH/memory-api-image.tar.gz"
docker save crawl4ai-engram:latest | gzip > "$BACKUP_PATH/crawler-api-image.tar.gz"
docker save engram-mcp-server:latest | gzip > "$BACKUP_PATH/mcp-server-image.tar.gz"
docker save engram-platform-frontend:latest | gzip > "$BACKUP_PATH/platform-frontend-image.tar.gz"

# 4. Create manifest
cat > "$BACKUP_PATH/manifest.json" << EOF
{
  "date": "$DATE",
  "version": "$(cd /opt/engram && git describe --tags)",
  "services": {
    "memory-api": "$(docker inspect --format='{{.Id}}' engram-memory-api:latest 2>/dev/null || echo 'N/A')",
    "crawler-api": "$(docker inspect --format='{{.Id}}' crawl4ai-engram:latest 2>/dev/null || echo 'N/A')",
    "mcp-server": "$(docker inspect --format='{{.Id}}' engram-mcp-server:latest 2>/dev/null || echo 'N/A')",
    "platform-frontend": "$(docker inspect --format='{{.Id}}' engram-platform-frontend:latest 2>/dev/null || echo 'N/A')"
  }
}
EOF

# 5. Compress everything
cd "$BACKUP_DIR"
tar -czf "engram-full-backup-$DATE.tar.gz" "engram-full-$DATE"
rm -rf "engram-full-$DATE"

# 6. Upload to offsite storage
if command -v aws &> /dev/null; then
  aws s3 cp "engram-full-backup-$DATE.tar.gz" s3://engram-backups/full/
fi

echo "Full backup completed: $DATE"
```

---

## Database Maintenance

### Weaviate Maintenance

#### Schema Verification

```bash
# Check schema integrity
curl -s http://localhost:8080/v1/schema | jq '.'

# Verify collection counts
for class in MemoryTier1 MemoryTier2 MemoryTier3 KnowledgeEntity KnowledgeRelation; do
  count=$(curl -s "http://localhost:8080/v1/objects?class=$class&limit=0" | jq '.totalResults')
  echo "$class: $count objects"
done
```

#### Index Optimization

```bash
# Weaviate automatically manages indices, but you can trigger compaction
# via the REST API if using a version that supports it

# Check inverted index configs
curl -s http://localhost:8080/v1/schema/MemoryTier1 | jq '.invertedIndexConfig'
```

#### Tenant Management

```bash
# List all tenants
curl -X GET http://localhost:8000/tenants \
  -H "Authorization: Bearer $MEMORY_API_KEY"

# Create new tenant
curl -X POST http://localhost:8000/tenants \
  -H "Authorization: Bearer $MEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "new-client"}'

# Delete tenant (WARNING: destructive)
curl -X DELETE http://localhost:8000/tenants/old-client \
  -H "Authorization: Bearer $MEMORY_API_KEY"
```

### Redis Maintenance

#### Memory Management

```bash
# Check Redis memory usage
docker compose exec memory-redis redis-cli INFO memory

# Check key count
docker compose exec memory-redis redis-cli DBSIZE

# Get memory stats
docker compose exec memory-redis redis-cli MEMORY STATS

# Check for large keys
docker compose exec memory-redis redis-cli --bigkeys

# Manual memory purge (if needed)
docker compose exec memory-redis redis-cli MEMORY PURGE
```

#### Cache Optimization

```bash
# Check hit/miss ratio
docker compose exec memory-redis redis-cli INFO stats | grep -E 'keyspace_hits|keyspace_misses'

# Monitor commands
docker compose exec memory-redis redis-cli MONITOR

# Check slow log
docker compose exec memory-redis redis-cli SLOWLOG GET 10
```

---

## Log Management

### Log Locations

| Service | Container Path | Host Access |
|---------|---------------|-------------|
| Memory API | /app/logs/ | `docker compose logs memory-api` |
| Crawler API | /app/data/logs/ | `docker compose logs crawler-api` |
| MCP Server | stdout | `docker compose logs mcp-server` |
| Nginx | /var/log/nginx/ | `docker compose logs nginx` |

### Log Rotation

Docker handles log rotation automatically with these settings:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Log Analysis

```bash
# Extract errors from last hour
docker compose logs --since="1h" memory-api 2>&1 | grep -i error

# Count errors by type
docker compose logs memory-api 2>&1 | grep -i error | cut -d' ' -f4- | sort | uniq -c | sort -rn

# Export logs for analysis
docker compose logs --no-color > /tmp/engram-logs-$(date +%Y%m%d).log

# Search for specific request
docker compose logs memory-api 2>&1 | grep "memory_id.*abc123"
```

### Centralized Logging (Optional)

For production, consider integrating with a centralized logging solution:

```yaml
# docker-compose.yml addition
services:
  memory-api:
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://logs.example.com:514"
        tag: "engram-memory-api"
```

---

## Resource Monitoring

### Prometheus Metrics (Optional)

Add Prometheus monitoring:

```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
```

### Resource Alerts

```bash
#!/bin/bash
# resource-alerts.sh

ALERT_THRESHOLD_DISK=90
ALERT_THRESHOLD_MEMORY=90
ALERT_EMAIL="ops@velocitydigi.com"

# Check disk usage
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt "$ALERT_THRESHOLD_DISK" ]; then
  echo "WARNING: Disk usage at ${DISK_USAGE}%" | mail -s "Engram Disk Alert" "$ALERT_EMAIL"
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d. -f1)
if [ "$MEM_USAGE" -gt "$ALERT_THRESHOLD_MEMORY" ]; then
  echo "WARNING: Memory usage at ${MEM_USAGE}%" | mail -s "Engram Memory Alert" "$ALERT_EMAIL"
fi

# Check container health
UNHEALTHY=$(docker ps --filter "health=unhealthy" -q | wc -l)
if [ "$UNHEALTHY" -gt 0 ]; then
  echo "WARNING: $UNHEALTHY unhealthy containers" | mail -s "Engram Container Alert" "$ALERT_EMAIL"
fi
```

---

## Update Procedures

### Pre-Update Checklist

- [ ] Create full backup
- [ ] Notify stakeholders of maintenance window
- [ ] Review changelog for breaking changes
- [ ] Prepare rollback plan
- [ ] Verify sufficient disk space

### Update Process

```bash
#!/bin/bash
# update-engram.sh

set -e

echo "=== Engram Update Started: $(date) ==="

# 1. Create backup
echo "Creating pre-update backup..."
/opt/engram/scripts/full-backup.sh

# 2. Pull latest code
echo "Pulling latest code..."
cd /opt/engram
git fetch origin
git log HEAD..origin/main --oneline
read -p "Proceed with update? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Update cancelled."
  exit 1
fi
git pull origin main

# 3. Update dependencies
echo "Updating dependencies..."
cd Engram-Platform
docker compose build --no-cache

# 4. Stop services gracefully
echo "Stopping services..."
docker compose down --timeout 60

# 5. Start services
echo "Starting services..."
docker compose up -d

# 6. Wait for health checks
echo "Waiting for services to be healthy..."
sleep 30

# 7. Verify health
echo "Verifying health..."
curl -sf http://localhost:8000/health || {
  echo "Health check failed! Rolling back..."
  docker compose down
  docker compose up -d
  exit 1
}

# 8. Run migrations (if any)
echo "Running migrations..."
curl -X POST http://localhost:8000/memories/cleanup \
  -H "Authorization: Bearer $MEMORY_API_KEY"

echo "=== Engram Update Completed: $(date) ==="
```

### Rollback Procedure

```bash
#!/bin/bash
# rollback-engram.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  ls -la /opt/engram/backups/full/
  exit 1
fi

echo "=== Rolling back to $BACKUP_FILE ==="

# Stop services
docker compose down

# Extract backup
tar -xzf "$BACKUP_FILE" -C /tmp/

# Restore volumes
# (This is destructive - ensure backup is valid)
# docker run --rm -v engram_weaviate_data:/data -v /tmp/engram-full-xxx:/backup alpine sh -c "rm -rf /data/* && tar -xzf /backup/weaviate-data.tar.gz -C /data"

# Restore config
cp /tmp/engram-full-*/.env /opt/engram/Engram-Platform/.env

# Restart
docker compose up -d

echo "Rollback completed. Verify services."
```

---

## Performance Tuning

### Weaviate Performance

```yaml
# docker-compose.yml performance settings
weaviate:
  environment:
    GOMEMLIMIT: "1.5GiB"
    GOMAXPROCS: "2"
    ENABLE_TurboBoost: "true"
    GRPC_MAX_CONCURRENT_STREAMS: "100"
    CACHE_ENABLED: "true"
    CACHE_SIZE: "512MB"
    CACHE_TTL: "3600"
```

### Redis Performance

```yaml
# Memory Redis
memory-redis:
  command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru --tcp-keepalive 300

# Crawler Redis
crawler-redis:
  command: redis-server --appendonly yes --maxmemory 768mb --maxmemory-policy allkeys-lru --tcp-keepalive 300
```

### Memory API Performance

```yaml
memory-api:
  environment:
    UVICORN_WORKERS: "2"
    UVICORN_LIMIT_CONN: "100"
    UVICORN_KEEPALIVE: "5"
```

---

## Memory System Maintenance

### Memory Cleanup

```bash
# Clean expired memories
curl -X POST http://localhost:8000/memories/cleanup \
  -H "Authorization: Bearer $MEMORY_API_KEY"

# Run memory consolidation
curl -X POST http://localhost:8000/memories/consolidate \
  -H "Authorization: Bearer $MEMORY_API_KEY"

# Trigger decay calculation
curl -X POST http://localhost:8000/memories/decay \
  -H "Authorization: Bearer $MEMORY_API_KEY"
```

### Memory Statistics

```bash
# Get memory stats
curl -s http://localhost:8000/stats \
  -H "Authorization: Bearer $MEMORY_API_KEY" | jq '.'

# Get analytics
curl -s http://localhost:8000/analytics \
  -H "Authorization: Bearer $MEMORY_API_KEY" | jq '.'
```

---

## Container Maintenance

### Docker Cleanup

```bash
# Remove unused images
docker image prune -af

# Remove unused volumes (CAUTION)
docker volume prune -f

# Full system cleanup
docker system prune -af --volumes

# Remove old images by date
docker image prune -af --filter "until=168h"
```

### Container Debugging

```bash
# Shell into container
docker compose exec memory-api /bin/bash

# Check container processes
docker compose top memory-api

# View container resource usage
docker stats engram-memory-api --no-stream

# Inspect container configuration
docker inspect engram-memory-api
```

---

## Security Maintenance

### Certificate Renewal

```bash
# Check certificate expiry
certbot certificates

# Force renewal
certbot renew --force-renewal

# Reload nginx
docker compose restart nginx
```

### Secret Rotation

```bash
# Generate new JWT secret
NEW_JWT=$(openssl rand -base64 32)

# Update .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_JWT/" /opt/engram/Engram-Platform/.env

# Restart affected services
docker compose restart memory-api mcp-server
```

### Security Audit

```bash
# Check for exposed ports
docker compose ps --format "table {{.Name}}\t{{.Ports}}"

# Verify no public IP binding
grep -r "0.0.0.0" /opt/engram/Engram-Platform/*.yml

# Check container security options
docker inspect --format '{{.HostConfig.SecurityOpt}}' engram-memory-api
```

---

## Disaster Recovery

### Recovery Time Objectives (RTO)

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single service failure | 5 minutes | 0 |
| Database corruption | 1 hour | 24 hours |
| Complete system failure | 4 hours | 24 hours |
| Data center failure | 24 hours | 24 hours |

### Recovery Procedures

#### Single Service Recovery

```bash
# Identify failed service
docker compose ps

# Check logs
docker compose logs --tail=100 <service>

# Restart service
docker compose restart <service>

# If restart fails, rebuild
docker compose up -d --force-recreate <service>
```

#### Database Recovery

```bash
# Stop services
docker compose down

# Restore Weaviate from backup
# (Assumes backup was created with backup-weaviate.sh)

# Start services
docker compose up -d

# Verify data integrity
curl http://localhost:8000/stats
```

#### Complete System Recovery

1. Provision new server with same specifications
2. Install Docker, Docker Compose, Tailscale
3. Join Tailscale network
4. Clone repository
5. Download backup from S3
6. Restore volumes and configuration
7. Start services
8. Verify functionality

---

**Document Control**
| Author | Review Date | Next Review |
|--------|-------------|-------------|
| Engram Team | March 2026 | September 2026 |
