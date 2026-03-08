#!/usr/bin/env bash
# =============================================================================
# deploy_ubuntu.sh — OSINT Investigation Platform Ubuntu Deployment Script
# =============================================================================
# Tested on: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS
# Run as: sudo bash deploy_ubuntu.sh [--domain your-domain.com] [--skip-ssl]
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ---- Colour helpers ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---- Defaults ---------------------------------------------------------------
DOMAIN=""
SKIP_SSL=false
APP_DIR="/opt/osint-platform"
APP_USER="osint"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# ---- Argument parsing -------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)   DOMAIN="$2";   shift 2 ;;
        --skip-ssl) SKIP_SSL=true; shift   ;;
        --app-dir)  APP_DIR="$2";  shift 2 ;;
        --help|-h)
            echo "Usage: $0 [--domain DOMAIN] [--skip-ssl] [--app-dir DIR]"
            exit 0 ;;
        *) warn "Unknown argument: $1"; shift ;;
    esac
done

# ---- Root check -------------------------------------------------------------
[[ $EUID -eq 0 ]] || error "This script must be run as root (sudo)."

# ---- OS check ---------------------------------------------------------------
. /etc/os-release 2>/dev/null || true
if [[ "${ID:-}" != "ubuntu" ]]; then
    warn "This script is designed for Ubuntu. Detected: ${PRETTY_NAME:-unknown}. Proceeding anyway..."
fi

# =============================================================================
# STEP 1 — System packages
# =============================================================================
info "Step 1/9 — Installing system packages..."
apt-get update -qq
apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    git \
    jq \
    htop \
    unzip \
    cron
success "System packages installed."

# =============================================================================
# STEP 2 — Docker CE
# =============================================================================
info "Step 2/9 — Installing Docker CE..."
if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker --version)
    success "Docker already installed: $DOCKER_VER"
else
    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    systemctl enable --now docker
    success "Docker CE installed."
fi

# Verify docker compose plugin
docker compose version &>/dev/null || error "docker compose plugin not found. Install failed."

# =============================================================================
# STEP 3 — Firewall (UFW)
# =============================================================================
info "Step 3/9 — Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment "SSH"
ufw allow 80/tcp    comment "HTTP (certbot + redirect)"
ufw allow 443/tcp   comment "HTTPS"
ufw --force enable
success "UFW configured: 22, 80, 443 open."

# =============================================================================
# STEP 4 — Application user & directory
# =============================================================================
info "Step 4/9 — Setting up application directory at $APP_DIR..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$APP_DIR" "$APP_USER"
    usermod -aG docker "$APP_USER"
    success "Created user: $APP_USER"
fi

mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# If running from within the repo, copy files; otherwise prompt
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ -f "$REPO_ROOT/$COMPOSE_FILE" ]]; then
    info "Copying application files from $REPO_ROOT to $APP_DIR..."
    rsync -a --exclude='.git' --exclude='.venv' --exclude='data' \
          --exclude='__pycache__' --exclude='*.pyc' \
          "$REPO_ROOT/" "$APP_DIR/"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    success "Application files copied."
else
    warn "Could not find $COMPOSE_FILE in $REPO_ROOT."
    warn "Please manually copy your application files to $APP_DIR before continuing."
    read -rp "Press ENTER when files are in place, or Ctrl+C to abort..." _
fi

# =============================================================================
# STEP 5 — Environment file
# =============================================================================
info "Step 5/9 — Checking environment file..."
if [[ ! -f "$APP_DIR/$ENV_FILE" ]]; then
    if [[ -f "$APP_DIR/.env.production.example" ]]; then
        cp "$APP_DIR/.env.production.example" "$APP_DIR/$ENV_FILE"
        warn ".env.production was missing — copied from .env.production.example."
        warn "IMPORTANT: Edit $APP_DIR/$ENV_FILE and fill in your real secrets before starting!"
        warn "  Required: APP_SECRET_KEY, REDIS_PASSWORD, DOMAIN, API keys"
        read -rp "Press ENTER to continue (or Ctrl+C to edit first)..." _
    else
        error ".env.production not found and no example template available. Cannot continue."
    fi
fi

# Inject DOMAIN into env file if provided via CLI
if [[ -n "$DOMAIN" ]]; then
    sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" "$APP_DIR/$ENV_FILE"
    success "Domain set to: $DOMAIN"
fi

# Read DOMAIN from env file
if [[ -z "$DOMAIN" ]]; then
    DOMAIN=$(grep -E '^DOMAIN=' "$APP_DIR/$ENV_FILE" | cut -d= -f2 | tr -d '"' | tr -d "'")
fi
[[ -z "$DOMAIN" || "$DOMAIN" == "your-domain.com" ]] && warn "DOMAIN is not set. SSL will be skipped."

# =============================================================================
# STEP 6 — Create data directories (mapped to Docker named volumes via bind)
# =============================================================================
info "Step 6/9 — Creating data directories..."
for dir in data/chroma data/cases data/face_refs data/hot data/warm data/cold data/archive logs; do
    mkdir -p "$APP_DIR/$dir"
done
chown -R "$APP_USER:$APP_USER" "$APP_DIR/data" "$APP_DIR/logs"
success "Data directories created."

# =============================================================================
# STEP 7 — Pull Docker images
# =============================================================================
info "Step 7/9 — Pulling Docker images..."
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull --quiet
success "Docker images pulled."

# =============================================================================
# STEP 8 — SSL certificate (certbot)
# =============================================================================
if [[ "$SKIP_SSL" == "true" ]]; then
    warn "Skipping SSL setup (--skip-ssl flag set)."
elif [[ -z "$DOMAIN" || "$DOMAIN" == "your-domain.com" ]]; then
    warn "Skipping SSL setup — DOMAIN not configured."
else
    info "Step 8/9 — Obtaining SSL certificate for $DOMAIN..."

    # Start nginx first (HTTP only, for ACME challenge)
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nginx

    # Wait for nginx to be ready
    sleep 5

    # Run certbot one-shot
    CERTBOT_EMAIL=$(grep -E '^CERTBOT_EMAIL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "admin@${DOMAIN}")
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
        --profile ssl run --rm certbot \
        certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email "$CERTBOT_EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    success "SSL certificate obtained for $DOMAIN."
fi

# =============================================================================
# STEP 9 — Start all services
# =============================================================================
info "Step 9/9 — Starting all services..."
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# Wait for app to be healthy
info "Waiting for application health check..."
MAX_WAIT=120
ELAPSED=0
until curl -sf "http://localhost:11235/health" &>/dev/null; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
        warn "App health check timed out after ${MAX_WAIT}s. Check logs: docker compose logs app"
        break
    fi
done
[[ $ELAPSED -lt $MAX_WAIT ]] && success "Application is healthy."

# =============================================================================
# CRON — Certbot renewal + backup
# =============================================================================
info "Setting up cron jobs..."
CRON_FILE="/etc/cron.d/osint-platform"
cat > "$CRON_FILE" << CRON
# OSINT Platform — automated tasks
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# SSL certificate renewal (twice daily, as recommended by certbot)
0 0,12 * * * root cd ${APP_DIR} && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} --profile ssl run --rm certbot renew --quiet && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} exec -T nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1

# Backup (every 6 hours — matches BACKUP_INTERVAL_HOURS in .env.production)
0 */6 * * * root cd ${APP_DIR} && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} exec -T backup /backup_entrypoint.sh once >> /var/log/osint-backup.log 2>&1
CRON
chmod 644 "$CRON_FILE"
success "Cron jobs installed at $CRON_FILE."

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  OSINT Investigation Platform — Deployment Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  App directory : $APP_DIR"
echo "  Environment   : $APP_DIR/$ENV_FILE"
echo "  Compose file  : $APP_DIR/$COMPOSE_FILE"
[[ -n "$DOMAIN" && "$DOMAIN" != "your-domain.com" ]] && \
echo "  URL           : https://$DOMAIN"
echo ""
echo "  Useful commands:"
echo "    docker compose -f $COMPOSE_FILE logs -f app"
echo "    docker compose -f $COMPOSE_FILE ps"
echo "    bash scripts/healthcheck_production.sh"
echo ""
echo -e "${YELLOW}  REMINDER: Verify .env.production has all secrets filled in.${NC}"
echo ""
