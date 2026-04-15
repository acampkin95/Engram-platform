#!/usr/bin/env bash
# DEPRECATED: Prefer ./scripts/deploy-unified.sh deploy:memory from the monorepo root.
# =============================================================================
#  AI Memory System — One-Shot Ubuntu Server Deployment
#
#  Targets: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (fresh install, run as root)
#  Networking: Tailscale VPN only — no public internet exposure
#  Reverse Proxy: Traefik v3 (hostname-based routing, HTTP only — Tailscale handles TLS)
#  Inference: Ollama (CPU-only, LFM 2.5 1.2B + Qwen2.5 0.5B)
#
#  Usage:
#    # Basic (uses defaults, auto-generates secrets):
#    bash deploy-server.sh
#
#    # With your Tailscale hostname set upfront:
#    TRAEFIK_DOMAIN=acdev-devnode.tail1234.ts.net bash deploy-server.sh
#
#    # With a specific git repo:
#    REPO_URL=git@github.com:yourorg/ai-memory.git bash deploy-server.sh
#
#  Idempotent: safe to re-run — each step checks current state before acting.
#
#  After running:
#    - Add DNS entries (local /etc/hosts or Tailscale split-DNS) pointing
#      api.memory.internal, dashboard.memory.internal, mcp.memory.internal
#      to this machine's Tailscale IP.
#    - Or access via: http://<tailscale-ip> with Host header overrides.
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ─── Configuration ────────────────────────────────────────────────────────────
# TODO: Replace with your actual repository URL before running
REPO_URL="${REPO_URL:-https://github.com/YOUR_ORG/ai-memory-system.git}"

INSTALL_DIR="${INSTALL_DIR:-/opt/ai-memory}"
COMPOSE_FILE="docker/docker-compose.prod.yml"
ENV_FILE="${INSTALL_DIR}/.env"
LOG_DIR="${INSTALL_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"

# Tailscale hostname used for Traefik routing rules
# Override with: TRAEFIK_DOMAIN=mymachine.tail1234.ts.net bash deploy-server.sh
TRAEFIK_DOMAIN="${TRAEFIK_DOMAIN:-memory.internal}"

# Ollama models to pull (order matters: embed model first)
OLLAMA_MODELS=(
    "nomic-embed-text:v1.5"
    "liquid/lfm2.5:1.2b"
    "qwen2.5:0.5b-instruct"
)

# ─── ANSI Colours ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
# MAGENTA reserved for future use
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
WARN_ICON="${YELLOW}⚠${NC}"

# ─── Helpers ──────────────────────────────────────────────────────────────────
WARNINGS=()
DEPLOY_START=$(date +%s)

_log() { echo -e "$*" | tee -a "${LOG_FILE}"; }

print_banner() {
    echo -e ""
    echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}${BOLD}║       AI Memory System — Server Deployment                      ║${NC}"
    echo -e "${BLUE}${BOLD}║       Weaviate · Redis · FastAPI · Ollama · Traefik v3          ║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "${DIM}  Install dir : ${INSTALL_DIR}${NC}"
    echo -e "${DIM}  Compose file: ${INSTALL_DIR}/${COMPOSE_FILE}${NC}"
    echo -e "${DIM}  Domain       : ${TRAEFIK_DOMAIN}${NC}"
    echo -e ""
}

print_header() {
    echo -e "" | tee -a "${LOG_FILE}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "${LOG_FILE}"
    echo -e "${BLUE}${BOLD}  ▶  $1${NC}" | tee -a "${LOG_FILE}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "${LOG_FILE}"
}

print_step() { echo -e "  ${CYAN}→${NC} $*" | tee -a "${LOG_FILE}"; }
print_ok()   { echo -e "  ${CHECK} $*" | tee -a "${LOG_FILE}"; }
print_warn() { echo -e "  ${WARN_ICON} ${YELLOW}$*${NC}" | tee -a "${LOG_FILE}"; WARNINGS+=("$*"); }
print_err()  { echo -e "  ${CROSS} ${RED}$*${NC}" | tee -a "${LOG_FILE}"; }

die() {
    echo -e "\n${RED}${BOLD}FATAL:${NC} $*" | tee -a "${LOG_FILE}"
    echo -e "${DIM}Log: ${LOG_FILE}${NC}"
    exit 1
}

# ─── Preflight ────────────────────────────────────────────────────────────────
check_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        die "This script must be run as root. Try: sudo bash $0"
    fi
}

check_ubuntu() {
    if [[ ! -f /etc/os-release ]]; then
        die "Cannot detect OS. Requires Ubuntu 22.04 or 24.04."
    fi
    # shellcheck source=/dev/null
    source /etc/os-release
    case "${VERSION_ID:-}" in
        22.04|24.04) print_ok "OS: Ubuntu ${VERSION_ID} (${PRETTY_NAME})" ;;
        *) print_warn "Untested Ubuntu version: ${VERSION_ID}. Proceeding anyway..." ;;
    esac
}

check_resources() {
    # RAM
    local ram_gb
    ram_gb=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
    if (( ram_gb < 8 )); then
        print_warn "RAM: ${ram_gb}GB — 8GB+ recommended (Ollama + Weaviate need headroom)"
    else
        print_ok "RAM: ${ram_gb}GB"
    fi

    # Disk
    local free_gb
    free_gb=$(df -BG / | awk 'NR==2{gsub("G","",$4); print $4}')
    if (( free_gb < 20 )); then
        print_warn "Disk: ${free_gb}GB free — 20GB+ recommended (Ollama models are large)"
    else
        print_ok "Disk: ${free_gb}GB free on /"
    fi
}

# ─── Step 1: Install Docker CE ────────────────────────────────────────────────
install_docker() {
    print_header "Step 1/7: Installing Docker CE"

    if command -v docker &>/dev/null && docker --version | grep -q "Docker version"; then
        print_ok "Docker already installed: $(docker --version)"
    else
        print_step "Adding Docker official GPG key and repository..."

        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg lsb-release 2>>"${LOG_FILE}"

        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            -o /etc/apt/keyrings/docker.asc 2>>"${LOG_FILE}"
        chmod a+r /etc/apt/keyrings/docker.asc

        # shellcheck source=/dev/null
        source /etc/os-release
        local codename="${UBUNTU_CODENAME:-${VERSION_CODENAME}}"

        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu ${codename} stable" \
            > /etc/apt/sources.list.d/docker.list

        apt-get update -qq 2>>"${LOG_FILE}"
        apt-get install -y -qq \
            docker-ce \
            docker-ce-cli \
            containerd.io \
            docker-buildx-plugin \
            docker-compose-plugin \
            2>>"${LOG_FILE}"

        systemctl enable --now docker
        print_ok "Docker CE installed: $(docker --version)"
    fi

    # Verify compose plugin
    if ! docker compose version &>/dev/null; then
        die "Docker Compose plugin not available after installation."
    fi
    print_ok "Docker Compose: $(docker compose version --short 2>/dev/null || docker compose version | awk '{print $NF}')"

    # Apply kernel settings required by Weaviate and Redis
    print_step "Applying kernel tunables (Weaviate/Redis requirements)..."

    local map_count
    map_count=$(sysctl -n vm.max_map_count 2>/dev/null || echo "0")
    if (( map_count < 262144 )); then
        sysctl -w vm.max_map_count=262144 >> "${LOG_FILE}" 2>&1
        echo 'vm.max_map_count=262144' > /etc/sysctl.d/90-ai-memory.conf
    fi

    local oc
    oc=$(sysctl -n vm.overcommit_memory 2>/dev/null || echo "0")
    if [[ "${oc}" != "1" ]]; then
        sysctl -w vm.overcommit_memory=1 >> "${LOG_FILE}" 2>&1
        echo 'vm.overcommit_memory=1' >> /etc/sysctl.d/90-ai-memory.conf
    fi

    # Disable THP (transparent huge pages) — required for Redis
    if [[ -f /sys/kernel/mm/transparent_hugepage/enabled ]]; then
        echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
    fi

    print_ok "Kernel tunables applied"
}

# ─── Step 2: Install Tailscale ────────────────────────────────────────────────
install_tailscale() {
    print_header "Step 2/7: Installing Tailscale"

    if command -v tailscale &>/dev/null; then
        print_ok "Tailscale already installed: $(tailscale --version | head -1)"
    else
        print_step "Downloading and running Tailscale installer..."
        curl -fsSL https://tailscale.com/install.sh | sh
        print_ok "Tailscale installed: $(tailscale --version | head -1)"
    fi

    # Check if already connected
    if tailscale status &>/dev/null 2>&1; then
        local ts_ip
        ts_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
        print_ok "Tailscale connected — Tailscale IP: ${ts_ip}"
        if [[ "${TRAEFIK_DOMAIN}" == "memory.internal" ]]; then
            local ts_hostname
            ts_hostname=$(tailscale status --json 2>/dev/null | \
                python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Self',{}).get('DNSName','').rstrip('.'))" \
                2>/dev/null || echo "")
            if [[ -n "${ts_hostname}" ]]; then
                TRAEFIK_DOMAIN="${ts_hostname}"
                print_ok "Auto-detected Tailscale hostname: ${TRAEFIK_DOMAIN}"
            fi
        fi
    else
        print_warn "Tailscale is installed but not authenticated."
        print_warn "Run 'tailscale up' after this script completes to join your tailnet."
    fi
}

# ─── Step 3: Set Up Directory Structure ──────────────────────────────────────
setup_directories() {
    print_header "Step 3/7: Setting Up Directory Structure"

    print_step "Creating ${INSTALL_DIR}/..."
    mkdir -p "${INSTALL_DIR}"/{logs,data,backups}
    mkdir -p "${INSTALL_DIR}/docker/traefik"
    print_ok "Directory structure created"
}

# ─── Step 4: Clone or Update Project Files ───────────────────────────────────
setup_project() {
    print_header "Step 4/7: Deploying Project Files"

    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        print_step "Repository exists — pulling latest changes..."
        git -C "${INSTALL_DIR}" pull --ff-only >> "${LOG_FILE}" 2>&1 || {
            print_warn "git pull failed (local changes?). Continuing with existing files."
        }
        print_ok "Repository updated at ${INSTALL_DIR}"
    elif [[ "${REPO_URL}" == *"YOUR_ORG"* ]]; then
        # No repo URL configured and no existing checkout — check if we're
        # running from within the project directory itself (dev/test scenario)
        local script_dir
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        local project_root
        project_root="$(cd "${script_dir}/.." && pwd)"

        if [[ -f "${project_root}/docker/docker-compose.prod.yml" ]]; then
            print_step "No REPO_URL set. Copying project files from ${project_root}..."
            rsync -a --exclude='.git' --exclude='node_modules' --exclude='.venv' \
                --exclude='__pycache__' --exclude='*.pyc' \
                "${project_root}/" "${INSTALL_DIR}/" >> "${LOG_FILE}" 2>&1
            print_ok "Project files copied from ${project_root}"
        else
            die "REPO_URL is not set and no project files found. Edit REPO_URL at the top of this script."
        fi
    else
        print_step "Cloning repository..."
        git clone "${REPO_URL}" "${INSTALL_DIR}" >> "${LOG_FILE}" 2>&1
        print_ok "Repository cloned to ${INSTALL_DIR}"
    fi
}

# ─── Step 5: Configure Environment ───────────────────────────────────────────
configure_env() {
    print_header "Step 5/7: Configuring Environment"

    if [[ ! -f "${INSTALL_DIR}/.env.production.example" ]]; then
        die ".env.production.example not found in ${INSTALL_DIR}. Check that project files are present."
    fi

    if [[ -f "${ENV_FILE}" ]]; then
        print_ok ".env already exists — skipping generation (delete to regenerate)"
    else
        print_step "Generating .env from .env.production.example with auto-generated secrets..."
        cp "${INSTALL_DIR}/.env.production.example" "${ENV_FILE}"

        # Auto-generate secrets
        local jwt_secret mcp_token api_key weaviate_key
        jwt_secret=$(openssl rand -hex 32)
        mcp_token=$(openssl rand -hex 32)
        api_key=$(openssl rand -hex 24)
        weaviate_key=$(openssl rand -hex 20)

        sed -i \
            -e "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" \
            -e "s|^MCP_AUTH_TOKEN=.*|MCP_AUTH_TOKEN=${mcp_token}|" \
            -e "s|^API_KEYS=.*|API_KEYS=${api_key}|" \
            -e "s|^WEAVIATE_API_KEY=.*|WEAVIATE_API_KEY=${weaviate_key}|" \
            -e "s|^TRAEFIK_DOMAIN=.*|TRAEFIK_DOMAIN=${TRAEFIK_DOMAIN}|" \
            "${ENV_FILE}"

        print_ok ".env generated with auto-generated secrets"
        print_ok "  JWT_SECRET     : ${jwt_secret:0:8}****"
        print_ok "  MCP_AUTH_TOKEN : ${mcp_token:0:8}****"
        print_ok "  API_KEYS       : ${api_key:0:8}****"
    fi

    # Load env into current shell for use in health checks
    # shellcheck source=/dev/null
    set -a && source "${ENV_FILE}" && set +a
    print_ok "Environment loaded"
}

# ─── Step 6: Pull Images and Start Stack ─────────────────────────────────────
deploy_stack() {
    print_header "Step 6/7: Deploying Docker Stack"

    local compose_path="${INSTALL_DIR}/${COMPOSE_FILE}"
    [[ -f "${compose_path}" ]] || die "Compose file not found: ${compose_path}"

    # Pull all images (idempotent)
    print_step "Pulling Docker images (this may take several minutes)..."
    docker compose -f "${compose_path}" pull 2>&1 | tee -a "${LOG_FILE}"
    print_ok "All images pulled"

    # Build custom images (memory-api, mcp-server, dashboard)
    print_step "Building application images..."
    docker compose -f "${compose_path}" build \
        --no-cache \
        memory-api mcp-server dashboard \
        2>&1 | tee -a "${LOG_FILE}"
    print_ok "Application images built"

    # Stop any running stack gracefully first
    if docker compose -f "${compose_path}" ps -q 2>/dev/null | grep -q .; then
        print_step "Stopping existing containers..."
        docker compose -f "${compose_path}" down --remove-orphans --timeout 30 \
            >> "${LOG_FILE}" 2>&1
    fi

    # Start the full stack
    print_step "Starting all services..."
    docker compose -f "${compose_path}" up -d --remove-orphans \
        2>&1 | tee -a "${LOG_FILE}"
    print_ok "Stack started"

    # Wait for core infrastructure to be healthy
    print_step "Waiting for Weaviate to be healthy..."
    _wait_for_container_health "ai-memory-weaviate" 120
    print_ok "Weaviate is healthy"

    print_step "Waiting for Redis to be healthy..."
    _wait_for_container_health "ai-memory-redis" 60
    print_ok "Redis is healthy"

    print_step "Waiting for Memory API to be healthy..."
    _wait_for_container_health "ai-memory-api" 120
    print_ok "Memory API is healthy"
}

# Wait for a container's Docker healthcheck to report "healthy"
# Falls back to "running" for containers without a healthcheck
_wait_for_container_health() {
    local container="$1"
    local timeout="${2:-60}"
    local elapsed=0

    while true; do
        local status health
        status=$(docker inspect --format '{{.State.Status}}' "${container}" 2>/dev/null || echo "missing")
        health=$(docker inspect --format '{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "none")

        case "${health}" in
            healthy) return 0 ;;
            unhealthy)
                die "Container ${container} is unhealthy. Check logs: docker logs ${container}"
                ;;
            none|"")
                # No healthcheck defined — just check it's running
                [[ "${status}" == "running" ]] && return 0
                ;;
        esac

        elapsed=$((elapsed + 3))
        if (( elapsed >= timeout )); then
            print_warn "Container ${container} not healthy after ${timeout}s (status: ${status}, health: ${health})"
            return 0  # Don't abort — let health checks report the issue
        fi

        sleep 3
        printf "." >&2
    done
}

# ─── Step 7: Pull Ollama Models ───────────────────────────────────────────────
pull_ollama_models() {
    print_header "Step 7/7: Pulling Ollama Models"

    print_step "Waiting for Ollama API to be ready..."
    local elapsed=0
    local max_wait=120

    while ! docker exec ai-memory-ollama ollama list >> "${LOG_FILE}" 2>&1; do
        elapsed=$((elapsed + 2))
        if (( elapsed >= max_wait )); then
            die "Ollama failed to start after ${max_wait}s. Check: docker logs ai-memory-ollama"
        fi
        sleep 2
        printf "." >&2
    done
    echo "" >&2
    print_ok "Ollama API is ready"

    for model in "${OLLAMA_MODELS[@]}"; do
        print_step "Pulling model: ${model}"
        docker exec ai-memory-ollama ollama pull "${model}" 2>&1 | tee -a "${LOG_FILE}"
        print_ok "Model pulled: ${model}"
    done
}

# ─── Health Checks ────────────────────────────────────────────────────────────
run_health_checks() {
    print_header "Post-Deploy Health Checks"

    local pass=0 fail=0

    _check() {
        local name="$1" container="$2" check_cmd="$3"
        printf "  %-28s" "${name}:"
        if docker exec "${container}" sh -c "${check_cmd}" >> "${LOG_FILE}" 2>&1; then
            echo -e " ${CHECK}"
            (( pass++ ))
        else
            echo -e " ${CROSS}"
            (( fail++ ))
            print_warn "${name}: health check failed"
        fi
    }

    _check_running() {
        local name="$1" container="$2"
        printf "  %-28s" "${name}:"
        local status
        status=$(docker inspect --format '{{.State.Status}}' "${container}" 2>/dev/null || echo "missing")
        if [[ "${status}" == "running" ]]; then
            echo -e " ${CHECK} (running)"
            (( pass++ ))
        else
            echo -e " ${CROSS} (${status})"
            (( fail++ ))
            print_warn "${name}: container not running (status: ${status})"
        fi
    }

    # Weaviate — uses wget internally
    _check "Weaviate" "ai-memory-weaviate" \
        "wget -qO- http://localhost:8080/v1/.well-known/ready"

    # Redis
    _check "Redis" "ai-memory-redis" \
        "redis-cli ping | grep -q PONG"

    # Memory API — Python container has curl
    _check "Memory API /health" "ai-memory-api" \
        "curl -sf http://localhost:8000/health"

    # MCP Server
    _check "MCP Server /health" "ai-memory-mcp" \
        "curl -sf http://localhost:3000/health"

    # Dashboard — check port 3000 inside container
    _check "Dashboard" "ai-memory-dashboard" \
        "wget -qO- http://127.0.0.1:3000 || curl -sf http://127.0.0.1:3000"

    # Ollama — check list API
    _check "Ollama API" "ai-memory-ollama" \
        "ollama list"

    # Traefik — check it's running (no exposed health endpoint without API enabled)
    _check_running "Traefik" "ai-memory-traefik"

    echo ""
    echo -e "  ${BOLD}Health check results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
}

# ─── Status Summary ───────────────────────────────────────────────────────────
print_summary() {
    local duration=$(( $(date +%s) - DEPLOY_START ))
    local mins=$(( duration / 60 ))
    local secs=$(( duration % 60 ))

    local compose_path="${INSTALL_DIR}/${COMPOSE_FILE}"
    local ts_ip
    ts_ip=$(tailscale ip -4 2>/dev/null || echo "<tailscale-ip>")

    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║              Deployment Complete!  🚀                           ║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║  Service Endpoints (via Tailscale + Traefik)                    ║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Dashboard     ${CYAN}http://dashboard.memory.internal${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Memory API    ${CYAN}http://api.memory.internal${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  MCP Server    ${CYAN}http://mcp.memory.internal${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Ollama        (internal only — ai-memory-ollama:11434)"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║  Tailscale IP : ${ts_ip}${NC}"
    echo -e "${GREEN}${BOLD}║  Config file  : ${ENV_FILE}${NC}"
    echo -e "${GREEN}${BOLD}║  Deploy log   : ${LOG_FILE}${NC}"
    echo -e "${GREEN}${BOLD}║  Deploy time  : ${mins}m ${secs}s${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo -e "${GREEN}${BOLD}║  ${YELLOW}Warnings:${NC}"
        for w in "${WARNINGS[@]}"; do
            echo -e "${GREEN}${BOLD}║${NC}    ${WARN_ICON}  ${YELLOW}${w}${NC}"
        done
        echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    fi

    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Next steps:${NC}"
    echo -e "  1. ${CYAN}tailscale up${NC}  — authenticate Tailscale (if not already done)"
    echo -e "  2. Add DNS entries pointing *.memory.internal to ${ts_ip}"
    echo -e "     ${DIM}Option A: Tailscale split-DNS (recommended)${NC}"
    echo -e "     ${DIM}Option B: /etc/hosts on client machines${NC}"
    echo -e "         ${ts_ip}  api.memory.internal"
    echo -e "         ${ts_ip}  dashboard.memory.internal"
    echo -e "         ${ts_ip}  mcp.memory.internal"
    echo -e "  3. ${CYAN}docker compose -f ${INSTALL_DIR}/${COMPOSE_FILE} ps${NC}  — check service status"
    echo -e "  4. Review ${CYAN}${ENV_FILE}${NC}  — customize settings if needed"
    echo -e ""

    # Docker compose status table
    echo -e "${BOLD}Container Status:${NC}"
    docker compose -f "${INSTALL_DIR}/${COMPOSE_FILE}" ps \
        --format "table {{.Name}}\t{{.Status}}\t{{.Image}}" 2>/dev/null || \
        docker ps --filter "name=ai-memory" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    # Set up logging dir ASAP (before LOG_FILE is used)
    mkdir -p "${LOG_DIR}"
    : > "${LOG_FILE}"

    print_banner
    _log "Deploy started at $(date)"
    _log "User: $(id)"
    _log "Hostname: $(hostname)"
    _log ""

    check_root
    check_ubuntu
    check_resources

    install_docker       # Step 1
    install_tailscale    # Step 2
    setup_directories    # Step 3
    setup_project        # Step 4
    configure_env        # Step 5
    deploy_stack         # Step 6
    pull_ollama_models   # Step 7

    run_health_checks
    print_summary

    _log ""
    _log "Deploy finished at $(date)"
}

main "$@"
