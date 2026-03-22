<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# scripts

## Purpose

Deployment, validation, and utility scripts. Handles environment setup, health checks, smoke testing, Tailscale verification, and production deployment orchestration to dv-syd-host01.

## Key Files

| File | Description |
|------|-------------|
| `deploy-production.sh` | Production deployment (main orchestrator) |
| `deploy-devnode.sh` | Dev node deployment (acdev-devnode) |
| `validate-env.sh` | Environment variable validation |
| `verify-deployment.sh` | Post-deploy verification |
| `smoke-test.sh` | Integration smoke tests |
| `verify-health.sh` | Service health checks |
| `setup-env.sh` | Initial environment setup |
| `engram` | CLI entry point (wrapper) |
| `engram-controller.sh` | Service control (start/stop/restart) |
| `engram-health-monitor.sh` | Continuous health monitoring |
| `provision-tailscale-certs.sh` | TLS certificate provisioning |
| `verify-tailscale-access.sh` | Tailscale connectivity verification |

## For AI Agents

### Working In This Directory

1. **Running Scripts**
   - All scripts require bash (not sh)
   - Make executable: `chmod +x script.sh`
   - Source environment: `source .env` before running
   - Always test locally first: `bash script.sh --dry-run` (if supported)

2. **Deployment Workflow**
   - Run `validate-env.sh` first (validate secrets)
   - Run `deploy-production.sh` (main deployment)
   - Run `verify-deployment.sh` (verify success)
   - Run `smoke-test.sh` (integration tests)

3. **Health Monitoring**
   - `verify-health.sh` — Single health check
   - `engram-health-monitor.sh` — Continuous monitoring (background)
   - Check logs: `docker compose logs -f [service]`

### Testing Requirements

- **Script Syntax:** `bash -n script.sh` (check syntax)
- **Dry Run:** Test with `--dry-run` flag (if supported)
- **Environment:** Test with `.env.example` first
- **Error Handling:** Verify scripts exit with proper codes

### Common Patterns

1. **Main Deployment Script (deploy-production.sh)**
   ```bash
   #!/bin/bash
   set -euo pipefail

   # Load environment
   source .env || { echo "Error: .env not found"; exit 1; }

   # Validate
   bash validate-env.sh || { echo "Validation failed"; exit 1; }

   # Deploy via Tailscale
   ssh -o ProxyCommand="tailscale ssh ${TAILSCALE_IP}" \
     root@"${TAILSCALE_IP}" \
     'cd /opt/engram && docker compose up -d'

   # Verify
   bash verify-deployment.sh || { echo "Verification failed"; exit 1; }

   # Test
   bash smoke-test.sh || { echo "Smoke tests failed"; exit 1; }
   ```

2. **Health Check Script**
   ```bash
   #!/bin/bash

   check_service() {
     local url=$1
     local name=$2

     if curl -sf "$url" > /dev/null 2>&1; then
       echo "✓ $name is UP"
       return 0
     else
       echo "✗ $name is DOWN"
       return 1
     fi
   }

   check_service "http://localhost:8000/health" "Memory API"
   check_service "http://localhost:11235/health" "Crawler API"
   check_service "http://localhost:3002/health" "Platform"
   ```

3. **Tailscale SSH Deployment**
   ```bash
   #!/bin/bash

   TAILSCALE_IP="100.100.42.6"  # dv-syd-host01

   # SSH via Tailscale (no public IP)
   ssh -o ProxyCommand="tailscale ssh ${TAILSCALE_IP}" \
     root@"${TAILSCALE_IP}" \
     'bash /opt/engram/scripts/health-check.sh'
   ```

4. **Environment Validation**
   ```bash
   #!/bin/bash

   required_vars=(
     "CLERK_SECRET_KEY"
     "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
     "NEXT_PUBLIC_MEMORY_API_URL"
     "NEXT_PUBLIC_CRAWLER_API_URL"
   )

   for var in "${required_vars[@]}"; do
     if [ -z "${!var:-}" ]; then
       echo "Error: $var not set"
       exit 1
     fi
   done

   echo "All environment variables validated"
   ```

## Script Index

| Script | Purpose | Target | Frequency |
|--------|---------|--------|-----------|
| `deploy-production.sh` | Full deployment | dv-syd-host01 | Manual (release) |
| `deploy-devnode.sh` | Dev deployment | acdev-devnode | Manual (testing) |
| `validate-env.sh` | Check env vars | Local | Before deploy |
| `verify-deployment.sh` | Post-deploy check | Remote | After deploy |
| `smoke-test.sh` | Integration tests | Remote | After deploy |
| `verify-health.sh` | Service health | Local/Remote | On-demand |
| `setup-env.sh` | Initial setup | Local | Once per setup |
| `engram-health-monitor.sh` | Health monitoring | Remote | Background (daemon) |
| `provision-tailscale-certs.sh` | TLS setup | Remote | Once per server |
| `verify-tailscale-access.sh` | Connectivity check | Remote | Troubleshooting |

## Deployment Targets

**Production Server (dv-syd-host01):**
- Tailscale IP: 100.100.42.6
- Public IP: 46.250.245.181 (never use directly)
- SSH via Tailscale: `ssh -o ProxyCommand="tailscale ssh 100.100.42.6" root@100.100.42.6`

**Dev Server (acdev-devnode):**
- Tailscale IP: 100.78.187.5
- Used for testing before production

## Environment Variables

**Required (from .env):**
```bash
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_MEMORY_API_URL=http://localhost:8000
NEXT_PUBLIC_CRAWLER_API_URL=http://localhost:11235
TAILSCALE_IP=100.100.42.6
```

**Script Specific:**
```bash
DRY_RUN=true              # Test without changes
VERBOSE=true              # Extra logging
SKIP_HEALTH_CHECK=true    # Skip verification (not recommended)
```

## Execution Flow

**Production Deployment:**
1. `validate-env.sh` — Check secrets, config
2. `deploy-production.sh` — Deploy to dv-syd-host01
3. `verify-deployment.sh` — Check services online
4. `smoke-test.sh` — Run integration tests
5. `engram-health-monitor.sh` — Start background monitoring

## Best Practices

1. **Always validate first:**
   ```bash
   bash scripts/validate-env.sh
   ```

2. **Use Tailscale, never public IP:**
   ```bash
   # Good
   ssh -o ProxyCommand="tailscale ssh 100.100.42.6" root@100.100.42.6

   # Bad
   ssh root@46.250.245.181  # Public IP (blocked)
   ```

3. **Test scripts locally first:**
   ```bash
   bash scripts/health-check.sh  # Local
   ```

4. **Check logs after deployment:**
   ```bash
   ssh root@100.100.42.6 "docker compose logs -f memory-api"
   ```

5. **Keep secrets in .env (never commit):**
   ```bash
   # Good: .env (in .gitignore)
   # Bad: hardcoded in scripts
   ```

## Known Patterns

1. **Error Handling:**
   ```bash
   set -euo pipefail  # Exit on error, undefined vars, pipe failures
   ```

2. **Dry Run Support:**
   ```bash
   if [ "${DRY_RUN:-false}" = "true" ]; then
     echo "[DRY RUN] Would execute: $command"
     return 0
   fi
   ```

3. **Logging:**
   ```bash
   echo "[INFO] Starting deployment..."
   echo "[WARN] Warning message"
   echo "[ERROR] Error message"
   ```

4. **Status Checks:**
   ```bash
   if curl -sf "$url" > /dev/null; then
     echo "✓ Service is UP"
   else
     echo "✗ Service is DOWN"
   fi
   ```

## Troubleshooting

**Tailscale SSH fails:**
```bash
tailscale status  # Check Tailscale is running
tailscale ssh 100.100.42.6 "echo test"  # Verify connectivity
```

**Health check fails:**
```bash
# Check service logs
docker compose logs memory-api

# Check port binding
netstat -tlnp | grep 8000

# Manual service test
curl http://localhost:8000/health
```

**Deployment incomplete:**
```bash
# Check Docker status
docker ps  # List containers
docker compose ps  # List compose services

# Check logs
docker compose logs --tail=50 [service-name]
```

<!-- MANUAL: Update Tailscale IPs and hosts as infrastructure changes -->
