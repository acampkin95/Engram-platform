# Commands Quick Reference

**Version:** 1.0.0 | **Last Updated:** March 2026

---

## Docker Compose Commands

### Service Management

```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up -d memory-api

# Stop all services
docker compose down

# Stop with timeout (graceful)
docker compose down --timeout 60

# Restart service
docker compose restart memory-api

# Force recreate service
docker compose up -d --force-recreate memory-api

# View service status
docker compose ps

# View all logs
docker compose logs

# Follow specific service logs
docker compose logs -f memory-api

# View last N lines
docker compose logs --tail=100 memory-api
```

### Building

```bash
# Build all images
docker compose build

# Build specific service
docker compose build memory-api

# Build with no cache
docker compose build --no-cache

# Pull pre-built images
docker compose pull
```

### Execution

```bash
# Execute command in container
docker compose exec memory-api /bin/bash

# Run one-off command
docker compose exec memory-api curl http://weaviate:8080/v1/.well-known/ready

# Run as different user
docker compose exec --user root memory-api id
```

### Cleanup

```bash
# Remove stopped containers
docker compose rm

# Remove volumes
docker compose down -v

# Full cleanup
docker compose down -v --rmi local

# System-wide cleanup
docker system prune -af

# Remove unused volumes
docker volume prune -f

# Remove old images
docker image prune -af --filter "until=168h"
```

---

## Makefile Commands (Engram-AiMemory)

```bash
# Show all commands
make help

# Development
make dev                  # Start MCP server + dashboard

# Building
make build                # Build all packages

# Testing
make test                 # Run all tests
make test-python          # Python tests only
make test-ts              # TypeScript tests only

# Linting
make lint                 # Run all linters
make lint-fix             # Auto-fix lint issues
make format               # Format all code

# Docker
make docker-up            # Start Docker development stack
make docker-down          # Stop Docker development stack
make docker-logs          # Tail Docker logs
make docker-prod-up       # Start production stack
make docker-prod-down     # Stop production stack

# Utilities
make deploy               # Run deployment script
make clean                # Remove build artifacts
make install              # Install all dependencies
make health               # Check system health
```

---

## API Commands (curl)

### Health Endpoints

```bash
# Memory API health
curl http://localhost:8000/health

# Detailed health (auth required)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/health/detailed

# Weaviate ready check
curl http://localhost:8080/v1/.well-known/ready

# Crawler API health
curl http://localhost:11235/

# MCP Server health
curl http://localhost:3000/health
```

### Authentication

```bash
# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Refresh token
curl -X POST http://localhost:8000/auth/refresh \
  -H "Authorization: Bearer $TOKEN"
```

### Memory Operations

```bash
# Add memory
curl -X POST http://localhost:8000/memories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test memory",
    "tier": 1,
    "project_id": "test-project"
  }'

# Search memories
curl -X POST http://localhost:8000/memories/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 10}'

# List memories
curl "http://localhost:8000/memories/list?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Get memory by ID
curl "http://localhost:8000/memories/{id}?tier=1" \
  -H "Authorization: Bearer $TOKEN"

# Delete memory
curl -X DELETE "http://localhost:8000/memories/{id}?tier=1" \
  -H "Authorization: Bearer $TOKEN"

# Batch add memories
curl -X POST http://localhost:8000/memories/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memories": [{"content": "Memory 1"}, {"content": "Memory 2"}]}'
```

### Context & RAG

```bash
# Build context
curl -X POST http://localhost:8000/memories/context \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication patterns", "max_tokens": 2000}'

# RAG query
curl -X POST http://localhost:8000/memories/rag \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "How should I handle errors?"}'
```

### Maintenance

```bash
# Cleanup expired memories
curl -X POST http://localhost:8000/memories/cleanup \
  -H "Authorization: Bearer $TOKEN"

# Consolidate memories
curl -X POST http://localhost:8000/memories/consolidate \
  -H "Authorization: Bearer $TOKEN"

# Trigger decay calculation
curl -X POST http://localhost:8000/memories/decay \
  -H "Authorization: Bearer $TOKEN"
```

### Knowledge Graph

```bash
# Add entity
curl -X POST http://localhost:8000/graph/entities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Auth Module",
    "entity_type": "component",
    "description": "Handles authentication"
  }'

# List entities
curl "http://localhost:8000/graph/entities" \
  -H "Authorization: Bearer $TOKEN"

# Add relation
curl -X POST http://localhost:8000/graph/relations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_entity_id": "uuid-1",
    "target_entity_id": "uuid-2",
    "relation_type": "depends_on"
  }'

# Query graph
curl -X POST http://localhost:8000/graph/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "uuid-1", "depth": 2}'
```

### Tenant Management

```bash
# List tenants
curl http://localhost:8000/tenants \
  -H "Authorization: Bearer $TOKEN"

# Create tenant
curl -X POST http://localhost:8000/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "new-client"}'

# Delete tenant
curl -X DELETE http://localhost:8000/tenants/old-client \
  -H "Authorization: Bearer $TOKEN"
```

### Analytics

```bash
# Get stats
curl http://localhost:8000/stats \
  -H "Authorization: Bearer $TOKEN"

# Aggregate analytics
curl http://localhost:8000/analytics \
  -H "Authorization: Bearer $TOKEN"

# Memory growth
curl "http://localhost:8000/analytics/memory-growth?period=daily" \
  -H "Authorization: Bearer $TOKEN"

# System metrics
curl http://localhost:8000/analytics/system-metrics \
  -H "Authorization: Bearer $TOKEN"
```

---

## Redis Commands

```bash
# Connect to Redis
docker compose exec memory-redis redis-cli

# Ping test
docker compose exec memory-redis redis-cli ping

# Get memory info
docker compose exec memory-redis redis-cli INFO memory

# Get all keys
docker compose exec memory-redis redis-cli KEYS '*'

# Clear all data (CAUTION)
docker compose exec memory-redis redis-cli FLUSHALL

# Monitor commands
docker compose exec memory-redis redis-cli MONITOR

# Check slow log
docker compose exec memory-redis redis-cli SLOWLOG GET 10

# Get database size
docker compose exec memory-redis redis-cli DBSIZE
```

---

## Weaviate Commands

```bash
# Check ready status
curl http://localhost:8080/v1/.well-known/ready

# Get schema
curl http://localhost:8080/v1/schema

# Get meta info
curl http://localhost:8080/v1/meta

# Count objects
curl "http://localhost:8080/v1/objects?limit=0"

# Get objects by class
curl "http://localhost:8080/v1/objects?class=MemoryTier1&limit=10"

# Get single object
curl http://localhost:8080/v1/objects/MemoryTier1/uuid

# Delete object
curl -X DELETE http://localhost:8080/v1/objects/MemoryTier1/uuid
```

---

## Git Commands

```bash
# Clone repository
git clone <repo-url> /opt/engram

# Check status
git status

# Pull latest
git pull origin main

# Checkout specific version
git checkout v1.0.0

# View recent commits
git log --oneline -10

# Create deployment tag
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

---

## System Commands

```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top -bn1 | head -5

# Check container stats
docker stats --no-stream

# Check open ports
netstat -tlnp

# Check process
ps aux | grep memory-api

# Find process by port
lsof -i :8000

# Check logs
journalctl -u docker -f

# Check system load
uptime
```

---

## Tailscale Commands

```bash
# Check status
tailscale status

# Ping host
tailscale ping acdev-node01.tail4da6b7.ts.net

# Connect
tailscale up

# Disconnect
tailscale down

# Check IP
tailscale ip

# List peers
tailscale status --json | jq '.Peer'
```

---

## NPM Commands (Frontend)

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build
npm run build

# Production start
npm start

# Lint
npm run lint

# Test
npm run test
npm run test:run

# E2E tests
npm run test:e2e
```

---

## Python Commands

```bash
# Create virtual environment
python3 -m venv .venv

# Activate
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=memory_system

# Format code
ruff format .

# Lint
ruff check .

# Type check
mypy packages/core/src/memory_system/
```

---

## Quick Diagnostic Commands

```bash
# Full system check
docker compose ps && \
curl -sf http://localhost:8000/health && \
docker compose exec memory-redis redis-cli ping && \
curl -sf http://localhost:8080/v1/.well-known/ready && \
echo "All systems healthy"

# Check resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check logs for errors
docker compose logs 2>&1 | grep -i "error\|exception\|failed" | tail -20

# Check disk usage
df -h / && du -sh /var/lib/docker/*

# Network connectivity test
docker compose exec memory-api ping -c 3 weaviate && \
docker compose exec memory-api ping -c 3 memory-redis
```
