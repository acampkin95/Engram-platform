#!/usr/bin/env bash
# =============================================================================
#  Engram Platform — Pre-Deployment Verification Checklist
#  Run before deploying to validate environment, images, certs, and resources
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
ENV_FILE="${PROJECT_ROOT}/.env"

ERRORS=0
WARNINGS=0

# ─── Helpers ─────────────────────────────────────────────────────────────────

print_header() {
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Engram Platform — Pre-Deployment Verification${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
  echo
}

print_section() {
  echo -e "${BLUE}── $1 ──${NC}"
}

pass() {
  printf "  %-45s ${GREEN}✓ OK${NC}\n" "$1"
}

fail() {
  printf "  %-45s ${RED}✗ FAIL${NC}\n" "$1"
  if [[ -n "${2:-}" ]]; then
    echo -e "    ${RED}→ $2${NC}"
  fi
  ((ERRORS+=1))
}

warn() {
  printf "  %-45s ${YELLOW}⚠ WARN${NC}\n" "$1"
  if [[ -n "${2:-}" ]]; then
    echo -e "    ${YELLOW}→ $2${NC}"
  fi
  ((WARNINGS+=1))
}

# ─── Check 1: Environment Variables ─────────────────────────────────────────

check_env() {
  print_section "1. Environment Variables"

  if [[ ! -f "$ENV_FILE" ]]; then
    fail ".env file" "Not found at ${ENV_FILE}. Copy .env.example first."
    echo
    return
  fi

  pass ".env file exists"

  # Run validate-env.sh if available
  if [[ -x "${SCRIPT_DIR}/validate-env.sh" ]]; then
    if "${SCRIPT_DIR}/validate-env.sh" "$ENV_FILE" >/dev/null 2>&1; then
      pass "validate-env.sh"
    else
      fail "validate-env.sh" "Environment validation failed — run it directly for details"
    fi
  else
    warn "validate-env.sh" "Not found or not executable — skipping env validation"
  fi

  # Source env and check critical vars
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a

  local required_vars=(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    "CLERK_SECRET_KEY"
    "JWT_SECRET"
    "DEEPINFRA_API_KEY"
    "EMBEDDING_PROVIDER"
  )

  for var in "${required_vars[@]}"; do
    local val="${!var:-}"
    if [[ -z "$val" || "$val" == *"your-"* || "$val" == *"..."* ]]; then
      fail "$var" "Missing or placeholder value"
    else
      pass "$var"
    fi
  done

  echo
}

# ─── Check 2: Docker Images ─────────────────────────────────────────────────

check_docker_images() {
  print_section "2. Docker Images"

  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker" "Docker is not installed or not in PATH"
    echo
    return
  fi

  pass "Docker available"

  if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon" "Docker daemon is not running"
    echo
    return
  fi

  pass "Docker daemon running"

  local images=("crawl4ai-engram:latest" "engram-memory-api:latest")
  local pull_images=("semitechnologies/weaviate:1.27.0" "redis:7-alpine" "nginx:alpine")

  for img in "${images[@]}"; do
    if docker image inspect "$img" >/dev/null 2>&1; then
      pass "Image: $img"
    else
      fail "Image: $img" "Not built — run 'docker compose build'"
    fi
  done

  for img in "${pull_images[@]}"; do
    if docker image inspect "$img" >/dev/null 2>&1; then
      pass "Image: $img"
    else
      warn "Image: $img" "Not pulled — will be pulled on first 'docker compose up'"
    fi
  done

  echo
}

# ─── Check 3: SSL Certificates ──────────────────────────────────────────────

check_ssl_certs() {
  print_section "3. SSL Certificates"

  local cert_dir="${PROJECT_ROOT}/nginx/certs"

  if [[ ! -d "$cert_dir" ]]; then
    warn "Cert directory" "${cert_dir} does not exist"
    echo -e "    ${YELLOW}→ Nginx will fail to start without certs. Generate self-signed:${NC}"
    echo -e "    ${YELLOW}  mkdir -p ${cert_dir}${NC}"
    echo -e "    ${YELLOW}  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\${NC}"
    echo -e "    ${YELLOW}    -keyout ${cert_dir}/nginx-selfsigned.key \\${NC}"
    echo -e "    ${YELLOW}    -out ${cert_dir}/nginx-selfsigned.crt -subj '/CN=localhost'${NC}"
    echo
    return
  fi

  if [[ -f "${cert_dir}/nginx-selfsigned.crt" && -f "${cert_dir}/nginx-selfsigned.key" ]]; then
    pass "Self-signed cert exists"

    # Check expiry
    local expiry
    expiry=$(openssl x509 -enddate -noout -in "${cert_dir}/nginx-selfsigned.crt" 2>/dev/null | cut -d= -f2) || true
    if [[ -n "$expiry" ]]; then
      local expiry_epoch
      expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null || date -d "$expiry" +%s 2>/dev/null) || true
      local now_epoch
      now_epoch=$(date +%s)
      if [[ -n "$expiry_epoch" ]] && (( expiry_epoch < now_epoch )); then
        fail "SSL cert expiry" "Certificate expired on $expiry"
      elif [[ -n "$expiry_epoch" ]] && (( expiry_epoch - now_epoch < 604800 )); then
        warn "SSL cert expiry" "Certificate expires in less than 7 days ($expiry)"
      else
        pass "SSL cert expiry ($expiry)"
      fi
    fi
  else
    fail "SSL cert files" "Missing nginx-selfsigned.crt or .key in ${cert_dir}"
  fi

  echo
}

# ─── Check 4: Disk Space ────────────────────────────────────────────────────

check_disk_space() {
  print_section "4. Disk Space"

  local available_kb
  available_kb=$(df -k "${PROJECT_ROOT}" | awk 'NR==2 {print $4}')
  local available_mb=$((available_kb / 1024))
  local available_gb=$((available_mb / 1024))

  if (( available_mb < 1024 )); then
    fail "Disk space" "Only ${available_mb}MB available — need at least 1GB"
  elif (( available_mb < 5120 )); then
    warn "Disk space" "${available_gb}GB available — consider freeing space (recommend 5GB+)"
  else
    pass "Disk space (${available_gb}GB available)"
  fi

  # Check Docker disk usage
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    local docker_usage
    docker_usage=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1) || true
    if [[ -n "$docker_usage" ]]; then
      pass "Docker disk usage: ${docker_usage}"
    fi
  fi

  echo
}

# ─── Check 5: Nginx Config ──────────────────────────────────────────────────

check_nginx_config() {
  print_section "5. Nginx Configuration"

  local nginx_conf="${PROJECT_ROOT}/nginx/nginx.conf"

  if [[ ! -f "$nginx_conf" ]]; then
    fail "nginx.conf" "Not found at ${nginx_conf}"
    echo
    return
  fi

  pass "nginx.conf exists"

  # Validate nginx config syntax via Docker if available
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker run --rm -v "${PROJECT_ROOT}/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
      nginx:alpine nginx -t >/dev/null 2>&1; then
      pass "nginx config syntax (nginx -t)"
    else
      fail "nginx config syntax" "nginx -t failed — check config for errors"
    fi
  else
    warn "nginx config syntax" "Cannot validate — Docker not available"
  fi

  echo
}

# ─── Check 6: Docker Compose Config ─────────────────────────────────────────

check_compose_config() {
  print_section "6. Docker Compose Configuration"

  local compose_file="${PROJECT_ROOT}/docker-compose.yml"

  if [[ ! -f "$compose_file" ]]; then
    fail "docker-compose.yml" "Not found at ${compose_file}"
    echo
    return
  fi

  pass "docker-compose.yml exists"

  if command -v docker >/dev/null 2>&1; then
    if docker compose -f "$compose_file" config --quiet 2>/dev/null; then
      pass "docker compose config valid"
    else
      fail "docker compose config" "Validation failed — check for syntax errors"
    fi
  fi

  echo
}

# ─── Summary ─────────────────────────────────────────────────────────────────

print_summary() {
  echo -e "${BLUE}════════════════════════════════════════════════════${NC}"

  if (( ERRORS == 0 )); then
    echo -e "${GREEN}  PRE-DEPLOYMENT CHECKS PASSED${NC}"
    echo -e "  ${ERRORS} errors, ${WARNINGS} warnings"
    echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
  else
    echo -e "${RED}  PRE-DEPLOYMENT CHECKS FAILED${NC}"
    echo -e "  ${ERRORS} errors, ${WARNINGS} warnings"
    echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  Fix errors before deploying.${NC}"
  fi
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  print_header
  check_env
  check_docker_images
  check_ssl_certs
  check_disk_space
  check_nginx_config
  check_compose_config
  print_summary

  if (( ERRORS > 0 )); then
    exit 1
  fi
}

main "$@"
