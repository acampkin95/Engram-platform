#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
SKIPPED=0

MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"

print_header() {
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}Engram Platform Health Check${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
  echo
}

print_separator() {
  echo -e "${BLUE}────────────────────────────────────────────────────${NC}"
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose not found. Install Docker Compose v2 or docker-compose." >&2
  exit 2
}

service_container_id() {
  local service="$1"
  compose_cmd ps -q "$service" 2>/dev/null || true
}

container_health_state() {
  local container_id="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true
}

check_service() {
  local service="$1"
  local optional="${2:-false}"

  printf "  %-28s " "$service"

  local cid
  cid="$(service_container_id "$service")"

  if [[ -z "$cid" ]]; then
    if [[ "$optional" == "true" ]]; then
      printf "${YELLOW}⊘ skipped (not running)${NC}\n"
      ((SKIPPED+=1))
      return 0
    fi

    printf "${RED}✗ not running${NC}\n"
    ((FAIL+=1))
    return 1
  fi

  local attempt=0
  while (( attempt < MAX_RETRIES )); do
    local status
    status="$(container_health_state "$cid")"

    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      printf "${GREEN}✓ healthy${NC}\n"
      ((PASS+=1))
      return 0
    fi

    ((attempt+=1))
    if (( attempt < MAX_RETRIES )); then
      sleep "$RETRY_INTERVAL"
    fi
  done

  local final_status
  final_status="$(container_health_state "$cid")"
  if [[ -z "$final_status" ]]; then
    final_status="unknown"
  fi

  printf "${RED}✗ unhealthy (${final_status})${NC}\n"
  ((FAIL+=1))
  return 1
}

print_header

echo -e "${BLUE}Core Services:${NC}"
check_service "nginx"
check_service "platform-frontend"
check_service "crawler-api"
check_service "memory-api"
check_service "weaviate"
check_service "crawler-redis"
check_service "memory-redis"

echo
echo -e "${BLUE}Optional Services:${NC}"
check_service "mcp-server" true

echo
print_separator
echo

if (( FAIL == 0 )); then
  local_total=$((PASS + SKIPPED))
  echo -e "${GREEN}✓ All required services are healthy${NC}"
  echo "  Results: ${PASS}/${local_total} services healthy"
  if (( SKIPPED > 0 )); then
    echo "  Skipped: ${SKIPPED} optional service(s)"
  fi
  exit 0
fi

total=$((PASS + FAIL + SKIPPED))
echo -e "${RED}✗ Some services are unhealthy${NC}"
echo "  Healthy:   ${PASS}"
echo "  Unhealthy: ${FAIL}"
if (( SKIPPED > 0 )); then
  echo "  Skipped:   ${SKIPPED}"
fi
echo "  Total:     ${total}"
exit 1
