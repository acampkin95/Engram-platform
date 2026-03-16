# Engram Platform Deployment Manual

**Version:** 1.0.0
**Last Updated:** March 2026
**Classification:** Internal Operations Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Requirements](#infrastructure-requirements)
4. [Environment Configuration](#environment-configuration)
5. [Docker Deployment](#docker-deployment)
6. [Production Deployment](#production-deployment)
7. [Tailscale Network Configuration](#tailscale-network-configuration)
8. [SSL/TLS Configuration](#ssltls-configuration)
9. [Service Orchestration](#service-orchestration)
10. [Health Checks and Verification](#health-checks-and-verification)
11. [Rollback Procedures](#rollback-procedures)
12. [Security Hardening](#security-hardening)

---

## Overview

The Engram Platform is a multi-layer AI memory and intelligence platform consisting of four interconnected subprojects:

- **Engram-AiMemory**: Python FastAPI vector memory system with Weaviate
- **Engram-AiCrawler**: Python FastAPI OSINT crawler with React frontend
- **Engram-MCP**: TypeScript Model Context Protocol server
- **Engram-Platform**: Next.js 15 unified dashboard

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX Reverse Proxy                       │
│                    (SSL Termination, Load Balancing)            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Platform     │   │  Memory API   │   │  Crawler API  │
│  Frontend     │   │  (FastAPI)    │   │  (FastAPI)    │
│  (Next.js)    │   │  Port: 8000   │   │  Port: 11235  │
│  Port: 3002   │   └───────┬───────┘   └───────┬───────┘
└───────────────┘           │                   │
                            │                   │
        ┌───────────────────┼───────────────────┤
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  MCP Server   │   │   Weaviate    │   │    Redis      │
│  (TypeScript) │   │   (Vector)    │   │   (Cache)     │
│  Port: 3000   │   │  Port: 8080   │   │   Port: 6379  │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## Prerequisites

### Software Requirements

| Component | Version | Purpose |
|-----------|---------|---------|
| Docker | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Multi-container orchestration |
| Node.js | 20.x LTS | Frontend build |
| Python | 3.11+ | Backend services |
| Tailscale | Latest | VPN mesh networking |

### Access Requirements

- Root SSH access to deployment servers
- Tailscale network membership
- SSL certificates (Let's Encrypt or custom)
- API keys for external services (OpenAI, Clerk, etc.)

---

## Infrastructure Requirements

### Minimum Hardware Specifications

| Service | CPU | RAM | Storage | Network |
|---------|-----|-----|---------|---------|
| Memory API | 1 core | 1GB | 10GB | 1Gbps |
| Crawler API | 2 cores | 3GB | 50GB | 1Gbps |
| Weaviate | 1 core | 2GB | 100GB | 1Gbps |
| Redis (x2) | 0.5 core | 1GB | 10GB | 1Gbps |
| MCP Server | 0.5 core | 512MB | 5GB | 1Gbps |
| Platform Frontend | 0.5 core | 512MB | 5GB | 1Gbps |
| Nginx | 0.5 core | 256MB | 5GB | 1Gbps |

**Total Minimum**: 6 cores, 8.25GB RAM, 185GB storage

### Recommended Production Specifications

| Service | CPU | RAM | Storage |
|---------|-----|-----|---------|
| Memory API | 2 cores | 2GB | 20GB |
| Crawler API | 4 cores | 4GB | 100GB |
| Weaviate | 2 cores | 4GB | 500GB SSD |
| Redis (x2) | 1 core | 2GB | 20GB |
| MCP Server | 1 core | 1GB | 10GB |
| Platform Frontend | 1 core | 1GB | 10GB |
| Nginx | 1 core | 512MB | 10GB |

**Total Recommended**: 12 cores, 16.5GB RAM, 670GB SSD

### Target Profile: i5 / 16GB / 1TB

Use the tuned `Engram-Platform/docker-compose.yml` profile when deploying to the approved i5/16GB/1TB host class. The current compose target reduces the stack to roughly 8.5GB total memory by using:

- `crawler-api` 2G limit with 2GB Chromium shared memory
- `memory-api` 512M limit
- `weaviate` 1536M limit with `GOMEMLIMIT=1.2GiB` and `CACHE_SIZE=384MB`
- `crawler-redis` 512M limit / `384mb` maxmemory
- `memory-redis` 384M limit / `256mb` maxmemory
- `mcp-server` 256M limit
- `platform-frontend` 256M limit
- `nginx` 128M limit

This profile is the default release target unless host telemetry justifies larger limits.

---

## Unified Deployment Entry Point

All deployment is managed through a single script at the repository root:

```bash
./scripts/deploy-unified.sh <command>
```

### First-Time Setup

```bash
./scripts/deploy-unified.sh init
```

This runs the interactive environment wizard, builds all services, and verifies health. It will:
1. Create `Engram-Platform/.env` from `.env.example` if missing
2. Prompt for required secrets (Clerk keys, JWT secret, embedding API key)
3. Auto-generate secure defaults where possible
4. Build and start the Docker stack
5. Run health checks against all services

### Interactive Environment Configuration

```bash
./scripts/deploy-unified.sh setup
```

Walks through each required variable interactively. Existing values are preserved; only missing or placeholder values are prompted. Supports:
- Auto-generation of JWT secrets and MCP tokens
- Secret masking during input
- Tailscale hostname and bind address configuration
- Embedding provider selection

### Production Deployment

```bash
./scripts/deploy-unified.sh deploy              # full deploy with pre-flight
./scripts/deploy-unified.sh deploy --dry-run    # validate without changes
./scripts/deploy-unified.sh health              # check all endpoints
```

Pre-flight checks validate Docker availability, `.env` existence, required secrets, and compose config before any containers are touched.

### Docker Compose Reference

The master orchestration file is `Engram-Platform/docker-compose.yml`. The MCP service builds from `Engram-MCP/docker/Dockerfile` (the canonical MCP server with OAuth 2.1, Zod validation, and 381 tests).

---

## Environment Configuration

### Environment File Structure

Create the `.env` file in `Engram-Platform/`, or use the interactive wizard (`./scripts/deploy-unified.sh setup`):

#### Root Environment (`/Engram-Platform/.env`)

```bash
# =============================================================================
# CORE SERVICES
# =============================================================================
JWT_SECRET=your-secure-jwt-secret-min-32-characters
MEMORY_API_KEY=your-memory-api-key
MCP_AUTH_TOKEN=your-mcp-auth-token

# =============================================================================
# EMBEDDING PROVIDER CONFIGURATION
# =============================================================================
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Alternative: DeepInfra
# EMBEDDING_PROVIDER=deepinfra
# DEEPINFRA_API_KEY=your-deepinfra-key

# Alternative: Local (mock embeddings)
# EMBEDDING_PROVIDER=local

# =============================================================================
# AUTHENTICATION (Clerk)
# =============================================================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_CLERK_DOMAIN=clerk.velocitydigi.com
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# =============================================================================
# APPLICATION URLS
# =============================================================================
NEXT_PUBLIC_APP_URL=https://memory.velocitydigi.com
NEXT_PUBLIC_MEMORY_API_KEY=your-public-api-key
CORS_ORIGINS=https://memory.velocitydigi.com,https://engram.velocitydigi.com

# =============================================================================
# ADMIN CREDENTIALS
# =============================================================================
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=your-bcrypt-hash

# =============================================================================
# BIND CONFIGURATION (Tailscale)
# =============================================================================
MEMORY_API_BIND=0.0.0.0
BIND_ADDRESS=127.0.0.1
TAILSCALE_HOSTNAME=dv-syd-host01.icefish-discus.ts.net
```

### Generating Secure Secrets

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate API keys
openssl rand -hex 32

# Generate bcrypt password hash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"
```

---

## Docker Deployment

### Quick Start (Development)

```bash
# Clone repository
git clone <repository-url> /opt/engram
cd /opt/engram/Engram-Platform

# Copy environment template
cp .env.example .env

# Edit environment variables
vim .env

# Start all services
docker compose up -d

# View logs
docker compose logs -f
```

### Building Images

```bash
# Build all images
docker compose build

# Build specific service
docker compose build memory-api
docker compose build crawler-api
docker compose build mcp-server
docker compose build platform-frontend

# Build with no cache
docker compose build --no-cache
```

### Image Details

| Image Name | Base | Size | Build Context |
|------------|------|------|---------------|
| `engram-memory-api` | python:3.12-slim | ~400MB | Engram-AiMemory |
| `crawl4ai-engram` | python:3.11-slim | ~800MB | Engram-AiCrawler/01_devroot |
| `engram-mcp-server` | node:20-alpine | ~150MB | Engram-AiMemory |
| `engram-platform-frontend` | node:20-alpine | ~200MB | Engram-Platform/frontend |

---

## Production Deployment

Use `plans/2026-03-11-release-checklist.md` as the authoritative pre-release, deployment, smoke-test, and rollback checklist. The manual below provides background and detailed procedures; the checklist is the release gate.

### Step 1: Prepare Infrastructure

```bash
# SSH into production server
ssh root@acdev-node01.tail4da6b7.ts.net

# Create deployment directory
mkdir -p /opt/engram
cd /opt/engram

# Clone repository
git clone <repository-url> .

# Install Docker if not present
curl -fsSL https://get.docker.com | sh
```

### Step 2: Configure Tailscale

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate with auth key
tailscale up --authkey=tskey-auth-xxx

# Verify connectivity
tailscale status
tailscale ping acdev-node02.tail4da6b7.ts.net
```

### Step 3: Deploy Services

```bash
# Navigate to platform directory
cd /opt/engram/Engram-Platform

# Create environment file
cat > .env << 'EOF'
# Production configuration
JWT_SECRET=$(openssl rand -base64 32)
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
# ... (full configuration)
EOF

# Pull images or build
docker compose pull || docker compose build

# Start services
docker compose up -d

# Verify health
docker compose ps
curl http://localhost:8000/health
```

### Step 4: Configure Nginx

```nginx
# /etc/nginx/conf.d/engram.conf

upstream memory_api {
    server 127.0.0.1:8000;
    keepalive 32;
}

upstream crawler_api {
    server 127.0.0.1:11235;
    keepalive 32;
}

upstream platform_frontend {
    server 127.0.0.1:3002;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name memory.velocitydigi.com engram.velocitydigi.com;

    ssl_certificate /etc/letsencrypt/live/velocitydigi.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/velocitydigi.com/privkey.pem;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Memory API
    location /api/ {
        proxy_pass http://memory_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 300s;
    }

    # Crawler API
    location /crawler/ {
        proxy_pass http://crawler_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 600s;
    }

    # Platform Frontend
    location / {
        proxy_pass http://platform_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# HTTP redirect
server {
    listen 80;
    server_name memory.velocitydigi.com engram.velocitydigi.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Tailscale Network Configuration

### Network Architecture

The Engram Platform operates exclusively over Tailscale mesh VPN for security. No public IP exposure is permitted in production.

### Server Configuration

| Hostname | Tailscale IP | Role |
|----------|--------------|------|
| acdev-vmi02d | 100.77.216.28 | Data VPS |
| acdev-node01 | 100.118.170.115 | Docker Swarm Node |
| acdev-node02 | 100.86.129.15 | Docker Swarm Node |
| acdev-devnode | 100.86.129.15 | Development Server |

### Access Control Lists (ACLs)

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:engram-admin"],
      "dst": ["tag:engram-server:*"]
    },
    {
      "action": "accept",
      "src": ["tag:engram-server"],
      "dst": ["tag:engram-server:*"]
    }
  ],
  "tagOwners": {
    "tag:engram-admin": ["autogroup:admin"],
    "tag:engram-server": ["autogroup:admin"]
  }
}
```

### SSH Configuration

```bash
# ~/.ssh/config
Host acdev-node01 node01
    HostName acdev-node01.tail4da6b7.ts.net
    User root
    IdentityFile ~/.ssh/tailscale_ed25519
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 600
```

---

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d memory.velocitydigi.com -d engram.velocitydigi.com

# Auto-renewal
certbot renew --dry-run
```

### Custom Certificates

```bash
# Place certificates
mkdir -p /opt/engram/Engram-Platform/certs
cp /path/to/fullchain.pem certs/
cp /path/to/privkey.pem certs/

# Set permissions
chmod 600 certs/privkey.pem
```

---

## Service Orchestration

### Docker Compose Commands

```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up -d memory-api

# View logs
docker compose logs -f memory-api
docker compose logs --tail=100 crawler-api

# Restart service
docker compose restart memory-api

# Scale service (if supported)
docker compose up -d --scale crawler-api=2

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Service Dependencies

```
crawler-api
    └── crawler-redis (healthy)
    └── memory-api (healthy)

memory-api
    └── weaviate (healthy)
    └── memory-redis (healthy)

mcp-server
    └── memory-api (healthy)

platform-frontend
    └── (no dependencies, uses runtime env vars)

nginx
    └── crawler-api
    └── memory-api
    └── platform-frontend
```

---

## Health Checks and Verification

### Automated Health Checks

Each service has built-in health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-sf", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

### Manual Verification

```bash
# Check all services
docker compose ps

# Memory API health
curl http://localhost:8000/health
curl http://localhost:8000/health/detailed

# Crawler API health
curl http://localhost:11235/

# MCP Server health
curl http://localhost:3000/health

# Weaviate health
curl http://localhost:8080/v1/.well-known/ready

# Redis connectivity
docker compose exec memory-redis redis-cli ping
```

### Integration Tests

```bash
# Run end-to-end test
curl -X POST http://localhost:8000/memories \
  -H "Authorization: Bearer $MEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test memory for deployment verification",
    "tier": 1,
    "project_id": "deployment-test"
  }'

# Search the created memory
curl -X POST http://localhost:8000/memories/search \
  -H "Authorization: Bearer $MEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "deployment verification"}'
```

---

## Rollback Procedures

### Quick Rollback

```bash
# Stop current deployment
docker compose down

# Checkout previous version
git checkout v1.0.0  # or specific commit

# Rebuild and restart
docker compose build
docker compose up -d
```

### Database Rollback

```bash
# Backup before rollback
docker compose exec weaviate \
  curl -X GET http://localhost:8080/v1/schema > schema-backup.json

# Restore Weaviate data from backup
# (depends on backup strategy - S3, local snapshot, etc.)
```

### Configuration Rollback

```bash
# Keep versioned config
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# Restore previous config
cp .env.backup-20260301-120000 .env
docker compose up -d --force-recreate
```

---

## Security Hardening

### Container Security

All containers use security hardening:

```yaml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp:size=64m
```

### Network Isolation

```yaml
networks:
  engram-platform-network:
    driver: bridge
    internal: false  # Allows external access via nginx only
```

### Secret Management

```bash
# Never commit secrets
echo ".env" >> .gitignore
echo "*.pem" >> .gitignore
echo "*_key*" >> .gitignore

# Use Docker secrets in production
echo "jwt_secret" | docker secret create jwt_secret -
```

### Firewall Rules

```bash
# UFW configuration
ufw default deny incoming
ufw default allow outgoing
ufw allow from 100.0.0.0/8 to any port 22  # Tailscale SSH
ufw allow from 100.0.0.0/8 to any port 443 # Tailscale HTTPS
ufw enable
```

---

## Appendix: Common Deployment Commands

```bash
# Full deployment sequence
docker compose down -v && \
docker compose build --no-cache && \
docker compose up -d && \
docker compose logs -f

# Service-specific restart with logs
docker compose restart memory-api && docker compose logs -f memory-api

# Check resource usage
docker stats --no-stream

# Clean up unused resources
docker system prune -af --volumes

# Export logs for debugging
docker compose logs > deployment-$(date +%Y%m%d).log
```

---

**Document Control**
| Author | Review Date | Next Review |
|--------|-------------|-------------|
| Engram Team | March 2026 | September 2026 |
