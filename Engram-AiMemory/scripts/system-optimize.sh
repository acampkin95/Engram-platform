#!/usr/bin/env bash
# =============================================================================
#  AI Memory System — System Optimisation Suite
#  Run standalone or sourced by ubuntu-install.sh
#  Targets: Weaviate HNSW, PostgreSQL, Redis, Python FastAPI workloads
# =============================================================================
set -euo pipefail

RED='\033[0;31m';  GREEN='\033[0;32m';  YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';   BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; WARN="${YELLOW}⚠${NC}"; INFO="${BLUE}ℹ${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG="${PROJECT_ROOT}/logs/optimize-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "${PROJECT_ROOT}/logs"

log()  { echo -e "$*" | tee -a "${LOG}"; }
ok()   { echo -e "  ${CHECK} $*" | tee -a "${LOG}"; }
warn() { echo -e "  ${WARN}  $*" | tee -a "${LOG}"; }
info() { echo -e "  ${INFO}  $*" | tee -a "${LOG}"; }
step() { echo -e "\n${BLUE}━━━${NC} ${BOLD}$*${NC}" | tee -a "${LOG}"; }

require_sudo() {
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        echo -e "${RED}Requires sudo. Run: sudo $0${NC}"
        exit 1
    fi
}

# ─── 1. Kernel / sysctl ───────────────────────────────────────────────────────
tune_kernel() {
    step "Kernel Parameters (sysctl)"

    sudo tee /etc/sysctl.d/90-ai-memory.conf > /dev/null << 'SYSCTL'
# =============================================================================
# AI Memory System — Kernel Tuning v2
# =============================================================================

# ── Virtual Memory ──────────────────────────────────────────────────────────
# Weaviate MMAP / HNSW: needs generous vm.max_map_count
vm.max_map_count              = 262144
# Reduce kernel swap tendency (0=never swap, 10=low tendency, 60=default)
vm.swappiness                 = 10
# Dirty-page writeback — tuned for write-heavy vector indexing
vm.dirty_ratio                = 20
vm.dirty_background_ratio     = 5
vm.dirty_writeback_centisecs  = 500
vm.dirty_expire_centisecs     = 3000
# Overcommit: allow memory allocation above physical for vector ops
vm.overcommit_memory          = 1
vm.overcommit_ratio           = 100
# Huge-pages disabled (Redis / Weaviate prefer regular pages)
# (managed via disable-thp.service)

# ── File System ─────────────────────────────────────────────────────────────
fs.file-max                   = 2097152
fs.inotify.max_user_watches   = 524288
fs.inotify.max_user_instances = 256
fs.aio-max-nr                 = 1048576

# ── Network — TCP/IP Stack ──────────────────────────────────────────────────
# BBR congestion control + fair queuing (best for mixed gRPC + HTTP2 traffic)
net.core.default_qdisc        = fq
net.ipv4.tcp_congestion_control = bbr
# Socket buffer maximums (128 MB)
net.core.rmem_max             = 134217728
net.core.wmem_max             = 134217728
net.core.rmem_default         = 262144
net.core.wmem_default         = 262144
net.ipv4.tcp_rmem             = 4096 262144 134217728
net.ipv4.tcp_wmem             = 4096 65536  134217728
net.ipv4.udp_rmem_min         = 8192
net.ipv4.udp_wmem_min         = 8192
# Connection queue depth (important for bursty API traffic)
net.core.somaxconn            = 65535
net.ipv4.tcp_max_syn_backlog  = 65535
net.core.netdev_max_backlog   = 65535
# TCP keepalive — keep gRPC connections alive
net.ipv4.tcp_keepalive_time   = 60
net.ipv4.tcp_keepalive_intvl  = 10
net.ipv4.tcp_keepalive_probes = 6
# TIME_WAIT optimisation
net.ipv4.tcp_tw_reuse         = 1
net.ipv4.ip_local_port_range  = 10000 65535
net.ipv4.tcp_max_tw_buckets   = 1440000
# Disable slow-start after idle (good for persistent MCP connections)
net.ipv4.tcp_slow_start_after_idle = 0
# Fast open
net.ipv4.tcp_fastopen         = 3

# ── Kernel ──────────────────────────────────────────────────────────────────
kernel.pid_max                = 4194304
kernel.sched_migration_cost_ns = 5000000
# Reduce scheduler latency for CPU-intensive embedding tasks
kernel.sched_autogroup_enabled = 0
SYSCTL

    sudo sysctl -p /etc/sysctl.d/90-ai-memory.conf >> "${LOG}" 2>&1
    ok "sysctl parameters applied"
}

# ─── 2. File descriptors & process limits ────────────────────────────────────
tune_limits() {
    step "File Descriptor & Process Limits"

    sudo tee /etc/security/limits.d/90-ai-memory.conf > /dev/null << 'LIMITS'
# AI Memory System — fd / process limits
# Covers: Docker containers, Python processes, Node.js
*     soft nofile  1048576
*     hard nofile  1048576
root  soft nofile  1048576
root  hard nofile  1048576
*     soft nproc   unlimited
*     hard nproc   unlimited
*     soft memlock unlimited
*     hard memlock unlimited
*     soft stack   unlimited
*     hard stack   unlimited
LIMITS

    # Systemd manager limits
    sudo mkdir -p /etc/systemd/system.conf.d
    sudo tee /etc/systemd/system.conf.d/90-ai-memory.conf > /dev/null << 'SYSD'
[Manager]
DefaultLimitNOFILE=1048576
DefaultLimitNPROC=infinity
DefaultLimitMEMLOCK=infinity
DefaultTasksMax=infinity
SYSD

    # PAM modules — ensure limits are loaded
    if ! grep -q "pam_limits" /etc/pam.d/common-session 2>/dev/null; then
        echo "session required pam_limits.so" | sudo tee -a /etc/pam.d/common-session > /dev/null
    fi

    sudo systemctl daemon-reexec >> "${LOG}" 2>&1
    ok "File descriptor limits: 1,048,576 (ulimit -n)"
    ok "Process limits: unlimited"
}

# ─── 3. Swap ──────────────────────────────────────────────────────────────────
configure_swap() {
    step "Swap Configuration"

    local ram_kb; ram_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo)
    local ram_gb=$(( ram_kb / 1024 / 1024 ))

    if swapon --show 2>/dev/null | grep -q .; then
        local swap_total; swap_total=$(free -h | awk '/Swap/{print $2}')
        ok "Swap already configured: ${swap_total}"

        # Verify swappiness is low
        local current_swappiness; current_swappiness=$(sysctl -n vm.swappiness)
        if (( current_swappiness > 10 )); then
            sudo sysctl -w vm.swappiness=10 >> "${LOG}" 2>&1
            warn "Reduced swappiness from ${current_swappiness} to 10"
        fi
        return 0
    fi

    # Recommend swap size: min(RAM/2, 8GB)
    local swap_gb=$(( ram_gb / 2 ))
    (( swap_gb > 8 )) && swap_gb=8
    (( swap_gb < 2 )) && swap_gb=2

    info "RAM: ${ram_gb}GB — creating ${swap_gb}GB swap file..."

    if [[ ! -f /swapfile ]]; then
        sudo fallocate -l "${swap_gb}G" /swapfile >> "${LOG}" 2>&1
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile >> "${LOG}" 2>&1
        sudo swapon /swapfile >> "${LOG}" 2>&1

        # Persist in fstab
        if ! grep -q '/swapfile' /etc/fstab; then
            echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
        fi
    fi

    ok "Swap: ${swap_gb}GB enabled"
}

# ─── 4. Transparent Huge Pages ────────────────────────────────────────────────
disable_thp() {
    step "Transparent Huge Pages (THP)"

    # Runtime disable
    echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled > /dev/null 2>&1 || true
    echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag  > /dev/null 2>&1 || true

    # Persist via systemd service
    sudo tee /etc/systemd/system/disable-thp.service > /dev/null << 'SVC'
[Unit]
Description=Disable Transparent Huge Pages (THP) — Required for Weaviate & Redis
Documentation=https://redis.io/docs/management/optimization/latency/
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/defrag'
ExecStart=/bin/sh -c 'echo 0 > /sys/kernel/mm/transparent_hugepage/khugepaged/defrag'

[Install]
WantedBy=basic.target
SVC

    sudo systemctl enable --now disable-thp >> "${LOG}" 2>&1
    ok "THP disabled (runtime + persistent)"
}

# ─── 5. I/O Scheduler ────────────────────────────────────────────────────────
tune_io_scheduler() {
    step "I/O Scheduler"

    sudo tee /etc/udev/rules.d/60-io-scheduler.rules > /dev/null << 'UDEV'
# AI Memory System — I/O Scheduler tuning
# NVMe: use 'none' (hardware managed)
ACTION=="add|change", KERNEL=="nvme[0-9]*", ATTR{queue/scheduler}="none"
# SATA SSD: mq-deadline (low latency)
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="0", ATTR{queue/scheduler}="mq-deadline"
# HDD: bfq (fair bandwidth)
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="1", ATTR{queue/scheduler}="bfq"
# Read-ahead: 4MB for SSD, 2MB for NVMe
ACTION=="add|change", KERNEL=="nvme[0-9]*", ATTR{queue/read_ahead_kb}="2048"
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="0", ATTR{queue/read_ahead_kb}="4096"
UDEV

    sudo udevadm control --reload-rules >> "${LOG}" 2>&1
    sudo udevadm trigger >> "${LOG}" 2>&1

    # Apply to currently mounted devices immediately
    for dev in /sys/block/nvme*/queue/scheduler; do
        [[ -f "$dev" ]] && echo none | sudo tee "$dev" > /dev/null 2>&1 || true
    done
    for dev in /sys/block/sd*/queue/scheduler; do
        [[ -f "$dev" ]] || continue
        local rotational_file; rotational_file="${dev%scheduler}rotational"
        if [[ "$(cat "$rotational_file" 2>/dev/null)" == "0" ]]; then
            echo mq-deadline | sudo tee "$dev" > /dev/null 2>&1 || true
        fi
    done

    ok "I/O scheduler rules applied"
}

# ─── 6. Docker daemon tuning ─────────────────────────────────────────────────
tune_docker() {
    step "Docker Daemon"

    sudo mkdir -p /etc/docker
    sudo tee /etc/docker/daemon.json > /dev/null << 'DOCKERD'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5",
    "compress": "true"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 1048576,
      "Soft": 1048576
    },
    "memlock": {
      "Name": "memlock",
      "Hard": -1,
      "Soft": -1
    }
  },
  "metrics-addr": "127.0.0.1:9323",
  "live-restore": true,
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 10,
  "experimental": false
}
DOCKERD

    if systemctl is-active docker &>/dev/null; then
        sudo systemctl restart docker >> "${LOG}" 2>&1
    fi
    ok "Docker daemon configured (log rotation, overlay2, ulimits)"
}

# ─── 7. PostgreSQL host-level tuning ─────────────────────────────────────────
tune_postgres_host() {
    step "PostgreSQL Host Tuning (sysctl supplements)"

    # PostgreSQL benefits from large shared_buffers → needs shmmax
    local ram_kb; ram_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo)
    local shmmax=$(( ram_kb * 1024 / 2 ))  # 50% of RAM in bytes

    sudo tee /etc/sysctl.d/91-postgres.conf > /dev/null << PGCONF
# PostgreSQL shared memory tuning
kernel.shmmax = ${shmmax}
kernel.shmall = $(( shmmax / 4096 ))
kernel.shmmni = 4096
# Huge pages for PostgreSQL (optional — leave 'madvise' for compatibility)
vm.nr_hugepages = 0
PGCONF

    sudo sysctl -p /etc/sysctl.d/91-postgres.conf >> "${LOG}" 2>&1
    ok "PostgreSQL shared memory: shmmax=$(( shmmax / 1024 / 1024 ))MB"
}

# ─── 8. CPU Governor ──────────────────────────────────────────────────────────
tune_cpu_governor() {
    step "CPU Governor"

    if ! command -v cpupower &>/dev/null; then
        sudo apt-get install -yq linux-tools-common linux-tools-generic >> "${LOG}" 2>&1 || {
            warn "cpupower not available — skipping CPU governor tuning"
            return 0
        }
    fi

    # Set performance governor for embedding/inference workloads
    sudo cpupower frequency-set -g performance >> "${LOG}" 2>&1 || \
        warn "Could not set CPU governor (VM or restricted kernel?)"

    # Persist via systemd
    sudo tee /etc/systemd/system/cpu-governor.service > /dev/null << 'CPUGOV'
[Unit]
Description=Set CPU governor to performance
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/cpupower frequency-set -g performance

[Install]
WantedBy=multi-user.target
CPUGOV

    sudo systemctl enable --now cpu-governor.service >> "${LOG}" 2>&1 || true
    ok "CPU governor: performance mode"
}

# ─── 9. Network tuning (additional) ──────────────────────────────────────────
tune_network() {
    step "Network Stack"

    # Enable BBR if not already
    local congestion; congestion=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null)
    if [[ "$congestion" != "bbr" ]]; then
        if ! lsmod | grep -q tcp_bbr; then
            sudo modprobe tcp_bbr >> "${LOG}" 2>&1 || warn "BBR module not available"
        fi
        echo "tcp_bbr" | sudo tee /etc/modules-load.d/bbr.conf > /dev/null
        sudo sysctl -w net.core.default_qdisc=fq >> "${LOG}" 2>&1 || true
        sudo sysctl -w net.ipv4.tcp_congestion_control=bbr >> "${LOG}" 2>&1 || true
    fi
    ok "TCP BBR congestion control: $(sysctl -n net.ipv4.tcp_congestion_control)"

    # Weaviate gRPC: allow larger frames
    sudo sysctl -w net.ipv4.tcp_window_scaling=1 >> "${LOG}" 2>&1 || true
    ok "TCP window scaling enabled"
}

# ─── 10. Logrotate ───────────────────────────────────────────────────────────
configure_logrotate() {
    step "Log Rotation"

    sudo tee /etc/logrotate.d/ai-memory > /dev/null << LOGROTATE
${PROJECT_ROOT}/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $(whoami) $(id -gn)
    sharedscripts
    postrotate
        # Notify Docker containers to reopen log files if needed
        docker kill -s HUP ai-memory-api 2>/dev/null || true
    endscript
}

/var/log/docker/*.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
LOGROTATE

    ok "Log rotation: 14 days (daily, compressed)"
}

# ─── Benchmark / verification ─────────────────────────────────────────────────
verify_optimizations() {
    step "Verification"

    local pass=0 fail=0

    check() {
        local label="$1" cmd="$2" expected="$3"
        local actual; actual=$(eval "$cmd" 2>/dev/null || echo "ERROR")
        if [[ "$actual" == "$expected" ]]; then
            ok "${label}: ${actual}"
            (( pass++ ))
        else
            warn "${label}: got '${actual}', expected '${expected}'"
            (( fail++ ))
        fi
    }

    check "vm.swappiness"             "sysctl -n vm.swappiness"             "10"
    check "vm.max_map_count"          "sysctl -n vm.max_map_count"          "262144"
    check "THP enabled"               "cat /sys/kernel/mm/transparent_hugepage/enabled | grep -o '\[never\]' | tr -d '[]'" "never"
    check "fs.file-max"               "sysctl -n fs.file-max"               "2097152"
    check "net.core.somaxconn"        "sysctl -n net.core.somaxconn"        "65535"
    check "TCP congestion"            "sysctl -n net.ipv4.tcp_congestion_control" "bbr"

    # Docker daemon config
    if [[ -f /etc/docker/daemon.json ]]; then
        ok "Docker daemon.json: exists"
        (( pass++ ))
    else
        warn "Docker daemon.json: missing"
        (( fail++ ))
    fi

    echo -e ""
    echo -e "  ${BOLD}Results: ${GREEN}${pass} passed${NC} ${fail:+/ ${RED}${fail} warnings${NC}}"
}

# ─── Report ───────────────────────────────────────────────────────────────────
show_report() {
    echo -e ""
    echo -e "${CYAN}${BOLD}━━━ Optimisation Report ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e ""

    # RAM
    local ram; ram=$(free -h | awk '/Mem/{print $2}')
    local swap; swap=$(free -h | awk '/Swap/{print $2}')
    echo -e "  ${BOLD}Memory${NC}"
    echo -e "    RAM:        ${ram}"
    echo -e "    Swap:       ${swap}"
    echo -e "    Swappiness: $(sysctl -n vm.swappiness)"
    echo -e "    Map count:  $(sysctl -n vm.max_map_count)"

    echo -e ""
    echo -e "  ${BOLD}Network${NC}"
    echo -e "    Congestion: $(sysctl -n net.ipv4.tcp_congestion_control)"
    echo -e "    Qdisc:      $(sysctl -n net.core.default_qdisc)"
    echo -e "    somaxconn:  $(sysctl -n net.core.somaxconn)"
    echo -e "    rmem_max:   $(sysctl -n net.core.rmem_max | numfmt --to=iec)"

    echo -e ""
    echo -e "  ${BOLD}File Descriptors${NC}"
    echo -e "    fs.file-max: $(sysctl -n fs.file-max | numfmt --grouping)"
    echo -e "    ulimit -n:   $(ulimit -n)"

    echo -e ""
    echo -e "  ${BOLD}CPU${NC}"
    if command -v cpupower &>/dev/null; then
        echo -e "    Governor:   $(cpupower frequency-info -p 2>/dev/null | grep 'The governor' | awk '{print $3}' || echo 'unknown')"
    fi
    echo -e "    CPUs:       $(nproc)"

    echo -e ""
    echo -e "  ${BOLD}Storage${NC}"
    for dev in /sys/block/*/queue/scheduler; do
        local devname; devname=$(echo "$dev" | cut -d/ -f4)
        local sched; sched=$(cat "$dev" 2>/dev/null | grep -o '\[.*\]' | tr -d '[]' || echo 'unknown')
        echo -e "    ${devname}: ${sched}"
    done

    echo -e ""
    echo -e "  ${DIM}Full log: ${LOG}${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    require_sudo

    echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}${BOLD}║        AI Memory System — System Optimisation Suite             ║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "${DIM}  Log: ${LOG}${NC}\n"

    tune_kernel
    tune_limits
    configure_swap
    disable_thp
    tune_io_scheduler
    tune_docker
    tune_postgres_host
    tune_cpu_governor
    tune_network
    configure_logrotate
    verify_optimizations
    show_report

    echo -e "${GREEN}${BOLD}✓ System optimisation complete.${NC}"
    echo -e "${DIM}Reboot recommended for all settings to take full effect.${NC}\n"
}

main "$@"
