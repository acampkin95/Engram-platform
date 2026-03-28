<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Scripts Directory

## Purpose

Deployment, testing, system management, and infrastructure scripts. Bash automation for building Docker images, deploying to servers, running health checks, and end-to-end testing of the memory system.

## Key Files

| File | Description |
|------|-------------|
| `deploy.sh` | Quick deployment script (Docker build, push to registry, restart services) |
| `deploy-server.sh` | Server-side deployment (SSH to remote, pull images, compose up) |
| `deploy-full.sh` | Full stack deployment (dependencies, environment, Docker compose orchestration) |
| `healthcheck.sh` | System health check (services up, endpoints responding, resource usage) |
| `manage.sh` | Service management (start, stop, restart, status, logs) |
| `validate-env.sh` | Validate environment configuration (.env file completeness) |
| `system-optimize.sh` | System optimization (cleanup, cache pruning, log rotation) |
| `ubuntu-install.sh` | Full Ubuntu system setup (dependencies, Docker, Python, etc.) |
| `e2e_test.py` | End-to-end integration test (crawl, parse, store, search full workflow) |
| `test-weaviate-integration.sh` | Weaviate integration test script |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `testing/` | Test utilities and fixtures |

## For AI Agents

### Working In This Directory

- **Make executable**: `chmod +x script.sh` before running
- **SSH required**: Most deploy scripts use Tailscale SSH (100.100.42.6, 100.78.187.5, etc.)
- **Environment setup**: Source `.env` before running (export API keys, secrets)
- **Logging**: Scripts use `set -x` for debug mode (export DEBUG=1)
- **Error handling**: Scripts exit on first error (set -e)

### Testing Requirements

- **Health checks**: `healthcheck.sh` validates endpoints respond
- **E2E tests**: `e2e_test.py` runs full workflow (requires running services)
- **Integration**: `test-weaviate-integration.sh` tests vector DB connectivity

### Common Patterns

- **Compose operations**: `docker compose up/down/logs/ps` for service management
- **SSH tunneling**: Tailscale IPs used for secure remote access (no public IP)
- **Environment loading**: Scripts source `.env` before executing
- **Error messages**: Echo to stderr (`>&2`) for debugging
- **Exit codes**: 0 success, 1+ failure (standard convention)
- **Lock files**: Some scripts use lock files to prevent concurrent execution

## Dependencies

### Internal

- `../docker/docker-compose.yml`: Service definitions
- `../.env`: Environment configuration
- `../Dockerfile.*`: Container build definitions

### External

**System tools**:
- `bash` (4.0+): Script interpreter
- `docker`, `docker compose`: Container orchestration
- `curl`, `wget`: HTTP requests (health checks)
- `jq`: JSON parsing (response validation)
- `ssh`, `scp`, `sftp`: Remote access (Tailscale)

**Python (for e2e_test.py)**:
- `requests`: HTTP client
- `python-dotenv`: Environment loading
- Standard library: os, sys, time, json

**Runtime dependencies**:
- Weaviate instance running (for integration tests)
- Redis instance running (for cache tests)
- Memory API service running (for e2e tests)

<!-- MANUAL: -->
