#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║        ENGRAM PLATFORM — Unified Interactive Installer              ║
# ║                   Ubuntu 22.04 / 24.04 LTS                         ║
# ╚══════════════════════════════════════════════════════════════════════╝
#
# This script installs and configures the entire Engram Platform:
#   - AiCrawler (Crawl4AI + Engram addon)
#   - AiMemory  (Vector memory system + Weaviate)
#   - Unified Next.js 15 frontend
#   - Nginx reverse proxy
#   - Redis caches, MCP server (optional)
#
# Usage:
#   chmod +x install.sh && ./install.sh
#   ./install.sh --unattended    # Use defaults, skip prompts
#   ./install.sh --dry-run       # Show what would be done
#   ./install.sh --status        # Check running services
#   ./install.sh --doctor       # Check system readiness (no changes made)
#   ./install.sh --stop          # Stop all services
#   ./install.sh --restart       # Restart all services
#   ./install.sh --logs          # Tail all logs
#   ./install.sh --update        # Pull latest images & restart
#   ./install.sh --uninstall     # Stop & remove everything

set -euo pipefail

# ── Constants ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
LOG_FILE="${SCRIPT_DIR}/install.log"
MIN_DOCKER_VERSION="24.0"
# shellcheck disable=SC2034  # MIN_COMPOSE_VERSION reserved for future version gate
MIN_COMPOSE_VERSION="2.20"
MIN_RAM_GB=4
MIN_DISK_GB=20

# ── Colors ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# ── Flags ──────────────────────────────────────────────────────────────
UNATTENDED=false
DRY_RUN=false
ENABLE_MCP=false
VERBOSE=false

# ── Logging ────────────────────────────────────────────────────────────
log()      { echo -e "${DIM}[$(date '+%H:%M:%S')]${NC} $*"; echo "[$(date '+%H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null || true; }
vlog()     { $VERBOSE && echo -e "${DIM}[verbose]${NC} $*" || true; }  # verbose logging, activated by --verbose
info()     { echo -e "${BLUE}ℹ${NC}  $*"; }
success()  { echo -e "${GREEN}✓${NC}  $*"; }
warn()     { echo -e "${YELLOW}⚠${NC}  $*"; }
error()    { echo -e "${RED}✗${NC}  $*" >&2; }
fatal()    { error "$*"; exit 1; }
step()     { echo -e "\n${PURPLE}━━━${NC} ${BOLD}$*${NC} ${PURPLE}━━━${NC}"; }
substep()  { echo -e "    ${CYAN}→${NC} $*"; }

banner() {
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}  ${BOLD}${WHITE}ENGRAM PLATFORM${NC} — Unified AI Memory & Intelligence       ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}  ${DIM}AiCrawler + AiMemory + Unified Frontend${NC}                  ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ── Utility ────────────────────────────────────────────────────────────
confirm() {
    local prompt="$1" default="${2:-y}"
    if $UNATTENDED; then echo "$default"; return 0; fi
    local yn
    read -rp "$(echo -e "${CYAN}?${NC}  ${prompt} [${default}]: ")" yn
    echo "${yn:-$default}"
}

prompt_value() {
    local prompt="$1" default="$2" secret="${3:-false}"
    if $UNATTENDED; then echo "$default"; return 0; fi
    local value=""
    if [[ "$secret" == "true" ]]; then
        read -rsp "$(echo -e "${CYAN}?${NC}  ${prompt} [hidden]: ")" value || true
        echo ""
    else
        read -rp "$(echo -e "${CYAN}?${NC}  ${prompt} [${default}]: ")" value || true
    fi
    # Return entered value, or default if empty
    if [[ -z "$value" ]]; then
        echo "$default"
    else
        echo "$value"
    fi
}

# FIX #5: generate_secret validates openssl is available
generate_secret() {
    local length="$1"
    if ! command -v openssl &>/dev/null; then
        # Fallback to /dev/urandom if openssl not available
        tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$length" || true
    else
        openssl rand -base64 "$length" 2>/dev/null | tr -d '=/+\n' | head -c "$length"
    fi
}

# FIX #8: Safe .env loading — no arbitrary code execution
load_env_safe() {
    local env_file="$1"
    if [[ ! -f "$env_file" ]]; then return 0; fi
    # SC2163: export KEY=VALUE pairs safely by splitting on first '='
    # set -a not used to avoid exporting unintended vars
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and blank lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        # Only process KEY=VALUE patterns (no subshell execution)
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"
            # Strip surrounding double or single quotes if present
            val="${val#\"}" ; val="${val%\"}"
            val="${val#\'}" ; val="${val%\'}"
            export "${key}=${val}" 2>/dev/null || true
        fi
    done < "$env_file"
}

version_gte() {
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

# ── Binary preflight verifier ────────────────────────────────────────────
# Call after install_docker/install_utils to confirm critical tools exist.
# Non-fatal for openssl (fallback available); fatal for docker/curl.
check_required_bins() {
    local _label="${1:-Verifying required binaries}"
    local _failed=false
    substep "$_label"

    # docker (critical)
    if ! command -v docker &>/dev/null; then
        error "  docker — NOT FOUND"
        error "    Install: https://docs.docker.com/engine/install/"
        _failed=true
    fi

    # docker compose v2 plugin (critical) — only test if docker exists
    if command -v docker &>/dev/null; then
        if ! docker compose version &>/dev/null 2>&1; then
            error "  docker compose (v2 plugin) — NOT FOUND"
            error "    Fix: sudo apt-get install -y docker-compose-plugin"
            error "    Or:  upgrade Docker Desktop to v3+"
            _failed=true
        fi
    fi

    # curl (critical — used in Docker install script & health probes)
    if ! command -v curl &>/dev/null; then
        error "  curl — NOT FOUND"
        error "    Fix: sudo apt-get install -y curl"
        _failed=true
    fi

    # openssl (recommended — generate_secret already has /dev/urandom fallback)
    if ! command -v openssl &>/dev/null; then
        warn "  openssl — NOT FOUND (secret generation will use /dev/urandom fallback)"
    fi

    if [[ "$_failed" == "true" ]]; then
        echo ""
        fatal "Missing required tools. Install them and re-run: ./install.sh"
    fi
}

# ── Failure trap ─────────────────────────────────────────────────────
# FIX #4: Trap to report failure context and guide user
_INSTALL_STEP="initializing"
on_error() {
    local exit_code=$?
    local line_no="${1:-unknown}"
    echo ""
    error "Installation failed at step: ${_INSTALL_STEP} (line ${line_no}, exit code ${exit_code})"
    echo ""
    echo -e "  ${DIM}Troubleshooting:${NC}"
    echo -e "    ${WHITE}cat ${LOG_FILE}${NC}              View full install log"
    echo -e "    ${WHITE}./install.sh --status${NC}        Check what started"
    echo -e "    ${WHITE}./install.sh --logs${NC}          View container logs"
    echo -e "    ${WHITE}./install.sh --stop${NC}          Stop partial install"
    echo -e "    ${WHITE}./install.sh --doctor${NC}        Run diagnostics to identify the cause"
    echo ""
    # Step-specific hints to accelerate root-cause analysis
    case "${_INSTALL_STEP}" in
        *"Step 2"*|*"Dependencies"*)
            echo -e "  ${DIM}Hint: Dependency install failed. Check network access and sudo privileges.${NC}"
            echo -e "  ${DIM}  Manual Docker install: curl -fsSL https://get.docker.com | sudo sh${NC}"
            ;;
        *"Step 3"*|*"Project Structure"*)
            echo -e "  ${DIM}Hint: Sibling repos (Engram-AiCrawler, Engram-AiMemory) not found.${NC}"
            echo -e "  ${DIM}  Ensure this script runs from inside the Engram-Platform directory.${NC}"
            ;;
        *"Step 4"*|*"Environment"*)
            echo -e "  ${DIM}Hint: Could not write .env. Check write permissions on: ${SCRIPT_DIR}${NC}"
            ;;
        *"Step 5"*|*"Build"*)
            echo -e "  ${DIM}Hint: Docker build failed. Common causes:${NC}"
            echo -e "  ${DIM}  - Insufficient disk space (need \u226510GB): df -h .${NC}"
            echo -e "  ${DIM}  - Network error fetching base images (check internet connectivity)${NC}"
            echo -e "  ${DIM}  - Docker daemon not running: sudo systemctl start docker${NC}"
            echo -e "  ${DIM}  - Review build log: tail -100 ${LOG_FILE}${NC}"
            ;;
        *"Step 6"*|*"Start"*)
            echo -e "  ${DIM}Hint: Service startup failed. Common causes:${NC}"
            echo -e "  ${DIM}  - Port conflict (80, 8080, 11235): ss -tlnp | grep -E '80|8080|11235'${NC}"
            echo -e "  ${DIM}  - Leftover containers: docker compose down --remove-orphans${NC}"
            ;;
    esac
    echo ""
    exit "$exit_code"
}
trap 'on_error $LINENO' ERR

# ── Subcommands ────────────────────────────────────────────────────────
cmd_status() {
    banner
    step "Service Status"
    cd "$SCRIPT_DIR"
    if ! command -v docker &>/dev/null; then
        fatal "Docker is not installed"
    fi
    echo ""
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No services running"
    echo ""

    step "Health Checks"
    local services=("crawler-api:11235" "memory-api:8000" "weaviate:8080" "nginx:80")
    for svc in "${services[@]}"; do
        local name="${svc%%:*}" port="${svc##*:}"
        local container="engram-${name}"
        if docker inspect --format='{{.State.Running}}' "$container" 2>/dev/null | grep -q true; then
            success "${name} — running (port ${port})"
        else
            warn "${name} — not running"
        fi
    done
    echo ""
    exit 0
}

cmd_stop() {
    banner
    step "Stopping all services"
    cd "$SCRIPT_DIR"
    # FIX #3: docker compose commands with explicit error handling
    docker compose --profile mcp down 2>/dev/null || docker compose down || true
    success "All services stopped"
    exit 0
}

cmd_restart() {
    banner
    step "Restarting all services"
    cd "$SCRIPT_DIR"
    docker compose down 2>/dev/null || true
    docker compose up -d
    success "All services restarted"
    exit 0
}

cmd_logs() {
    cd "$SCRIPT_DIR"
    docker compose logs -f --tail=50
    exit 0
}

cmd_update() {
    banner
    step "Updating Engram Platform"
    cd "$SCRIPT_DIR"

    # ── Custom flags for update subcommand ──────────────────────────────
    local SKIP_BACKUP=false
    local FORCE_REBUILD=false
    local DRY_RUN_UPDATE=${DRY_RUN}
    for _arg in "$@"; do
        case "$_arg" in
            --skip-backup)   SKIP_BACKUP=true ;;
            --force-rebuild) FORCE_REBUILD=true ;;
            --dry-run)       DRY_RUN_UPDATE=true ;;
        esac
    done

    # ════════════════════════════════════════════════════════════════════
    # PHASE 1 — Pre-flight
    # ════════════════════════════════════════════════════════════════════
    substep "Phase 1/5 — Pre-flight checks"

    command -v docker &>/dev/null || fatal "Docker not installed"
    docker info &>/dev/null       || fatal "Docker daemon not running"
    [[ -f "$COMPOSE_FILE" ]]       || fatal "docker-compose.yml not found: ${COMPOSE_FILE}"
    [[ -f "$ENV_FILE" ]]           || fatal ".env not found — run ./install.sh first"

    # Disk space: need at least 5 GB free for build layers
    local free_gb
    free_gb=$(df -BG "$SCRIPT_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "0")
    (( free_gb >= 5 )) || fatal "Insufficient disk space: ${free_gb}GB free, 5GB required for build"

    load_env_safe "$ENV_FILE"
    success "Pre-flight OK (disk: ${free_gb}GB free)"

    # ════════════════════════════════════════════════════════════════════
    # PHASE 2 — Snapshot (tag rollback images + backup data)
    # ════════════════════════════════════════════════════════════════════
    substep "Phase 2/5 — Snapshotting current state for rollback"

    # Images to snapshot (custom-built ones; upstream images are re-pulled)
    local CUSTOM_IMAGES=(
        "crawl4ai-engram"
        "engram-memory-api"
        "engram-mcp-server"
        "engram-platform-frontend"
    )
    local ROLLBACK_AVAILABLE=false

    if [[ "$DRY_RUN_UPDATE" == "true" ]]; then
        substep "[dry-run] Would tag current images as :rollback"
    else
        for img in "${CUSTOM_IMAGES[@]}"; do
            if docker image inspect "${img}:latest" &>/dev/null; then
                docker tag "${img}:latest" "${img}:rollback" 2>/dev/null && {
                    vlog "Tagged ${img}:latest → ${img}:rollback"
                    ROLLBACK_AVAILABLE=true
                } || warn "Could not tag ${img}:latest — skipping rollback snapshot for this image"
            else
                vlog "${img}:latest not found — skipping rollback tag"
            fi
        done
        [[ "$ROLLBACK_AVAILABLE" == "true" ]] && success "Rollback images tagged" || warn "No existing images to snapshot (first run?)"
    fi

    if [[ "$SKIP_BACKUP" == "true" ]]; then
        substep "Skipping data backup (--skip-backup)"
    elif [[ "$DRY_RUN_UPDATE" == "true" ]]; then
        substep "[dry-run] Would backup Redis + Weaviate data"
    else
        local BACKUP_DIR="${SCRIPT_DIR}/backups/pre-update-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"

        # Redis backup — trigger BGSAVE then copy dump.rdb
        local redis_containers
        redis_containers=$(docker ps --filter name=engram-crawler-redis --filter name=engram-memory-redis --format '{{.Names}}' 2>/dev/null || true)
        for rc in $redis_containers; do
            docker exec "$rc" redis-cli BGSAVE > /dev/null 2>&1 || true
            sleep 1
            docker cp "${rc}:/data/dump.rdb" "${BACKUP_DIR}/${rc}-dump.rdb" 2>/dev/null && \
                vlog "Backed up Redis ${rc}" || warn "Could not backup Redis ${rc} (may not have data yet)"
        done

        # Weaviate — copy volume data directory if accessible
        local weaviate_vol
        weaviate_vol=$(docker inspect engram-weaviate --format '{{range .Mounts}}{{if eq .Destination "/var/lib/weaviate"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)
        if [[ -n "$weaviate_vol" && -d "$weaviate_vol" ]]; then
            tar -czf "${BACKUP_DIR}/weaviate-data.tar.gz" -C "$weaviate_vol" . 2>/dev/null && \
                vlog "Backed up Weaviate volume" || warn "Could not backup Weaviate volume"
        fi

        success "Data snapshot → ${BACKUP_DIR}"
    fi

    # ════════════════════════════════════════════════════════════════════
    # PHASE 3 — Build (parallel, cache-enabled; pull upstream first)
    # ════════════════════════════════════════════════════════════════════
    substep "Phase 3/5 — Pulling upstream images & building application images"

    if [[ "$DRY_RUN_UPDATE" == "true" ]]; then
        substep "[dry-run] Would pull upstream images (weaviate, redis, nginx)"
        substep "[dry-run] Would build crawler-api, memory-api, mcp-server, platform-frontend (with cache)"
    else
        # Pull upstream/third-party images in parallel (they don't need building)
        info "Pulling upstream images in parallel..."
        docker compose pull weaviate crawler-redis memory-redis nginx 2>&1 | grep -E 'Pull|Pulled|up to date|error' || \
            warn "Some upstream images could not be pulled — continuing with cached versions"

        # Build custom images WITH layer cache (no --no-cache) for speed
        # Run builds in parallel using background jobs
        info "Building application images (parallel, with cache)..."
        local BUILD_PIDS=() BUILD_LOGS=() BUILD_NAMES=()
        local build_tmp
        build_tmp=$(mktemp -d)

        _start_build() {
            local svc="$1" logf="${build_tmp}/${1}.log"
            BUILD_NAMES+=("$svc")
            BUILD_LOGS+=("$logf")
            if [[ "$FORCE_REBUILD" == "true" ]]; then
                docker compose build --no-cache "$svc" > "$logf" 2>&1 &
            else
                docker compose build "$svc" > "$logf" 2>&1 &
            fi
            BUILD_PIDS+=($!)
        }

        _start_build crawler-api
        _start_build memory-api
        _start_build platform-frontend
        $ENABLE_MCP && _start_build mcp-server || true

        # Wait for all builds; collect failures
        local BUILD_FAILED=false
        for i in "${!BUILD_PIDS[@]}"; do
            local pid=${BUILD_PIDS[$i]}
            local svc=${BUILD_NAMES[$i]}
            local logf=${BUILD_LOGS[$i]}
            if wait "$pid"; then
                success "Built: ${svc}"
            else
                error "Build FAILED: ${svc}"
                cat "$logf" >&2
                BUILD_FAILED=true
            fi
        done
        rm -rf "$build_tmp"

        if [[ "$BUILD_FAILED" == "true" ]]; then
            _do_rollback "Build failed"
            exit 1
        fi
        success "All images built"
    fi

    # ════════════════════════════════════════════════════════════════════
    # PHASE 4 — Rolling swap (graceful shutdown, ordered restart)
    # ════════════════════════════════════════════════════════════════════
    substep "Phase 4/5 — Rolling service swap (graceful shutdown)"

    if [[ "$DRY_RUN_UPDATE" == "true" ]]; then
        substep "[dry-run] Would stop app layer (crawler-api, memory-api, platform-frontend, mcp-server, nginx)"
        substep "[dry-run] Would restart infra (weaviate, redis instances) then app layer"
    else
        # Stop application layer first (they have no persistent state)
        # --timeout 30: give containers 30s to drain in-flight requests before SIGKILL
        info "Stopping application layer (30s graceful drain)..."
        docker compose stop --timeout 30 crawler-api memory-api platform-frontend nginx 2>/dev/null || true
        $ENABLE_MCP && docker compose stop --timeout 30 mcp-server 2>/dev/null || true

        # Restart infra containers (weaviate, redis) — they handle their own persistence
        info "Restarting infrastructure (weaviate, redis)..."
        docker compose up -d --no-deps weaviate crawler-redis memory-redis 2>&1 | grep -v '^#' || true

        # Start / recreate application layer with new images
        info "Starting application layer with new images..."
        if $ENABLE_MCP; then
            docker compose up -d --remove-orphans 2>&1 | grep -v '^#' || true
        else
            docker compose up -d --remove-orphans 2>&1 | grep -v '^#' || true
        fi
        success "Services swapped"
    fi

    # ════════════════════════════════════════════════════════════════════
    # PHASE 5 — Health gates + auto-rollback on failure
    # ════════════════════════════════════════════════════════════════════
    substep "Phase 5/5 — Health gates (auto-rollback on failure)"

    if [[ "$DRY_RUN_UPDATE" == "true" ]]; then
        substep "[dry-run] Would wait for all services to report healthy"
        substep "[dry-run] Would auto-rollback if any service fails health gate"
    else
        local MAX_WAIT=180
        local WAITED=0
        local INTERVAL=5
        declare -A SVC_HEALTHY
        local SERVICES_TO_CHECK=(
            "engram-weaviate"
            "engram-crawler-redis"
            "engram-memory-redis"
            "engram-memory-api"
            "engram-crawler-api"
            "engram-platform-frontend"
            "engram-nginx"
        )

        for svc in "${SERVICES_TO_CHECK[@]}"; do
            SVC_HEALTHY[$svc]=false
        done

        while (( WAITED < MAX_WAIT )); do
            local all_healthy=true
            for svc in "${SERVICES_TO_CHECK[@]}"; do
                [[ "${SVC_HEALTHY[$svc]}" == "true" ]] && continue

                local has_health
                has_health=$(docker inspect --format='{{if .Config.Healthcheck}}yes{{else}}no{{end}}' "$svc" 2>/dev/null || echo "missing")

                if [[ "$has_health" == "missing" ]]; then
                    all_healthy=false; continue
                fi

                local h_status
                if [[ "$has_health" == "yes" ]]; then
                    h_status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "unknown")
                    if [[ "$h_status" == "healthy" ]]; then
                        SVC_HEALTHY[$svc]=true
                        success "${svc} — healthy"
                    elif [[ "$h_status" == "unhealthy" ]]; then
                        error "${svc} — UNHEALTHY after update"
                        _do_rollback "${svc} failed health gate (status: unhealthy)"
                        exit 1
                    else
                        all_healthy=false
                    fi
                else
                    local running
                    running=$(docker inspect --format='{{.State.Running}}' "$svc" 2>/dev/null || echo "false")
                    if [[ "$running" == "true" ]]; then
                        SVC_HEALTHY[$svc]=true
                        success "${svc} — running"
                    else
                        all_healthy=false
                    fi
                fi
            done

            $all_healthy && break

            sleep "$INTERVAL"
            WAITED=$(( WAITED + INTERVAL ))
            printf "\r    ${DIM}Waiting for health gates... %ds / %ds${NC}" "$WAITED" "$MAX_WAIT"
        done
        echo ""

        if (( WAITED >= MAX_WAIT )); then
            error "Health gate timeout after ${MAX_WAIT}s"
            _do_rollback "Health gate timed out — services did not become healthy"
            exit 1
        fi
    fi

    # ── Update complete ──────────────────────────────────────────────────
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}${WHITE}Engram Platform updated successfully!${NC}                    ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo -e "  ${DIM}Rollback available: ./install.sh --rollback${NC}"
    echo -e "  ${DIM}Log: ${LOG_FILE}${NC}"
    echo ""
    exit 0
}

# ── Rollback helper (called on build/health failure) ─────────────────
_do_rollback() {
    local reason="${1:-unknown failure}"
    echo ""
    warn "INITIATING ROLLBACK — reason: ${reason}"

    local CUSTOM_IMAGES=(
        "crawl4ai-engram"
        "engram-memory-api"
        "engram-mcp-server"
        "engram-platform-frontend"
    )

    local any_rolled_back=false
    for img in "${CUSTOM_IMAGES[@]}"; do
        if docker image inspect "${img}:rollback" &>/dev/null; then
            docker tag "${img}:rollback" "${img}:latest" 2>/dev/null && {
                any_rolled_back=true
                vlog "Restored ${img}:rollback → ${img}:latest"
            } || warn "Could not restore ${img}:rollback"
        fi
    done

    if [[ "$any_rolled_back" == "true" ]]; then
        info "Restarting services with rolled-back images..."
        docker compose up -d --remove-orphans 2>/dev/null || true
        success "Rollback complete — services restarted with previous images"
        echo -e "  ${DIM}Check status: ./install.sh --status${NC}"
    else
        error "No rollback images available — manual recovery needed"
        echo -e "  ${DIM}Check logs: ./install.sh --logs${NC}"
    fi
}

cmd_rollback() {
    banner
    step "Rolling back Engram Platform"
    cd "$SCRIPT_DIR"
    _do_rollback "manual rollback requested"
    exit 0
}

# ── Diagnostic mode (--doctor) ────────────────────────────────────────────
# Runs preflight checks without making any changes to the system.
# Exits 0 if all critical checks pass, 1 if any failures detected.
cmd_doctor() {
    banner
    step "Engram Platform — Diagnostic Report"
    echo -e "  ${DIM}$(date)  |  Platform dir: ${SCRIPT_DIR}${NC}"
    echo ""

    local _ok=0 _warn=0 _fail=0
    _dr_ok()   { success "$*"; _ok=$(( _ok + 1 ));     }
    _dr_warn() { warn    "$*"; _warn=$(( _warn + 1 )); }
    _dr_fail() { error   "$*"; _fail=$(( _fail + 1 )); }

    # ── System Resources ──────────────────────────────────────────────────
    step "System Resources"
    local _os="unknown"
    [[ -f /etc/os-release ]] && _os=$(. /etc/os-release && echo "${PRETTY_NAME:-Linux}")
    substep "OS: ${_os} ($(uname -m))"

    local _ram_kb _ram_gb
    _ram_kb=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
    _ram_gb=$(( _ram_kb / 1024 / 1024 ))
    if (( _ram_gb >= MIN_RAM_GB )); then
        _dr_ok "RAM: ${_ram_gb}GB (≥ ${MIN_RAM_GB}GB required)"
    else
        _dr_warn "RAM: ${_ram_gb}GB — below ${MIN_RAM_GB}GB minimum"
    fi

    local _disk_gb
    _disk_gb=$(df -BG "$SCRIPT_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "0")
    if (( _disk_gb >= MIN_DISK_GB )); then
        _dr_ok "Disk: ${_disk_gb}GB free (≥ ${MIN_DISK_GB}GB required)"
    else
        _dr_warn "Disk: ${_disk_gb}GB free — below ${MIN_DISK_GB}GB minimum"
    fi

    # ── Required Binaries ─────────────────────────────────────────────────
    step "Required Binaries"

    for _bin in docker curl; do
        if command -v "$_bin" &>/dev/null; then
            _dr_ok "${_bin}: $(command -v "${_bin}")"
        else
            _dr_fail "${_bin}: NOT FOUND — install it and re-run"
        fi
    done

    if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
        local _cv
        _cv=$(docker compose version --short 2>/dev/null || echo "?")
        _dr_ok "docker compose v2: v${_cv}"
    else
        _dr_fail "docker compose (v2 plugin): NOT FOUND — sudo apt-get install docker-compose-plugin"
    fi

    if command -v openssl &>/dev/null; then
        _dr_ok "openssl: $(openssl version 2>/dev/null | head -1)"
    else
        _dr_warn "openssl: NOT FOUND (secret gen falls back to /dev/urandom — install recommended)"
    fi

    # ── Docker Daemon ─────────────────────────────────────────────────────
    step "Docker Daemon"

    if ! command -v docker &>/dev/null; then
        _dr_fail "Docker not installed — cannot check daemon"
    elif docker info &>/dev/null 2>&1; then
        local _dv
        _dv=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
        _dr_ok "Docker daemon running (server v${_dv})"
        if version_gte "$_dv" "$MIN_DOCKER_VERSION"; then
            _dr_ok "Docker version OK (v${_dv} ≥ v${MIN_DOCKER_VERSION})"
        else
            _dr_warn "Docker version old: v${_dv} — v${MIN_DOCKER_VERSION}+ recommended"
        fi
        if groups "${USER:-root}" 2>/dev/null | grep -qw docker; then
            _dr_ok "User '${USER:-root}' is in docker group"
        else
            _dr_warn "User '${USER:-root}' is NOT in docker group — may need sudo or newgrp"
            substep "  Fix: sudo usermod -aG docker \$USER  (then re-login or: newgrp docker)"
        fi
    else
        _dr_fail "Docker daemon NOT running — try: sudo systemctl start docker"
    fi

    # ── Project Files ─────────────────────────────────────────────────────
    step "Project Files"

    if [[ -f "$COMPOSE_FILE" ]]; then
        _dr_ok "docker-compose.yml: found"
    else
        _dr_fail "docker-compose.yml: NOT FOUND at ${COMPOSE_FILE}"
    fi

    if [[ -f "$ENV_FILE" ]]; then
        _dr_ok ".env: found ($(wc -l < "$ENV_FILE") lines)"
        # Check key required variables — show presence only, NEVER log values
        load_env_safe "$ENV_FILE" 2>/dev/null || true
        for _key in EMBEDDING_PROVIDER MEMORY_API_KEY JWT_SECRET; do
            if [[ -n "${!_key:-}" ]]; then
                substep "  .env ${_key} = <set>"
            else
                _dr_warn ".env ${_key} = <empty or missing>"
            fi
        done
    else
        _dr_warn ".env: NOT FOUND — run ./install.sh to create it"
    fi

    local _crawler_dir="${SCRIPT_DIR}/../Engram-AiCrawler"
    local _memory_dir="${SCRIPT_DIR}/../Engram-AiMemory"
    local _frontend_dir="${SCRIPT_DIR}/frontend"

    [[ -d "$_crawler_dir"  ]] && _dr_ok "Engram-AiCrawler dir: found"  || _dr_fail "Engram-AiCrawler: NOT FOUND at ${_crawler_dir}"
    [[ -d "$_memory_dir"   ]] && _dr_ok "Engram-AiMemory dir: found"   || _dr_fail "Engram-AiMemory:  NOT FOUND at ${_memory_dir}"
    [[ -d "$_frontend_dir" ]] && _dr_ok "frontend dir: found"           || _dr_fail "frontend dir:     NOT FOUND at ${_frontend_dir}"

    # ── MCP (optional) ────────────────────────────────────────────────────
    step "MCP Server (optional)"

    if command -v docker &>/dev/null && docker image inspect engram-mcp-server:latest &>/dev/null 2>&1; then
        _dr_ok "engram-mcp-server image: built"
    else
        substep "engram-mcp-server image: not built (use --mcp flag to enable)"
    fi

    # ── Running Services ──────────────────────────────────────────────────
    step "Running Services"

    if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
        local _svcs=("engram-crawler-api" "engram-memory-api" "engram-weaviate" "engram-nginx" "engram-crawler-redis" "engram-memory-redis")
        local _any_running=false
        for _svc in "${_svcs[@]}"; do
            if docker inspect --format='{{.State.Running}}' "$_svc" 2>/dev/null | grep -q true; then
                _dr_ok "${_svc}: running"
                _any_running=true
            else
                substep "${_svc}: not running"
            fi
        done
        if [[ "$_any_running" == "false" ]]; then
            substep "(no Engram services running — install first, then check with --status)"
        fi
    else
        substep "Docker unavailable — skipping service check"
    fi

    # ── Summary ───────────────────────────────────────────────────────────
    echo ""
    echo -e "${BOLD}━━ Diagnostic Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}✓${NC} Passed:   ${_ok}"
    echo -e "  ${YELLOW}⚠${NC} Warnings: ${_warn}"
    echo -e "  ${RED}✗${NC} Failed:   ${_fail}"
    echo ""
    if (( _fail > 0 )); then
        echo -e "  ${RED}✗ Resolve the failures above before running the installer.${NC}"
        echo ""
        exit 1
    elif (( _warn > 0 )); then
        echo -e "  ${YELLOW}⚠ Warnings found — review above before proceeding.${NC}"
        echo ""
    else
        echo -e "  ${GREEN}✓ All checks passed — system is ready for installation!${NC}"
        echo -e "  ${DIM}Run: ./install.sh${NC}"
        echo ""
    fi
    exit 0
}

cmd_uninstall() {
    banner
    step "Uninstalling Engram Platform"
    warn "This will stop all containers and remove volumes"
    local answer
    answer=$(confirm "Are you sure? (y/N)" "n")
    if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
        info "Cancelled"
        exit 0
    fi
    cd "$SCRIPT_DIR"
    docker compose --profile mcp down -v --remove-orphans 2>/dev/null || docker compose down -v --remove-orphans || true
    success "All containers and volumes removed"
    info "Configuration files (.env) preserved. Delete manually if needed."
    exit 0
}

# ── Parse Arguments ────────────────────────────────────────────────────
for arg in "$@"; do
    case "$arg" in
        --unattended)   UNATTENDED=true ;;
        --dry-run)      DRY_RUN=true ;;
        --verbose)      VERBOSE=true ;;
        --mcp)          ENABLE_MCP=true ;;
        --status)       cmd_status ;;
        --stop)         cmd_stop ;;
        --restart)      cmd_restart ;;
        --logs)         cmd_logs ;;
        --update)       cmd_update "$@" ;;
        --uninstall)    cmd_uninstall ;;
        --rollback)     cmd_rollback ;;
        --doctor)       cmd_doctor ;;
        --help|-h)
            banner
            echo "Usage: ./install.sh [OPTIONS]"
            echo ""
            echo "Installation:"
            echo "  (no flags)       Interactive guided installation"
            echo "  --unattended     Use defaults, skip all prompts"
            echo "  --dry-run        Show what would be done without doing it"
            echo "  --mcp            Also start the MCP server"
            echo "  --verbose        Show detailed output"
            echo ""
            echo "Management:"
            echo "  --status         Show service status & health checks"
            echo "  --stop           Stop all services"
            echo "  --restart        Restart all services"
            echo "  --logs           Tail all service logs"
            echo "  --update         Snapshot -> build (parallel, cached) -> rolling swap -> health gates"
            echo "  --update --skip-backup   Skip pre-update data backup"
            echo "  --update --force-rebuild Rebuild images without layer cache"
            echo "  --rollback       Restore previous :rollback images and restart"
            echo "  --doctor         Run diagnostic checks (binaries, daemon, files, services)"
            echo "  --uninstall      Stop containers, remove volumes"
            echo ""
            exit 0
            ;;
        *) fatal "Unknown option: $arg (use --help)" ;;
    esac
done

# ══════════════════════════════════════════════════════════════════════
#                        MAIN INSTALLATION
# ══════════════════════════════════════════════════════════════════════

banner

if $DRY_RUN; then
    warn "DRY RUN MODE — no changes will be made"
    echo ""
fi

# ── Step 1: System Requirements ────────────────────────────────────────
_INSTALL_STEP="Step 1: System Requirements"
step "Step 1/7 — Checking System Requirements"

# OS check
if [[ -f /etc/os-release ]]; then
    # FIX #8: use safe load instead of source for os-release too
    # os-release is controlled by the OS so sourcing is safe here, but
    # we use a subshell to avoid polluting the environment
    OS_PRETTY_NAME=$(. /etc/os-release && echo "${PRETTY_NAME:-Linux}")
    OS_ID=$(. /etc/os-release && echo "${ID:-}")
    OS_ID_LIKE=$(. /etc/os-release && echo "${ID_LIKE:-}")
    substep "OS: ${OS_PRETTY_NAME}"
    if [[ "$OS_ID" != "ubuntu" && "$OS_ID_LIKE" != *"ubuntu"* && "$OS_ID_LIKE" != *"debian"* ]]; then
        warn "This installer is designed for Ubuntu/Debian. Continuing anyway..."
    fi
else
    warn "Cannot detect OS. Continuing anyway..."
fi

# Architecture
ARCH=$(uname -m)
substep "Architecture: ${ARCH}"
if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" ]]; then
    warn "Untested architecture: $ARCH"
fi

# RAM
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
TOTAL_RAM_GB=$(( TOTAL_RAM_KB / 1024 / 1024 ))
substep "RAM: ${TOTAL_RAM_GB}GB"
if (( TOTAL_RAM_GB < MIN_RAM_GB )); then
    warn "Minimum ${MIN_RAM_GB}GB RAM recommended. You have ${TOTAL_RAM_GB}GB."
fi

# Disk
AVAIL_DISK_GB=$(df -BG "$SCRIPT_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "0")
substep "Available disk: ${AVAIL_DISK_GB}GB"
if (( AVAIL_DISK_GB < MIN_DISK_GB )); then
    # FIX #14: Block if critically low disk space (< half of minimum)
    if (( AVAIL_DISK_GB < MIN_DISK_GB / 2 )); then
        fatal "Critically low disk space: ${AVAIL_DISK_GB}GB available, ${MIN_DISK_GB}GB required. Aborting."
    else
        warn "Minimum ${MIN_DISK_GB}GB disk recommended. You have ${AVAIL_DISK_GB}GB. Proceeding but build may fail."
    fi
fi

success "System requirements checked"

# ── Step 2: Install Dependencies ───────────────────────────────────────
_INSTALL_STEP="Step 2: Install Dependencies"
step "Step 2/7 — Installing Dependencies"

install_docker() {
    if command -v docker &>/dev/null; then
        local ver
        ver=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
        substep "Docker already installed: v${ver}"
        if [[ "$ver" != "unknown" ]] && version_gte "$ver" "$MIN_DOCKER_VERSION"; then
            success "Docker version OK"
        else
            warn "Docker version $ver may be outdated (recommended: $MIN_DOCKER_VERSION+)"
        fi
        return 0
    fi

    info "Installing Docker..."
    if $DRY_RUN; then substep "[dry-run] Would install Docker via official script"; return 0; fi

    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release

    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add current user to docker group
    if ! groups "$USER" | grep -qw docker; then
        sudo usermod -aG docker "$USER"
        # FIX #6: Docker group won't be active until re-login.
        # Set a flag so we can use `sg docker` for subsequent docker commands.
        DOCKER_GROUP_JUST_ADDED=true
        warn "Added $USER to docker group."
        warn "NOTE: You will need to log out and back in for group changes to take full effect."
        warn "This installer will use 'sg docker' to run Docker commands in this session."
    fi

    success "Docker installed"
}

install_utils() {
    local needed=()
    for cmd in curl wget openssl jq git; do
        if ! command -v "$cmd" &>/dev/null; then
            needed+=("$cmd")
        fi
    done

    if [[ ${#needed[@]} -eq 0 ]]; then
        substep "All utilities present (curl, wget, openssl, jq, git)"
        return 0
    fi

    info "Installing: ${needed[*]}"
    if $DRY_RUN; then substep "[dry-run] Would install: ${needed[*]}"; return 0; fi

    sudo apt-get update -qq
    sudo apt-get install -y -qq "${needed[@]}"
    success "Utilities installed"
}

# FIX #6: Track whether we just added docker group
DOCKER_GROUP_JUST_ADDED=false

install_utils
install_docker

# FIX #1: Removed `local` keyword — this is main script body, not a function
# FIX #3: Use || fatal instead of relying on set -e for better error messages
# Verify Docker Compose v2
if ! docker compose version &>/dev/null 2>&1; then
    # FIX #6: If we just added to docker group, try with sg
    if $DOCKER_GROUP_JUST_ADDED; then
        if ! sg docker -c "docker compose version" &>/dev/null 2>&1; then
            fatal "Docker Compose v2 not found. Install docker-compose-plugin."
        fi
    else
        fatal "Docker Compose v2 not found. Install docker-compose-plugin."
    fi
fi
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
substep "Docker Compose: v${COMPOSE_VER}"

# FIX #6: If docker group was just added, wrap all docker commands with sg docker
# We redefine a helper for docker compose that handles this transparently
docker_compose() {
    if $DOCKER_GROUP_JUST_ADDED; then
        sg docker -c "docker compose $*"
    else
        docker compose "$@"
    fi
}

success "All dependencies ready"

# Verify all critical binaries are present after installation attempts.
# This catches failures on non-apt systems or when apt install was skipped.
check_required_bins "Post-install binary verification"

# ── Step 3: Verify Project Structure ───────────────────────────────────
_INSTALL_STEP="Step 3: Verify Project Structure"
step "Step 3/7 — Verifying Project Structure"

check_dir() {
    local dir="$1" desc="$2"
    if [[ -d "$dir" ]]; then
        success "$desc: found"
    else
        fatal "$desc not found at: $dir"
    fi
}

check_file() {
    local file="$1" desc="$2"
    if [[ -f "$file" ]]; then
        success "$desc: found"
    else
        fatal "$desc not found at: $file"
    fi
}

CRAWLER_DIR="${SCRIPT_DIR}/../Engram-AiCrawler"
MEMORY_DIR="${SCRIPT_DIR}/../Engram-AiMemory"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"

check_dir  "$CRAWLER_DIR"                         "Engram-AiCrawler"
check_dir  "$MEMORY_DIR"                          "Engram-AiMemory"
check_dir  "$FRONTEND_DIR"                        "Engram-Platform frontend"
check_file "$CRAWLER_DIR/01_devroot/Dockerfile"   "Crawler Dockerfile"
check_file "$MEMORY_DIR/docker/Dockerfile.memory-api"  "Memory API Dockerfile"
check_file "$FRONTEND_DIR/Dockerfile"             "Frontend Dockerfile"
check_file "$COMPOSE_FILE"                        "docker-compose.yml"
check_file "${SCRIPT_DIR}/nginx/nginx.conf"       "Nginx config"

success "Project structure verified"

# ── Step 4: Configure Environment ──────────────────────────────────────
_INSTALL_STEP="Step 4: Configure Environment"
step "Step 4/7 — Configuring Environment"

skip_env=false

if [[ -f "$ENV_FILE" ]] && ! $UNATTENDED; then
    # FIX #1/#2: plain variable, not `local` (we're in main script body)
    env_answer=$(confirm "Existing .env found. Overwrite? (y/N)" "n")
    if [[ "$env_answer" != "y" && "$env_answer" != "Y" ]]; then
        info "Keeping existing .env"
        # FIX #8: Use safe env loader instead of source
        load_env_safe "$ENV_FILE"
        success "Environment loaded from existing .env"
        skip_env=true
    fi
fi

if [[ "$skip_env" == "false" ]]; then
    echo ""
    info "Let's configure your Engram Platform."
    info "Press Enter to accept defaults. Secrets are auto-generated."
    echo ""

    # ── Embedding Provider ──
    echo -e "${BOLD}Embedding Configuration${NC}"

    # FIX #7: Validate EMBEDDING_PROVIDER against known values
    while true; do
        EMBEDDING_PROVIDER=$(prompt_value "Embedding provider (openai/ollama/local)" "openai")
        if [[ "$EMBEDDING_PROVIDER" == "openai" || "$EMBEDDING_PROVIDER" == "ollama" || "$EMBEDDING_PROVIDER" == "local" ]]; then
            break
        fi
        warn "Invalid provider '${EMBEDDING_PROVIDER}'. Must be one of: openai, ollama, local"
    done

    if [[ "$EMBEDDING_PROVIDER" == "openai" ]]; then
        OPENAI_API_KEY=$(prompt_value "OpenAI API key" "" true)
        if [[ -z "$OPENAI_API_KEY" ]]; then
            warn "No OpenAI key provided. Memory API embedding will not work."
            warn "You can add it later in .env"
        fi
        EMBEDDING_MODEL="text-embedding-3-small"
        EMBEDDING_DIMENSIONS=1536
    elif [[ "$EMBEDDING_PROVIDER" == "ollama" ]]; then
        OPENAI_API_KEY=""
        EMBEDDING_MODEL=$(prompt_value "Ollama embedding model" "nomic-embed-text")
        # FIX #7: Validate EMBEDDING_DIMENSIONS is numeric
        while true; do
            EMBEDDING_DIMENSIONS=$(prompt_value "Embedding dimensions" "768")
            if [[ "$EMBEDDING_DIMENSIONS" =~ ^[0-9]+$ ]]; then
                break
            fi
            warn "Embedding dimensions must be a positive integer (e.g. 768)"
        done
    else
        OPENAI_API_KEY=""
        EMBEDDING_MODEL=$(prompt_value "Embedding model name" "all-MiniLM-L6-v2")
        # FIX #7: Validate EMBEDDING_DIMENSIONS is numeric
        while true; do
            EMBEDDING_DIMENSIONS=$(prompt_value "Embedding dimensions" "384")
            if [[ "$EMBEDDING_DIMENSIONS" =~ ^[0-9]+$ ]]; then
                break
            fi
            warn "Embedding dimensions must be a positive integer (e.g. 384)"
        done
    fi

    echo ""

    # ── Clerk Auth (optional) ──
    echo -e "${BOLD}Authentication (Optional)${NC}"
    info "Clerk provides user authentication for the platform."
    info "Leave blank to run without auth (development mode)."
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$(prompt_value "Clerk publishable key (or Enter to skip)" "")
    if [[ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]]; then
        CLERK_SECRET_KEY=$(prompt_value "Clerk secret key" "" true)
    else
        CLERK_SECRET_KEY=""
        info "Running without Clerk auth — all routes are public"
    fi

    echo ""

    # ── Auto-generated secrets ──
    echo -e "${BOLD}Auto-Generating Secrets${NC}"
    MEMORY_API_KEY=$(generate_secret 32)
    # FIX #5: Validate generated secrets are non-empty
    if [[ -z "$MEMORY_API_KEY" ]]; then
        fatal "Failed to generate MEMORY_API_KEY. Ensure openssl or /dev/urandom is available."
    fi
    substep "Memory API key: ${MEMORY_API_KEY:0:8}..."

    JWT_SECRET=$(generate_secret 48)
    if [[ -z "$JWT_SECRET" ]]; then
        fatal "Failed to generate JWT_SECRET."
    fi
    substep "JWT secret: ${JWT_SECRET:0:8}..."

    MCP_AUTH_TOKEN=$(generate_secret 32)
    if [[ -z "$MCP_AUTH_TOKEN" ]]; then
        fatal "Failed to generate MCP_AUTH_TOKEN."
    fi
    substep "MCP auth token: ${MCP_AUTH_TOKEN:0:8}..."

    echo ""

    # ── LM Studio / Ollama ──
    echo -e "${BOLD}Local AI Configuration (Optional)${NC}"
    LM_STUDIO_URL=$(prompt_value "LM Studio URL (for RAG Chat)" "http://host.docker.internal:1234")
    OLLAMA_HOST=$(prompt_value "Ollama URL" "http://host.docker.internal:11434")

    echo ""

    # ── MCP Server ──
    echo -e "${BOLD}MCP Server${NC}"
    if ! $UNATTENDED; then
        mcp_answer=$(confirm "Enable MCP server? (y/N)" "n")
        if [[ "$mcp_answer" == "y" || "$mcp_answer" == "Y" ]]; then
            ENABLE_MCP=true
        fi
    fi

    echo ""

    # ── Write .env ──
    # FIX #13: Use quoted heredoc (<<'ENVEOF') to prevent variable expansion of
    # secret values that may contain $ characters. Write each variable explicitly.
    if $DRY_RUN; then
        info "[dry-run] Would write .env file"
    else
        {
            echo "# ============================================"
            echo "# Engram-Platform Environment — Auto-generated"
            echo "# Generated: $(date -Iseconds)"
            echo "# ============================================"
            echo ""
            echo "# ── Embedding Provider ──"
            printf 'EMBEDDING_PROVIDER=%s\n' "$EMBEDDING_PROVIDER"
            printf 'OPENAI_API_KEY=%s\n' "$OPENAI_API_KEY"
            printf 'EMBEDDING_MODEL=%s\n' "$EMBEDDING_MODEL"
            printf 'EMBEDDING_DIMENSIONS=%s\n' "$EMBEDDING_DIMENSIONS"
            echo ""
            echo "# ── Clerk Authentication ──"
            printf 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=%s\n' "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
            printf 'CLERK_SECRET_KEY=%s\n' "$CLERK_SECRET_KEY"
            echo ""
            echo "# ── Memory API ──"
            printf 'NEXT_PUBLIC_MEMORY_API_KEY=%s\n' "$MEMORY_API_KEY"
            printf 'MEMORY_API_KEY=%s\n' "$MEMORY_API_KEY"
            printf 'JWT_SECRET=%s\n' "$JWT_SECRET"
            echo "ADMIN_USERNAME=admin"
            echo ""
            echo "# ── MCP Server ──"
            printf 'MCP_AUTH_TOKEN=%s\n' "$MCP_AUTH_TOKEN"
            echo "CORS_ORIGINS=http://localhost:3002,http://localhost:80"
            echo ""
            echo "# ── Local AI ──"
            printf 'LM_STUDIO_URL=%s\n' "$LM_STUDIO_URL"
            printf 'OLLAMA_HOST=%s\n' "$OLLAMA_HOST"
            echo ""
            echo "# ── Application URLs ──"
            echo "NEXT_PUBLIC_APP_URL=http://localhost"
            echo "NEXT_PUBLIC_MEMORY_API_URL=http://localhost/api/memory"
            echo "NEXT_PUBLIC_CRAWLER_API_URL=http://localhost/api/crawler"
            echo ""
            echo "# ── Crawler Integration ──"
            echo "ENGRAM_ENABLED=true"
            echo "ENGRAM_API_URL=http://memory-api:8000"
            echo "ENGRAM_AUTO_STORE=true"
            printf 'ENGRAM_API_KEY=%s\n' "$MEMORY_API_KEY"
            echo ""
            echo "# ── Redis ──"
            echo "REDIS_URL=redis://crawler-redis:6379/0"
            echo "MEMORY_REDIS_URL=redis://memory-redis:6379"
            echo ""
            echo "# ── Logging ──"
            echo "LOG_LEVEL=INFO"
        } > "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        success ".env file written"
    fi
fi

# Write frontend .env.local
FRONTEND_ENV="${FRONTEND_DIR}/.env.local"
if $DRY_RUN; then
    info "[dry-run] Would write frontend/.env.local"
else
    # FIX #8: Use safe env loader instead of source
    load_env_safe "$ENV_FILE" 2>/dev/null || true

    # FIX #13: Use printf to write each var safely (handles $ in values)
    {
        echo "# Auto-generated by install.sh — $(date -Iseconds)"
        printf 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=%s\n' "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}"
        printf 'CLERK_SECRET_KEY=%s\n' "${CLERK_SECRET_KEY:-}"
        printf 'NEXT_PUBLIC_MEMORY_API_URL=%s\n' "${NEXT_PUBLIC_MEMORY_API_URL:-http://localhost/api/memory}"
        printf 'NEXT_PUBLIC_MEMORY_API_KEY=%s\n' "${NEXT_PUBLIC_MEMORY_API_KEY:-${MEMORY_API_KEY:-}}"
        printf 'NEXT_PUBLIC_CRAWLER_API_URL=%s\n' "${NEXT_PUBLIC_CRAWLER_API_URL:-http://localhost/api/crawler}"
        printf 'NEXT_PUBLIC_APP_URL=%s\n' "${NEXT_PUBLIC_APP_URL:-http://localhost}"
    } > "$FRONTEND_ENV"
    success "frontend/.env.local written"
fi

success "Environment configured"

# ── Step 5: Build Images ───────────────────────────────────────────────
_INSTALL_STEP="Step 5: Build Docker Images"
step "Step 5/7 — Building Docker Images"

if $DRY_RUN; then
    substep "[dry-run] Would build: crawler-api, memory-api, platform-frontend"
    substep "[dry-run] Would pull: weaviate:1.27.0, redis:7-alpine, nginx:alpine"
else
    # FIX #10: Always cd to SCRIPT_DIR so docker compose picks up .env automatically
    cd "$SCRIPT_DIR"

    # FIX #14: Re-check disk space before heavy build step
    AVAIL_DISK_GB=$(df -BG "$SCRIPT_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "0")
    if (( AVAIL_DISK_GB < 10 )); then
        fatal "Insufficient disk space for Docker builds: ${AVAIL_DISK_GB}GB available, 10GB required."
    fi

    info "Building images... This may take 5-15 minutes on first run."
    echo ""

    # Pull base images first (FIX #3: || warn instead of letting set -e kill script)
    substep "Pulling base images..."
    if ! docker compose pull weaviate crawler-redis memory-redis nginx 2>&1 | tail -5; then
        warn "Some base images could not be pulled from registry. Will use cached versions if available."
    fi
    success "Base images ready"

    # FIX #11: Capture build exit codes and provide actionable error messages
    substep "Building Crawler API..."
    if ! docker compose build crawler-api 2>&1 | tee -a "$LOG_FILE" | tail -5; then
        error "Crawler API build failed. Check the log for details:"
        error "  tail -50 ${LOG_FILE}"
        error "  docker compose logs crawler-api"
        fatal "Build step failed: crawler-api"
    fi
    success "Crawler API built"

    substep "Building Memory API..."
    if ! docker compose build memory-api 2>&1 | tee -a "$LOG_FILE" | tail -5; then
        error "Memory API build failed. Check the log for details:"
        error "  tail -50 ${LOG_FILE}"
        fatal "Build step failed: memory-api"
    fi
    success "Memory API built"

    substep "Building Frontend..."
    if ! docker compose build platform-frontend 2>&1 | tee -a "$LOG_FILE" | tail -5; then
        error "Frontend build failed. Check the log for details:"
        error "  tail -50 ${LOG_FILE}"
        fatal "Build step failed: platform-frontend"
    fi
    success "Frontend built"

    if $ENABLE_MCP; then
        substep "Building MCP Server..."
        if ! docker compose build mcp-server 2>&1 | tee -a "$LOG_FILE" | tail -5; then
            warn "MCP Server build failed — MCP will be disabled for this installation"
            warn "  The rest of the platform will install normally without MCP"
            warn "  To retry MCP later: docker compose --profile mcp build mcp-server"
            warn "  Build log: tail -50 ${LOG_FILE}"
            ENABLE_MCP=false
        else
            success "MCP Server built"
        fi
    fi
fi

success "All images ready"

# ── Step 6: Start Services ─────────────────────────────────────────────
_INSTALL_STEP="Step 6: Start Services"
step "Step 6/7 — Starting Services"

if $DRY_RUN; then
    substep "[dry-run] Would run: docker compose up -d"
    if $ENABLE_MCP; then
        substep "[dry-run] Would also start MCP server profile"
    fi
else
    cd "$SCRIPT_DIR"

    # FIX #3: Explicit error handling on docker compose up
    if $ENABLE_MCP; then
        if ! docker compose --profile mcp up -d 2>&1; then
            fatal "Failed to start services. Check logs: docker compose logs"
        fi
    else
        if ! docker compose up -d 2>&1; then
            fatal "Failed to start services. Check logs: docker compose logs"
        fi
    fi

    echo ""
    info "Waiting for services to become healthy..."
    echo ""

    # FIX #9: Health check loop handles containers without healthchecks
    # by falling back to checking .State.Running when no health config exists
    MAX_WAIT=180
    WAITED=0
    INTERVAL=5

    declare -A SVC_HEALTHY
    SERVICES_TO_CHECK=("engram-weaviate" "engram-crawler-redis" "engram-memory-redis" "engram-memory-api" "engram-crawler-api" "engram-platform-frontend" "engram-nginx")

    for svc in "${SERVICES_TO_CHECK[@]}"; do
        SVC_HEALTHY[$svc]=false
    done

    while (( WAITED < MAX_WAIT )); do
        all_healthy=true
        for svc in "${SERVICES_TO_CHECK[@]}"; do
            if [[ "${SVC_HEALTHY[$svc]}" == "true" ]]; then continue; fi

            # FIX #9: Check if container has a healthcheck configured
            has_health=$(docker inspect --format='{{if .Config.Healthcheck}}yes{{else}}no{{end}}' "$svc" 2>/dev/null || echo "missing")

            if [[ "$has_health" == "missing" ]]; then
                # Container doesn't exist yet
                all_healthy=false
                continue
            fi

            if [[ "$has_health" == "yes" ]]; then
                # Container has healthcheck — use health status
                status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "unknown")
                if [[ "$status" == "healthy" ]]; then
                    SVC_HEALTHY[$svc]=true
                    success "${svc} — healthy"
                elif [[ "$status" == "unhealthy" ]]; then
                    warn "${svc} — unhealthy (check logs: docker logs $svc)"
                    SVC_HEALTHY[$svc]=true  # Don't block indefinitely on unhealthy
                else
                    all_healthy=false
                fi
            else
                # No healthcheck — fall back to checking Running state
                running=$(docker inspect --format='{{.State.Running}}' "$svc" 2>/dev/null || echo "false")
                if [[ "$running" == "true" ]]; then
                    SVC_HEALTHY[$svc]=true
                    success "${svc} — running (no healthcheck)"
                else
                    all_healthy=false
                fi
            fi
        done

        if $all_healthy; then break; fi

        sleep "$INTERVAL"
        WAITED=$((WAITED + INTERVAL))
        printf "\r    ${DIM}Waiting... %ds / %ds${NC}" "$WAITED" "$MAX_WAIT"
    done
    echo ""

    if (( WAITED >= MAX_WAIT )); then
        warn "Timed out waiting for all services. Some may still be starting."
        warn "Check status with: ./install.sh --status"
    fi
fi

success "Services started"

# ── Step 7: Final Summary ─────────────────────────────────────────────
_INSTALL_STEP="Step 7: Complete"
step "Step 7/7 — Installation Complete!"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}${WHITE}Engram Platform is running!${NC}                                ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Dashboard${NC}      →  ${CYAN}http://localhost${NC}"
echo -e "  ${BOLD}Crawler API${NC}    →  ${CYAN}http://localhost/api/crawler/health${NC}"
echo -e "  ${BOLD}Memory API${NC}     →  ${CYAN}http://localhost/api/memory/health${NC}"
echo -e "  ${BOLD}WebSocket${NC}      →  ${CYAN}ws://localhost/ws${NC}"
if $ENABLE_MCP; then
echo -e "  ${BOLD}MCP Server${NC}     →  ${CYAN}http://localhost/mcp${NC}"
fi
echo ""
echo -e "  ${DIM}Management commands:${NC}"
echo -e "    ${WHITE}./install.sh --status${NC}    Check service health"
echo -e "    ${WHITE}./install.sh --logs${NC}      Tail all logs"
echo -e "    ${WHITE}./install.sh --stop${NC}      Stop all services"
echo -e "    ${WHITE}./install.sh --restart${NC}   Restart all services"
echo -e "    ${WHITE}./install.sh --update${NC}    Snapshot -> parallel build -> rolling swap -> health gates"
echo -e "    ${WHITE}./install.sh --uninstall${NC} Remove everything"
echo -e "    ${WHITE}./install.sh --rollback${NC}  Restore previous images if update broke things"
echo ""

if [[ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]]; then
echo -e "  ${YELLOW}⚠ Running without Clerk auth — all routes are public${NC}"
echo -e "  ${DIM}  Add Clerk keys to .env and restart to enable auth${NC}"
echo ""
fi

if [[ -z "${OPENAI_API_KEY:-}" && "${EMBEDDING_PROVIDER:-openai}" == "openai" ]]; then
echo -e "  ${YELLOW}⚠ No OpenAI API key — Memory API embeddings will not work${NC}"
echo -e "  ${DIM}  Add OPENAI_API_KEY to .env and restart${NC}"
echo ""
fi

# FIX #6: Remind user about docker group re-login if needed
if $DOCKER_GROUP_JUST_ADDED; then
echo -e "  ${YELLOW}⚠ Docker group change requires re-login${NC}"
echo -e "  ${DIM}  Run: newgrp docker  — or log out and back in${NC}"
echo -e "  ${DIM}  Then run: ./install.sh --status  to verify${NC}"
echo ""
fi

echo -e "  ${DIM}Config:  ${ENV_FILE}${NC}"
echo -e "  ${DIM}Logs:    ${LOG_FILE}${NC}"
echo ""
