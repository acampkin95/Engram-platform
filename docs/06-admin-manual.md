# Engram Platform Administrator Manual

**Version:** 1.0.0
**Last Updated:** March 2026
**Classification:** Administrative Reference Documentation

---

## Table of Contents

1. [Administrator Overview](#administrator-overview)
2. [Access and Authentication](#access-and-authentication)
3. [User Management](#user-management)
4. [Tenant Management](#tenant-management)
5. [API Key Management](#api-key-management)
6. [System Monitoring](#system-monitoring)
7. [Security Administration](#security-administration)
8. [Backup and Recovery](#backup-and-recovery)
9. [Audit Logging](#audit-logging)
10. [Compliance and Governance](#compliance-and-governance)
11. [Administrative Commands Reference](#administrative-commands-reference)
12. [Emergency Procedures](#emergency-procedures)

---

## Administrator Overview

This manual provides comprehensive guidance for Engram Platform administrators. It covers user management, security configuration, system monitoring, and operational procedures.

### Administrative Roles

| Role | Permissions | Access Level |
|------|-------------|--------------|
| Super Admin | Full system access | All tenants, all operations |
| Tenant Admin | Single tenant management | Own tenant only |
| Operator | Monitoring and maintenance | Read-only + restart |
| Auditor | Log access only | Read-only audit logs |

### Administrative Interfaces

1. **API Endpoints**: Direct REST API access with admin credentials
2. **Dashboard**: Web-based administration panel
3. **CLI Tools**: Command-line administrative utilities
4. **Direct Database**: Weaviate/Redis direct access (emergency only)

---

## Access and Authentication

### Admin Login

#### Dashboard Login

```bash
# Access dashboard
https://memory.velocitydigi.com/sign-in

# Admin credentials
Username: admin
Password: [configured in ADMIN_PASSWORD_HASH]
```

#### API Authentication

```bash
# Get JWT token
curl -X POST https://memory.velocitydigi.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400
}

# Use token
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  https://memory.velocitydigi.com/stats
```

### Setting Admin Password

```bash
# Generate bcrypt hash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'your-secure-password', bcrypt.gensalt()).decode())"

# Add to .env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$...

# Restart services
docker compose restart memory-api
```

### Multi-Factor Authentication (Future)

MFA support is planned for future releases. Current authentication relies on:
- Strong password policies
- JWT token expiration
- IP-based access control via Tailscale

---

## User Management

### User Types

| Type | Description | Tenant Scope |
|------|-------------|--------------|
| Admin | System administrator | All tenants |
| Member | Regular user | Single tenant |
| Service | API-only access | Configurable |

### Creating Users via Clerk

Engram uses Clerk for authentication. User management is handled through the Clerk dashboard:

1. Navigate to https://clerk.velocitydigi.com
2. Select "Users" from sidebar
3. Click "Create User"
4. Configure user details and tenant assignment

### User Metadata

Store tenant information in Clerk user metadata:

```json
{
  "public_metadata": {
    "tenant_id": "client-acme",
    "role": "member"
  },
  "private_metadata": {
    "api_key_id": "key_abc123"
  }
}
```

### User Provisioning Workflow

```
┌─────────────────┐
│  Admin Creates  │
│  User in Clerk  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Receives  │
│  Invitation     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Sets      │
│  Password       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Accesses  │
│  Platform       │
└─────────────────┘
```

---

## Tenant Management

### Tenant Overview

Multi-tenancy provides complete data isolation between clients. Each tenant has:
- Isolated vector collections
- Separate Redis cache namespace
- Independent analytics
- Dedicated API keys

### Creating Tenants

#### Via API

```bash
# Create new tenant
curl -X POST https://memory.velocitydigi.com/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "client-acme"}'

# Response
{
  "tenant_id": "client-acme",
  "status": "created"
}
```

#### Via Dashboard

1. Navigate to Admin > Tenants
2. Click "Create Tenant"
3. Enter tenant ID (must be unique, lowercase, alphanumeric with hyphens)
4. Configure initial settings
5. Click "Create"

### Listing Tenants

```bash
# List all tenants
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/tenants

# Response
{
  "tenants": ["default", "client-acme", "client-globex"],
  "total": 3
}
```

### Tenant Statistics

```bash
# Get tenant-specific stats
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://memory.velocitydigi.com/stats?tenant_id=client-acme"

# Response
{
  "total_memories": 1523,
  "tier1_count": 1200,
  "tier2_count": 300,
  "tier3_count": 23,
  "by_type": {
    "fact": 800,
    "decision": 400,
    "insight": 323
  }
}
```

### Deleting Tenants

⚠️ **WARNING**: This is irreversible and deletes all tenant data.

```bash
# Delete tenant
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/tenants/client-acme

# Response
{
  "tenant_id": "client-acme",
  "status": "deleted"
}
```

### Tenant Isolation Verification

```bash
# Verify tenant isolation
# Search as tenant A should not return tenant B's data

curl -X POST https://memory.velocitydigi.com/memories/search \
  -H "Authorization: Bearer $TENANT_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "confidential", "tenant_id": "tenant-a"}'

# Should only return tenant-a results
```

---

## API Key Management

### API Key Types

| Type | Scope | Use Case |
|------|-------|----------|
| Admin Key | Full access | System administration |
| Tenant Key | Single tenant | Client integrations |
| Read-Only | Read operations | Analytics, monitoring |

### Generating API Keys

```bash
# Generate secure API key
openssl rand -hex 32
# Output: 8f4b2c1e9d3a7f6b5c4e3d2a1b9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1

# Add to environment
MEMORY_API_KEY=8f4b2c1e9d3a7f6b5c4e3d2a1b9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1

# Configure in .env
echo "MEMORY_API_KEY=$(openssl rand -hex 32)" >> .env

# Restart to apply
docker compose restart memory-api
```

### API Key Configuration

```bash
# Multiple API keys (comma-separated)
API_KEYS=key1,key2,key3

# Each key has the same permissions
# Consider separate keys for:
# - Production services
# - Development/testing
# - Third-party integrations
```

### Rotating API Keys

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)

# 2. Add to .env (keep old key temporarily)
API_KEYS=$OLD_KEY,$NEW_KEY

# 3. Restart services
docker compose restart memory-api

# 4. Update all clients to use new key

# 5. Remove old key
API_KEYS=$NEW_KEY

# 6. Restart again
docker compose restart memory-api
```

### API Key Security Best Practices

1. **Never commit keys to version control**
2. **Use environment variables only**
3. **Rotate keys every 90 days**
4. **Use separate keys per environment**
5. **Monitor key usage for anomalies**
6. **Revoke compromised keys immediately**

---

## System Monitoring

### Health Endpoints

```bash
# Basic health
curl https://memory.velocitydigi.com/health

# Detailed health (requires auth)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/health/detailed
```

### Detailed Health Response

```json
{
  "status": "healthy",
  "services": {
    "weaviate": {
      "status": "up",
      "memory_mb": 77
    },
    "redis": {
      "status": "up",
      "memory_mb": 21
    },
    "ollama": {
      "status": "not_configured"
    },
    "embedding_model": {
      "status": "loaded",
      "memory_mb": 350,
      "model": "nomic-embed-text-v1.5"
    }
  },
  "maintenance_queue": {
    "pending": 0,
    "running": 0,
    "scheduler_running": true
  },
  "resource_usage": {
    "total_model_ram_mb": 350,
    "budget_mb": 3072,
    "headroom_mb": 2722
  }
}
```

### Analytics Endpoints

```bash
# Memory growth
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://memory.velocitydigi.com/analytics/memory-growth?period=daily"

# Activity timeline
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://memory.velocitydigi.com/analytics/activity-timeline?year=2026"

# Search statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/analytics/search-stats

# System metrics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/analytics/system-metrics

# Knowledge graph statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/analytics/knowledge-graph-stats
```

### Monitoring Dashboard

Access the monitoring dashboard at:
```
https://memory.velocitydigi.com/dashboard
```

Key metrics displayed:
- Total memories by tier
- Search query volume
- API response times
- Error rates
- Resource utilization

### Alerting Configuration

Set up alerts for critical metrics:

```bash
#!/bin/bash
# alert-check.sh

# Memory usage alert
MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemPerc}}" engram-memory-api | tr -d '%')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
  echo "ALERT: Memory API memory usage at ${MEMORY_USAGE}%"
  # Send notification
fi

# Error rate alert
ERROR_RATE=$(curl -s http://localhost:8000/analytics/system-metrics | jq '.error_rate')
if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
  echo "ALERT: Error rate at ${ERROR_RATE}%"
  # Send notification
fi

# Disk usage alert
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "ALERT: Disk usage at ${DISK_USAGE}%"
  # Send notification
fi
```

---

## Security Administration

### Security Checklist

- [ ] Admin password is strong (16+ characters)
- [ ] JWT_SECRET is unique and secure (32+ characters)
- [ ] API keys are rotated every 90 days
- [ ] TLS 1.3 is enforced
- [ ] Tailscale ACLs are configured
- [ ] Rate limiting is enabled
- [ ] Audit logging is enabled
- [ ] Backups are encrypted
- [ ] Unused ports are closed
- [ ] Container security options are set

### Rate Limiting Configuration

Rate limiting is configured in the Memory API:

```python
# Default: 60 requests per minute
@limiter.limit("60/minute")
async def endpoint():
    pass

# Configure in .env
RATE_LIMIT_PER_MINUTE=60
```

### IP Access Control

```nginx
# nginx.conf - Restrict admin endpoints
location /admin {
    allow 100.0.0.0/8;  # Tailscale only
    deny all;
    proxy_pass http://memory-api;
}
```

### Security Headers

```nginx
# nginx.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

### Security Audit

```bash
#!/bin/bash
# security-audit.sh

echo "=== Security Audit ==="

# Check for exposed ports
echo "Checking exposed ports..."
docker compose ps --format "table {{.Name}}\t{{.Ports}}"

# Verify no public IPs
echo "Checking for public IP bindings..."
grep -r "0.0.0.0" /opt/engram/Engram-Platform/*.yml && echo "WARNING: Public IP binding found"

# Check container security
echo "Checking container security options..."
docker inspect --format '{{.Name}}: {{.HostConfig.SecurityOpt}}' $(docker ps -q)

# Verify TLS
echo "Checking TLS configuration..."
curl -vI https://memory.velocitydigi.com 2>&1 | grep -E "SSL|TLS"

# Check for outdated dependencies
echo "Checking for outdated packages..."
docker compose run --rm memory-api pip list --outdated

echo "=== Audit Complete ==="
```

---

## Backup and Recovery

### Backup Schedule

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| Full System | Weekly | 30 days | S3 + Local |
| Weaviate Data | Daily | 14 days | S3 + Local |
| Redis Data | Every 6 hours | 7 days | Local |
| Configuration | On change | 90 days | Git |

### Manual Backup

```bash
# Create full backup
/opt/engram/scripts/full-backup.sh

# Backup specific tenant
curl -X POST https://memory.velocitydigi.com/tenants/client-acme/backup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Recovery Procedures

#### Full System Recovery

```bash
# 1. Stop services
docker compose down

# 2. Restore volumes
LATEST_BACKUP=$(ls -t /opt/engram/backups/full/*.tar.gz | head -1)
tar -xzf "$LATEST_BACKUP" -C /tmp/

# 3. Restore Docker volumes
docker run --rm -v engram_weaviate_data:/data -v /tmp/backup:/backup \
  alpine sh -c "rm -rf /data/* && tar -xzf /backup/weaviate-data.tar.gz -C /data"

# 4. Restore configuration
cp /tmp/backup/.env /opt/engram/Engram-Platform/.env

# 5. Start services
docker compose up -d

# 6. Verify
curl https://memory.velocitydigi.com/health
```

#### Tenant Recovery

```bash
# Restore specific tenant from backup
# Requires tenant-specific backup files
```

---

## Audit Logging

### Audit Events

| Event Type | Description | Logged Data |
|------------|-------------|-------------|
| AUTH_LOGIN | User login | User ID, IP, timestamp |
| AUTH_LOGOUT | User logout | User ID, timestamp |
| AUTH_FAIL | Failed auth | IP, reason, timestamp |
| TENANT_CREATE | Tenant created | Tenant ID, admin ID |
| TENANT_DELETE | Tenant deleted | Tenant ID, admin ID |
| MEMORY_ADD | Memory stored | Memory ID, tenant, tier |
| MEMORY_DELETE | Memory deleted | Memory ID, admin ID |
| API_KEY_ROTATE | Key rotated | Key ID, admin ID |
| CONFIG_CHANGE | Config modified | Change details |

### Accessing Audit Logs

```bash
# View recent audit events
docker compose logs memory-api | grep -i "audit"

# Search for specific events
docker compose logs memory-api | grep "TENANT_DELETE"

# Export audit logs
docker compose logs memory-api > audit-$(date +%Y%m%d).log
```

### Audit Log Format

```json
{
  "timestamp": "2026-03-02T10:30:00Z",
  "event_type": "TENANT_DELETE",
  "user_id": "admin",
  "tenant_id": "client-acme",
  "ip_address": "100.118.170.115",
  "user_agent": "curl/7.88.1",
  "details": {
    "reason": "Contract termination"
  }
}
```

---

## Compliance and Governance

### Data Retention Policy

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Active Memories | Until deleted | API delete |
| Expired Memories | Auto-deleted | Cleanup job |
| Audit Logs | 1 year | Automated purge |
| Backups | 30 days | Automated purge |

### GDPR Compliance

For GDPR compliance, implement:

1. **Right to Access**: Export all tenant data
```bash
curl -X GET "https://memory.velocitydigi.com/tenants/{tenant_id}/export" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

2. **Right to Erasure**: Delete tenant and all data
```bash
curl -X DELETE "https://memory.velocitydigi.com/tenants/{tenant_id}" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

3. **Data Portability**: Export in standard format
```bash
curl -X GET "https://memory.velocitydigi.com/tenants/{tenant_id}/export?format=json" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Compliance Checklist

- [ ] Data processing agreement in place
- [ ] Privacy policy published
- [ ] Consent mechanism implemented
- [ ] Data export functionality tested
- [ ] Data deletion functionality tested
- [ ] Audit logging enabled
- [ ] Backup encryption verified
- [ ] Access controls documented

---

## Administrative Commands Reference

### Service Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart memory-api

# View service logs
docker compose logs -f memory-api

# Check service status
docker compose ps

# Execute command in container
docker compose exec memory-api /bin/bash
```

### Memory Operations

```bash
# Get system statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/stats

# Run memory cleanup
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/memories/cleanup

# Run memory consolidation
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/memories/consolidate

# Trigger decay calculation
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/memories/decay
```

### Tenant Operations

```bash
# List tenants
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/tenants

# Create tenant
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "new-client"}' \
  https://memory.velocitydigi.com/tenants

# Delete tenant
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://memory.velocitydigi.com/tenants/old-client
```

### Database Operations

```bash
# Check Weaviate status
curl http://localhost:8080/v1/.well-known/ready

# Check Redis status
docker compose exec memory-redis redis-cli ping

# Get Weaviate object count
curl "http://localhost:8080/v1/objects?limit=0" | jq '.totalResults'

# Clear Redis cache (CAUTION)
docker compose exec memory-redis redis-cli FLUSHALL
```

---

## Emergency Procedures

### Incident Response Flowchart

```
┌─────────────────────┐
│   Incident Detected │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Assess Severity   │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│ Critical│ │  High   │
└────┬────┘ └────┬────┘
     │           │
     ▼           ▼
┌─────────────────────┐
│  Notify Stakeholders│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Isolate Problem   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Apply Fix         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Verify Recovery   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Document Incident │
└─────────────────────┘
```

### Emergency Contacts

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| Primary Admin | admin@velocitydigi.com | Immediate |
| Backup Admin | backup@velocitydigi.com | 15 minutes |
| Security Team | security@velocitydigi.com | 30 minutes |
| Infrastructure | infra@velocitydigi.com | 1 hour |

### Emergency Shutdown

```bash
#!/bin/bash
# emergency-shutdown.sh

echo "=== EMERGENCY SHUTDOWN ==="

# 1. Stop accepting new requests
docker compose exec nginx nginx -s stop

# 2. Gracefully stop services
docker compose down --timeout 60

# 3. Verify all stopped
docker compose ps

# 4. Create emergency backup
/opt/engram/scripts/full-backup.sh

echo "=== SHUTDOWN COMPLETE ==="
```

### Emergency Recovery

```bash
#!/bin/bash
# emergency-recovery.sh

echo "=== EMERGENCY RECOVERY ==="

# 1. Check data integrity
docker volume ls | grep engram

# 2. Start infrastructure first
docker compose up -d weaviate memory-redis crawler-redis
sleep 30

# 3. Start application services
docker compose up -d memory-api crawler-api mcp-server platform-frontend
sleep 30

# 4. Start nginx
docker compose up -d nginx

# 5. Verify
curl -sf http://localhost:8000/health || {
  echo "RECOVERY FAILED"
  exit 1
}

echo "=== RECOVERY COMPLETE ==="
```

---

**Document Control**
| Author | Review Date | Next Review |
|--------|-------------|-------------|
| Engram Team | March 2026 | September 2026 |
