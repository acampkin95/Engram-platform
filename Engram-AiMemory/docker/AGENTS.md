<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Docker Directory

## Purpose

Container definitions and orchestration for memory system. Dockerfiles for Memory API, MCP server (legacy), and dashboard (legacy). Compose files for local development, testing, and production deployments with Weaviate, Redis, and nginx.

## Key Files

| File | Description |
|------|-------------|
| `Dockerfile.memory-api` | Python 3.11 slim image, FastAPI uvicorn server on :8000 |
| `Dockerfile.mcp-server` | Node 20 image for MCP server (no longer canonical — see Engram-MCP) |
| `Dockerfile.dashboard` | Legacy dashboard (no longer canonical — see Engram-Platform) |
| `docker-compose.yml` | Local dev compose (weaviate, redis, memory-api, nginx) |
| `docker-compose.prod.yml` | Production-grade compose (resource limits, healthchecks, restart policies) |
| `nginx.conf` | Reverse proxy config (routes to memory-api, mcp, dashboard) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `traefik/` | Traefik reverse proxy config (alternative to nginx) |

## For AI Agents

### Working In This Directory

- **Local dev**: `docker compose -f docker-compose.yml up -d` (starts weaviate, redis, memory-api on :8000)
- **Production**: `docker compose -f docker-compose.prod.yml up -d` (adds resource limits, healthchecks)
- **Logs**: `docker compose logs -f memory-api` (tail specific service)
- **Health**: `curl http://localhost:8000/health` (memory-api endpoint)
- **Stop**: `docker compose down` (removes containers and networks)

### Testing Requirements

- Docker daemon running
- Port 8000 (memory-api), 8080 (weaviate), 6379 (redis) available
- `.env` file with settings (see `.env.example`)
- `docker-compose.test.yml` in root for unit test isolation

### Common Patterns

- **Multi-stage builds**: Dockerfile.memory-api reduces image size (install → copy → run)
- **Health checks**: Memory-api has HTTP health check (port 8000/health)
- **Volumes**: Weaviate and Redis use named volumes for persistence
- **Environment**: Services inherit from `.env` file
- **Networks**: Internal bridge network for service-to-service communication
- **Restart policy**: `unless-stopped` for production (auto-recover on crash)

## Dependencies

### Internal

- `Engram-AiMemory/packages/core/`: Memory API source (copied in build)
- `Engram-MCP/`: MCP server (legacy in this directory, canonical source is Engram-MCP)
- `Engram-Platform/`: Dashboard (legacy in this directory, canonical source is Engram-Platform)

### External

**Dockerfiles**:
- `python:3.11-slim`: Base image for Memory API
- `node:20`: Base image for MCP server (legacy)
- `node:20`: Base image for dashboard (legacy)
- `weaviate/weaviate:1.25.0`: Vector database service
- `redis:7-alpine`: Cache service
- `nginx:alpine`: Reverse proxy

**Services**:
- Weaviate: Vector database on port 8080
- Redis: Cache on port 6379
- Memory API: FastAPI on port 8000
- nginx: Reverse proxy on port 80 (routes to :8000, :8080, :6379)

<!-- MANUAL: -->
