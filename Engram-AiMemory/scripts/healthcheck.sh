#!/usr/bin/env bash
# =============================================================================
#  AI Memory System — Deep Health Check
#  Checks: containers, endpoints, data integrity, system resources
# =============================================================================
set -euo pipefail

RED='\033[0;31m';  GREEN='\033[0;32m';  YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';   BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"

# Counters
PASS=0; FAIL=0; WARN_COUNT=0
ISSUES=()

# ─── Helpers ─────────────────────────────────────────────────────────────────
pass()    { echo -e "  ${CHECK} $*";                 (( PASS++ ));       }
fail()    { echo -e "  ${CROSS} ${RED}$*${NC}";     (( FAIL++ ));      ISSUES+=("FAIL: $*"); }
warn_()   { echo -e "  ${WARN}  ${YELLOW}$*${NC}"; (( WARN_COUNT++ )); ISSUES+=("WARN: $*"); }
section() { echo -e "\n${BLUE}${BOLD}── $* ────────────────────────────────────────${NC}"; }

http_ok() {
    local name="$1" url="$2" expected_code="${3:-200}"
    local code
    code=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    if [[ "$code" == "$expected_code" ]] || [[ "$code" =~ ^2 ]]; then
        pass "${name}: HTTP ${code}"
    elif [[ "$code" == "000" ]]; then
        fail "${name}: unreachable (${url})"
    else
        warn_ "${name}: HTTP ${code} (expected ${expected_code})"
    fi
}

container_running() {
    local name="$1" container="${2:-$1}"
    if docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null | grep -q true; then
        local health; health=$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        if [[ "$health" == "unhealthy" ]]; then
            warn_ "Container ${name}: running but UNHEALTHY"
        else
            pass "Container ${name}: running (health: ${health})"
        fi
    else
        fail "Container ${name}: not running"
    fi
}

# ─── Section: Docker Containers ──────────────────────────────────────────────
check_containers() {
    section "Docker Containers"

    if ! command -v docker &>/dev/null; then
        fail "Docker not installed"
        return
    fi

    if ! docker info &>/dev/null; then
        fail "Docker daemon not running"
        return
    fi
    pass "Docker daemon: running"

    # Load container names from compose
    if [[ -f "$COMPOSE_FILE" ]]; then
        while IFS= read -r container; do
            [[ -z "$container" ]] && continue
            container_running "$container" "$container"
        done < <(docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | \
            xargs -r docker inspect --format '{{.Name}}' | tr -d '/')
    else
        warn_ "docker-compose.yml not found at ${COMPOSE_FILE}"
    fi
}

# ─── Section: Service Endpoints ──────────────────────────────────────────────
check_endpoints() {
    section "Service Endpoints"

    http_ok "Weaviate ready"    "http://localhost:8080/v1/.well-known/ready"
    http_ok "Weaviate liveness" "http://localhost:8080/v1/.well-known/live"
    http_ok "Weaviate meta"     "http://localhost:8080/v1/meta"
    http_ok "API health"        "http://localhost:8000/health"
    http_ok "API docs"          "http://localhost:8000/docs"
    http_ok "Dashboard"         "http://localhost:3001"

    # Redis
    local redis_container; redis_container=$(docker ps --filter name=redis --format '{{.Names}}' | head -1)
    if [[ -n "$redis_container" ]]; then
        if docker exec "$redis_container" redis-cli ping 2>/dev/null | grep -q PONG; then
            pass "Redis: PONG"
        else
            fail "Redis: no response to PING"
        fi
    else
        fail "Redis: container not found"
    fi

    # PostgreSQL
    local pg_container; pg_container=$(docker ps --filter name=postgres --format '{{.Names}}' | head -1)
    if [[ -n "$pg_container" ]]; then
        if docker exec "$pg_container" pg_isready -U memoryserver 2>/dev/null | grep -q "accepting"; then
            pass "PostgreSQL: accepting connections"
        else
            fail "PostgreSQL: not accepting connections"
        fi
    else
        fail "PostgreSQL: container not found"
    fi
}

# ─── Section: Weaviate Deep Check ─────────────────────────────────────────────
check_weaviate() {
    section "Weaviate Health"

    # Schema
    local schema_resp; schema_resp=$(curl -fsS --max-time 5 \
        "http://localhost:8080/v1/schema" 2>/dev/null || echo '{}')
    if echo "$schema_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'classes' in d or 'collections' in d else 1)" 2>/dev/null; then
        local count; count=$(echo "$schema_resp" | python3 -c \
            "import sys,json; d=json.load(sys.stdin); print(len(d.get('classes',d.get('collections',[]))))" 2>/dev/null || echo "?")
        pass "Weaviate schema: ${count} collections"
    else
        warn_ "Weaviate schema: empty or unexpected response"
    fi

    # Object count
    local nodes_resp; nodes_resp=$(curl -fsS --max-time 5 \
        "http://localhost:8080/v1/nodes" 2>/dev/null || echo '{}')
    if echo "$nodes_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'nodes' in d else 1)" 2>/dev/null; then
        pass "Weaviate nodes: responding"
    else
        warn_ "Weaviate nodes: no node data"
    fi
}

# ─── Section: PostgreSQL Deep Check ──────────────────────────────────────────
check_postgres() {
    section "PostgreSQL Health"

    local pg_container; pg_container=$(docker ps --filter name=postgres --format '{{.Names}}' | head -1)
    [[ -z "$pg_container" ]] && { fail "PostgreSQL container not found"; return; }

    # Connection count
    local conn_count; conn_count=$(docker exec "$pg_container" \
        psql -U memoryserver -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ' || echo "?")
    pass "PostgreSQL connections: ${conn_count}"

    # DB size
    local db_size; db_size=$(docker exec "$pg_container" \
        psql -U memoryserver -t -c "SELECT pg_size_pretty(pg_database_size('memoryserver'));" 2>/dev/null | tr -d ' ' || echo "?")
    pass "PostgreSQL DB size: ${db_size}"

    # Check core tables exist
    local tables; tables=$(docker exec "$pg_container" \
        psql -U memoryserver -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');" 2>/dev/null | tr -d ' ' || echo "0")
    if (( tables > 0 )); then
        pass "PostgreSQL tables: ${tables} user tables"
    else
        warn_ "PostgreSQL: no user tables found (schema not initialized?)"
    fi
}

# ─── Section: Redis Deep Check ────────────────────────────────────────────────
check_redis() {
    section "Redis Health"

    local redis_container; redis_container=$(docker ps --filter name=redis --format '{{.Names}}' | head -1)
    [[ -z "$redis_container" ]] && { fail "Redis container not found"; return; }

    # INFO stats
    local info; info=$(docker exec "$redis_container" redis-cli info 2>/dev/null || echo "")
    if [[ -z "$info" ]]; then
        fail "Redis: INFO command failed"
        return
    fi

    local used_mem; used_mem=$(echo "$info" | grep "used_memory_human:" | awk -F: '{print $2}' | tr -d '\r')
    local connected_clients; connected_clients=$(echo "$info" | grep "connected_clients:" | awk -F: '{print $2}' | tr -d '\r')
    local role; role=$(echo "$info" | grep "^role:" | awk -F: '{print $2}' | tr -d '\r')
    local keyspace; keyspace=$(docker exec "$redis_container" redis-cli dbsize 2>/dev/null || echo "?")

    pass "Redis role: ${role}"
    pass "Redis memory: ${used_mem}"
    pass "Redis clients: ${connected_clients}"
    pass "Redis keys: ${keyspace}"

    # Persistence
    local rdb_last_save; rdb_last_save=$(echo "$info" | grep "rdb_last_bgsave_status:" | awk -F: '{print $2}' | tr -d '\r')
    if [[ "$rdb_last_save" == "ok" ]]; then
        pass "Redis RDB persistence: ok"
    else
        warn_ "Redis RDB last save: ${rdb_last_save}"
    fi
}

# ─── Section: System Resources ────────────────────────────────────────────────
check_system_resources() {
    section "System Resources"

    # CPU
    local cpu_count; cpu_count=$(nproc)
    local load; load=$(awk '{print $1}' /proc/loadavg)
    local load_pct; load_pct=$(echo "$load $cpu_count" | awk '{printf "%.0f", ($1/$2)*100}')
    if (( load_pct < 80 )); then
        pass "CPU load: ${load} (${load_pct}% of ${cpu_count} cores)"
    else
        warn_ "CPU load high: ${load} (${load_pct}% of ${cpu_count} cores)"
    fi

    # RAM
    local mem_info; mem_info=$(free -h | awk '/Mem:/{print $3 " / " $2 " (" int($3/$2*100) "% used)"}')
    local mem_pct; mem_pct=$(free | awk '/Mem:/{printf "%.0f", $3/$2*100}')
    if (( mem_pct < 85 )); then
        pass "RAM usage: ${mem_info}"
    else
        warn_ "RAM high: ${mem_info}"
    fi

    # Swap
    local swap_total; swap_total=$(free -h | awk '/Swap:/{print $2}')
    local swap_pct; swap_pct=$(free | awk '/Swap:/{if ($2>0) printf "%.0f", $3/$2*100; else print 0}')
    if (( swap_pct < 50 )); then
        pass "Swap usage: ${swap_pct}% (total ${swap_total})"
    else
        warn_ "Swap high: ${swap_pct}% (total ${swap_total})"
    fi

    # Disk
    local disk_info; disk_info=$(df -h "${PROJECT_ROOT}" | awk 'NR==2{print $5 " used (" $4 " free on " $1 ")"}')
    local disk_pct; disk_pct=$(df "${PROJECT_ROOT}" | awk 'NR==2{gsub("%",""); print $5}')
    if (( disk_pct < 80 )); then
        pass "Disk: ${disk_info}"
    else
        warn_ "Disk space: ${disk_info}"
    fi

    # File descriptors
    local fd_count; fd_count=$(cat /proc/sys/fs/file-nr | awk '{print $1}')
    local fd_max; fd_max=$(cat /proc/sys/fs/file-max)
    local fd_pct; fd_pct=$(echo "$fd_count $fd_max" | awk '{printf "%.0f", $1/$2*100}')
    pass "File descriptors: ${fd_count}/${fd_max} (${fd_pct}% used)"
}

# ─── Section: Kernel Optimizations ───────────────────────────────────────────
check_kernel_optimizations() {
    section "Kernel Optimisations"

    local issues=0

    check_sysctl() {
        local key="$1" expected="$2"
        local actual; actual=$(sysctl -n "$key" 2>/dev/null || echo "N/A")
        if [[ "$actual" == "$expected" ]]; then
            pass "${key}: ${actual}"
        else
            warn_ "${key}: ${actual} (expected ${expected})"
            (( issues++ ))
        fi
    }

    check_sysctl "vm.swappiness"               "10"
    check_sysctl "vm.max_map_count"             "262144"
    check_sysctl "fs.file-max"                  "2097152"
    check_sysctl "net.core.somaxconn"           "65535"
    check_sysctl "net.ipv4.tcp_congestion_control" "bbr"

    # THP
    local thp; thp=$(cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null | grep -o '\[.*\]' | tr -d '[]' || echo "unknown")
    if [[ "$thp" == "never" ]]; then
        pass "Transparent Huge Pages: disabled"
    else
        warn_ "THP not disabled: ${thp} (Redis/Weaviate prefer never)"
        (( issues++ ))
    fi

    if (( issues > 0 )); then
        warn_ "Kernel not fully optimised — run: ./scripts/system-optimize.sh"
    fi
}

# ─── Section: Configuration Files ─────────────────────────────────────────────
check_configuration() {
    section "Configuration"

    [[ -f "${PROJECT_ROOT}/.env" ]]                   && pass ".env file: exists"          || fail ".env file: missing"
    [[ -f "${COMPOSE_FILE}" ]]                         && pass "docker-compose.yml: exists" || fail "docker-compose.yml: missing"
    [[ -f "${PROJECT_ROOT}/.env.example" ]]            && pass ".env.example: exists"       || warn_ ".env.example: missing"

    # .env validation
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        local missing_keys=()
        for key in OPENAI_API_KEY DB_PASSWORD; do
            if ! grep -qE "^${key}=.+" "${PROJECT_ROOT}/.env" 2>/dev/null; then
                missing_keys+=("$key")
            fi
        done
        if [[ ${#missing_keys[@]} -eq 0 ]]; then
            pass ".env keys: all required keys set"
        else
            warn_ ".env missing values for: ${missing_keys[*]}"
        fi
    fi

    # Docker daemon config
    [[ -f /etc/docker/daemon.json ]] && pass "Docker daemon.json: present" || warn_ "Docker daemon.json: not configured"
}

# ─── Section: Backup Status ───────────────────────────────────────────────────
check_backups() {
    section "Backup Status"

    local backup_dir="${PROJECT_ROOT}/data/backups"
    if [[ -d "$backup_dir" ]]; then
        local backup_count; backup_count=$(find "$backup_dir" -maxdepth 1 -type d | wc -l)
        (( backup_count-- ))  # subtract parent dir
        if (( backup_count > 0 )); then
            local latest; latest=$(find "$backup_dir" -maxdepth 1 -type d -not -name "backups" | sort -r | head -1)
            local latest_age; latest_age=$(( ( $(date +%s) - $(stat -c %Y "$latest" 2>/dev/null || date +%s) ) / 3600 ))
            pass "Backups found: ${backup_count} (latest: ${latest_age}h ago)"
            if (( latest_age > 48 )); then
                warn_ "No backup in 48+ hours — run: ./scripts/manage.sh backup"
            fi
        else
            warn_ "No backups found — run: ./scripts/manage.sh backup"
        fi
    else
        warn_ "Backup directory not found: ${backup_dir}"
    fi
}

# ─── Section: MCP Server ─────────────────────────────────────────────────────
check_mcp() {
    section "MCP Server"

    local mcp_container; mcp_container=$(docker ps --filter name=mcp --format '{{.Names}}' | head -1)
    if [[ -n "$mcp_container" ]]; then
        container_running "MCP Server" "$mcp_container"
        http_ok "MCP Server health" "http://localhost:8002/health"
    else
        warn_ "MCP Server container not detected"
    fi
}

# ─── Summary ──────────────────────────────────────────────────────────────────
show_summary() {
    echo -e ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  Health Check Summary${NC}"
    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ${GREEN}Passed:   ${PASS}${NC}"
    echo -e "  ${YELLOW}Warnings: ${WARN_COUNT}${NC}"
    echo -e "  ${RED}Failed:   ${FAIL}${NC}"

    if [[ ${#ISSUES[@]} -gt 0 ]]; then
        echo -e ""
        echo -e "  ${BOLD}Issues:${NC}"
        for issue in "${ISSUES[@]}"; do
            if [[ "$issue" == FAIL:* ]]; then
                echo -e "    ${CROSS} ${issue#FAIL: }"
            else
                echo -e "    ${WARN}  ${issue#WARN: }"
            fi
        done
    fi

    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if (( FAIL == 0 && WARN_COUNT == 0 )); then
        echo -e "  ${GREEN}${BOLD}All systems nominal ✓${NC}"
        exit 0
    elif (( FAIL == 0 )); then
        echo -e "  ${YELLOW}${BOLD}System healthy with ${WARN_COUNT} warning(s)${NC}"
        exit 0
    else
        echo -e "  ${RED}${BOLD}${FAIL} critical issue(s) detected — review above${NC}"
        exit 1
    fi
    echo -e ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    local verbose=false
    local sections=("containers" "endpoints" "weaviate" "postgres" "redis" "system" "kernel" "config" "backups" "mcp")

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -v|--verbose) verbose=true ;;
            --only)       shift; sections=("$@"); break ;;
            --help|-h)
                echo "Usage: $0 [--verbose] [--only <section>...]"
                echo "Sections: containers endpoints weaviate postgres redis system kernel config backups mcp"
                exit 0 ;;
            *) echo "Unknown: $1" ;;
        esac
        shift
    done

    echo -e "${BLUE}${BOLD}"
    echo -e "╔══════════════════════════════════════════════════════════════════╗"
    echo -e "║         AI Memory System — Deep Health Check                   ║"
    echo -e "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "  $(date '+%Y-%m-%d %H:%M:%S') — $(hostname)"
    echo -e ""

    for section in "${sections[@]}"; do
        case "$section" in
            containers) check_containers ;;
            endpoints)  check_endpoints ;;
            weaviate)   check_weaviate ;;
            postgres)   check_postgres ;;
            redis)      check_redis ;;
            system)     check_system_resources ;;
            kernel)     check_kernel_optimizations ;;
            config)     check_configuration ;;
            backups)    check_backups ;;
            mcp)        check_mcp ;;
        esac
    done

    show_summary
}

main "$@"
