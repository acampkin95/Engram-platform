#!/usr/bin/env bash
# =============================================================================
#  AI Memory System — Ubuntu Install Bundle
#  Interactive setup: system deps → Docker → optimization → stack deploy
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ─── Colours & Formatting ────────────────────────────────────────────────────
RED='\033[0;31m';    GREEN='\033[0;32m';   YELLOW='\033[1;33m'
BLUE='\033[0;34m';   CYAN='\033[0;36m';   MAGENTA='\033[0;35m'
BOLD='\033[1m';      DIM='\033[2m';        NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; ARROW="${CYAN}→${NC}"
WARN="${YELLOW}⚠${NC}";  INFO="${BLUE}ℹ${NC}"

# ─── Global State ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/install-$(date +%Y%m%d-%H%M%S).log"
INSTALL_STATE_FILE="${PROJECT_ROOT}/.install-state"

SKIP_SYSTEM_UPDATE=false
SKIP_DOCKER=false
SKIP_OPTIMIZE=false
SKIP_DEPLOY=false
DRY_RUN=false

# Track install phases for resumption
declare -A PHASES_DONE

# ─── Helpers ─────────────────────────────────────────────────────────────────
log() { echo -e "$*" | tee -a "${LOG_FILE}"; }
log_raw() { echo "$*" >> "${LOG_FILE}" 2>&1; }
step() { echo -e "\n${BLUE}━━━${NC} ${BOLD}$*${NC}" | tee -a "${LOG_FILE}"; }
ok()   { echo -e "  ${CHECK} $*" | tee -a "${LOG_FILE}"; }
fail() { echo -e "  ${CROSS} $*" | tee -a "${LOG_FILE}"; }
warn() { echo -e "  ${WARN}  $*" | tee -a "${LOG_FILE}"; }
info() { echo -e "  ${INFO}  $*" | tee -a "${LOG_FILE}"; }

die() {
    echo -e "\n${RED}${BOLD}FATAL:${NC} $*" | tee -a "${LOG_FILE}"
    echo -e "${DIM}See full log: ${LOG_FILE}${NC}"
    exit 1
}

confirm() {
    local prompt="$1"
    local default="${2:-y}"
    local yn_prompt
    [[ "$default" == "y" ]] && yn_prompt="[Y/n]" || yn_prompt="[y/N]"
    echo -e "\n  ${MAGENTA}?${NC} ${BOLD}${prompt}${NC} ${DIM}${yn_prompt}${NC} " >&2
    read -r reply </dev/tty
    reply="${reply:-$default}"
    [[ "$reply" =~ ^[Yy]$ ]]
}

prompt_value() {
    local prompt="$1"
    local default="${2:-}"
    local secret="${3:-false}"
    local value
    if [[ "$secret" == "true" ]]; then
        echo -e "\n  ${MAGENTA}?${NC} ${BOLD}${prompt}${NC}${DIM}${default:+ [${default}]}${NC}: " >&2
        read -rs value </dev/tty
        echo "" >&2
    else
        echo -e "\n  ${MAGENTA}?${NC} ${BOLD}${prompt}${NC}${DIM}${default:+ [${default}]}${NC}: " >&2
        read -r value </dev/tty
    fi
    echo "${value:-$default}"
}

spinner() {
    local pid="$1" msg="$2"
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local i=0
    tput civis 2>/dev/null || true
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${CYAN}%s${NC}  %s " "${frames[$((i % ${#frames[@]}))]}" "$msg"
        ((i++))
        sleep 0.1
    done
    tput cnorm 2>/dev/null || true
    printf "\r%*s\r" "$(tput cols)" ""
}

run_quiet() {
    local msg="$1"; shift
    if [[ "$DRY_RUN" == "true" ]]; then
        info "[DRY-RUN] $*"
        return 0
    fi
    { "$@" >> "${LOG_FILE}" 2>&1; } &
    local pid=$!
    spinner "$pid" "$msg"
    wait "$pid"
}

run_with_sudo() {
    local msg="$1"; shift
    if [[ "$DRY_RUN" == "true" ]]; then
        info "[DRY-RUN] sudo $*"
        return 0
    fi
    { sudo "$@" >> "${LOG_FILE}" 2>&1; } &
    local pid=$!
    spinner "$pid" "$msg"
    wait "$pid"
}

save_phase() { echo "$1" >> "${INSTALL_STATE_FILE}"; }
phase_done() { grep -q "^$1$" "${INSTALL_STATE_FILE}" 2>/dev/null; }

require_cmd() {
    command -v "$1" &>/dev/null || die "Required command '$1' not found. Install it first."
}

require_root_or_sudo() {
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        die "This script requires sudo privileges. Run with a user that has sudo access."
    fi
}

ubuntu_version_check() {
    local ver
    ver=$(lsb_release -rs 2>/dev/null || echo "0")
    local major="${ver%%.*}"
    if (( major < 22 )); then
        warn "Ubuntu ${ver} detected. Ubuntu 22.04+ is recommended."
        confirm "Continue anyway?" "n" || die "Aborted."
    fi
}

# ─── Banner ───────────────────────────────────────────────────────────────────
show_banner() {
    echo -e ""
    echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}${BOLD}║      AI Memory System — Ubuntu Interactive Installer             ║${NC}"
    echo -e "${BLUE}${BOLD}║      Weaviate · PostgreSQL · Redis · FastAPI · MCP · Dashboard  ║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "${DIM}  Log: ${LOG_FILE}${NC}"
    echo -e ""
}

# ─── Pre-flight checks ────────────────────────────────────────────────────────
preflight() {
    step "Pre-flight checks"

    # OS
    if [[ "$(uname -s)" != "Linux" ]]; then
        die "This installer targets Ubuntu Linux. Current OS: $(uname -s)"
    fi
    ok "OS: Linux"

    # Ubuntu specifically
    if command -v lsb_release &>/dev/null; then
        ubuntu_version_check
        ok "Ubuntu $(lsb_release -rs)"
    fi

    # Architecture
    local arch; arch=$(uname -m)
    if [[ "$arch" != "x86_64" ]] && [[ "$arch" != "aarch64" ]]; then
        warn "Architecture ${arch} may have limited Docker image support."
    else
        ok "Architecture: ${arch}"
    fi

    # Disk space (require ≥20 GB free)
    local free_gb; free_gb=$(df -BG "${PROJECT_ROOT}" | awk 'NR==2{gsub("G","",$4); print $4}')
    if (( free_gb < 20 )); then
        warn "Only ${free_gb}GB free. 20GB+ recommended for full stack with data volumes."
        confirm "Continue with limited disk space?" "n" || die "Aborted."
    else
        ok "Disk space: ${free_gb}GB free"
    fi

    # RAM
    local ram_gb; ram_gb=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
    if (( ram_gb < 8 )); then
        warn "Only ${ram_gb}GB RAM. 16GB+ recommended for full stack."
        confirm "Continue with limited RAM?" "n" || die "Aborted."
    else
        ok "RAM: ${ram_gb}GB"
    fi

    # Network
    if ! curl -fsSL --max-time 5 https://example.com &>/dev/null; then
        warn "Cannot reach the internet. Some steps may fail."
    else
        ok "Network: reachable"
    fi

    # Sudo access
    require_root_or_sudo
    ok "Sudo access: confirmed"

    echo -e ""
}

# ─── Phase 1: System packages ─────────────────────────────────────────────────
install_system_packages() {
    phase_done "system_packages" && { info "System packages already installed, skipping."; return 0; }
    step "Phase 1/5 — System packages"

    run_with_sudo "Updating apt package list" apt-get update -q
    run_with_sudo "Installing essential tools" apt-get install -yq \
        curl wget git build-essential ca-certificates \
        gnupg lsb-release apt-transport-https software-properties-common \
        htop iotop nethogs tmux \
        unzip jq yq \
        python3 python3-pip python3-venv \
        net-tools dnsutils \
        fail2ban ufw \
        logrotate

    ok "System packages installed"

    # Python 3.12 via deadsnakes PPA (if not already 3.12+)
    local py_ver; py_ver=$(python3 --version 2>&1 | awk '{print $2}')
    local py_major_minor; py_major_minor=$(echo "$py_ver" | cut -d. -f1,2)
    if [[ "$py_major_minor" < "3.12" ]]; then
        info "Python ${py_ver} found. Installing 3.12 via deadsnakes PPA..."
        run_with_sudo "Adding deadsnakes PPA" add-apt-repository -y ppa:deadsnakes/ppa
        run_with_sudo "Updating apt after PPA" apt-get update -q
        run_with_sudo "Installing Python 3.12" apt-get install -yq python3.12 python3.12-venv python3.12-dev
        ok "Python 3.12 installed"
    else
        ok "Python ${py_ver} — adequate"
    fi

    # Node.js 20 LTS
    if ! command -v node &>/dev/null || [[ "$(node -v | tr -d 'v' | cut -d. -f1)" -lt 20 ]]; then
        info "Installing Node.js 20 LTS via NodeSource..."
        run_quiet "Fetching NodeSource setup" bash -c \
            'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -'
        run_with_sudo "Installing Node.js 20" apt-get install -yq nodejs
        ok "Node.js $(node -v) installed"
    else
        ok "Node.js $(node -v) — adequate"
    fi

    save_phase "system_packages"
}

# ─── Phase 2: Docker ──────────────────────────────────────────────────────────
install_docker() {
    phase_done "docker" && { info "Docker already installed, skipping."; return 0; }
    step "Phase 2/5 — Docker Engine & Compose"

    if command -v docker &>/dev/null; then
        ok "Docker already installed: $(docker --version)"
    else
        info "Installing Docker Engine..."

        # Remove conflicting packages
        run_with_sudo "Removing old docker packages" \
            apt-get remove -yq docker docker-engine docker.io containerd runc 2>/dev/null || true

        # Add Docker's official GPG key
        run_quiet "Downloading Docker GPG key" bash -c \
            'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg'

        # Add Docker repo
        local arch; arch=$(dpkg --print-architecture)
        local codename; codename=$(lsb_release -cs)
        run_with_sudo "Adding Docker apt repo" bash -c \
            "echo \"deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable\" | tee /etc/apt/sources.list.d/docker.list > /dev/null"

        run_with_sudo "Updating apt (Docker repo)" apt-get update -q
        run_with_sudo "Installing Docker" apt-get install -yq \
            docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

        ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    fi

    # Add current user to docker group
    local current_user="${SUDO_USER:-$(whoami)}"
    if ! groups "${current_user}" | grep -q docker; then
        run_with_sudo "Adding ${current_user} to docker group" usermod -aG docker "${current_user}"
        warn "Docker group added — log out/in (or use 'newgrp docker') to apply without sudo."
    else
        ok "User ${current_user} already in docker group"
    fi

    # Start and enable Docker
    run_with_sudo "Enabling Docker service" systemctl enable docker --now
    ok "Docker daemon running"

    save_phase "docker"
}

# ─── Phase 3: System optimisation ────────────────────────────────────────────
optimize_system() {
    phase_done "system_optimize" && { info "System optimization already applied, skipping."; return 0; }
    step "Phase 3/5 — System Optimisation"

    # ── Sysctl tuning ──────────────────────────────────────────────────────
    info "Applying sysctl kernel parameters..."
    cat <<'EOF' | sudo tee /etc/sysctl.d/90-ai-memory.conf > /dev/null
# =============================================================================
# AI Memory System — Kernel Tuning
# =============================================================================

# ── Virtual Memory ──────────────────────────────────────────────────────────
# Weaviate's HNSW graph benefits from generous dirty-page buffers
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
# Reduce swappiness — keep data in RAM as long as possible
vm.swappiness = 10
# Large memory maps for Weaviate MMAP files
vm.max_map_count = 262144
# Overcommit for vector operations
vm.overcommit_memory = 1

# ── Network ─────────────────────────────────────────────────────────────────
# Larger socket buffers for high-throughput gRPC / HTTP2
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.rmem_default = 65536
net.core.wmem_default = 65536
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq
# Increase connection queue depth
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
# Keepalive tuning for long-lived gRPC streams
net.ipv4.tcp_keepalive_time = 60
net.ipv4.tcp_keepalive_intvl = 10
net.ipv4.tcp_keepalive_probes = 6
# TIME_WAIT recycling
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10000 65535

# ── File system ─────────────────────────────────────────────────────────────
# More open file descriptors for Docker containers + DB connections
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 256

# ── Kernel ──────────────────────────────────────────────────────────────────
kernel.pid_max = 4194304
EOF

    run_with_sudo "Loading sysctl settings" sysctl -p /etc/sysctl.d/90-ai-memory.conf
    ok "Kernel parameters applied"

    # ── File-descriptor limits ─────────────────────────────────────────────
    info "Setting ulimit / systemd limits..."
    cat <<'EOF' | sudo tee /etc/security/limits.d/90-ai-memory.conf > /dev/null
# AI Memory System — file descriptor limits
*         soft  nofile  1048576
*         hard  nofile  1048576
root      soft  nofile  1048576
root      hard  nofile  1048576
*         soft  nproc   unlimited
*         hard  nproc   unlimited
EOF

    # Systemd global override
    sudo mkdir -p /etc/systemd/system.conf.d
    cat <<'EOF' | sudo tee /etc/systemd/system.conf.d/90-ai-memory.conf > /dev/null
[Manager]
DefaultLimitNOFILE=1048576
DefaultLimitNPROC=infinity
DefaultTasksMax=infinity
EOF
    run_with_sudo "Reloading systemd daemon" systemctl daemon-reexec
    ok "File descriptor limits set (1M)"

    # ── Swap ──────────────────────────────────────────────────────────────
    local ram_gb; ram_gb=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
    local swap_gb=$(( ram_gb / 2 > 8 ? 8 : ram_gb / 2 ))
    if ! swapon --show | grep -q swapfile 2>/dev/null && [[ ! -f /swapfile ]]; then
        if confirm "Create ${swap_gb}GB swap file? (recommended for <32GB RAM)" "y"; then
            run_with_sudo "Allocating ${swap_gb}GB swapfile" fallocate -l "${swap_gb}G" /swapfile
            sudo chmod 600 /swapfile
            run_with_sudo "Formatting swap" mkswap /swapfile
            run_with_sudo "Enabling swap" swapon /swapfile
            echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
            ok "Swap: ${swap_gb}GB created and enabled"
        fi
    else
        ok "Swap already configured"
    fi

    # ── Docker daemon tuning ───────────────────────────────────────────────
    info "Tuning Docker daemon..."
    sudo mkdir -p /etc/docker
    cat <<'EOF' | sudo tee /etc/docker/daemon.json > /dev/null
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5",
    "compress": "true"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 1048576,
      "Soft": 1048576
    }
  },
  "metrics-addr": "127.0.0.1:9323",
  "experimental": false,
  "live-restore": true,
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 10
}
EOF
    run_with_sudo "Restarting Docker with new config" systemctl restart docker
    ok "Docker daemon tuned (log rotation, overlay2, ulimits)"

    # ── I/O Scheduler ─────────────────────────────────────────────────────
    info "Setting I/O scheduler for NVMe/SSD..."
    cat <<'EOF' | sudo tee /etc/udev/rules.d/60-io-scheduler.rules > /dev/null
# NVMe — none (queue managed by NVMe driver)
ACTION=="add|change", KERNEL=="nvme[0-9]*", ATTR{queue/scheduler}="none"
# SATA SSD — mq-deadline
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="0", ATTR{queue/scheduler}="mq-deadline"
# HDD — bfq
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="1", ATTR{queue/scheduler}="bfq"
EOF
    run_with_sudo "Reloading udev rules" udevadm control --reload-rules
    ok "I/O scheduler rules applied"

    # ── Transparent huge pages ─────────────────────────────────────────────
    info "Disabling Transparent Huge Pages (THP) for Weaviate/Redis..."
    cat <<'EOF' | sudo tee /etc/systemd/system/disable-thp.service > /dev/null
[Unit]
Description=Disable Transparent Huge Pages (THP)
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/defrag'
RemainAfterExit=yes

[Install]
WantedBy=basic.target
EOF
    run_with_sudo "Enabling disable-thp service" systemctl enable --now disable-thp
    ok "Transparent Huge Pages disabled"

    # ── Basic firewall ─────────────────────────────────────────────────────
    if confirm "Configure UFW firewall? (allow SSH + service ports)" "y"; then
        run_with_sudo "Resetting UFW defaults" ufw --force reset
        run_with_sudo "UFW default deny incoming" ufw default deny incoming
        run_with_sudo "UFW default allow outgoing" ufw default allow outgoing
        run_with_sudo "UFW allow SSH" ufw allow 22/tcp
        run_with_sudo "UFW allow HTTP" ufw allow 80/tcp
        run_with_sudo "UFW allow HTTPS" ufw allow 443/tcp
        run_with_sudo "UFW allow dashboard (3001)" ufw allow 3001/tcp
        run_with_sudo "UFW allow API (8000)" ufw allow 8000/tcp
        run_with_sudo "UFW allow Weaviate (8080)" ufw allow 8080/tcp
        run_with_sudo "UFW enable" ufw --force enable
        ok "UFW firewall configured"
    fi

    # ── Log rotation ───────────────────────────────────────────────────────
    cat <<EOF | sudo tee /etc/logrotate.d/ai-memory > /dev/null
${PROJECT_ROOT}/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $(whoami) $(id -gn)
    sharedscripts
}
EOF
    ok "Log rotation configured (14 days)"

    save_phase "system_optimize"
}

# ─── Phase 4: Data directories & .env ────────────────────────────────────────
setup_project() {
    phase_done "project_setup" && { info "Project already configured, skipping."; return 0; }
    step "Phase 4/5 — Project Configuration"

    # Create volume directories
    local dirs=(
        "${PROJECT_ROOT}/logs"
        "${PROJECT_ROOT}/data/volumes/weaviate"
        "${PROJECT_ROOT}/data/volumes/postgres"
        "${PROJECT_ROOT}/data/volumes/redis"
        "${PROJECT_ROOT}/data/backups"
        "${PROJECT_ROOT}/data/configs"
    )
    for d in "${dirs[@]}"; do
        mkdir -p "$d"
        ok "Directory: $d"
    done

    # .env setup
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        warn ".env already exists. Skipping interactive configuration."
        confirm "Re-configure .env values?" "n" && setup_env || true
    else
        setup_env
    fi

    save_phase "project_setup"
}

setup_env() {
    info "Interactive .env configuration..."

    local openai_key embedding_provider db_password weaviate_key api_key

    embedding_provider=$(prompt_value "Embedding provider (openai / local)" "openai")

    if [[ "$embedding_provider" == "openai" ]]; then
        openai_key=$(prompt_value "OpenAI API key" "" "true")
        if [[ -z "$openai_key" ]]; then
            warn "No API key provided — system will use mock/local embeddings."
            openai_key="your-openai-api-key-here"
        fi
    else
        openai_key="not-needed-for-local"
    fi

    db_password=$(prompt_value "PostgreSQL password" "$(openssl rand -hex 16)")
    weaviate_key=$(prompt_value "Weaviate API key" "$(openssl rand -hex 16)")
    api_key=$(prompt_value "Dashboard API key" "$(openssl rand -hex 16)")

    cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env" 2>/dev/null || \
        touch "${PROJECT_ROOT}/.env"

    # Write values
    python3 - <<PYEOF
import re, os

env_path = '${PROJECT_ROOT}/.env'
example_path = '${PROJECT_ROOT}/.env.example'

# Read template
with open(example_path if os.path.exists(example_path) else env_path) as f:
    content = f.read()

replacements = {
    'OPENAI_API_KEY': '${openai_key}',
    'EMBEDDING_PROVIDER': '${embedding_provider}',
    'DB_PASSWORD': '${db_password}',
    'WEAVIATE_API_KEY': '${weaviate_key}',
    'API_KEY': '${api_key}',
}

for key, val in replacements.items():
    pattern = rf'^({key}=).*$'
    if re.search(pattern, content, re.MULTILINE):
        content = re.sub(pattern, rf'\g<1>{val}', content, flags=re.MULTILINE)
    else:
        content += f'\n{key}={val}'

with open('${PROJECT_ROOT}/.env', 'w') as f:
    f.write(content)

print('  .env written')
PYEOF

    ok ".env configured"
}

# ─── Phase 5: Deploy stack ────────────────────────────────────────────────────
deploy_stack() {
    phase_done "stack_deployed" && { info "Stack already deployed, skipping."; return 0; }
    step "Phase 5/5 — Deploying Docker Stack"

    local compose_file="${PROJECT_ROOT}/docker/docker-compose.yml"
    [[ -f "$compose_file" ]] || die "docker-compose.yml not found at ${compose_file}"

    # Pull images first (shows progress)
    info "Pulling Docker images (this may take a few minutes)..."
    docker compose -f "$compose_file" pull --quiet 2>&1 | tee -a "${LOG_FILE}" || true

    run_quiet "Building and starting services" \
        docker compose -f "$compose_file" up -d --build --remove-orphans

    ok "Containers started"

    # Health checks
    step "Waiting for services to become healthy..."
    wait_for_service "Weaviate" "http://localhost:8080/v1/.well-known/ready" 60
    wait_for_service "API" "http://localhost:8000/health" 45
    wait_for_redis "Redis" 30

    save_phase "stack_deployed"
}

wait_for_service() {
    local name="$1" url="$2" timeout_s="$3"
    local elapsed=0
    printf "  Waiting %-12s " "${name}:"
    while (( elapsed < timeout_s )); do
        if curl -fsS --max-time 2 "$url" &>/dev/null; then
            echo -e "${CHECK}"
            return 0
        fi
        sleep 2
        (( elapsed += 2 ))
        printf "."
    done
    echo -e " ${WARN} timed out (check logs)"
}

wait_for_redis() {
    local name="$1" timeout_s="$2"
    local elapsed=0
    printf "  Waiting %-12s " "${name}:"
    while (( elapsed < timeout_s )); do
        if docker exec ai-memory-redis redis-cli ping &>/dev/null 2>&1; then
            echo -e "${CHECK}"
            return 0
        fi
        sleep 2
        (( elapsed += 2 ))
        printf "."
    done
    echo -e " ${WARN} timed out (check logs)"
}

# ─── Systemd persistent service ───────────────────────────────────────────────
setup_systemd_service() {
    step "Optional: Systemd auto-start"
    confirm "Create systemd service to auto-start on boot?" "y" || return 0

    local compose_file="${PROJECT_ROOT}/docker/docker-compose.yml"
    local current_user="${SUDO_USER:-$(whoami)}"

    cat <<EOF | sudo tee /etc/systemd/system/ai-memory.service > /dev/null
[Unit]
Description=AI Memory System (Weaviate + Redis + PostgreSQL + API + Dashboard)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=${current_user}
WorkingDirectory=${PROJECT_ROOT}
EnvironmentFile=${PROJECT_ROOT}/.env
ExecStart=/usr/bin/docker compose -f ${compose_file} up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f ${compose_file} down
ExecReload=/usr/bin/docker compose -f ${compose_file} restart
TimeoutStartSec=180
TimeoutStopSec=60
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

    run_with_sudo "Enabling ai-memory systemd service" systemctl enable ai-memory.service
    ok "Systemd service enabled: ai-memory.service"
    info "Commands: sudo systemctl start|stop|status ai-memory"
}

# ─── Summary ──────────────────────────────────────────────────────────────────
show_summary() {
    echo -e ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                  Installation Complete! 🎉                       ║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║  Service         URL / Address                                  ║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Dashboard     ${CYAN}http://localhost:3001${NC}                           ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  API           ${CYAN}http://localhost:8000${NC}                           ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  API Docs      ${CYAN}http://localhost:8000/docs${NC}                      ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Weaviate      ${CYAN}http://localhost:8080${NC}                           ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Redis         ${CYAN}localhost:6379${NC}                                  ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  PostgreSQL    ${CYAN}localhost:5432${NC}                                  ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║  Management Commands                                             ║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  ${CYAN}./scripts/manage.sh status${NC}    — service status              ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  ${CYAN}./scripts/manage.sh logs${NC}      — tail all logs               ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  ${CYAN}./scripts/manage.sh restart${NC}   — restart all services        ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  ${CYAN}./scripts/manage.sh backup${NC}    — run backup now              ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  ${CYAN}./scripts/healthcheck.sh${NC}      — deep health report          ${GREEN}${BOLD}║${NC}"
    echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}${BOLD}║${NC}  Log file: ${DIM}${LOG_FILE}${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo -e ""
}

# ─── CLI argument parsing ─────────────────────────────────────────────────────
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --skip-update)   SKIP_SYSTEM_UPDATE=true ;;
            --skip-docker)   SKIP_DOCKER=true ;;
            --skip-optimize) SKIP_OPTIMIZE=true ;;
            --skip-deploy)   SKIP_DEPLOY=true ;;
            --dry-run)       DRY_RUN=true; warn "Dry-run mode: no changes will be made." ;;
            --reset)         rm -f "${INSTALL_STATE_FILE}"; info "Install state cleared." ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-update    Skip apt system update/packages"
                echo "  --skip-docker    Skip Docker installation"
                echo "  --skip-optimize  Skip kernel/system optimizations"
                echo "  --skip-deploy    Skip Docker stack deployment"
                echo "  --dry-run        Show what would be done, make no changes"
                echo "  --reset          Clear installation state (re-run all phases)"
                echo "  --help           Show this help"
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

    # Ensure log dir exists
    mkdir -p "${PROJECT_ROOT}/logs"
    : > "${LOG_FILE}"  # touch log file

    show_banner

    echo -e "${BOLD}This installer will set up the full AI Memory System stack on Ubuntu.${NC}"
    echo -e "${DIM}It will:${NC}"
    echo -e "  1. Install system packages (curl, git, Python 3.12, Node 20)"
    echo -e "  2. Install Docker Engine + Compose"
    echo -e "  3. Apply system optimizations (kernel params, file limits, I/O)"
    echo -e "  4. Configure project directories and .env"
    echo -e "  5. Deploy the full Docker stack"
    echo -e ""
    confirm "Proceed with installation?" "y" || { echo "Aborted."; exit 0; }

    preflight

    [[ "$SKIP_SYSTEM_UPDATE" == "false" ]] && install_system_packages
    [[ "$SKIP_DOCKER" == "false" ]]        && install_docker
    [[ "$SKIP_OPTIMIZE" == "false" ]]      && optimize_system
    setup_project
    [[ "$SKIP_DEPLOY" == "false" ]]        && deploy_stack

    setup_systemd_service
    show_summary
}

main "$@"
