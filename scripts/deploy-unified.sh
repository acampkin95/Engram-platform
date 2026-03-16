#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/Engram-Platform/docker-compose.yml"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-unified.sh <command> [args...]

Commands:
  up [extra args]       Start the unified stack with build
  down [extra args]     Stop the unified stack
  ps                    Show service status
  logs [service]        Tail logs for all or one service
  config                Validate and print composed config
  pull                  Pull images referenced by the unified stack

Examples:
  ./scripts/deploy-unified.sh up
  ./scripts/deploy-unified.sh up --profile mcp
  ./scripts/deploy-unified.sh logs memory-api
EOF
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
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: ${command}" >&2
    usage
    exit 1
    ;;
esac
