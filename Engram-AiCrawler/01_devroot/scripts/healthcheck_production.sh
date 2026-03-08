#!/usr/bin/env bash
# =============================================================================
# healthcheck_production.sh — Aggregated production health monitor
# =============================================================================
# Checks: app, redis, nginx, tor, backup container, disk, memory
# Exit codes: 0=healthy, 1=degraded, 2=critical
# =============================================================================
set -euo pipefail

# ---- Colour helpers ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS="${GREEN}✓${NC}"; FAIL="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
APP_PORT="${APP_PORT:-11235}"
DISK_WARN_PCT=80
DISK_CRIT_PCT=90
MEM_WARN_PCT=85

DEGRADED=0
CRITICAL=0

pass()  { echo -e "  ${PASS} $*"; }
fail()  { echo -e "  ${FAIL} $*"; ((CRITICAL++)) || true; }
warn_msg() { echo -e "  ${WARN} $*"; ((DEGRADED++)) || true; }
header(){ echo -e "\n${BLUE}── $* ──${NC}"; }

# ---- Docker container status ------------------------------------------------
container_status() {
    local name="$1"
    local label="${2:-$1}"
    local status
    status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "not_found")
    local health
    health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo "unknown")

    if [[ "$status" == "running" ]]; then
        if [[ "$health" == "healthy" || "$health" == "none" ]]; then
            pass "$label: running${health:+ ($health)}"
        elif [[ "$health" == "starting" ]]; then
            warn_msg "$label: running (health: starting)"
        else
            warn_msg "$label: running (health: $health)"
        fi
    elif [[ "$status" == "not_found" ]]; then
        warn_msg "$label: container not found"
    else
        fail "$label: $status"
    fi
}

# ---- HTTP endpoint check ----------------------------------------------------
http_check() {
    local url="$1"
    local label="$2"
    local expected_code="${3:-200}"
    local code
    code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    if [[ "$code" == "$expected_code" ]]; then
        pass "$label: HTTP $code"
    elif [[ "$code" == "000" ]]; then
        fail "$label: unreachable"
    else
        warn_msg "$label: HTTP $code (expected $expected_code)"
    fi
}

# =============================================================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  OSINT Platform — Production Health Check    ║${NC}"
echo -e "${BLUE}║  $(date -u '+%Y-%m-%d %H:%M:%S UTC')              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"

# ---- Containers -------------------------------------------------------------
header "Docker Containers"
container_status "osint-platform-app-1"    "App (FastAPI)"
container_status "osint-platform-redis-1"  "Redis"
container_status "osint-platform-nginx-1"  "Nginx"
container_status "osint-platform-tor-1"    "Tor"
container_status "osint-platform-backup-1" "Backup (rclone)"

# ---- Application endpoints --------------------------------------------------
header "Application Endpoints"
http_check "http://localhost:${APP_PORT}/health"  "App /health"
http_check "http://localhost:${APP_PORT}/api/v1/status" "App /api/v1/status" "200"
http_check "http://localhost:80"                  "Nginx HTTP (→ HTTPS redirect)" "301"

# HTTPS check (only if domain configured)
if [[ -f "$ENV_FILE" ]]; then
    DOMAIN=$(grep -E '^DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" || echo "")
    if [[ -n "$DOMAIN" && "$DOMAIN" != "your-domain.com" ]]; then
        http_check "https://${DOMAIN}/health" "Nginx HTTPS /health"
    fi
fi

# ---- Redis ------------------------------------------------------------------
header "Redis"
if docker exec osint-platform-redis-1 redis-cli ping &>/dev/null 2>&1; then
    REDIS_INFO=$(docker exec osint-platform-redis-1 redis-cli info server 2>/dev/null | grep redis_version || echo "")
    pass "Redis PING: PONG ($REDIS_INFO)"
    # Check memory usage
    REDIS_MEM=$(docker exec osint-platform-redis-1 redis-cli info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '[:space:]' || echo "?")
    pass "Redis memory: $REDIS_MEM"
else
    fail "Redis: not responding to PING"
fi

# ---- Disk usage -------------------------------------------------------------
header "Disk Usage"
while IFS= read -r line; do
    PCT=$(echo "$line" | awk '{print $5}' | tr -d '%')
    MOUNT=$(echo "$line" | awk '{print $6}')
    USED=$(echo "$line" | awk '{print $3}')
    AVAIL=$(echo "$line" | awk '{print $4}')
    if [[ $PCT -ge $DISK_CRIT_PCT ]]; then
        fail "Disk $MOUNT: ${PCT}% used (${USED} used, ${AVAIL} free) — CRITICAL"
    elif [[ $PCT -ge $DISK_WARN_PCT ]]; then
        warn_msg "Disk $MOUNT: ${PCT}% used (${USED} used, ${AVAIL} free) — WARNING"
    else
        pass "Disk $MOUNT: ${PCT}% used (${AVAIL} free)"
    fi
done < <(df -h --output=source,size,used,avail,pcent,target 2>/dev/null | grep -v tmpfs | grep -v udev | grep -v Filesystem || \
         df -h 2>/dev/null | grep -v tmpfs | grep -v devfs | tail -n +2)

# ---- Memory -----------------------------------------------------------------
header "System Memory"
if command -v free &>/dev/null; then
    MEM_LINE=$(free -m | grep Mem)
    MEM_TOTAL=$(echo "$MEM_LINE" | awk '{print $2}')
    MEM_USED=$(echo "$MEM_LINE" | awk '{print $3}')
    MEM_PCT=$(( MEM_USED * 100 / MEM_TOTAL ))
    if [[ $MEM_PCT -ge $MEM_WARN_PCT ]]; then
        warn_msg "Memory: ${MEM_PCT}% used (${MEM_USED}MB / ${MEM_TOTAL}MB)"
    else
        pass "Memory: ${MEM_PCT}% used (${MEM_USED}MB / ${MEM_TOTAL}MB)"
    fi
fi

# ---- Tor connectivity -------------------------------------------------------
header "Tor Network"
if docker exec osint-platform-tor-1 curl -sf --socks5-hostname localhost:9050 \
    --max-time 15 https://check.torproject.org/api/ip &>/dev/null 2>&1; then
    pass "Tor: connected (SOCKS5 working)"
else
    warn_msg "Tor: connectivity check failed (non-critical)"
fi

# ---- Last backup timestamp --------------------------------------------------
header "Backup Status"
BACKUP_LOG="/var/log/osint-backup.log"
if [[ -f "$BACKUP_LOG" ]]; then
    LAST_BACKUP=$(grep "Backup completed successfully" "$BACKUP_LOG" 2>/dev/null | tail -1 | cut -d']' -f1 | tr -d '[' || echo "")
    if [[ -n "$LAST_BACKUP" ]]; then
        pass "Last successful backup: $LAST_BACKUP"
    else
        warn_msg "No successful backup found in $BACKUP_LOG"
    fi
else
    warn_msg "Backup log not found at $BACKUP_LOG"
fi

# ---- Summary ----------------------------------------------------------------
echo ""
echo -e "${BLUE}══════════════════════════════════════════════${NC}"
if [[ $CRITICAL -gt 0 ]]; then
    echo -e "  ${RED}CRITICAL: $CRITICAL critical issue(s), $DEGRADED warning(s)${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════${NC}"
    exit 2
elif [[ $DEGRADED -gt 0 ]]; then
    echo -e "  ${YELLOW}DEGRADED: $DEGRADED warning(s) — system operational${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════${NC}"
    exit 1
else
    echo -e "  ${GREEN}HEALTHY: All systems operational${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════${NC}"
    exit 0
fi
