#!/usr/bin/env bash
# =============================================================================
#  Engram Platform — Tailscale Certificate Provisioning
#  Fetches HTTPS certificates from Tailscale for nginx
# =============================================================================
set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERT_DIR="${PROJECT_ROOT}/certs"
ENV_FILE="${PROJECT_ROOT}/.env"

# Get domain from environment or use default
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$ENV_FILE"
fi
DOMAIN="${TAILSCALE_HOSTNAME:-dv-syd-host01.icefish-discus.ts.net}"

echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║        Tailscale Certificate Provisioning                       ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Check Tailscale is installed
if ! command -v tailscale &>/dev/null; then
    echo -e "${CROSS} Tailscale is not installed"
    echo -e "${YELLOW}Install with: curl -fsSL https://tailscale.com/install.sh | sh${NC}"
    exit 1
fi
echo -e "${CHECK} Tailscale is installed"

# Check Tailscale is connected
if ! tailscale status &>/dev/null; then
    echo -e "${CROSS} Tailscale is not connected"
    echo -e "${YELLOW}Run: sudo tailscale up${NC}"
    exit 1
fi
echo -e "${CHECK} Tailscale is connected"

# Get Tailscale IP
TS_IP=$(tailscale ip -4 2>/dev/null || echo "unknown")
echo -e "${CHECK} Tailscale IP: ${CYAN}${TS_IP}${NC}"

# Create cert directory
mkdir -p "$CERT_DIR"
echo -e "${CHECK} Certificate directory: ${CERT_DIR}"

# Check if HTTPS is enabled in tailnet
echo ""
echo -e "${BLUE}Requesting certificate for:${NC} ${CYAN}${DOMAIN}${NC}"

# Fetch certificate from Tailscale
if tailscale cert --cert-file="${CERT_DIR}/nginx-selfsigned.crt" --key-file="${CERT_DIR}/nginx-selfsigned.key" "$DOMAIN"; then
    echo -e "${CHECK} Certificate fetched successfully"

    # Set proper permissions
    chmod 644 "${CERT_DIR}/nginx-selfsigned.crt"
    chmod 600 "${CERT_DIR}/nginx-selfsigned.key"
    echo -e "${CHECK} Permissions set (644 for cert, 600 for key)"

    # Verify certificate
    echo ""
    echo -e "${BLUE}Certificate details:${NC}"
    openssl x509 -in "${CERT_DIR}/nginx-selfsigned.crt" -noout -subject -dates -issuer 2>/dev/null | sed 's/^/  /'

    # Reload nginx if container is running
    echo ""
    if docker ps -q --filter "name=engram-nginx" | grep -q .; then
        echo -e "${BLUE}Reloading nginx...${NC}"
        if docker exec engram-nginx nginx -s reload 2>/dev/null; then
            echo -e "${CHECK} Nginx reloaded successfully"
        else
            echo -e "${WARN} Failed to reload nginx (may need manual restart)"
        fi
    else
        echo -e "${WARN} Nginx container not running (cert will be used on next start)"
    fi

    echo ""
    echo -e "${GREEN}${BOLD}✓ Certificate provisioning complete!${NC}"
    echo -e "${DIM}Certificate location:${NC}"
    echo -e "  ${CYAN}${CERT_DIR}/nginx-selfsigned.crt${NC}"
    echo -e "  ${CYAN}${CERT_DIR}/nginx-selfsigned.key${NC}"

    # Show renewal info
    echo ""
    echo -e "${DIM}To renew certificates, run this script again or create a cron job:${NC}"
    echo -e "  ${CYAN}0 2 * * 0 ${SCRIPT_DIR}/provision-tailscale-certs.sh${NC}"

else
    echo -e "${CROSS} Failed to fetch certificate"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo -e "  1. HTTPS not enabled in your tailnet (https://login.tailscale.com/admin/settings/features)"
    echo -e "  2. MagicDNS not enabled"
    echo -e "  3. Domain ${DOMAIN} not valid for this machine"
    echo ""
    echo -e "${YELLOW}For self-signed fallback, generate with:${NC}"
    echo -e "  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
    echo -e "    -keyout ${CERT_DIR}/nginx-selfsigned.key \\"
    echo -e "    -out ${CERT_DIR}/nginx-selfsigned.crt \\"
    echo -e "    -subj '/CN=localhost'"
    exit 1
fi
