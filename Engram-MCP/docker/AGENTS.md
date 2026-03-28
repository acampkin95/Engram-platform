<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# docker

Container configuration and orchestration.

## Key Files

| File | Description |
|------|-------------|
| `Dockerfile` | Multi-stage build — compiles TypeScript, copies dist, runs Node |
| `docker-compose.yml` | Local development compose (if any) |

## For AI Agents

### Working In This Directory

1. **Building Docker Image**
   ```bash
   docker build -f docker/Dockerfile -t engram-mcp:latest .
   ```

2. **Running Container**
   ```bash
   docker run -e JWT_SECRET=... -e MEMORY_API_URL=... \
     -p 3000:3000 engram-mcp:latest
   ```

3. **Dockerfile Best Practices**
   - Multi-stage: reduce final image size
   - Non-root user: security (if applicable)
   - Health check: `curl /health` or equivalent
   - Environment: Use `--build-arg` or runtime env vars

### Image Details

- Base: Node.js LTS (check Dockerfile)
- Build: TypeScript compilation
- Runtime: node dist/index.ts (HTTP transport by default)
- Health: GET /health endpoint
- Signals: SIGTERM triggers graceful shutdown

## For Deployment

- Image pushed to registry (if configured)
- Orchestrated by parent `Engram-Platform/docker-compose.yml`
- Environment: `.env` with JWT_SECRET, MEMORY_API_URL, OAuth settings
- Expose: Port 3000 (HTTP) or stdio (default)

<!-- MANUAL: -->
