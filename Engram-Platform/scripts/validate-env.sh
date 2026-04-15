#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$SCRIPT_DIR/.env}"

echo -e "${BLUE}=== Engram Environment Validation ===${NC}"
echo -e "Checking: $ENV_FILE"

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}ERROR: $ENV_FILE not found. Copy .env.example to .env first.${NC}"
  exit 1
fi

# Source env file (handle lines with spaces/special chars)
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a

ERRORS=0
WARNINGS=0

check_required() {
  local var_name="$1"
  local var_value="${!var_name}"
  if [ -z "$var_value" ] || [[ "$var_value" == *"your-"* ]] || [[ "$var_value" == *"..."* ]]; then
    echo -e "  ${RED}MISSING: $var_name${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "  ${GREEN}OK: $var_name${NC}"
  fi
}

check_optional() {
  local var_name="$1"
  local var_value="${!var_name}"
  if [ -z "$var_value" ] || [[ "$var_value" == *"your-"* ]]; then
    echo -e "  ${YELLOW}OPTIONAL (not set): $var_name${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "  ${GREEN}OK: $var_name${NC}"
  fi
}

echo ""
echo -e "${BLUE}--- Authentication ---${NC}"
check_required NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
check_required CLERK_SECRET_KEY
check_required JWT_SECRET

echo ""
echo -e "${BLUE}--- API Keys ---${NC}"
check_required DEEPINFRA_API_KEY
check_required MCP_AUTH_TOKEN
check_optional MEMORY_API_KEY
check_optional NEXT_PUBLIC_MEMORY_API_KEY

echo ""
echo -e "${BLUE}--- Network ---${NC}"
check_required BIND_ADDRESS
check_optional TAILSCALE_HOSTNAME
check_optional CORS_ORIGINS
check_optional NEXT_PUBLIC_APP_URL

echo ""
echo -e "${BLUE}--- Embedding ---${NC}"
check_required EMBEDDING_PROVIDER
check_optional EMBEDDING_MODEL
check_optional EMBEDDING_DIMENSIONS

echo ""
echo -e "${BLUE}--- Observability ---${NC}"
check_optional NEXT_PUBLIC_SENTRY_DSN
check_optional SENTRY_AUTH_TOKEN
check_optional SENTRY_ORG
check_optional SENTRY_PROJECT

echo ""
echo -e "${BLUE}--- Security Checks ---${NC}"
if [ -n "$JWT_SECRET" ] && [ ${#JWT_SECRET} -lt 32 ]; then
  echo -e "  ${RED}WEAK: JWT_SECRET is less than 32 characters${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "  ${GREEN}OK: JWT_SECRET length${NC}"
fi

if [ "$BIND_ADDRESS" = "0.0.0.0" ]; then
  echo -e "  ${RED}DANGER: BIND_ADDRESS=0.0.0.0 exposes services to all interfaces${NC}"
  ERRORS=$((ERRORS + 1))
elif [ "$BIND_ADDRESS" = "127.0.0.1" ]; then
  echo -e "  ${GREEN}OK: BIND_ADDRESS is localhost-only${NC}"
else
  echo -e "  ${GREEN}OK: BIND_ADDRESS=$BIND_ADDRESS${NC}"
fi

echo ""
echo -e "${BLUE}=================================${NC}"
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}FAILED: $ERRORS errors, $WARNINGS warnings${NC}"
  exit 1
else
  echo -e "${GREEN}PASSED: 0 errors, $WARNINGS warnings${NC}"
fi
