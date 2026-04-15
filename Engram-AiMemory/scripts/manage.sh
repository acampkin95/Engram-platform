#!/usr/bin/env bash
# =============================================================================
#  AI Memory System — Service Manager
#  Usage: ./scripts/manage.sh <command> [options]
# =============================================================================
set -euo pipefail

RED='\033[0;31m';  GREEN='\033[0;32m';  YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';   BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
BACKUP_DIR="${PROJECT_ROOT}/data/backups"

# ─── Helpers ─────────────────────────────────────────────────────────────────
ok()    { echo -e "  ${CHECK} $*"; }
fail()  { echo -e "  ${CROSS} $*"; }
warn()  { echo -e "  ${WARN}  $*"; }
header(){ echo -e "\n${BLUE}${BOLD}$*${NC}"; }
die()   { echo -e "${RED}${BOLD}ERROR:${NC} $*"; exit 1; }

require_compose() {
    [[ -f "$COMPOSE_FILE" ]] || die "docker-compose.yml not found: ${COMPOSE_FILE}"
    command -v docker &>/dev/null || die "Docker not installed"
}

dc() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ─── start ────────────────────────────────────────────────────────────────────
cmd_start() {
    require_compose
    header "Starting AI Memory System..."
    [[ -f "${PROJECT_ROOT}/.env" ]] || die ".env file not found. Run ./scripts/ubuntu-install.sh first."
    dc up -d --remove-orphans
    echo -e ""
    cmd_status
}

# ─── stop ─────────────────────────────────────────────────────────────────────
cmd_stop() {
    require_compose
    header "Stopping AI Memory System..."
    dc stop
    ok "All services stopped"
}

# ─── restart ──────────────────────────────────────────────────────────────────
cmd_restart() {
    local service="${1:-}"
    require_compose
    if [[ -n "$service" ]]; then
        header "Restarting ${service}..."
        dc restart "$service"
    else
        header "Restarting all services..."
        dc restart
    fi
    sleep 3
    cmd_status
}

# ─── status ───────────────────────────────────────────────────────────────────
cmd_status() {
    require_compose
    header "Service Status"

    echo -e ""
    printf "  %-20s %-12s %-8s %s\n" "SERVICE" "STATE" "HEALTH" "PORTS"
    printf "  %-20s %-12s %-8s %s\n" "───────────────────" "──────────" "──────" "──────────────────"

    # Parse docker compose ps output
    while IFS= read -r line; do
        local name state health ports
        name=$(echo "$line" | awk '{print $1}')
        state=$(echo "$line" | awk '{print $4}')
        health=$(echo "$line" | awk '{print $7}')
        ports=$(echo "$line" | awk '{for(i=8;i<=NF;i++) printf $i " "; print ""}')

        local state_icon health_icon
        [[ "$state" == "running" ]] && state_icon="${GREEN}running${NC}" || state_icon="${RED}${state}${NC}"
        case "${health:-}" in
            healthy)   health_icon="${GREEN}✓${NC}" ;;
            unhealthy) health_icon="${RED}✗${NC}" ;;
            starting)  health_icon="${YELLOW}…${NC}" ;;
            *)         health_icon="${DIM}-${NC}" ;;
        esac

        printf "  %-20s " "$name"
        echo -e "${state_icon}          ${health_icon}       ${DIM}${ports}${NC}"
    done < <(dc ps --format "table {{.Name}}\t{{.Service}}\t{{.Image}}\t{{.State}}\t{{.Status}}\t{{.Health}}\t{{.Ports}}" 2>/dev/null | tail -n +2 || dc ps 2>/dev/null | tail -n +2)

    echo -e ""

    # Quick connectivity test
    header "Endpoint Health"
    test_endpoint "Dashboard"  "http://localhost:3001"
    test_endpoint "API"        "http://localhost:8000/health"
    test_endpoint "API Docs"   "http://localhost:8000/docs"
    test_endpoint "Weaviate"   "http://localhost:8080/v1/.well-known/ready"
    test_redis    "Redis"      "ai-memory-redis"
    echo -e ""
}

test_endpoint() {
    local name="$1" url="$2"
    local http_code
    http_code=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null || echo "000")
    if [[ "$http_code" =~ ^2 ]]; then
        ok "${name} (${url}) — ${GREEN}${http_code}${NC}"
    else
        fail "${name} (${url}) — ${RED}${http_code}${NC}"
    fi
}

test_redis() {
    local name="$1" container="$2"
    if docker exec "$container" redis-cli ping 2>/dev/null | grep -q PONG; then
        ok "${name} — ${GREEN}PONG${NC}"
    else
        fail "${name} — ${RED}unreachable${NC}"
    fi
}

# ─── logs ─────────────────────────────────────────────────────────────────────
cmd_logs() {
    require_compose
    local service="${1:-}"
    local lines="${2:-100}"
    if [[ -n "$service" ]]; then
        dc logs -f --tail="$lines" "$service"
    else
        dc logs -f --tail="$lines"
    fi
}

# ─── shell ────────────────────────────────────────────────────────────────────
cmd_shell() {
    local service="${1:-api}"
    require_compose
    echo -e "  ${CYAN}Opening shell in ${service}...${NC}"
    dc exec "$service" /bin/bash 2>/dev/null || dc exec "$service" /bin/sh
}

# ─── pull / update ────────────────────────────────────────────────────────────
cmd_update() {
    require_compose
    header "Pulling latest images and redeploying..."
    dc pull
    dc up -d --remove-orphans --build
    ok "Update complete"
    cmd_status
}

# ─── backup ───────────────────────────────────────────────────────────────────
cmd_backup() {
    require_compose
    local backup_name="${1:-$(date +%Y%m%d-%H%M%S)}"
    local dest="${BACKUP_DIR}/${backup_name}"
    mkdir -p "$dest"

    header "Running backup → ${dest}"

    # PostgreSQL
    echo -n "  PostgreSQL: "
    if docker exec ai-memory-postgres pg_dump -U memoryserver memoryserver 2>/dev/null \
        | gzip > "${dest}/postgres.sql.gz"; then
        local size; size=$(du -sh "${dest}/postgres.sql.gz" | awk '{print $1}')
        echo -e "${CHECK} ${size}"
    else
        echo -e "${WARN} skipped (container not running?)"
    fi

    # Weaviate data snapshot
    echo -n "  Weaviate:   "
    local weaviate_vol="${PROJECT_ROOT}/data/volumes/weaviate"
    if [[ -d "$weaviate_vol" ]]; then
        tar -czf "${dest}/weaviate.tar.gz" -C "${weaviate_vol}" . 2>/dev/null
        local size; size=$(du -sh "${dest}/weaviate.tar.gz" | awk '{print $1}')
        echo -e "${CHECK} ${size}"
    else
        echo -e "${WARN} skipped (no volume directory)"
    fi

    # Redis dump
    echo -n "  Redis:      "
    docker exec ai-memory-redis redis-cli BGSAVE > /dev/null 2>&1 || true
    sleep 2
    if docker cp ai-memory-redis:/data/dump.rdb "${dest}/redis.rdb" 2>/dev/null; then
        local size; size=$(du -sh "${dest}/redis.rdb" | awk '{print $1}')
        echo -e "${CHECK} ${size}"
    else
        echo -e "${WARN} skipped"
    fi

    # .env (encrypted)
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        cp "${PROJECT_ROOT}/.env" "${dest}/env.bak"
        ok ".env backed up"
    fi

    # Prune old backups (keep 30 days)
    find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \; 2>/dev/null || true

    echo -e ""
    ok "Backup complete: ${dest}"
    echo -e "  ${DIM}$(du -sh "$dest" | awk '{print $1}') total${NC}"
}

# ─── restore ──────────────────────────────────────────────────────────────────
cmd_restore() {
    local backup_path="${1:-}"
    [[ -n "$backup_path" ]] || die "Usage: $0 restore <backup-directory>"
    [[ -d "$backup_path" ]] || die "Backup directory not found: ${backup_path}"

    header "Restoring from ${backup_path}"
    echo -e "  ${YELLOW}${BOLD}WARNING: This will overwrite current data!${NC}"
    read -r -p "  Type 'RESTORE' to confirm: " confirmation
    [[ "$confirmation" == "RESTORE" ]] || die "Aborted."

    # Stop services before restore
    dc stop api dashboard mcp-server 2>/dev/null || true

    # PostgreSQL restore
    if [[ -f "${backup_path}/postgres.sql.gz" ]]; then
        echo -n "  PostgreSQL: "
        zcat "${backup_path}/postgres.sql.gz" | \
            docker exec -i ai-memory-postgres psql -U memoryserver memoryserver >> /dev/null 2>&1
        echo -e "${CHECK}"
    fi

    # Weaviate restore
    if [[ -f "${backup_path}/weaviate.tar.gz" ]]; then
        echo -n "  Weaviate:   "
        local weaviate_vol="${PROJECT_ROOT}/data/volumes/weaviate"
        rm -rf "${weaviate_vol:?}"/* 2>/dev/null || true
        tar -xzf "${backup_path}/weaviate.tar.gz" -C "$weaviate_vol" 2>/dev/null
        echo -e "${CHECK}"
    fi

    # Redis restore
    if [[ -f "${backup_path}/redis.rdb" ]]; then
        echo -n "  Redis:      "
        docker cp "${backup_path}/redis.rdb" ai-memory-redis:/data/dump.rdb 2>/dev/null
        docker restart ai-memory-redis >> /dev/null 2>&1
        echo -e "${CHECK}"
    fi

    dc up -d --remove-orphans
    ok "Restore complete — services restarted"
}

# ─── scale ────────────────────────────────────────────────────────────────────
cmd_scale() {
    local service="${1:-api}"
    local replicas="${2:-2}"
    require_compose
    header "Scaling ${service} to ${replicas} replicas..."
    dc up -d --scale "${service}=${replicas}"
    ok "Scaled ${service} → ${replicas}"
}

# ─── stats ────────────────────────────────────────────────────────────────────
cmd_stats() {
    header "Resource Usage"
    docker stats --no-stream \
        --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" \
        2>/dev/null || warn "No running containers"
}

# ─── prune ────────────────────────────────────────────────────────────────────
cmd_prune() {
    header "Docker cleanup (unused images, volumes, networks)..."
    echo -e "  ${YELLOW}Removes unused Docker resources (not affecting running containers)${NC}"
    read -r -p "  Confirm? [y/N] " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || { echo "  Aborted."; return 0; }
    docker system prune -f --volumes
    ok "Pruning done"
}

# ─── env ──────────────────────────────────────────────────────────────────────
cmd_env() {
    header "Environment Variables"
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        # Show keys without secret values
        while IFS='=' read -r key val; do
            [[ "$key" =~ ^#|^$ ]] && continue
            if [[ "$key" =~ (KEY|PASSWORD|SECRET|TOKEN) ]]; then
                printf "  %-30s = %s\n" "$key" "${val:0:4}****"
            else
                printf "  %-30s = %s\n" "$key" "$val"
            fi
        done < "${PROJECT_ROOT}/.env"
    else
        warn ".env not found"
    fi
}

# ─── Help ─────────────────────────────────────────────────────────────────────
show_help() {
    echo -e "${BLUE}${BOLD}"
    echo -e "AI Memory System — Service Manager"
    echo -e "${NC}"
    echo -e "Usage: ${BOLD}$0 <command> [args]${NC}"
    echo -e ""
    echo -e "${BOLD}Core:${NC}"
    echo -e "  ${CYAN}start${NC}               Start all services"
    echo -e "  ${CYAN}stop${NC}                Stop all services"
    echo -e "  ${CYAN}restart [service]${NC}   Restart all or specific service"
    echo -e "  ${CYAN}status${NC}              Show service status & endpoint health"
    echo -e ""
    echo -e "${BOLD}Debugging:${NC}"
    echo -e "  ${CYAN}logs [service]${NC}      Tail logs (all or specific)"
    echo -e "  ${CYAN}shell [service]${NC}     Open shell (default: api)"
    echo -e "  ${CYAN}stats${NC}               Show CPU/RAM/IO per container"
    echo -e ""
    echo -e "${BOLD}Maintenance:${NC}"
    echo -e "  ${CYAN}update${NC}              Pull latest images and redeploy"
    echo -e "  ${CYAN}backup [name]${NC}       Run backup (postgres + weaviate + redis)"
    echo -e "  ${CYAN}restore <dir>${NC}       Restore from backup directory"
    echo -e "  ${CYAN}scale <svc> <n>${NC}     Scale a service to N replicas"
    echo -e "  ${CYAN}prune${NC}               Remove unused Docker resources"
    echo -e "  ${CYAN}env${NC}                 Show current environment (keys masked)"
    echo -e ""
    echo -e "${BOLD}Services:${NC} api, dashboard, mcp-server, weaviate, redis, postgres"
    echo -e ""
    echo -e "${DIM}Examples:${NC}"
    echo -e "  $0 restart api          # Restart only the API"
    echo -e "  $0 logs api             # Tail API logs"
    echo -e "  $0 backup pre-upgrade   # Snapshot before upgrading"
    echo -e "  $0 restore data/backups/20260225-120000"
    echo -e ""
}

# ─── Dispatch ─────────────────────────────────────────────────────────────────
main() {
    local cmd="${1:-help}"; shift || true
    case "$cmd" in
        start)          cmd_start ;;
        stop)           cmd_stop ;;
        restart)        cmd_restart "$@" ;;
        status|ps)      cmd_status ;;
        logs|log)       cmd_logs "$@" ;;
        shell|exec|sh)  cmd_shell "$@" ;;
        update|pull)    cmd_update ;;
        backup)         cmd_backup "$@" ;;
        restore)        cmd_restore "$@" ;;
        scale)          cmd_scale "$@" ;;
        stats)          cmd_stats ;;
        prune|clean)    cmd_prune ;;
        env)            cmd_env ;;
        help|--help|-h) show_help ;;
        *)
            echo -e "${RED}Unknown command: ${cmd}${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
