#!/bin/bash
#
# Engram Unified Deployment Entry Point
#
# Canonical orchestration surface for the full Engram stack.
# Wraps the master docker-compose at Engram-Platform/docker-compose.yml
# and provides shortcuts for production deployment, health checks, and
# service lifecycle management.
#
# Usage:
#   ./scripts/deploy-unified.sh <command> [args...]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/Engram-Platform/docker-compose.yml"
ENV_FILE="${ROOT_DIR}/Engram-Platform/.env"
ENV_EXAMPLE="${ROOT_DIR}/Engram-Platform/.env.example"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

prompt_value() {
  local var_name="$1" prompt_text="$2" default_val="${3:-}" secret="${4:-false}"
  local current_val=""

  if [[ -f "${ENV_FILE}" ]]; then
    current_val=$(grep -E "^${var_name}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)
  fi

  if [[ -n "${current_val}" && "${current_val}" != *"..."* && "${current_val}" != *"your-"* ]]; then
    local display_val="${current_val}"
    if [[ "${secret}" == "true" && ${#current_val} -gt 8 ]]; then
      display_val="${current_val:0:4}****${current_val: -4}"
    fi
    echo -e "  ${CHECK} ${var_name} = ${DIM}${display_val}${NC} (existing)"
    return 0
  fi

  local shown_default="${default_val}"
  if [[ "${secret}" == "true" && -n "${default_val}" ]]; then
    shown_default="(auto-generated)"
  fi

  if [[ -n "${shown_default}" ]]; then
    printf "  ${CYAN}?${NC} ${prompt_text} [${DIM}${shown_default}${NC}]: "
  else
    printf "  ${CYAN}?${NC} ${prompt_text}: "
  fi

  local input=""
  if [[ "${secret}" == "true" ]]; then
    read -rs input
    echo ""
  else
    read -r input
  fi

  local final_val="${input:-${default_val}}"
  if [[ -z "${final_val}" ]]; then
    echo -e "  ${WARN}  Skipped ${var_name} (no value provided)"
    return 0
  fi

  if [[ -f "${ENV_FILE}" ]] && grep -q "^${var_name}=" "${ENV_FILE}" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${var_name}=.*|${var_name}=${final_val}|" "${ENV_FILE}"
    else
      sed -i "s|^${var_name}=.*|${var_name}=${final_val}|" "${ENV_FILE}"
    fi
  else
    echo "${var_name}=${final_val}" >> "${ENV_FILE}"
  fi
  echo -e "  ${CHECK} ${var_name} set"
}

generate_secret() {
  openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '/+=' | head -c 64
}

env_setup() {
  echo -e "\n${BLUE}━━━${NC} ${BOLD}Environment Configuration${NC}\n"
  echo -e "  This wizard configures ${BOLD}Engram-Platform/.env${NC}."
  echo -e "  Press Enter to accept defaults. Existing values are preserved.\n"

  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${ENV_EXAMPLE}" ]]; then
      cp "${ENV_EXAMPLE}" "${ENV_FILE}"
      echo -e "  ${CHECK} Created .env from .env.example\n"
    else
      touch "${ENV_FILE}"
      echo -e "  ${WARN}  No .env.example found, starting with empty .env\n"
    fi
  else
    echo -e "  ${CHECK} Using existing .env (values preserved)\n"
  fi

  echo -e "  ${BOLD}--- Authentication ---${NC}"
  prompt_value "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "Clerk publishable key (pk_live_... or pk_test_...)"
  prompt_value "CLERK_SECRET_KEY" "Clerk secret key" "" "true"
  local jwt_default
  jwt_default=$(generate_secret)
  prompt_value "JWT_SECRET" "JWT secret (min 32 chars)" "${jwt_default}" "true"

  echo -e "\n  ${BOLD}--- Embedding Provider ---${NC}"
  prompt_value "EMBEDDING_PROVIDER" "Embedding provider (openai|deepinfra|nomic|local)" "deepinfra"
  prompt_value "DEEPINFRA_API_KEY" "DeepInfra API key (if using deepinfra)" "" "true"

  echo -e "\n  ${BOLD}--- Network / Tailscale ---${NC}"
  prompt_value "BIND_ADDRESS" "Bind address (127.0.0.1 for local, Tailscale IP for remote)" "127.0.0.1"
  prompt_value "TAILSCALE_HOSTNAME" "Tailscale MagicDNS hostname" "dv-syd-host01.icefish-discus.ts.net"
  prompt_value "NEXT_PUBLIC_APP_URL" "Public application URL" "http://localhost:3002"

  echo -e "\n  ${BOLD}--- MCP Server ---${NC}"
  local mcp_default
  mcp_default=$(generate_secret)
  prompt_value "MCP_AUTH_TOKEN" "MCP bearer token" "${mcp_default}" "true"

  echo -e "\n  ${BOLD}--- Optional Services ---${NC}"
  prompt_value "LM_STUDIO_URL" "LM Studio URL (for local LLM)" "http://host.docker.internal:1234"
  prompt_value "OLLAMA_HOST" "Ollama host URL" "http://host.docker.internal:11434"

  echo -e "\n${GREEN}${BOLD}Environment configuration complete${NC}"
  echo -e "  File: ${ENV_FILE}"
  echo -e "  Edit manually: ${DIM}nano ${ENV_FILE}${NC}\n"
}

usage() {
  cat <<EOF
${BOLD}Engram Unified Deployment${NC}

Usage: ./scripts/deploy-unified.sh <command> [args...]

${BOLD}Setup:${NC}
  setup                     Interactive environment configuration wizard
  init                      Full first-time setup: env config + deploy + health check

${BOLD}Lifecycle:${NC}
  up [extra args]           Build and start the unified stack
  down [extra args]         Stop the unified stack
  restart [service]         Restart all or one service
  ps                        Show service status
  logs [service]            Tail logs for all or one service
  config                    Validate and print composed config
  pull                      Pull latest images

${BOLD}Deployment:${NC}
  deploy [--dry-run]        Production deployment with pre-flight checks
  health                    Run health checks against running services

${BOLD}Legacy Delegation:${NC}
  deploy:production         Full production deploy (Engram-Platform/scripts/deploy-production.sh)
  deploy:devnode            Devnode deploy (Engram-Platform/scripts/deploy-devnode.sh)
  deploy:memory             Memory system deploy (Engram-AiMemory/scripts/deploy-full.sh)

${BOLD}Examples:${NC}
  ${DIM}# First-time setup on a fresh machine${NC}
  ./scripts/deploy-unified.sh init

  ${DIM}# Configure environment interactively${NC}
  ./scripts/deploy-unified.sh setup

  ${DIM}# Start the full stack${NC}
  ./scripts/deploy-unified.sh up

  ${DIM}# Start with MCP server profile${NC}
  ./scripts/deploy-unified.sh up --profile mcp

  ${DIM}# Dry-run deployment (validates without changes)${NC}
  ./scripts/deploy-unified.sh deploy --dry-run

  ${DIM}# Check all service health${NC}
  ./scripts/deploy-unified.sh health

  ${DIM}# Tail memory API logs${NC}
  ./scripts/deploy-unified.sh logs memory-api

  ${DIM}# Restart just the MCP server${NC}
  ./scripts/deploy-unified.sh restart mcp-server

${BOLD}Tips:${NC}
  - Run ${DIM}setup${NC} before first deploy to configure secrets
  - The .env file lives at Engram-Platform/.env
  - Copy .env.example to .env for a starting template
  - Use ${DIM}config${NC} to validate compose without starting services
  - Use ${DIM}deploy --dry-run${NC} to test a production deploy safely
  - All services bind to BIND_ADDRESS (default 127.0.0.1)
  - Set BIND_ADDRESS to your Tailscale IP for remote access
  - Never use 0.0.0.0 in production
EOF
}

preflight() {
  echo -e "${BLUE}━━━${NC} ${BOLD}Pre-flight checks${NC}"

  if ! command -v docker &>/dev/null; then
    echo -e "  ${CROSS} Docker not installed"; exit 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    echo -e "  ${CROSS} Docker daemon not running"; exit 1
  fi
  echo -e "  ${CHECK} Docker available ($(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1))"

  if ! docker compose version &>/dev/null 2>&1; then
    echo -e "  ${CROSS} Docker Compose not available"; exit 1
  fi
  echo -e "  ${CHECK} Docker Compose available"

  if [[ ! -f "${ENV_FILE}" ]]; then
    echo -e "  ${WARN}  No .env file at ${ENV_FILE}"
    echo -e "       Run: ${DIM}$0 setup${NC} to create one interactively"
    return 1
  else
    echo -e "  ${CHECK} Environment file exists"
  fi

  local missing_vars=()
  for var in JWT_SECRET NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY; do
    local val
    val=$(grep -E "^${var}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)
    if [[ -z "${val}" || "${val}" == *"your-"* || "${val}" == *"..."* ]]; then
      missing_vars+=("${var}")
    fi
  done

  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo -e "  ${WARN}  Missing or placeholder values: ${missing_vars[*]}"
    echo -e "       Run: ${DIM}$0 setup${NC} to configure"
  else
    echo -e "  ${CHECK} Required secrets configured"
  fi

  docker compose -f "${COMPOSE_FILE}" config --quiet 2>/dev/null \
    && echo -e "  ${CHECK} Compose config valid" \
    || echo -e "  ${WARN}  Compose config has warnings"
}

health_check() {
  echo -e "${BLUE}━━━${NC} ${BOLD}Health checks${NC}"
  local services=("memory-api:8000/health" "mcp-server:3000/health" "platform:3002")
  local all_ok=true

  for svc_port in "${services[@]}"; do
    local name="${svc_port%%:*}"
    local endpoint="${svc_port#*:}"
    local url="http://localhost:${endpoint}"

    if curl -sf --max-time 5 "${url}" >/dev/null 2>&1; then
      echo -e "  ${CHECK} ${name} (${url})"
    else
      echo -e "  ${CROSS} ${name} (${url})"
      all_ok=false
    fi
  done

  local weaviate_url="http://localhost:8080/v1/.well-known/ready"
  if curl -sf --max-time 5 "${weaviate_url}" >/dev/null 2>&1; then
    echo -e "  ${CHECK} weaviate (${weaviate_url})"
  else
    echo -e "  ${CROSS} weaviate (${weaviate_url})"
    all_ok=false
  fi

  if [[ "${all_ok}" == true ]]; then
    echo -e "\n${GREEN}${BOLD}All services healthy${NC}"
  else
    echo -e "\n${YELLOW}${BOLD}Some services unhealthy${NC}"
    return 1
  fi
}

do_deploy() {
  local dry_run=false
  for arg in "$@"; do
    [[ "${arg}" == "--dry-run" ]] && dry_run=true
  done

  preflight || {
    echo -e "\n  ${WARN}  Pre-flight failed. Run ${DIM}$0 setup${NC} first."
    exit 1
  }

  echo -e "\n${BLUE}━━━${NC} ${BOLD}Deploying unified stack${NC}"

  if [[ "${dry_run}" == true ]]; then
    echo -e "  ${WARN}  Dry-run mode — no changes will be made"
    docker compose -f "${COMPOSE_FILE}" config --quiet
    echo -e "  ${CHECK} Compose config validated"
    echo -e "  ${CHECK} Dry-run complete"
    return 0
  fi

  docker compose -f "${COMPOSE_FILE}" pull --ignore-pull-failures 2>/dev/null || true
  docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans

  echo -e "\n  Waiting for services to start..."
  sleep 10

  health_check || echo -e "  ${WARN}  Some services still starting — recheck with: $0 health"
}

do_init() {
  echo -e "\n${BOLD}Engram First-Time Setup${NC}\n"
  echo -e "  This will configure your environment, build all services,"
  echo -e "  and verify everything is healthy.\n"

  env_setup
  preflight || {
    echo -e "\n  ${WARN}  Pre-flight failed after setup. Check errors above."
    exit 1
  }

  echo -e "\n${BLUE}━━━${NC} ${BOLD}Building and starting services${NC}"
  docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans

  echo -e "\n  Waiting for services to start..."
  sleep 15

  health_check || true

  echo -e "\n${GREEN}${BOLD}Setup complete!${NC}"
  echo -e "  Dashboard:  ${CYAN}http://localhost:3002${NC}"
  echo -e "  Memory API: ${CYAN}http://localhost:8000${NC}"
  echo -e "  MCP Server: ${CYAN}http://localhost:3000${NC}"
  echo -e "\n  Next steps:"
  echo -e "    ${DIM}$0 logs${NC}             — watch service output"
  echo -e "    ${DIM}$0 health${NC}           — verify all services"
  echo -e "    ${DIM}$0 ps${NC}               — check container status"
}

delegate() {
  local script="$1"; shift
  if [[ ! -f "${script}" ]]; then
    echo -e "${CROSS} Script not found: ${script}" >&2; exit 1
  fi
  if [[ ! -x "${script}" ]]; then
    chmod +x "${script}"
  fi
  exec "${script}" "$@"
}

command="${1:-}"
shift || true

case "${command}" in
  setup)
    env_setup
    ;;
  init)
    do_init
    ;;
  up)
    docker compose -f "${COMPOSE_FILE}" up -d --build "$@"
    ;;
  down)
    docker compose -f "${COMPOSE_FILE}" down "$@"
    ;;
  restart)
    docker compose -f "${COMPOSE_FILE}" restart "$@"
    ;;
  ps)
    docker compose -f "${COMPOSE_FILE}" ps "$@"
    ;;
  logs)
    docker compose -f "${COMPOSE_FILE}" logs -f "$@"
    ;;
  config)
    docker compose -f "${COMPOSE_FILE}" config "$@"
    ;;
  pull)
    docker compose -f "${COMPOSE_FILE}" pull "$@"
    ;;
  deploy)
    do_deploy "$@"
    ;;
  health)
    health_check
    ;;
  deploy:production)
    delegate "${ROOT_DIR}/Engram-Platform/scripts/deploy-production.sh" "$@"
    ;;
  deploy:devnode)
    delegate "${ROOT_DIR}/Engram-Platform/scripts/deploy-devnode.sh" "$@"
    ;;
  deploy:memory)
    delegate "${ROOT_DIR}/Engram-AiMemory/scripts/deploy-full.sh" "$@"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo -e "${CROSS} Unknown command: ${command}" >&2
    echo ""
    usage
    exit 1
    ;;
esac
