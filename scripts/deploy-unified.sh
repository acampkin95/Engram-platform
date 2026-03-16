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

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-unified.sh <command> [args...]

Lifecycle Commands:
  up [extra args]           Build and start the unified stack
  down [extra args]         Stop the unified stack
  restart [service]         Restart all or one service
  ps                        Show service status
  logs [service]            Tail logs for all or one service
  config                    Validate and print composed config
  pull                      Pull images referenced by the unified stack

Deployment Commands:
  deploy [--dry-run]        Production deployment with pre-flight checks
  health                    Run health checks against running services

Legacy Script Delegation:
  deploy:production         Delegates to Engram-Platform/scripts/deploy-production.sh
  deploy:devnode            Delegates to Engram-Platform/scripts/deploy-devnode.sh
  deploy:memory             Delegates to Engram-AiMemory/scripts/deploy-full.sh

Examples:
  ./scripts/deploy-unified.sh up
  ./scripts/deploy-unified.sh up --profile mcp
  ./scripts/deploy-unified.sh deploy --dry-run
  ./scripts/deploy-unified.sh health
  ./scripts/deploy-unified.sh logs memory-api
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
  echo -e "  ${CHECK} Docker available"

  if ! docker compose version &>/dev/null 2>&1; then
    echo -e "  ${CROSS} Docker Compose not available"; exit 1
  fi
  echo -e "  ${CHECK} Docker Compose available"

  if [[ ! -f "${ENV_FILE}" ]]; then
    echo -e "  ${WARN}  No .env file at ${ENV_FILE}"
    if [[ -f "${ENV_FILE}.example" ]]; then
      echo -e "  ${WARN}  Copy ${ENV_FILE}.example to ${ENV_FILE} and fill in secrets"
    fi
  else
    echo -e "  ${CHECK} Environment file exists"
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

  preflight

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
    echo "Unknown command: ${command}" >&2
    usage
    exit 1
    ;;
esac
