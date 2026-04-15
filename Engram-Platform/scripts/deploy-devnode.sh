#!/usr/bin/env bash
# DEPRECATED: Prefer ./scripts/deploy-unified.sh deploy:devnode from the monorepo root.
# =============================================================================
#  Engram Platform — Devnode Deployment Script
#  Optimized for acdev-devnode.tail4da6b7.ts.net
# =============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
INSTALL_DIR="/opt/engram"
LOG_DIR="/var/log/engram"

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"; ARROW="${CYAN}→${NC}"; INFO="${BLUE}ℹ${NC}"

# ─── Functions ─────────────────────────────────────────────────────────────────
log() { echo -e "$*" | tee -a "${LOG_DIR}/deploy.log" >&2; }
step() { echo -e "\n${BLUE}━━━${NC} ${BOLD}$*${NC}" | tee -a "${LOG_DIR}/deploy.log" >&2; }
ok() { echo -e "  ${CHECK} $*" | tee -a "${LOG_DIR}/deploy.log" >&2; }
warn() { echo -e "  ${WARN}  $*" | tee -a "${LOG_DIR}/deploy.log" >&2; }
fail() { echo -e "  ${CROSS} $*" | tee -a "${LOG_DIR}/deploy.log" >&2; exit 1; }

# ─── Pre-flight Checks ──────────────────────────────────────────────────────────
preflight() {
    step "Running pre-flight checks..."

    # Check Docker
    if ! command -v docker &>/dev/null; then
        fail "Docker not installed"
    fi

    if ! docker info &>/dev/null; then
        fail "Docker daemon not running"
    fi
    ok "Docker available"

    # Check Docker Compose
    if ! docker compose version &>/dev/null; then
        fail "Docker Compose not available"
    fi
    ok "Docker Compose available"

    # Check env file
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "${ENV_FILE}.example" ]]; then
            warn "No .env file found, copying from .env.example"
            cp "${ENV_FILE}.example" "$ENV_FILE"
            warn "Please edit $ENV_FILE with your configuration"
            exit 1
        else
            fail "No .env file found. Please create one from .env.example"
        fi
    fi
    ok "Environment file exists"

    # Check required env vars
    local required_vars=("JWT_SECRET" "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "CLERK_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE" &>/dev/null; then
            fail "Required environment variable $var not set in $ENV_FILE"
        fi
    done
    ok "Required environment variables set"

    # Check Tailscale connectivity
    if command -v tailscale &>/dev/null; then
        if tailscale status | grep -q "Connected" &>/dev/null; then
            ok "Tailscale connected"
        else
            warn "Tailscale not connected. Some services may not be accessible"
        fi
    fi
}

# ─── Pull Images ──────────────────────────────────────────────────────────────
pull_images() {
    step "Pulling Docker images..."

    cd "$PROJECT_ROOT"
    docker compose pull 2>&1 | tee -a "${LOG_DIR}/deploy.log"

    ok "Images pulled"
}

# ─── Start Services ──────────────────────────────────────────────────────────────
start_services() {
    step "Starting services..."

    cd "$PROJECT_ROOT"
    docker compose up -d 2>&1 | tee -a "${LOG_DIR}/deploy.log"

    ok "Services started"
}

# ─── Health Check ──────────────────────────────────────────────────────────────
health_check() {
    step "Running health checks..."

    local max_retries=30
    local retry_interval=5
    local services=("nginx:443" "memory-api:8000" "crawler-api:11235" "mcp-server:3000" "platform:3002")

    for service_port in "${services[@]}"; do
        local service="${service_port%%:*}"
        local port="${service_port#*:}"
        local retries=0

        while [[ $retries -lt $max_retries ]]; do
            if curl -sf "http://localhost:${port}/health" &>/dev/null; then
                ok "$service healthy (port $port)"
                break
            fi

            retries=$((retries + 1))
            sleep $retry_interval
        done

        if [[ $retries -eq $max_retries ]]; then
            fail "$service health check failed after ${max_retries} attempts"
        fi
    done
}

# ─── Show Status ──────────────────────────────────────────────────────────────
show_status() {
    step "Service status:"

    cd "$PROJECT_ROOT"
    docker compose ps

    echo ""
    info "Deployment complete!"
    info "Access Platform at: https://$(hostname):443"
    info "Memory API at: https://$(hostname):8000"
    info "Crawler API at: https://$(hostname):11235"
    info "MCP Server at: https://$(hostname):3000"
}

# ─── Main ──────────────────────────────────────────────────────────────────────
main() {
    # Create log directory
    mkdir -p "$LOG_DIR"

    log "========================================"
    log "Engram Platform Deployment - $(date)"
    log "========================================"

    preflight
    pull_images
    start_services
    health_check
    show_status
}

# Run main
main "$@"
