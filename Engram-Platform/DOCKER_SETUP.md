# Engram-Platform Docker Compose Setup

## Overview

This unified Docker Compose orchestration manages the complete Engram-Platform stack:
- **Crawler API** (Crawl4AI with Engram addon)
- **Memory API** (Python vector memory system)
- **Weaviate** (vector database)
- **Redis** (separate instances for crawler and memory)
- **MCP Server** (Model Context Protocol, optional)
- **Platform Frontend** (Next.js web UI)
- **Nginx** (reverse proxy)

## Quick Start

### 1. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env with your actual values
```

### 2. Start All Services

```bash
docker compose up -d
```

### 3. Verify Services

```bash
docker compose ps
docker compose logs -f
```

### 4. Access the Platform

- **Frontend**: http://localhost:3002
- **Crawler API**: http://localhost/api/crawler/
- **Memory API**: http://localhost/api/memory/
- **Health Check**: http://localhost/health

## Service Architecture

### Network
- **Single shared network**: `engram-platform-network`
- All services communicate via service names (e.g., `http://memory-api:8000`)

### Volumes (All Prefixed)

**Crawler volumes** (`crawler_*`):
- `crawler_cache` — HTTP cache
- `crawler_logs` — Application logs
- `crawler_hot`, `crawler_warm`, `crawler_cold`, `crawler_archive` — Data tiers
- `crawler_chroma_data` — ChromaDB persistence
- `crawler_supervisor` — Supervisor logs
- `crawler_redis_data` — Redis persistence

**Memory volumes** (`memory_*`):
- `memory_redis_data` — Redis persistence
- `weaviate_data` — Vector database persistence

### Service Dependencies

```
nginx
├── crawler-api
│   ├── crawler-redis (healthy)
│   └── memory-api (healthy)
├── memory-api
│   ├── weaviate (healthy)
│   └── memory-redis (healthy)
└── platform-frontend
```

## Nginx Reverse Proxy Routes

| Path | Target | Purpose |
|------|--------|---------|
| `/api/crawler/*` | crawler-api:11235 | Crawl4AI API |
| `/api/memory/*` | memory-api:8000 | Memory API |
| `/ws` | crawler-api:11235/ws | WebSocket for crawl progress |
| `/mcp` | mcp-server:3000 | Model Context Protocol (optional) |
| `/` | platform-frontend:3000 | Frontend (catch-all) |
| `/health` | Nginx | Health check endpoint |

## Environment Variables

### Critical Variables

- `ENGRAM_ENABLED=true` — Enable Engram addon in crawler
- `ENGRAM_API_URL=http://memory-api:8000` — Memory API endpoint (Docker service name)
- `OPENAI_API_KEY` — For embeddings
- `EMBEDDING_PROVIDER=openai` — Embedding service

### Optional Variables

- `MCP_AUTH_TOKEN` — MCP server authentication
- `OLLAMA_HOST` — For local LLM inference
- `LM_STUDIO_URL` — For RAG/chat features

See `.env.example` for complete list.

## Common Commands

```bash
# View logs
docker compose logs -f crawler-api
docker compose logs -f memory-api
docker compose logs -f nginx

# Execute commands in containers
docker compose exec memory-api curl http://localhost:8000/health
docker compose exec crawler-api curl http://localhost:11235/health

# Restart a service
docker compose restart memory-api

# Scale a service
docker compose up -d --scale crawler-api=2

# Stop all services
docker compose down

# Remove volumes (WARNING: data loss)
docker compose down -v

# View resource usage
docker compose stats
```

## Troubleshooting

### Services not starting

```bash
# Check logs
docker compose logs

# Verify configuration
docker compose config --quiet

# Check service health
docker compose ps
```

### Memory API connection issues

Ensure `ENGRAM_API_URL=http://memory-api:8000` in crawler environment.
Service names resolve within the Docker network automatically.

### Port conflicts

If port 80 is in use:
```yaml
# In docker-compose.yml, change nginx ports:
ports:
  - "8080:80"  # Access via http://localhost:8080
```

### Weaviate not ready

Weaviate takes time to initialize. Check logs:
```bash
docker compose logs weaviate
```

## Production Considerations

1. **SSL/TLS**: Add certificates to Nginx (not included in this setup)
2. **Rate Limiting**: Configure in Nginx if needed
3. **Resource Limits**: Set `deploy.resources.limits` for each service
4. **Backup**: Regular backups of `weaviate_data` and Redis volumes
5. **Monitoring**: Add Prometheus/Grafana for observability

## File Structure

```
Engram-Platform/
├── docker-compose.yml      # Main orchestration
├── .env.example            # Environment template
├── nginx/
│   └── nginx.conf          # Reverse proxy config
├── frontend/               # Next.js frontend
└── DOCKER_SETUP.md         # This file
```

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Reverse Proxy Guide](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Weaviate Docker Setup](https://weaviate.io/developers/weaviate/installation/docker-compose)
