#!/usr/bin/env bash
# =============================================================================
#  Engram Platform — Tailscale Access Verification
#  Verifies services are accessible via Tailscale and NOT publicly exposed
# =============================================================================
set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Get configuration from environment or use defaults
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$ENV_FILE"
fi

TS_IP="${TAILSCALE_IP:-100.100.42.6}"
DOMAIN="${DOMAIN:-memory.velocitydigi.com}"
PUBLIC_IP="${PUBLIC_IP:-46.250.245.181}"

PASS=0
FAIL=0

echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║        Tailscale Access Verification                            ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${DIM}Configuration:${NC}"
echo -e "  Tailscale IP: ${CYAN}${TS_IP}${NC}"
echo -e "  Domain:       ${CYAN}${DOMAIN}${NC}"
echo -e "  Public IP:    ${CYAN}${PUBLIC_IP}${NC}"
echo ""

# Helper functions
test_pass() {
    echo -e "  ${CHECK} $1"
    ((PASS++))
}

test_fail() {
    echo -e "  ${CROSS} $1"
    ((FAIL++))
}

test_warn() {
    echo -e "  ${WARN} $1"
}

# Test 1: HTTPS via Tailscale IP
echo -e "${BLUE}Testing Tailscale Access:${NC}"
if curl -sf --max-time 5 -k "https://${TS_IP}/health" > /dev/null 2>&1; then
    test_pass "HTTPS via Tailscale IP (https://${TS_IP}/health)"
else
    test_fail "HTTPS via Tailscale IP (https://${TS_IP}/health)"
fi

# Test 2: HTTP redirects to HTTPS
echo ""
echo -e "${BLUE}Testing HTTP → HTTPS Redirect:${NC}"
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://${TS_IP}/health" 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" == "301" ]] || [[ "$HTTP_STATUS" == "308" ]]; then
    test_pass "HTTP redirects to HTTPS (status ${HTTP_STATUS})"
else
    test_warn "HTTP response status ${HTTP_STATUS} (expected 301/308 redirect)"
fi

# Test 3: Memory API via nginx proxy
echo ""
echo -e "${BLUE}Testing API Endpoints:${NC}"
if curl -sf --max-time 5 -k "https://${TS_IP}/api/memory/health" > /dev/null 2>&1; then
    test_pass "Memory API (/api/memory/health)"
else
    test_fail "Memory API (/api/memory/health)"
fi

# Test 4: Crawler API via nginx proxy
if curl -sf --max-time 5 -k "https://${TS_IP}/api/crawler/" > /dev/null 2>&1; then
    test_pass "Crawler API (/api/crawler/)"
else
    test_fail "Crawler API (/api/crawler/)"
fi

# Test 5: MCP health
if curl -sf --max-time 5 -k "https://${TS_IP}/mcp/health" > /dev/null 2>&1; then
    test_pass "MCP Server (/mcp/health)"
else
    test_fail "MCP Server (/mcp/health)"
fi

# Test 6: No public access (should timeout/fail)
echo ""
echo -e "${BLUE}Testing Public Access Blocking:${NC}"
if curl -sf --max-time 3 -k "https://${PUBLIC_IP}/health" > /dev/null 2>&1; then
    test_fail "Public IP is accessible (SHOULD BE BLOCKED!)"
    echo -e "  ${RED}SECURITY ISSUE: Service is exposed to the public internet${NC}"
else
    test_pass "Public IP is not accessible (correctly blocked)"
fi

# Test 7: CORS preflight
echo ""
echo -e "${BLUE}Testing CORS Configuration:${NC}"
CORS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -k \
    -H "Origin: https://${DOMAIN}" \
    -H "Access-Control-Request-Method: GET" \
    -X OPTIONS "https://${TS_IP}/api/memory/health" 2>/dev/null || echo "000")
if [[ "$CORS_STATUS" == "200" ]] || [[ "$CORS_STATUS" == "204" ]]; then
    test_pass "CORS preflight request (status ${CORS_STATUS})"
else
    test_warn "CORS preflight returned status ${CORS_STATUS}"
fi

# Test 8: Security headers
echo ""
echo -e "${BLUE}Testing Security Headers:${NC}"
HEADERS=$(curl -sI --max-time 5 -k "https://${TS_IP}/health" 2>/dev/null || true)
if echo "$HEADERS" | grep -qi "x-frame-options"; then
    test_pass "X-Frame-Options header present"
else
    test_fail "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "strict-transport-security"; then
    test_pass "HSTS header present"
else
    test_fail "HSTS header missing"
fi

if echo "$HEADERS" | grep -qi "content-security-policy"; then
    test_pass "Content-Security-Policy header present"
else
    test_fail "Content-Security-Policy header missing"
fi

# Test 9: Tailscale connectivity from this host
echo ""
echo -e "${BLUE}Testing Local Tailscale Connection:${NC}"
if command -v tailscale &>/dev/null; then
    if tailscale status &>/dev/null; then
        LOCAL_TS_IP=$(tailscale ip -4 2>/dev/null || echo "unknown")
        test_pass "Tailscale is connected (this host: ${LOCAL_TS_IP})"
    else
        test_warn "Tailscale is installed but not connected"
    fi
else
    test_warn "Tailscale is not installed on this host"
fi

# Summary
echo ""
echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Results:${NC} ${GREEN}${PASS} passed${NC} ${FAIL:+/ ${RED}${FAIL} failed${NC}}"
echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ $FAIL -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}✓ All checks passed!${NC}"
    echo -e "${DIM}Engram Platform is properly configured for Tailscale-only access.${NC}"
    exit 0
else
    echo -e "${YELLOW}${BOLD}⚠ Some checks failed.${NC}"
    echo -e "${DIM}Review the failures above and remediate as needed.${NC}"
    exit 1
fi
