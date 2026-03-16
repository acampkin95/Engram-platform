#!/usr/bin/env bash
# DEPRECATED: Prefer ./scripts/deploy-unified.sh deploy:production from the monorepo root.
# =============================================================================
#  Engram Platform — Enhanced Production Deployment Script v2.0
#  Features: Pre-flight checks, dry-run mode, rollback, secret validation
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"

# Install locations
SYSTEMD_DIR="/etc/systemd/system"
INSTALL_DIR="/opt/engram"
SCRIPTS_DIR="${INSTALL_DIR}/scripts"
CONFIG_DIR="${INSTALL_DIR}/config"
LOG_DIR="/var/log/engram"
BACKUP_DIR="/var/backups/engram"

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"; ARROW="${CYAN}→${NC}"; INFO="${BLUE}ℹ${NC}"

# ─── Global State ──────────────────────────────────────────────────────────────
DRY_RUN=false
VERBOSE=false
SKIP_BACKUP=false
SKIP_SYSTEMD=false
DEPLOYMENT_START_TIME=""
FAILED_SERVICES=()
LOG_FILE=""

# ─── Functions ─────────────────────────────────────────────────────────────────

setup_logging() {
    LOG_FILE="${PROJECT_ROOT}/logs/deploy-$(date +%Y%m%d-%H%M%S).log"
    if ! mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null; then
        LOG_FILE="/tmp/engram-deploy-$(date +%Y%m%d-%H%M%S).log"
    fi
    if [[ $EUID -eq 0 ]]; then
        mkdir -p "$BACKUP_DIR" 2>/dev/null || true
    fi
}

log()   { echo -e "$*" | tee -a "${LOG_FILE}" >&2; }
step()  { echo -e "\n${BLUE}━━━${NC} ${BOLD}$*${NC}" | tee -a "${LOG_FILE}" >&2; }
ok()    { echo -e "  ${CHECK} $*" | tee -a "${LOG_FILE}" >&2; }
warn()  { echo -e "  ${WARN}  $*" | tee -a "${LOG_FILE}" >&2; }
fail()  { echo -e "  ${CROSS} $*" | tee -a "${LOG_FILE}" >&2; }
info()  { echo -e "  ${INFO}  $*" >&2; }
die()   {
    if [[ -n "${LOG_FILE}" ]]; then
        echo -e "\n${RED}${BOLD}FATAL:${NC} $*" | tee -a "${LOG_FILE}" >&2
    else
        echo -e "\n${RED}${BOLD}FATAL:${NC} $*" >&2
    fi
    exit 1
}

run_cmd() {
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${DIM}[DRY RUN] $*${NC}" | tee -a "${LOG_FILE}" >&2
        return 0
    fi
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${DIM}[EXEC] $*${NC}" >&2
    fi
    "$@"
}

# ─── Prerequisites ──────────────────────────────────────────────────────────────
check_root() {
    if [[ $EUID -ne 0 ]]; then
        die "This script must be run as root (use sudo)"
    fi
    setup_logging
}

check_docker() {
    step "Checking Docker installation..."

    if ! command -v docker &>/dev/null; then
        die "Docker is not installed. Install with: curl -fsSL https://get.docker.com | sh"
    fi

    if ! docker info &>/dev/null; then
        die "Docker daemon is not running. Start with: sudo systemctl start docker"
    fi

    local docker_version
    docker_version=$(docker --version | awk '{print $3}' | tr -d ',')
    ok "Docker ${docker_version}"

    if ! docker compose version &>/dev/null; then
        die "Docker Compose v2 plugin not found. Install with: sudo apt-get install docker-compose-plugin"
    fi

    local compose_version
    compose_version=$(docker compose version --short)
    ok "Docker Compose ${compose_version}"
}

check_compose_file() {
    step "Validating docker-compose.yml..."

    if [[ ! -f "$COMPOSE_FILE" ]]; then
        die "docker-compose.yml not found at ${COMPOSE_FILE}"
    fi

    if ! docker compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
        die "docker-compose.yml has syntax errors. Run 'docker compose config' for details."
    fi

    ok "docker-compose.yml is valid"
}

validate_env() {
    step "Validating environment configuration..."

    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "${PROJECT_ROOT}/.env.example" ]]; then
            warn ".env not found, using .env.example"
            if [[ "$DRY_RUN" == false ]]; then
                cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
            fi
        else
            die ".env file not found and no .env.example available"
        fi
    fi

    local errors=0
    local required_vars=(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:pk_live_"
        "CLERK_SECRET_KEY:sk_live_"
        "JWT_SECRET"
        "NEXT_PUBLIC_APP_URL"
        "BIND_ADDRESS"
    )

    for var_pattern in "${required_vars[@]}"; do
        local var_name
        local var_prefix=""
        if [[ "$var_pattern" == *:* ]]; then
            var_name="${var_pattern%%:*}"
            var_prefix="${var_pattern#*:}"
        else
            var_name="$var_pattern"
        fi
        local var_value
        var_value=$(grep "^${var_name}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | head -1 || true)

        if [[ -z "$var_value" ]] || [[ "$var_value" == your-* ]] || [[ "$var_value" == "..." ]]; then
            fail "${var_name} is not set or is a placeholder"
            errors=$((errors + 1))
        elif [[ -n "$var_prefix" ]] && [[ "$var_prefix" != "${var_value}" ]] && [[ ! "$var_value" =~ ^$var_prefix ]]; then
            fail "${var_name} does not start with ${var_prefix}"
            errors=$((errors + 1))
        else
            ok "${var_name} is configured"
        fi
    done

    local bind_address
    bind_address=$(grep "^BIND_ADDRESS=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | head -1 || echo "127.0.0.1")
    if [[ "$bind_address" == "0.0.0.0" ]]; then
        fail "BIND_ADDRESS is 0.0.0.0 (publicly exposed). Use 127.0.0.1 or Tailscale IP."
        errors=$((errors + 1))
    elif [[ "$bind_address" == "127.0.0.1" ]]; then
        warn "BIND_ADDRESS is 127.0.0.1 (localhost only)"
    else
        ok "BIND_ADDRESS is set to ${bind_address}"
    fi

    if [[ $errors -gt 0 ]]; then
        die "Environment validation failed with ${errors} errors. Fix before deploying."
    fi

    ok "Environment configuration is valid"
}

check_tailscale() {
    step "Checking Tailscale connectivity..."

    if ! command -v tailscale &>/dev/null; then
        warn "Tailscale is not installed (optional but recommended)"
        info "Install with: curl -fsSL https://tailscale.com/install.sh | sh"
        return 0
    fi

    if ! tailscale status &>/dev/null; then
        warn "Tailscale is installed but not connected"
        info "Connect with: sudo tailscale up"
        return 0
    fi

    local ts_ip
    ts_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
    ok "Tailscale connected (IP: ${ts_ip})"

    local bind_address
    bind_address=$(grep "^BIND_ADDRESS=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | head -1 || echo "127.0.0.1")

    if [[ "$bind_address" == "127.0.0.1" ]]; then
        warn "BIND_ADDRESS is 127.0.0.1 (localhost only)"
        info "For Tailscale access, set BIND_ADDRESS=${ts_ip} in .env"
    elif [[ "$bind_address" == "$ts_ip" ]]; then
        ok "BIND_ADDRESS matches Tailscale IP"
    fi
}

validate_certificates() {
    step "Validating SSL certificates..."

    local cert_dir="${PROJECT_ROOT}/certs"
    local cert_file="${cert_dir}/nginx-selfsigned.crt"
    local key_file="${cert_dir}/nginx-selfsigned.key"

    if [[ ! -f "$cert_file" ]] || [[ ! -f "$key_file" ]]; then
        warn "SSL certificates not found in ${cert_dir}"
        info "Generate with: sudo ./scripts/provision-tailscale-certs.sh"
        return 0
    fi

    if ! openssl x509 -in "$cert_file" -noout 2>/dev/null; then
        fail "Certificate file is invalid"
        return 1
    fi

    local expiry_date days_until_expiry
    expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
    days_until_expiry=$(( ($(date -d "$expiry_date" +%s) - $(date +%s)) / 86400 ))

    if [[ $days_until_expiry -lt 0 ]]; then
        fail "Certificate has EXPIRED (${expiry_date})"
        return 1
    elif [[ $days_until_expiry -lt 7 ]]; then
        warn "Certificate expires in ${days_until_expiry} days"
    else
        ok "Certificate valid until ${expiry_date}"
    fi

    ok "Certificates are valid"
}

check_resources() {
    step "Checking system resources..."

    local total_mem available_mem
    total_mem=$(awk '/MemTotal/{print int($2/1024/1024)}' /proc/meminfo)
    available_mem=$(awk '/MemAvailable/{print int($2/1024/1024)}' /proc/meminfo)

    info "Memory: ${available_mem}GB available / ${total_mem}GB total"

    if [[ $available_mem -lt 2 ]]; then
        warn "Low available memory (${available_mem}GB). Recommended: 4GB+"
    else
        ok "Memory sufficient"
    fi

    local available_disk
    available_disk=$(df -BG "$INSTALL_DIR" 2>/dev/null | awk 'NR==2 {print int($4)}' || echo "0")

    info "Disk: ${available_disk}GB available"

    if [[ $available_disk -lt 10 ]]; then
        warn "Low disk space (${available_disk}GB). Recommended: 20GB+"
    else
        ok "Disk space sufficient"
    fi
}

backup_existing() {
    if [[ "$SKIP_BACKUP" == true ]]; then
        info "Backup skipped"
        return 0
    fi

    step "Creating backup..."

    local backup_timestamp
    backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_dir="${BACKUP_DIR}/engram-${backup_timestamp}"

    mkdir -p "$backup_dir"

    if [[ -d "$INSTALL_DIR" ]]; then
        for file in docker-compose.yml .env nginx/nginx.conf; do
            if [[ -f "${INSTALL_DIR}/${file}" ]]; then
                mkdir -p "${backup_dir}/$(dirname "$file")"
                cp "${INSTALL_DIR}/${file}" "${backup_dir}/${file}"
            fi
        done

        echo "$backup_dir" > /tmp/engram-last-backup
        ok "Backup created: ${backup_dir}"
    else
        info "No existing installation to backup"
    fi
}

rollback() {
    step "Rolling back deployment..."

    local backup_dir
    backup_dir=$(cat /tmp/engram-last-backup 2>/dev/null || true)

    if [[ -z "$backup_dir" ]] || [[ ! -d "$backup_dir" ]]; then
        die "No backup found for rollback"
    fi

    info "Restoring from: ${backup_dir}"

    if [[ -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
        (cd "$INSTALL_DIR" && docker compose down --timeout 30) || true
    fi

    cp "${backup_dir}/docker-compose.yml" "$INSTALL_DIR/"
    [[ -f "${backup_dir}/.env" ]] && cp "${backup_dir}/.env" "$INSTALL_DIR/"
    [[ -f "${backup_dir}/nginx/nginx.conf" ]] && cp "${backup_dir}/nginx/nginx.conf" "${INSTALL_DIR}/nginx/"

    (cd "$INSTALL_DIR" && docker compose up -d)

    ok "Rollback completed"
}

create_directories() {
    step "Creating directory structure..."

    local dirs=("$INSTALL_DIR" "$SCRIPTS_DIR" "$CONFIG_DIR" "$LOG_DIR")

    for dir in "${dirs[@]}"; do
        run_cmd mkdir -p "$dir"
    done

    ok "Directories created"
}

deploy_application() {
    step "Deploying application files..."

    run_cmd cp "$COMPOSE_FILE" "${INSTALL_DIR}/docker-compose.yml"
    ok "docker-compose.yml"

    run_cmd cp "$ENV_FILE" "${INSTALL_DIR}/.env"
    run_cmd chmod 600 "${INSTALL_DIR}/.env"
    ok ".env (permissions: 600)"

    if [[ -f "${PROJECT_ROOT}/nginx/nginx.conf" ]]; then
        run_cmd mkdir -p "${INSTALL_DIR}/nginx"
        run_cmd cp "${PROJECT_ROOT}/nginx/nginx.conf" "${INSTALL_DIR}/nginx/"
        ok "nginx.conf"
    fi

    if [[ -d "${PROJECT_ROOT}/certs" ]]; then
        run_cmd mkdir -p "${INSTALL_DIR}/certs"
        run_cmd cp "${PROJECT_ROOT}/certs/"* "${INSTALL_DIR}/certs/" 2>/dev/null || true
        run_cmd chmod 600 "${INSTALL_DIR}/certs/"*.key 2>/dev/null || true
        run_cmd chmod 644 "${INSTALL_DIR}/certs/"*.crt 2>/dev/null || true
        ok "SSL certificates"
    fi

    run_cmd cp "${PROJECT_ROOT}/scripts/"*.sh "$SCRIPTS_DIR/" 2>/dev/null || true
    run_cmd chmod +x "$SCRIPTS_DIR/"*.sh 2>/dev/null || true
    ok "Scripts"
}

setup_systemd() {
    if [[ "$SKIP_SYSTEMD" == true ]]; then
        info "Systemd setup skipped"
        return 0
    fi

    step "Configuring systemd services..."

    for service in engram-platform engram-health-monitor; do
        if [[ -f "${PROJECT_ROOT}/systemd/${service}.service" ]]; then
            run_cmd cp "${PROJECT_ROOT}/systemd/${service}.service" "$SYSTEMD_DIR/"
            ok "${service}.service"
        fi
    done

    run_cmd systemctl daemon-reload
    run_cmd systemctl enable engram-platform.service
    ok "Services enabled"
}

deploy_stack() {
    step "Deploying Docker stack..."

    cd "$INSTALL_DIR"

    info "Pulling Docker images..."
    if [[ "$VERBOSE" == true ]]; then
        run_cmd docker compose pull
    else
        run_cmd docker compose pull --quiet
    fi

    info "Starting services..."
    run_cmd docker compose up -d --remove-orphans

    ok "Stack deployed"
}

verify_health() {
    step "Verifying deployment health..."

    if [[ "$DRY_RUN" == true ]]; then
        info "Dry run mode: skipping live container health checks"
        ok "Health verification skipped in dry run"
        return 0
    fi

    local timeout=180
    local elapsed=0
    local services=(weaviate memory-api crawler-api crawler-redis memory-redis)
    local all_healthy=false

    info "Waiting for services to become healthy (timeout: ${timeout}s)..."

    while (( elapsed < timeout )); do
        all_healthy=true

        for svc in "${services[@]}"; do
            local health
            health=$(docker inspect --format='{{.State.Health.Status}}' "engram-${svc}" 2>/dev/null || echo "none")

            if [[ "$health" != "healthy" ]] && [[ "$health" != "none" ]]; then
                all_healthy=false
                FAILED_SERVICES+=("$svc")
                break
            fi
        done

        if $all_healthy; then
            ok "All services healthy"
            return 0
        fi

        sleep 5
        (( elapsed += 5 ))
        echo -n "."
    done

    echo ""
    fail "Timeout waiting for services to become healthy"
    return 1
}

verify_endpoints() {
    step "Verifying endpoints..."

    if [[ "$DRY_RUN" == true ]]; then
        info "Dry run mode: skipping live endpoint checks"
        ok "Endpoint verification skipped in dry run"
        return 0
    fi

    local bind_address
    bind_address=$(grep "^BIND_ADDRESS=" "${INSTALL_DIR}/.env" 2>/dev/null | cut -d'=' -f2 | head -1 || echo "127.0.0.1")

    local endpoints=(
        "https://${bind_address}/health:Nginx"
        "https://${bind_address}/api/memory/health:Memory API"
    )

    local failed=0

    for endpoint_info in "${endpoints[@]}"; do
        local endpoint="${endpoint_info%%:*}"
        local name="${endpoint_info#*:}"

        if curl -kfsS --max-time 10 "$endpoint" > /dev/null 2>&1; then
            ok "${name}"
        else
            fail "${name}"
            ((failed++))
        fi
    done

    if [[ $failed -gt 0 ]]; then
        return 1
    fi
}

show_summary() {
    local duration=$(( ($(date +%s) - DEPLOYMENT_START_TIME) ))

    echo ""
    echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║              ENGRAM PLATFORM DEPLOYMENT COMPLETE                      ║${NC}"
    echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    local bind_address
    bind_address=$(grep "^BIND_ADDRESS=" "${INSTALL_DIR}/.env" 2>/dev/null | cut -d'=' -f2 | head -1 || echo "127.0.0.1")

    echo -e "${BOLD}Access URLs:${NC}"
    echo -e "  ${CYAN}Frontend:${NC}     https://${bind_address}"
    echo -e "  ${CYAN}API Docs:${NC}     https://${bind_address}/api/memory/docs"
    echo ""

    echo -e "${BOLD}Management Commands:${NC}"
    echo -e "  ${CYAN}Status:${NC}   sudo systemctl status engram-platform"
    echo -e "  ${CYAN}Logs:${NC}     sudo journalctl -u engram-platform -f"
    echo -e "  ${CYAN}Verify:${NC}   ${SCRIPTS_DIR}/verify-tailscale-access.sh"
    echo ""

    echo -e "${DIM}Deployment completed in ${duration}s${NC}"
    echo -e "${DIM}Log: ${LOG_FILE}${NC}"
    echo ""
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Engram Platform Production Deployment Script v2.0

OPTIONS:
    -h, --help          Show this help message
    -n, --dry-run       Show what would be done without executing
    -v, --verbose       Enable verbose output
    --no-backup         Skip backup of existing installation
    --no-systemd        Skip systemd service setup
    --rollback          Rollback to previous deployment

EXAMPLES:
    sudo $0                           # Standard deployment
    sudo $0 --dry-run                 # Preview changes
    sudo $0 --verbose                 # Verbose output
    sudo $0 --rollback                # Rollback on failure

EOF
}

main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --no-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --no-systemd)
                SKIP_SYSTEMD=true
                shift
                ;;
            --rollback)
                check_root
                rollback
                exit 0
                ;;
            *)
                die "Unknown option: $1"
                ;;
        esac
    done

    DEPLOYMENT_START_TIME=$(date +%s)

    echo -e "${BLUE}${BOLD}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}${BOLD}║     Engram Platform — Production Deployment v2.0                     ║${NC}"
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}${BOLD}║     [DRY RUN MODE — No changes will be made]                         ║${NC}"
    fi
    echo -e "${BLUE}${BOLD}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    check_root
    check_docker
    check_compose_file
    validate_env
    check_tailscale
    validate_certificates
    check_resources

    backup_existing
    create_directories
    deploy_application
    setup_systemd
    deploy_stack

    if verify_health && verify_endpoints; then
        show_summary
        exit 0
    else
        echo ""
        warn "Deployment completed with issues"
        info "Check logs: sudo journalctl -u engram-platform -n 100"
        info "To rollback: sudo $0 --rollback"
        exit 1
    fi
}

trap 'echo -e "\n${RED}Deployment interrupted${NC}"; exit 130' INT TERM

main "$@"
