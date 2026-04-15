#!/usr/bin/env bash
# =============================================================================
#  Engram Platform — E2E Smoke Test Suite
#  Verifies UI -> API -> Backend flow after deployment
#  CI-compatible: exits non-zero on any failure
# =============================================================================
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS=0
FAIL=0
SKIP=0

# Configurable base URL for nginx proxy (default: localhost via docker)
BASE_URL="${SMOKE_TEST_BASE_URL:-http://localhost:8080}"
TIMEOUT="${SMOKE_TEST_TIMEOUT:-10}"
MAX_RETRIES="${SMOKE_TEST_RETRIES:-3}"

# ─── Helpers ─────────────────────────────────────────────────────────────────

print_header() {
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Engram Platform — E2E Smoke Tests${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
  echo -e "  Base URL: ${BASE_URL}"
  echo -e "  Timeout:  ${TIMEOUT}s"
  echo
}

print_section() {
  echo -e "${BLUE}── $1 ──${NC}"
}

pass() {
  printf "  %-45s ${GREEN}✓ PASS${NC}\n" "$1"
  ((PASS+=1))
}

fail() {
  printf "  %-45s ${RED}✗ FAIL${NC}\n" "$1"
  if [[ -n "${2:-}" ]]; then
    echo -e "    ${RED}→ $2${NC}"
  fi
  ((FAIL+=1))
}

skip() {
  printf "  %-45s ${YELLOW}⊘ SKIP${NC}\n" "$1"
  ((SKIP+=1))
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "${PROJECT_ROOT}/docker-compose.yml" "$@"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" "$@"
    return
  fi
  echo "Docker Compose not found." >&2
  return 1
}

# HTTP check with retries
http_check() {
  local url="$1"
  local method="${2:-GET}"
  local data="${3:-}"
  local attempt=0

  while (( attempt < MAX_RETRIES )); do
    local http_code
    if [[ "$method" == "GET" ]]; then
      http_code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$url" 2>/dev/null) || true
    else
      http_code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" \
        -X "$method" -H 'Content-Type: application/json' -d "$data" "$url" 2>/dev/null) || true
    fi

    if [[ "$http_code" =~ ^[23] ]]; then
      echo "$http_code"
      return 0
    fi

    ((attempt+=1))
    if (( attempt < MAX_RETRIES )); then
      sleep 2
    fi
  done

  echo "${http_code:-000}"
  return 1
}

# ─── Phase 1: Docker Service Health ─────────────────────────────────────────

check_docker_services() {
  print_section "Phase 1: Docker Service Health"

  if ! command -v docker >/dev/null 2>&1; then
    skip "Docker not available"
    return
  fi

  local services=("nginx" "platform-frontend" "crawler-api" "memory-api" "weaviate" "crawler-redis" "memory-redis")
  local optional_services=("mcp-server")

  for svc in "${services[@]}"; do
    local cid
    cid=$(compose_cmd ps -q "$svc" 2>/dev/null) || true
    if [[ -z "$cid" ]]; then
      fail "$svc" "container not running"
      continue
    fi

    local status
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null) || true
    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      pass "$svc ($status)"
    else
      fail "$svc" "status: ${status:-unknown}"
    fi
  done

  for svc in "${optional_services[@]}"; do
    local cid
    cid=$(compose_cmd ps -q "$svc" 2>/dev/null) || true
    if [[ -z "$cid" ]]; then
      skip "$svc (optional, not running)"
    else
      local status
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null) || true
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        pass "$svc ($status)"
      else
        fail "$svc" "status: ${status:-unknown}"
      fi
    fi
  done

  echo
}

# ─── Phase 2: Direct Service Health Endpoints ───────────────────────────────

check_service_endpoints() {
  print_section "Phase 2: Direct Service Health Endpoints"

  # Memory API
  local code
  if code=$(http_check "http://localhost:8000/health"); then
    pass "memory-api:8000/health (HTTP $code)"
  else
    fail "memory-api:8000/health" "HTTP $code"
  fi

  # Crawler API
  if code=$(http_check "http://localhost:11235/health"); then
    pass "crawler-api:11235/health (HTTP $code)"
  else
    fail "crawler-api:11235/health" "HTTP $code"
  fi

  # MCP Server (optional)
  if code=$(http_check "http://localhost:3000/health"); then
    pass "mcp-server:3000/health (HTTP $code)"
  else
    skip "mcp-server:3000/health (HTTP $code)"
  fi

  # Platform Frontend
  if code=$(http_check "http://localhost:3002/"); then
    pass "platform-frontend:3002 (HTTP $code)"
  else
    # Also try port 3000 (Docker internal)
    if code=$(http_check "http://localhost:3000/"); then
      pass "platform-frontend:3000 (HTTP $code)"
    else
      fail "platform-frontend" "HTTP $code on both :3002 and :3000"
    fi
  fi

  echo
}

# ─── Phase 3: Nginx Proxy Routes ────────────────────────────────────────────

check_nginx_proxy() {
  print_section "Phase 3: Nginx Proxy Routes"

  local code

  # Nginx own health
  if code=$(http_check "${BASE_URL}/health"); then
    pass "nginx /health (HTTP $code)"
  else
    fail "nginx /health" "HTTP $code — nginx may not be running"
    echo -e "  ${YELLOW}Skipping remaining proxy checks${NC}"
    echo
    return
  fi

  # Memory API via nginx
  if code=$(http_check "${BASE_URL}/api/memory/health"); then
    pass "nginx -> /api/memory/health (HTTP $code)"
  else
    fail "nginx -> /api/memory/health" "HTTP $code"
  fi

  # Crawler API via nginx
  if code=$(http_check "${BASE_URL}/api/crawler/health"); then
    pass "nginx -> /api/crawler/health (HTTP $code)"
  else
    fail "nginx -> /api/crawler/health" "HTTP $code"
  fi

  # MCP health via nginx
  if code=$(http_check "${BASE_URL}/mcp/health"); then
    pass "nginx -> /mcp/health (HTTP $code)"
  else
    skip "nginx -> /mcp/health (HTTP $code)"
  fi

  # Frontend via nginx
  if code=$(http_check "${BASE_URL}/"); then
    pass "nginx -> / (frontend) (HTTP $code)"
  else
    fail "nginx -> / (frontend)" "HTTP $code"
  fi

  echo
}

# ─── Phase 4: API Functional Tests ──────────────────────────────────────────

check_api_functionality() {
  print_section "Phase 4: API Functional Smoke Tests"

  local code

  # Memory API — search endpoint
  if code=$(http_check "${BASE_URL}/api/memory/memories/search" "POST" '{"query":"smoke test","limit":1}'); then
    pass "POST /api/memory/memories/search (HTTP $code)"
  else
    # 401/403 is acceptable — means the endpoint exists and auth is enforced
    if [[ "$code" == "401" || "$code" == "403" || "$code" == "422" ]]; then
      pass "POST /api/memory/memories/search (HTTP $code, auth required)"
    else
      fail "POST /api/memory/memories/search" "HTTP $code"
    fi
  fi

  # Crawler API — dashboard stats
  if code=$(http_check "${BASE_URL}/api/crawler/api/stats/dashboard"); then
    pass "GET /api/crawler/api/stats/dashboard (HTTP $code)"
  else
    if [[ "$code" == "401" || "$code" == "403" ]]; then
      pass "GET /api/crawler/api/stats/dashboard (HTTP $code, auth required)"
    else
      fail "GET /api/crawler/api/stats/dashboard" "HTTP $code"
    fi
  fi

  # Crawler API — basic health/version
  if code=$(http_check "${BASE_URL}/api/crawler/health"); then
    pass "GET /api/crawler/health (HTTP $code)"
  else
    fail "GET /api/crawler/health" "HTTP $code"
  fi

  echo
}

# ─── Summary ─────────────────────────────────────────────────────────────────

print_summary() {
  local total=$((PASS + FAIL + SKIP))
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"

  if (( FAIL == 0 )); then
    echo -e "${GREEN}  SMOKE TESTS PASSED${NC}"
  else
    echo -e "${RED}  SMOKE TESTS FAILED${NC}"
  fi

  echo -e "  Passed:  ${PASS}"
  echo -e "  Failed:  ${FAIL}"
  if (( SKIP > 0 )); then
    echo -e "  Skipped: ${SKIP}"
  fi
  echo -e "  Total:   ${total}"
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  print_header
  check_docker_services
  check_service_endpoints
  check_nginx_proxy
  check_api_functionality
  print_summary

  if (( FAIL > 0 )); then
    exit 1
  fi
}

main "$@"
