<!-- Generated: 2026-03-22 -->

# scripts/

## Purpose

Unified deployment and orchestration scripts. Single canonical entry point for service lifecycle, environment validation, health monitoring, backup, and release automation. Replaces six fragmented service-specific deploy scripts.

## Key Files

| File | Description |
|------|-------------|
| `deploy-unified.sh` | Master orchestration (v2.1.0) — interactive menu, service control, env setup |
| `quality-gate.sh` | Pre-commit verification — lint, test, coverage, bundle size checks |
| `release-smoke-test.sh` | Post-deployment verification — endpoint health, functional tests |
| `tests/` | Integration test suite (shell + curl tests) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `tests/` | Bash integration tests, Docker validation, health check examples |

## For AI Agents

### Working In This Directory

1. **deploy-unified.sh**
   - Entry point for all deployments (interactive, non-interactive, dry-run modes)
   - Uses `Engram-Platform/docker-compose.yml` (master file)
   - Supports environments: dev, staging, production
   - Always verify with `--dry-run` before executing on production

2. **quality-gate.sh**
   - Run this before pushing changes
   - Enforces linting, type checking, test coverage, bundle size
   - Exit code 0 = ready to commit, non-zero = fix issues
   - Configurable thresholds in script header

3. **release-smoke-test.sh**
   - Run after deployment to production
   - Validates all services are responding
   - Tests API endpoints with real payloads
   - Generates report in `./smoke-test-report.txt`

### Testing Requirements

- All scripts must pass `bash -n` (syntax check)
- All Docker Compose calls must validate with `docker compose config`
- All curl examples must work against mock HTTP server
- All file I/O must handle paths with spaces
- All environment variable references must be quoted

### Common Patterns

**Service control:**
```bash
# Always use docker compose with the master file
docker compose -f "${COMPOSE_FILE}" up -d
docker compose -f "${COMPOSE_FILE}" logs -f SERVICE_NAME
docker compose -f "${COMPOSE_FILE}" down
```

**Environment validation:**
- Check required vars with `[[ -z "${VAR}" ]]`
- Validate file existence before sourcing
- Use `set -euo pipefail` for error handling
- Log all commands in debug mode (`DEBUG=1`)

**Health checks:**
- Use `curl -f` (fail on HTTP error)
- Include timeouts: `-m 5` (5 seconds)
- Check response status and body content
- Retry with exponential backoff for transient failures

**Backup procedures:**
- Always create timestamped backups: `backup-$(date +%Y%m%d_%H%M%S).tar.gz`
- Store in `BACKUP_DIR` (configurable, default: `./backups/`)
- Include rotation policy (keep last 30 days)

## Dependencies

### Internal
- Master compose file: `Engram-Platform/docker-compose.yml`
- Environment template: `Engram-Platform/.env.example`
- All subproject Makefiles (for `make test`, `make lint`, etc.)
- Documented in `docs/00-index.md` (reference section)

### External
- Docker Engine 24.0+
- Docker Compose 2.20+
- bash 4.0+
- curl (for health checks)
- jq (for JSON parsing, optional)

<!-- MANUAL: Scripts are the operational surface. Never break the interface. Always maintain backward compatibility. -->
