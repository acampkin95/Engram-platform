#!/bin/bash
# =============================================================================
#  Engram Platform — Docker Compose Controller
#  Provides graceful start/stop with dependency awareness
# =============================================================================
set -euo pipefail

COMPOSE_FILE="/opt/engram/docker-compose.yml"
COMPOSE_PROJECT="engram-platform"
LOG_FILE="/var/log/engram-controller.log"
LOCK_FILE="/var/run/engram-controller.lock"
HEALTH_TIMEOUT=300
SHUTDOWN_TIMEOUT=120

# Colors for output
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
log_info() { log "${GREEN}[INFO]${NC} $*"; }
log_warn() { log "${YELLOW}[WARN]${NC} $*"; }
log_error() { log "${RED}[ERROR]${NC} $*"; }

# Check if docker compose is available
check_docker() {
    if ! command -v docker &>/dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    if ! docker info &>/dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
}

# Acquire lock to prevent concurrent operations
acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid
        pid=$(cat "$LOCK_FILE" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_error "Another instance is running (PID: $pid)"
            exit 1
        fi
        log_warn "Stale lock file found, removing..."
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

release_lock() {
    rm -f "$LOCK_FILE"
}

# Wait for services to be healthy
wait_for_healthy() {
    local service="$1"
    local timeout="$2"
    local elapsed=0

    log_info "Waiting for $service to become healthy..."
    while (( elapsed < timeout )); do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "${COMPOSE_PROJECT}-${service}" 2>/dev/null || echo "none")

        if [[ "$health" == "healthy" ]]; then
            log_info "$service is healthy"
            return 0
        elif [[ "$health" == "none" ]]; then
            # Service doesn't have healthcheck, check if running
            local state
            state=$(docker inspect --format='{{.State.Status}}' "${COMPOSE_PROJECT}-${service}" 2>/dev/null || echo "unknown")
            if [[ "$state" == "running" ]]; then
                log_info "$service is running"
                return 0
            fi
        fi

        sleep 2
        (( elapsed += 2 ))
    done

    log_warn "$service did not become healthy within ${timeout}s"
    return 1
}

# Get service dependencies from compose file
get_dependencies() {
    local service="$1"
    docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | head -1 || echo ""
}

# Pre-start validation
pre_start_check() {
    log_info "Running pre-start validation..."

    # Check disk space (require at least 10% free)
    local df_output
    df_output=$(df -P "$COMPOSE_FILE" | awk 'NR==2 {print $5}' | tr -d '%')
    if (( df_output > 90 )); then
        log_error "Disk space critical: ${df_output}% used"
        return 1
    fi

    # Check memory (require at least 1GB available)
    local avail_mem
    avail_mem=$(free -m | awk '/MemAvailable/{print $2}')
    if (( avail_mem < 1024 )); then
        log_warn "Low memory: ${avail_mem}MB available"
    fi

    # Validate compose file
    if ! docker compose -f "$COMPOSE_FILE" config &>/dev/null; then
        log_error "Invalid docker-compose.yml"
        return 1
    fi

    log_info "Pre-start validation passed"
    return 0
}

# Start all services
cmd_start() {
    check_docker
    acquire_lock

    log_info "Starting Engram Platform..."

    pre_start_check || {
        log_error "Pre-start check failed"
        release_lock
        return 1
    }

    # Start services with dependency awareness
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

    # Wait for core services to be healthy
    local core_services=("weaviate" "memory-api" "crawler-redis" "memory-redis")
    for svc in "${core_services[@]}"; do
        wait_for_healthy "$svc" "$HEALTH_TIMEOUT" || log_warn "$svc may not be fully healthy"
    done

    log_info "Engram Platform started successfully"
    release_lock
}

# Stop all services gracefully
cmd_stop() {
    check_docker
    acquire_lock

    log_info "Stopping Engram Platform gracefully..."

    # Send SIGTERM and wait for graceful shutdown
    docker compose -f "$COMPOSE_FILE" down --timeout "$SHUTDOWN_TIMEOUT"

    log_info "Engram Platform stopped"
    release_lock
}

# Restart services
cmd_restart() {
    cmd_stop
    sleep 5
    cmd_start
}

# Get status of all services
cmd_status() {
    check_docker

    echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Engram Platform — Service Status${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"

    printf "  %-25s %-12s %-12s %s\n" "SERVICE" "STATE" "HEALTH" "PORTS"
    echo "  --------------------------------------------------------------------------------"

    docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | while read -r line; do
        local name state health ports
        name=$(echo "$line" | jq -r '.Name // .Service' 2>/dev/null)
        state=$(echo "$line" | jq -r '.State' 2>/dev/null)
        health=$(echo "$line" | jq -r '.Health' 2>/dev/null)
        ports=$(echo "$line" | jq -r '.Ports' 2>/dev/null)

        local state_color="$NC"
        case "$state" in
            running) state_color="$GREEN" ;;
            exited|stopped) state_color="$RED" ;;
            *) state_color="$YELLOW" ;;
        esac

        local health_icon="—"
        case "$health" in
            healthy) health_icon="✓" ; health_color="$GREEN" ;;
            unhealthy) health_icon="✗" ; health_color="$RED" ;;
            starting) health_icon="…" ; health_color="$YELLOW" ;;
            *) health_color="$NC" ;;
        esac

        printf "  %-25s ${state_color}%-12s${NC} ${health_color}%-12s${NC} %s\n" \
            "$name" "$state" "$health_icon $health" "${ports:0:50}"
    done

    echo ""

    # Show resource usage
    echo -e "${BLUE}Resource Usage:${NC}"
    docker stats --no-stream --format "  {{.Name}}: CPU={{.CPUPerc}} MEM={{.MemUsage}} NET={{.NetIO}}" \
        "$(docker compose -f "$COMPOSE_FILE" ps -q)" 2>/dev/null || echo "  No containers running"

    echo ""
}

# Show logs
cmd_logs() {
    local service="${1:-}"
    local lines="${2:-100}"

    if [[ -n "$service" ]]; then
        docker compose -f "$COMPOSE_FILE" logs --tail="$lines" -f "$service"
    else
        docker compose -f "$COMPOSE_FILE" logs --tail="$lines" -f
    fi
}

# Full system health check
cmd_health() {
    check_docker

    echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Engram Platform — Health Check${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"

    local all_healthy=true

    # Check all containers
    while IFS= read -r container; do
        local name health status
        name=$(echo "$container" | jq -r '.Name' 2>/dev/null | sed 's/^\///')
        health=$(echo "$container" | jq -r '.Health' 2>/dev/null)
        status=$(echo "$container" | jq -r '.State' 2>/dev/null)

        if [[ "$status" != "running" ]]; then
            echo -e "  ${RED}✗${NC} $name: $status"
            all_healthy=false
        elif [[ "$health" == "unhealthy" ]]; then
            echo -e "  ${RED}✗${NC} $name: unhealthy"
            all_healthy=false
        elif [[ "$health" == "healthy" ]] || [[ "$health" == "null" ]]; then
            echo -e "  ${GREEN}✓${NC} $name"
        else
            echo -e "  ${YELLOW}…${NC} $name: starting"
        fi
    done < <(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null)

    echo ""

    # Check connectivity
    echo -e "${BLUE}Endpoint Tests:${NC}"
    local endpoints=(
        "nginx:http://localhost:8080/health"
        "memory-api:http://localhost:8000/health"
        "crawler-api:http://localhost:11235/"
    )

    for endpoint in "${endpoints[@]}"; do
        local name url
        name="${endpoint%%:*}"
        url="${endpoint##*:}"

        if curl -fsS --max-time 5 "$url" &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} $name"
        else
            echo -e "  ${RED}✗${NC} $name"
            all_healthy=false
        fi
    done

    echo ""

    if $all_healthy; then
        echo -e "${GREEN}All systems healthy${NC}"
        return 0
    else
        echo -e "${RED}Some issues detected${NC}"
        return 1
    fi
}

# Show help
show_help() {
    echo -e "${BLUE}Engram Platform Controller${NC}"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start           Start all services"
    echo "  stop            Stop all services gracefully"
    echo "  restart         Restart all services"
    echo "  status          Show status of all services"
    echo "  health          Run health check"
    echo "  logs [service]  Show logs (all or specific service)"
    echo ""
}

# Main dispatcher
main() {
    local cmd="${1:-}"
    shift || true

    mkdir -p "$(dirname "$LOG_FILE")"

    case "$cmd" in
        start)      cmd_start "$@" ;;
        stop)      cmd_stop "$@" ;;
        restart)   cmd_restart "$@" ;;
        status|ps) cmd_status "$@" ;;
        health)    cmd_health "$@" ;;
        logs)      cmd_logs "$@" ;;
        help|--help|-h) show_help ;;
        *)         show_help ; exit 1 ;;
    esac
}

main "$@"
