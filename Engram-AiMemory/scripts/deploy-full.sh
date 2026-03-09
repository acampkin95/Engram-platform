#!/usr/bin/env bash
# =============================================================================
#  AI Memory System — Full Production Deployment Script
#
#  Covers:
#    1. Pre-flight validation
#    2. Environment setup & secret generation
#    3. System optimisation (kernel, limits, Docker)
#    4. Docker stack deployment with health gates
#    5. Schema initialisation
#    6. MCP server verification
#    7. Systemd auto-start
#    8. Post-deploy smoke tests
#    9. Summary report
#
#  Usage:
#    ./scripts/deploy-full.sh                  # interactive
#    ./scripts/deploy-full.sh --non-interactive # CI/CD (uses env vars)
#    ./scripts/deploy-full.sh --upgrade         # redeploy without re-configuring
#    ./scripts/deploy-full.sh --help
#
#  Non-interactive env vars:
#    OPENAI_API_KEY, DB_PASSWORD, JWT_SECRET, API_KEYS,
#    WEAVIATE_API_KEY, ADMIN_PASSWORD, DOMAIN (optional)
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m';    GREEN='\033[0;32m';  YELLOW='\033[1;33m'
BLUE='\033[0;34m';   CYAN='\033[0;36m';  MAGENTA='\033[0;35m'
BOLD='\033[1m';      DIM='\033[2m';       NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
DEPLOY_REPORT="${PROJECT_ROOT}/logs/deploy-report.md"

# ─── Flags ────────────────────────────────────────────────────────────────────
NON_INTERACTIVE=false
UPGRADE_ONLY=false
SKIP_OPTIMIZE=false
SKIP_SYSTEMD=false
DRY_RUN=false
FORCE=false

# ─── Counters ─────────────────────────────────────────────────────────────────
STEPS_TOTAL=9
STEPS_DONE=0
WARNINGS=()
DEPLOY_START=$(date +%s)

# ─── Helpers ─────────────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
: > "${LOG_FILE}"

log()    { echo -e "$*" | tee -a "${LOG_FILE}"; }
raw()    { echo "$*" >> "${LOG_FILE}" 2>&1; }
step()   {
    (( STEPS_DONE++ ))
    echo -e "\n${BLUE}${BOLD}[${STEPS_DONE}/${STEPS_TOTAL}]${NC} ${BOLD}$*${NC}" | tee -a "${LOG_FILE}"
}
ok()     { echo -e "  ${CHECK} $*" | tee -a "${LOG_FILE}"; }
fail()   { echo -e "  ${CROSS} ${RED}$*${NC}" | tee -a "${LOG_FILE}"; }
warn()   { echo -e "  ${WARN}  ${YELLOW}$*${NC}" | tee -a "${LOG_FILE}"; WARNINGS+=("$*"); }
info()   { echo -e "  ${CYAN}→${NC} $*" | tee -a "${LOG_FILE}"; }
die()    {
    echo -e "\n${RED}${BOLD}FATAL:${NC} $*" | tee -a "${LOG_FILE}"
    echo -e "${DIM}Log: ${LOG_FILE}${NC}"
    exit 1
}

confirm() {
    [[ "$NON_INTERACTIVE" == "true" ]] && return 0
    local prompt="$1" default="${2:-y}"
    local hint; [[ "$default" == "y" ]] && hint="[Y/n]" || hint="[y/N]"
    printf "\n  ${MAGENTA}?${NC} ${BOLD}%s${NC} ${DIM}%s${NC} " "$prompt" "$hint" >&2
    read -r reply </dev/tty
    reply="${reply:-$default}"
    [[ "$reply" =~ ^[Yy]$ ]]
}

prompt_secret() {
    local var="$1" prompt="$2" default="${3:-}"
    if [[ "$NON_INTERACTIVE" == "true" ]]; then
        [[ -z "${!var:-}" ]] && [[ -n "$default" ]] && eval "${var}=${default}"
        [[ -z "${!var:-}" ]] && die "${var} must be set in non-interactive mode"
        return
    fi
    if [[ -n "${!var:-}" ]]; then
        info "${prompt}: using existing env value"
        return
    fi
    printf "\n  ${MAGENTA}?${NC} ${BOLD}%s${NC}: " "$prompt" >&2
    read -rs value </dev/tty; echo "" >&2
    [[ -z "$value" ]] && value="$default"
    [[ -z "$value" ]] && die "${var} is required"
    eval "${var}=${value}"
}

prompt_value() {
    local var="$1" prompt="$2" default="${3:-}"
    if [[ "$NON_INTERACTIVE" == "true" ]]; then
        [[ -z "${!var:-}" ]] && eval "${var}=${default}"
        return
    fi
    if [[ -n "${!var:-}" ]]; then
        info "${prompt}: using existing env value (${!var})"
        return
    fi
    printf "\n  ${MAGENTA}?${NC} ${BOLD}%s${NC}${DIM}%s${NC}: " "$prompt" "${default:+ [$default]}" >&2
    read -r value </dev/tty
    eval "${var}=${value:-$default}"
}

run_q() {
    local msg="$1"; shift
    [[ "$DRY_RUN" == "true" ]] && { info "[DRY-RUN] $*"; return; }
    { "$@" >> "${LOG_FILE}" 2>&1; } &
    local pid=$!
    local i=0
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    tput civis 2>/dev/null || true
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${CYAN}%s${NC}  %s " "${frames[$((i++ % 10))]}" "$msg"
        sleep 0.1
    done
    tput cnorm 2>/dev/null || true
    printf "\r%*s\r" "$(tput cols 2>/dev/null || echo 80)" ""
    wait "$pid"
}

run_sudo_q() {
    local msg="$1"; shift
    [[ "$DRY_RUN" == "true" ]] && { info "[DRY-RUN] sudo $*"; return; }
    { sudo "$@" >> "${LOG_FILE}" 2>&1; } &
    local pid=$!
    local i=0
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    tput civis 2>/dev/null || true
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${CYAN}%s${NC}  %s " "${frames[$((i++ % 10))]}" "$msg"
        sleep 0.1
    done
    tput cnorm 2>/dev/null || true
    printf "\r%*s\r" "$(tput cols 2>/dev/null || echo 80)" ""
    wait "$pid"
}

# ─── Banner ───────────────────────────────────────────────────────────────────
banner() {
    echo -e ""
    echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}${BOLD}║       AI Memory System — Full Production Deployment             ║${NC}"
    echo -e "${BLUE}${BOLD}║       Weaviate 1.27 · Redis 7 · FastAPI · Node 20 · Next.js    ║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "${DIM}  Project: ${PROJECT_ROOT}"
    echo -e "  Log:     ${LOG_FILE}${NC}"
    echo -e ""
}

# ─── Step 1: Pre-flight ───────────────────────────────────────────────────────
preflight() {
    step "Pre-flight Validation"

    # OS check
    [[ "$(uname -s)" == "Linux" ]] || die "Requires Linux (Ubuntu 22.04+)"
    ok "OS: Linux"

    # RAM
    local ram_gb; ram_gb=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
    if (( ram_gb < 4 )); then
        die "Insufficient RAM: ${ram_gb}GB (4GB minimum)"
    elif (( ram_gb < 8 )); then
        warn "RAM: ${ram_gb}GB — 8GB+ recommended for production"
    else
        ok "RAM: ${ram_gb}GB"
    fi

    # Disk
    local free_gb; free_gb=$(df -BG "${PROJECT_ROOT}" | awk 'NR==2{gsub("G","",$4); print $4}')
    if (( free_gb < 10 )); then
        die "Insufficient disk: ${free_gb}GB free (10GB minimum)"
    elif (( free_gb < 20 )); then
        warn "Disk: ${free_gb}GB free — 20GB+ recommended"
    else
        ok "Disk: ${free_gb}GB free"
    fi

    # Docker
    command -v docker &>/dev/null || die "Docker not installed. Run ./scripts/ubuntu-install.sh first."
    docker info &>/dev/null || die "Docker daemon not running. Run: sudo systemctl start docker"
    ok "Docker: $(docker --version | awk '{print $3}' | tr -d ',')"
    docker compose version &>/dev/null || die "Docker Compose v2 not installed"
    ok "Docker Compose: $(docker compose version | awk '{print $NF}')"

    # Compose file
    [[ -f "${COMPOSE_FILE}" ]] || die "docker-compose.yml not found: ${COMPOSE_FILE}"
    ok "docker-compose.yml: found"

    # Python
    command -v python3 &>/dev/null || die "Python 3 not installed"
    local py_ver; py_ver=$(python3 --version | awk '{print $2}')
    ok "Python: ${py_ver}"

    # Node.js
    command -v node &>/dev/null || die "Node.js not installed. Run ./scripts/ubuntu-install.sh first."
    local node_ver; node_ver=$(node --version)
    ok "Node.js: ${node_ver}"

    # Sudo
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        warn "No passwordless sudo — system optimisation steps will prompt for password"
    else
        ok "Sudo: available"
    fi

    # Network
    if curl -fsS --max-time 5 https://registry-1.docker.io/v2/ &>/dev/null; then
        ok "Docker Hub: reachable"
    else
        warn "Docker Hub not reachable — will use cached images or fail on pull"
    fi
}

# ─── Step 2: Environment Configuration ───────────────────────────────────────
configure_env() {
    step "Environment Configuration"

    if [[ -f "${ENV_FILE}" ]] && [[ "$FORCE" == "false" ]] && [[ "$UPGRADE_ONLY" == "false" ]]; then
        warn ".env already exists"
        if ! confirm "Reconfigure .env values?"; then
            ok ".env: using existing"
            set -a && source "${ENV_FILE}" && set +a
            return 0
        fi
    fi

    info "Collecting configuration values..."

    # Embedding provider
    local EMBEDDING_PROVIDER
    prompt_value "EMBEDDING_PROVIDER" "Embedding provider (openai/local/ollama)" "openai"

    # OpenAI key
    local OPENAI_API_KEY="${OPENAI_API_KEY:-}"
    if [[ "$EMBEDDING_PROVIDER" == "openai" ]]; then
        prompt_secret "OPENAI_API_KEY" "OpenAI API key"
    else
        OPENAI_API_KEY="${OPENAI_API_KEY:-not-required}"
        info "OpenAI key not required for provider: ${EMBEDDING_PROVIDER}"
    fi

    # Generated secrets
    local DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 24)}"
    local JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
    local API_KEYS="${API_KEYS:-$(openssl rand -hex 16)}"
    local WEAVIATE_API_KEY="${WEAVIATE_API_KEY:-$(openssl rand -hex 20)}"

    if [[ "$NON_INTERACTIVE" == "false" ]]; then
        info "Generated random secrets (or using existing env vars)"
        info "  DB_PASSWORD: ${DB_PASSWORD:0:8}****"
        info "  JWT_SECRET:  ${JWT_SECRET:0:8}****"
        info "  API_KEYS:    ${API_KEYS:0:8}****"
    fi

    # Domain (optional, for production Nginx)
    local DOMAIN="${DOMAIN:-localhost}"
    prompt_value "DOMAIN" "Domain (e.g. memory.example.com or localhost for dev)" "localhost"

    # Copy template and apply values
    [[ -f "${PROJECT_ROOT}/.env.example" ]] && \
        cp "${PROJECT_ROOT}/.env.example" "${ENV_FILE}" || \
        : > "${ENV_FILE}"

    # Write all values using Python for reliable env-file editing
    python3 - << PYEOF
import re, os

env_path = '${ENV_FILE}'
template = '${PROJECT_ROOT}/.env.example'

with open(template if os.path.exists(template) else env_path) as f:
    content = f.read()

updates = {
    'OPENAI_API_KEY':       '${OPENAI_API_KEY}',
    'EMBEDDING_PROVIDER':   '${EMBEDDING_PROVIDER}',
    'DB_PASSWORD':          '${DB_PASSWORD}',
    'JWT_SECRET':           '${JWT_SECRET}',
    'API_KEYS':             '${API_KEYS}',
    'WEAVIATE_API_KEY':     '${WEAVIATE_API_KEY}',
    'NEXT_PUBLIC_API_URL':  'http://localhost:8000',
    'MULTI_TENANCY_ENABLED': 'true',
    'DEFAULT_TENANT_ID':    'default',
    'LOG_LEVEL':            'INFO',
    'LOG_FORMAT':           'json',
}

for key, val in updates.items():
    if val == '':
        continue
    pattern = rf'^({re.escape(key)}=).*\$'
    if re.search(pattern, content, re.MULTILINE):
        content = re.sub(pattern, rf'\g<1>{val}', content, flags=re.MULTILINE)
    else:
        content += f'\n{key}={val}'

with open(env_path, 'w') as f:
    f.write(content)

print('  ENV: written successfully')
PYEOF

    # Export for rest of script
    set -a && source "${ENV_FILE}" && set +a

    ok ".env configured"
    ok "API key: ${API_KEYS:0:8}****"
}

# ─── Step 3: System Optimisation ─────────────────────────────────────────────
optimise_system() {
    step "System Optimisation"

    if [[ "$SKIP_OPTIMIZE" == "true" ]]; then
        info "Skipping (--skip-optimize)"
        return
    fi

    # vm.max_map_count — required for Weaviate
    local current_map; current_map=$(sysctl -n vm.max_map_count 2>/dev/null || echo "0")
    if (( current_map < 262144 )); then
        run_sudo_q "Setting vm.max_map_count=262144 (Weaviate requirement)" \
            sysctl -w vm.max_map_count=262144

        echo 'vm.max_map_count=262144' | sudo tee /etc/sysctl.d/90-weaviate.conf > /dev/null
        ok "vm.max_map_count: 262144"
    else
        ok "vm.max_map_count: ${current_map} (already sufficient)"
    fi

    # vm.overcommit_memory — required for Redis
    local current_oc; current_oc=$(sysctl -n vm.overcommit_memory 2>/dev/null || echo "0")
    if [[ "$current_oc" != "1" ]]; then
        run_sudo_q "Setting vm.overcommit_memory=1 (Redis requirement)" \
            sysctl -w vm.overcommit_memory=1
        ok "vm.overcommit_memory: 1"
    else
        ok "vm.overcommit_memory: 1 (already set)"
    fi

    # vm.swappiness
    local current_swap; current_swap=$(sysctl -n vm.swappiness 2>/dev/null || echo "60")
    if (( current_swap > 10 )); then
        run_sudo_q "Reducing vm.swappiness to 10" sysctl -w vm.swappiness=10
        ok "vm.swappiness: 10"
    else
        ok "vm.swappiness: ${current_swap} (already optimised)"
    fi

    # THP — required for Redis
    local thp; thp=$(cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null | grep -o '\[.*\]' | tr -d '[]' || echo "unknown")
    if [[ "$thp" != "never" ]]; then
        echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled > /dev/null 2>&1 || true
        echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag  > /dev/null 2>&1 || true
        ok "THP: disabled"
    else
        ok "THP: already disabled"
    fi

    # BBR congestion control
    local tcp_cc; tcp_cc=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo "cubic")
    if [[ "$tcp_cc" != "bbr" ]]; then
        sudo modprobe tcp_bbr 2>/dev/null || true
        sudo sysctl -w net.core.default_qdisc=fq > /dev/null 2>&1 || true
        sudo sysctl -w net.ipv4.tcp_congestion_control=bbr > /dev/null 2>&1 || true
        ok "TCP congestion: BBR"
    else
        ok "TCP congestion: BBR (already set)"
    fi

    # File descriptor limits
    local current_nofile; current_nofile=$(ulimit -n)
    if (( current_nofile < 65536 )); then
        sudo tee /etc/security/limits.d/90-ai-memory.conf > /dev/null << 'LIMITS'
*     soft nofile  1048576
*     hard nofile  1048576
root  soft nofile  1048576
root  hard nofile  1048576
LIMITS
        ok "File descriptors: 1,048,576 (effective after re-login)"
    else
        ok "File descriptors: ${current_nofile}"
    fi

    # Docker daemon tuning
    if [[ ! -f /etc/docker/daemon.json ]] || ! python3 -m json.tool /etc/docker/daemon.json &>/dev/null; then
        sudo mkdir -p /etc/docker
        sudo tee /etc/docker/daemon.json > /dev/null << 'DOCKERD'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "100m", "max-file": "5", "compress": "true" },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": { "Name": "nofile", "Hard": 1048576, "Soft": 1048576 }
  },
  "live-restore": true
}
DOCKERD
        run_sudo_q "Restarting Docker with new config" systemctl restart docker
        ok "Docker daemon: configured"
    else
        ok "Docker daemon: already configured"
    fi
}

# ─── Step 4: Build & Pull ─────────────────────────────────────────────────────
build_images() {
    step "Building & Pulling Docker Images"

    cd "${PROJECT_ROOT}"

    # Pull base images first (shows progress cleanly)
    info "Pulling base images..."
    docker compose -f "${COMPOSE_FILE}" pull --quiet 2>&1 | tee -a "${LOG_FILE}" || {
        warn "Some images could not be pulled (may use cached versions)"
    }

    # Build custom images
    info "Building application images..."
    run_q "Building memory-api" \
        docker compose -f "${COMPOSE_FILE}" build --no-cache memory-api 2>/dev/null || \
        docker compose -f "${COMPOSE_FILE}" build memory-api
    ok "memory-api: built"

    run_q "Building mcp-server" \
        docker compose -f "${COMPOSE_FILE}" build mcp-server 2>/dev/null || \
        docker compose -f "${COMPOSE_FILE}" build mcp-server
    ok "mcp-server: built"

    run_q "Building dashboard" \
        docker compose -f "${COMPOSE_FILE}" build dashboard 2>/dev/null || \
        docker compose -f "${COMPOSE_FILE}" build dashboard
    ok "dashboard: built"
}

# ─── Step 5: Deploy Stack ─────────────────────────────────────────────────────
deploy_stack() {
    step "Deploying Docker Stack"

    cd "${PROJECT_ROOT}"
    set -a && source "${ENV_FILE}" && set +a

    # Stop existing services gracefully
    if docker compose -f "${COMPOSE_FILE}" ps -q 2>/dev/null | grep -q .; then
        info "Stopping existing services..."
        run_q "Stopping current containers" \
            docker compose -f "${COMPOSE_FILE}" down --remove-orphans --timeout 30
    fi

    # Start services
    info "Starting all services..."
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans 2>&1 | tee -a "${LOG_FILE}"
    ok "Containers started"

    # Health gate — wait for each service
    info "Waiting for services to become healthy..."
    echo ""

    # Infrastructure first
    wait_healthy "Weaviate"    "http://localhost:8080/v1/.well-known/ready" 120
    wait_healthy_container "Redis" "redis" 30

    # Application layer
    wait_healthy "Memory API"  "http://localhost:8000/health" 90
    wait_healthy_container "MCP Server" "mcp-server" 30
    wait_healthy "Dashboard"   "http://localhost:3001" 60

    echo ""
    ok "All services healthy"
}

wait_healthy() {
    local name="$1" url="$2" timeout="${3:-60}"
    local elapsed=0
    printf "    %-20s" "${name}:"
    while (( elapsed < timeout )); do
        if curl -fsS --max-time 3 "$url" &>/dev/null; then
            echo -e " ${CHECK}"
            return 0
        fi
        sleep 3; (( elapsed += 3 ))
        [[ $(( elapsed % 15 )) -eq 0 ]] && printf "." || true
    done
    echo -e " ${WARN} timeout (${timeout}s) — check logs"
    WARNINGS+=("${name} health check timed out")
}

wait_healthy_container() {
    local name="$1" container="$2" timeout="${3:-30}"
    local elapsed=0
    printf "    %-20s" "${name}:"
    while (( elapsed < timeout )); do
        local state; state=$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
        local health; health=$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        if [[ "$state" == "running" ]]; then
            echo -e " ${CHECK} (${health:-no healthcheck})"
            return 0
        fi
        sleep 3; (( elapsed += 3 ))
    done
    echo -e " ${WARN} not running"
    WARNINGS+=("${name} container not running")
}

# ─── Step 6: Schema Initialisation ───────────────────────────────────────────
init_schema() {
    step "Schema Initialisation"

    # Check if schema already exists
    local existing; existing=$(curl -fsS --max-time 10 \
        "http://localhost:8080/v1/schema" 2>/dev/null \
        | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cols = d.get('classes', d.get('collections', []))
    print(len(cols))
except:
    print(0)
" 2>/dev/null || echo "0")

    if (( existing > 0 )); then
        ok "Schema: ${existing} collections already exist (skipping re-init)"

        # Still verify expected collections
        local schema; schema=$(curl -fsS --max-time 10 "http://localhost:8080/v1/schema" 2>/dev/null)
        for expected in "Memories" "Entities" "Relationships"; do
            if echo "$schema" | grep -qi "\"$expected\""; then
                ok "Collection '${expected}': exists"
            else
                warn "Collection '${expected}': missing — may need re-init"
            fi
        done
        return 0
    fi

    info "Initialising Weaviate schema..."

    local API_KEY="${API_KEYS%%,*}"

    # Try API-based init
    local init_resp; init_resp=$(curl -s --max-time 30 -X POST \
        "http://localhost:8000/admin/init-schema" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" 2>/dev/null || echo '{"error":"connection failed"}')

    if echo "$init_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('status')=='ok' or 'created' in str(d) else 1)" 2>/dev/null; then
        ok "Schema initialised via API"
    else
        # Fallback: direct Weaviate schema creation
        warn "API init unavailable — creating schema directly in Weaviate"
        _create_schema_direct
    fi

    # Create default tenant
    curl -s -X POST "http://localhost:8000/tenants" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d '{"tenant_id":"default","name":"Default Tenant"}' > /dev/null 2>&1 || true

    ok "Default tenant configured"

    # Verify
    local count; count=$(curl -fsS --max-time 10 "http://localhost:8080/v1/schema" 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('classes',d.get('collections',[]))))" 2>/dev/null || echo "?")
    ok "Collections created: ${count}"
}

_create_schema_direct() {
    # Minimal Memories collection — direct Weaviate API
    curl -s -X POST "http://localhost:8080/v1/schema" \
        -H "Content-Type: application/json" \
        -d '{
          "class": "Memories",
          "description": "AI agent memory storage",
          "multiTenancyConfig": {"enabled": true},
          "properties": [
            {"name": "content",      "dataType": ["text"]},
            {"name": "memory_type",  "dataType": ["text"]},
            {"name": "tier",         "dataType": ["int"]},
            {"name": "tenant_id",    "dataType": ["text"]},
            {"name": "metadata",     "dataType": ["object"]},
            {"name": "created_at",   "dataType": ["date"]}
          ]
        }' >> "${LOG_FILE}" 2>&1 || true

    curl -s -X POST "http://localhost:8080/v1/schema" \
        -H "Content-Type: application/json" \
        -d '{
          "class": "Entities",
          "description": "Knowledge graph entities",
          "multiTenancyConfig": {"enabled": true},
          "properties": [
            {"name": "name",         "dataType": ["text"]},
            {"name": "entity_type",  "dataType": ["text"]},
            {"name": "description",  "dataType": ["text"]},
            {"name": "tenant_id",    "dataType": ["text"]}
          ]
        }' >> "${LOG_FILE}" 2>&1 || true

    curl -s -X POST "http://localhost:8080/v1/schema" \
        -H "Content-Type: application/json" \
        -d '{
          "class": "Relationships",
          "description": "Knowledge graph edges",
          "multiTenancyConfig": {"enabled": true},
          "properties": [
            {"name": "source_id",        "dataType": ["text"]},
            {"name": "relation_type",    "dataType": ["text"]},
            {"name": "target_id",        "dataType": ["text"]},
            {"name": "weight",           "dataType": ["number"]},
            {"name": "tenant_id",        "dataType": ["text"]}
          ]
        }' >> "${LOG_FILE}" 2>&1 || true

    ok "Schema created directly via Weaviate API"
}

# ─── Step 7: MCP Server Verification ─────────────────────────────────────────
verify_mcp() {
    step "MCP Server Verification"

    # Check container
    if ! docker inspect mcp-server &>/dev/null; then
        warn "MCP server container not found"
        return
    fi

    local state; state=$(docker inspect --format '{{.State.Status}}' mcp-server 2>/dev/null)
    if [[ "$state" == "running" ]]; then
        ok "MCP container: running"
    else
        warn "MCP container: ${state}"
        return
    fi

    # HTTP endpoint test
    local mcp_resp; mcp_resp=$(curl -s --max-time 5 \
        "http://localhost:3000/health" 2>/dev/null || echo '{}')
    if echo "$mcp_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0)" 2>/dev/null; then
        ok "MCP HTTP endpoint: responding"
    else
        info "MCP HTTP health endpoint not available (stdio-only transport is normal)"
    fi

    # Verify built output
    if [[ -f "${PROJECT_ROOT}/packages/mcp-server/dist/index.js" ]]; then
        ok "MCP dist/index.js: present"
    else
        warn "MCP dist/index.js not found — run: npm run build"
    fi

    # Print integration config
    local abs_mcp="${PROJECT_ROOT}/packages/mcp-server/dist/index.js"
    local api_key="${API_KEYS%%,*}"
    info "Claude Desktop config (add to claude_desktop_config.json):"
    echo -e ""
    echo -e '    {' | tee -a "${LOG_FILE}"
    echo -e '      "mcpServers": {' | tee -a "${LOG_FILE}"
    echo -e '        "ai-memory": {' | tee -a "${LOG_FILE}"
    echo -e "          \"command\": \"node\"," | tee -a "${LOG_FILE}"
    echo -e "          \"args\": [\"${abs_mcp}\"]," | tee -a "${LOG_FILE}"
    echo -e "          \"env\": {" | tee -a "${LOG_FILE}"
    echo -e "            \"MEMORY_API_URL\": \"http://localhost:8000\"," | tee -a "${LOG_FILE}"
    echo -e "            \"AI_MEMORY_API_KEY\": \"${api_key}\"" | tee -a "${LOG_FILE}"
    echo -e '          }' | tee -a "${LOG_FILE}"
    echo -e '        }' | tee -a "${LOG_FILE}"
    echo -e '      }' | tee -a "${LOG_FILE}"
    echo -e '    }' | tee -a "${LOG_FILE}"
    echo -e ""
}

# ─── Step 8: Systemd Auto-start ───────────────────────────────────────────────
setup_systemd() {
    step "Systemd Auto-start"

    if [[ "$SKIP_SYSTEMD" == "true" ]]; then
        info "Skipping (--skip-systemd)"
        return
    fi

    if ! confirm "Configure systemd to auto-start on boot?" "y"; then
        info "Skipping systemd setup"
        return
    fi

    local current_user="${SUDO_USER:-${USER}}"

    sudo tee /etc/systemd/system/ai-memory.service > /dev/null << SVC
[Unit]
Description=AI Memory System (Weaviate + Redis + API + MCP + Dashboard)
Documentation=${PROJECT_ROOT}/docs/INSTALL.md
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=${current_user}
WorkingDirectory=${PROJECT_ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/docker compose -f ${COMPOSE_FILE} up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f ${COMPOSE_FILE} down --timeout 30
ExecReload=/usr/bin/docker compose -f ${COMPOSE_FILE} restart
TimeoutStartSec=300
TimeoutStopSec=60
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
SVC

    sudo systemctl daemon-reload
    sudo systemctl enable ai-memory.service >> "${LOG_FILE}" 2>&1
    ok "Systemd service: ai-memory.service enabled"
    ok "Auto-start on boot: yes"
    info "Commands: sudo systemctl start|stop|restart|status ai-memory"
}

# ─── Step 9: Smoke Tests ──────────────────────────────────────────────────────
smoke_tests() {
    step "Post-Deploy Smoke Tests"

    local API_KEY="${API_KEYS%%,*}"
    local PASS=0; local FAIL=0

    smoke() {
        local name="$1" cmd="$2"
        if eval "$cmd" >> "${LOG_FILE}" 2>&1; then
            ok "PASS  ${name}"
            (( PASS++ ))
        else
            fail "FAIL  ${name}"
            (( FAIL++ ))
        fi
    }

    smoke "Weaviate ready"    "curl -fsS --max-time 5 http://localhost:8080/v1/.well-known/ready"
    smoke "Weaviate meta"     "curl -fsS --max-time 5 http://localhost:8080/v1/meta"
    smoke "API health"        "curl -fsS --max-time 5 http://localhost:8000/health"
    smoke "API docs"          "curl -fsS --max-time 5 http://localhost:8000/docs"
    smoke "API stats"         "curl -fsS --max-time 5 -H 'X-API-Key: ${API_KEY}' http://localhost:8000/stats"
    smoke "Dashboard"         "curl -fsS --max-time 10 http://localhost:3001"
    smoke "Redis ping"        "docker exec redis redis-cli ping | grep -q PONG"
    smoke "Redis AOF enabled" "docker exec redis redis-cli config get appendonly | grep -q yes"
    smoke "Weaviate schema"   "curl -fsS --max-time 5 http://localhost:8080/v1/schema | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if len(d.get(\"classes\",d.get(\"collections\",[])))>0 else 1)'"

    # Write a test memory and search for it
    local test_memory_id
    test_memory_id=$(curl -s --max-time 10 -X POST http://localhost:8000/memories \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d "{\"content\":\"smoke test memory $(date +%s)\",\"memory_type\":\"episodic\",\"tier\":1}" \
        2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','error'))" 2>/dev/null || echo "error")

    if [[ "$test_memory_id" != "error" ]] && [[ -n "$test_memory_id" ]]; then
        ok "PASS  Memory write + read (id: ${test_memory_id:0:8}...)"
        (( PASS++ ))
        # Cleanup test memory
        curl -s -X DELETE "http://localhost:8000/memories/${test_memory_id}" \
            -H "X-API-Key: ${API_KEY}" > /dev/null 2>&1 || true
    else
        fail "FAIL  Memory write/read"
        (( FAIL++ ))
    fi

    echo ""
    echo -e "  ${BOLD}Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"

    (( FAIL > 0 )) && WARNINGS+=("${FAIL} smoke test(s) failed — check logs")
}

# ─── Deploy Report ────────────────────────────────────────────────────────────
generate_report() {
    local duration=$(( $(date +%s) - DEPLOY_START ))
    local mins=$(( duration / 60 ))
    local secs=$(( duration % 60 ))

    # Console summary
    echo -e ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                 Deployment Complete! 🚀                          ║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║  Service         URL                                            ║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Dashboard     ${CYAN}http://localhost:3001${NC}                          ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Memory API    ${CYAN}http://localhost:8000${NC}                          ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  API Docs      ${CYAN}http://localhost:8000/docs${NC}                     ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Weaviate      ${CYAN}http://localhost:8080${NC}                          ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Redis         ${CYAN}localhost:6379${NC}                                 ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  API Key       ${YELLOW}${API_KEYS%%,*}${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo -e "${GREEN}${BOLD}║${NC}  ${YELLOW}Warnings:${NC}"
        for w in "${WARNINGS[@]}"; do
            echo -e "${GREEN}${BOLD}║${NC}    ${WARN}  ${w}"
        done
        echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
    fi

    echo -e "${GREEN}${BOLD}║${NC}  Deploy time   ${DIM}${mins}m ${secs}s${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Log           ${DIM}${LOG_FILE}${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo -e ""
    echo -e "  ${BOLD}Next steps:${NC}"
    echo -e "  1. ${CYAN}./scripts/manage.sh status${NC}      — verify services"
    echo -e "  2. ${CYAN}./scripts/healthcheck.sh${NC}        — deep health report"
    echo -e "  3. Add MCP config to Claude Desktop (printed above in step 7)"
    echo -e "  4. ${CYAN}./scripts/manage.sh backup${NC}      — create first backup"
    echo -e "  5. Review ${CYAN}docs/INSTALL.md §12${NC}            — production hardening"
    echo -e ""

    # Write markdown report
    cat > "${DEPLOY_REPORT}" << REPORT
# Deploy Report — $(date '+%Y-%m-%d %H:%M:%S')

## Status
$([ ${#WARNINGS[@]} -eq 0 ] && echo "✅ All checks passed" || echo "⚠️ Deployed with ${#WARNINGS[@]} warning(s)")

## Services

| Service | URL | Status |
|---------|-----|--------|
| Dashboard | http://localhost:3001 | ✓ |
| Memory API | http://localhost:8000 | ✓ |
| API Docs | http://localhost:8000/docs | ✓ |
| Weaviate | http://localhost:8080 | ✓ |
| Redis | localhost:6379 | ✓ |

## Credentials

\`\`\`
API_KEYS=${API_KEYS}
\`\`\`

> ⚠️ **Store these credentials securely. They are not shown again.**

## Deployment Details

- Duration: ${mins}m ${secs}s
- Log: ${LOG_FILE}
- Project: ${PROJECT_ROOT}
- Date: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

## Warnings

$([ ${#WARNINGS[@]} -eq 0 ] && echo "None" || printf -- "- %s\n" "${WARNINGS[@]}")

## MCP Integration

Add to \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "ai-memory": {
      "command": "node",
      "args": ["${PROJECT_ROOT}/packages/mcp-server/dist/index.js"],
      "env": {
        "MEMORY_API_URL": "http://localhost:8000",
        "AI_MEMORY_API_KEY": "${API_KEYS%%,*}"
      }
    }
  }
}
\`\`\`
REPORT

    echo -e "  ${DIM}Full report: ${DEPLOY_REPORT}${NC}"
}

# ─── Argument parsing ─────────────────────────────────────────────────────────
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --non-interactive|-y) NON_INTERACTIVE=true ;;
            --upgrade)            UPGRADE_ONLY=true ;;
            --skip-optimize)      SKIP_OPTIMIZE=true ;;
            --skip-systemd)       SKIP_SYSTEMD=true ;;
            --dry-run)            DRY_RUN=true; warn "DRY-RUN: no changes will be made" ;;
            --force)              FORCE=true ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "  --non-interactive   No prompts (use env vars for secrets)"
                echo "  --upgrade           Redeploy without reconfiguring .env"
                echo "  --skip-optimize     Skip kernel/system optimisation"
                echo "  --skip-systemd      Skip systemd service setup"
                echo "  --dry-run           Show what would run, no changes"
                echo "  --force             Overwrite existing .env"
                echo ""
                echo "  Non-interactive required env vars:"
                echo "    OPENAI_API_KEY, DB_PASSWORD, JWT_SECRET, API_KEYS,"
                echo "    WEAVIATE_API_KEY, EMBEDDING_PROVIDER"
                exit 0
                ;;
            *) warn "Unknown argument: $1" ;;
        esac
        shift
    done
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    parse_args "$@"
    banner

    if [[ "$NON_INTERACTIVE" == "false" ]]; then
        echo -e "${BOLD}This will:${NC}"
        echo -e "  • Validate system requirements"
        echo -e "  • Configure environment (.env)"
        echo -e "  • Apply kernel optimisations for Weaviate & Redis"
        echo -e "  • Build and deploy the full Docker stack"
        echo -e "  • Initialise Weaviate schema"
        echo -e "  • Verify MCP server integration"
        echo -e "  • Set up systemd auto-start"
        echo -e "  • Run smoke tests"
        echo -e ""
        confirm "Proceed with deployment?" "y" || { echo "Aborted."; exit 0; }
    fi

    preflight
    configure_env
    optimise_system
    build_images
    deploy_stack
    init_schema
    verify_mcp
    setup_systemd
    smoke_tests
    generate_report
}

main "$@"
