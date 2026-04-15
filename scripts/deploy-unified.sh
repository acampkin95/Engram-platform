#!/usr/bin/env bash
#
# Engram Unified Deployment & Management Console
#
# Canonical orchestration surface for the full Engram stack.
# Interactive installer, environment wizard, service lifecycle,
# health monitoring, maintenance, backup, and update management.
#
# Usage:
#   ./scripts/deploy-unified.sh [command] [args...]
#   ./scripts/deploy-unified.sh              (interactive menu)

set -euo pipefail
[[ ${DEBUG:-0} == 1 ]] && set -x

# ============================================================================
# Constants & paths
# ============================================================================
readonly VERSION="2.1.0"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly ROOT_DIR
readonly COMPOSE_FILE="${ROOT_DIR}/Engram-Platform/docker-compose.yml"
readonly ENV_FILE="${ROOT_DIR}/Engram-Platform/.env"
readonly ENV_EXAMPLE="${ROOT_DIR}/Engram-Platform/.env.example"
readonly STATE_DIR="${ROOT_DIR}/.engram-state"
readonly BACKUP_DIR="${ROOT_DIR}/backups"
readonly LOG_DIR="/var/log/engram"

# Non-interactive mode flags (set via --auto, --env-file, --accept-defaults)
AUTO_MODE="${AUTO_MODE:-false}"
ENV_FILE_OVERRIDE=""
VERBOSE="${VERBOSE:-false}"
DRY_RUN=false
JSON_OUTPUT=false

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

# ============================================================================
# Terminal capabilities
# ============================================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
CHECK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN="${YELLOW}⚠${NC}"
ARROW="${CYAN}→${NC}"; BULLET="${MAGENTA}▸${NC}"



cols() { tput cols 2>/dev/null || echo 80; }

# ============================================================================
# Logging & error helpers
# ============================================================================
_LOG_FILE=""

_init_logging() {
  local log_path
  log_path="${LOG_DIR}/deploy-$(date +%Y%m%d).log"
  if mkdir -p "${LOG_DIR}" 2>/dev/null && touch "${log_path}" 2>/dev/null; then
    _LOG_FILE="${log_path}"
  else
    _LOG_FILE="/tmp/engram-deploy-$(date +%Y%m%d).log"
  fi
}

_log_raw() {
  [[ -z "${_LOG_FILE}" ]] && return 0
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${_LOG_FILE}" 2>/dev/null || true
}

die() {
  echo -e "${RED}${BOLD}FATAL:${NC} $*" >&2
  _log_raw "FATAL: $*"
  exit 1
}

log() {
  echo -e "$*"
  _log_raw "$(echo -e "$*" | sed 's/\x1b\[[0-9;]*m//g')"
}

run_cmd() {
  if [[ "${DRY_RUN}" == true ]]; then
    echo -e "  ${DIM}[DRY RUN] $*${NC}"
    _log_raw "[DRY RUN] $*"
    return 0
  fi
  if [[ "${VERBOSE}" == true ]]; then
    echo -e "  ${DIM}[EXEC] $*${NC}"
  fi
  _log_raw "[EXEC] $*"
  "$@"
}

trap 'echo -e "\n${RED}Interrupted${NC}"; exit 130' INT TERM

# ============================================================================
# Utility functions
# ============================================================================
generate_secret() {
  openssl rand -hex 32 2>/dev/null \
    || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null \
    || head -c 64 /dev/urandom | base64 | tr -d '/+=' | head -c 64
}

env_get() {
  local key="$1"
  grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- || echo ""
}

env_set() {
  local key="$1" val="$2"
  mkdir -p "$(dirname "${ENV_FILE}")"
  if [[ -f "${ENV_FILE}" ]] && grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
    fi
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

ensure_dirs() {
  mkdir -p "${STATE_DIR}" "${BACKUP_DIR}" 2>/dev/null || true
  _init_logging
}

# ============================================================================
# Display helpers
# ============================================================================
banner() {
  echo ""
  echo -e "${BLUE}${BOLD}"
  echo "  ╔═══════════════════════════════════════════════════════╗"
  echo "  ║                                                       ║"
  echo "  ║     ███████╗███╗   ██╗ ██████╗ ██████╗  █████╗ ███╗  ║"
  echo "  ║     ██╔════╝████╗  ██║██╔════╝ ██╔══██╗██╔══██╗████║ ║"
  echo "  ║     █████╗  ██╔██╗ ██║██║  ███╗██████╔╝███████║██╔█║ ║"
  echo "  ║     ██╔══╝  ██║╚██╗██║██║   ██║██╔══██╗██╔══██║██║█║ ║"
  echo "  ║     ███████╗██║ ╚████║╚██████╔╝██║  ██║██║  ██║████║ ║"
  echo "  ║     ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝ ║"
  echo "  ║                                                       ║"
  echo "  ║        AI Memory & Intelligence Platform              ║"
  echo "  ║        Unified Deployment Console v${VERSION}             ║"
  echo "  ║                                                       ║"
  echo "  ╚═══════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

section() {
  echo ""
  echo -e "${BLUE}━━━${NC} ${BOLD}$1${NC}"
  echo ""
}

subsection() {
  echo -e "\n  ${BOLD}--- $1 ---${NC}"
}

info() { echo -e "  ${CHECK} $*"; }
warn() { echo -e "  ${WARN}  $*"; }
fail() { echo -e "  ${CROSS} $*"; }
hint() { echo -e "  ${DIM}$*${NC}"; }
step() { echo -e "  ${ARROW} $*"; }
bullet() { echo -e "  ${BULLET} $*"; }

progress_bar() {
  local current="$1" total="$2" width="${3:-40}" label="${4:-}"
  local pct=$((current * 100 / total))
  local filled=$((current * width / total))
  local empty=$((width - filled))
  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done
  printf "\r  ${CYAN}[${bar}]${NC} %3d%% %s" "${pct}" "${label}"
  if [[ "${current}" -eq "${total}" ]]; then echo ""; fi
}

spinner() {
  local pid="$1" msg="${2:-Working...}"
  local chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYAN}${chars:i%${#chars}:1}${NC} %s" "${msg}"
    i=$((i+1))
    sleep 0.1
  done
  printf "\r  ${CHECK} %s\n" "${msg}"
}

confirm() {
  local msg="${1:-Continue?}" default="${2:-y}"
  if [[ "${AUTO_MODE}" == true ]]; then
    [[ "${default}" == "y" ]]
    return $?
  fi
  local prompt
  if [[ "${default}" == "y" ]]; then
    prompt="[Y/n]"
  else
    prompt="[y/N]"
  fi
  printf "  ${CYAN}?${NC} %s %s " "${msg}" "${prompt}"
  read -r answer
  answer="${answer:-${default}}"
  [[ "${answer}" =~ ^[Yy] ]]
}

choose() {
  local prompt="$1"; shift
  local options=("$@")
  echo -e "\n  ${CYAN}?${NC} ${prompt}"
  local i=1
  for opt in "${options[@]}"; do
    echo -e "    ${BOLD}${i})${NC} ${opt}"
    i=$((i+1))
  done
  printf "  ${CYAN}>${NC} "
  read -r choice
  echo "${choice}"
}

prompt_value() {
  local var_name="$1" prompt_text="$2" default_val="${3:-}" secret="${4:-false}" tooltip="${5:-}"
  local current_val
  current_val=$(env_get "${var_name}")

  if [[ -n "${current_val}" && "${current_val}" != *"..."* && "${current_val}" != *"your-"* ]]; then
    local display_val="${current_val}"
    if [[ "${secret}" == "true" && ${#current_val} -gt 8 ]]; then
      display_val="${current_val:0:4}····${current_val: -4}"
    fi
    info "${var_name} = ${DIM}${display_val}${NC} (existing)"
    return 0
  fi

  if [[ "${AUTO_MODE}" == true ]]; then
    if [[ -n "${default_val}" ]]; then
      env_set "${var_name}" "${default_val}"
      info "${var_name} set (auto-default)"
    else
      warn "Skipped ${var_name} (no default in auto mode)"
    fi
    return 0
  fi

  if [[ -n "${tooltip}" ]]; then
    hint "${tooltip}"
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
    warn "Skipped ${var_name} (no value provided)"
    return 0
  fi

  env_set "${var_name}" "${final_val}"
  info "${var_name} set"
}

# ============================================================================
# System requirements check
# ============================================================================
check_requirements() {
  section "System Requirements"

  local pass=0 total=0 warnings=0

  # Docker
  total=$((total+1))
  if command -v docker &>/dev/null; then
    local docker_ver
    docker_ver=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    if docker info &>/dev/null 2>&1; then
      info "Docker ${docker_ver} (daemon running)"
      pass=$((pass+1))
    else
      fail "Docker ${docker_ver} installed but daemon not running"
    fi
  else
    fail "Docker not installed"
    hint "Install: https://docs.docker.com/engine/install/"
  fi

  # Docker Compose
  total=$((total+1))
  if docker compose version &>/dev/null 2>&1; then
    local compose_ver
    compose_ver=$(docker compose version --short 2>/dev/null || echo "unknown")
    info "Docker Compose ${compose_ver}"
    pass=$((pass+1))
  else
    fail "Docker Compose not available"
    hint "Install: https://docs.docker.com/compose/install/"
  fi

  # Memory
  total=$((total+1))
  local mem_gb
  if [[ "$(uname)" == "Darwin" ]]; then
    mem_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
  else
    mem_gb=$(( $(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0) / 1048576 ))
  fi
  if [[ "${mem_gb}" -ge 16 ]]; then
    info "RAM: ${mem_gb}GB (recommended: 16GB)"
    pass=$((pass+1))
  elif [[ "${mem_gb}" -ge 8 ]]; then
    warn "RAM: ${mem_gb}GB (recommended: 16GB, minimum: 8GB)"
    warnings=$((warnings+1))
    pass=$((pass+1))
  else
    fail "RAM: ${mem_gb}GB (minimum 8GB required)"
  fi

  # Disk
  total=$((total+1))
  local disk_avail
  if [[ "$(uname)" == "Darwin" ]]; then
    disk_avail=$(df -g "${ROOT_DIR}" | tail -1 | awk '{print $4}')
  else
    disk_avail=$(df -BG "${ROOT_DIR}" | tail -1 | awk '{print $4}' | tr -d 'G')
  fi
  if [[ "${disk_avail}" -ge 50 ]]; then
    info "Disk: ${disk_avail}GB available"
    pass=$((pass+1))
  elif [[ "${disk_avail}" -ge 20 ]]; then
    warn "Disk: ${disk_avail}GB available (recommended: 50GB)"
    warnings=$((warnings+1))
    pass=$((pass+1))
  else
    fail "Disk: ${disk_avail}GB available (minimum 20GB)"
  fi

  # Python (optional, for local dev)
  total=$((total+1))
  if command -v python3.11 &>/dev/null; then
    info "Python 3.11 available (for local development)"
    pass=$((pass+1))
  elif command -v python3 &>/dev/null; then
    local py_ver
    py_ver=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
    warn "Python ${py_ver} (3.11+ recommended for local dev)"
    warnings=$((warnings+1))
    pass=$((pass+1))
  else
    warn "Python not found (only needed for local development)"
    warnings=$((warnings+1))
    pass=$((pass+1))
  fi

  # Node.js (optional, for local dev)
  total=$((total+1))
  if command -v node &>/dev/null; then
    local node_ver
    node_ver=$(node --version | tr -d 'v')
    local node_major
    node_major=$(echo "${node_ver}" | cut -d. -f1)
    if [[ "${node_major}" -ge 20 ]]; then
      info "Node.js ${node_ver}"
      pass=$((pass+1))
    else
      warn "Node.js ${node_ver} (20+ recommended)"
      warnings=$((warnings+1))
      pass=$((pass+1))
    fi
  else
    warn "Node.js not found (only needed for local development)"
    warnings=$((warnings+1))
    pass=$((pass+1))
  fi

  # curl
  total=$((total+1))
  if command -v curl &>/dev/null; then
    info "curl available"
    pass=$((pass+1))
  else
    fail "curl not installed (required for health checks)"
  fi

  # git
  total=$((total+1))
  if command -v git &>/dev/null; then
    info "git available"
    pass=$((pass+1))
  else
    warn "git not found (recommended for updates)"
    warnings=$((warnings+1))
    pass=$((pass+1))
  fi

  echo ""
  if [[ "${pass}" -eq "${total}" ]]; then
    if [[ "${warnings}" -gt 0 ]]; then
      echo -e "  ${BOLD}Result:${NC} ${GREEN}${pass}/${total} passed${NC} (${YELLOW}${warnings} warnings${NC})"
    else
      echo -e "  ${BOLD}Result:${NC} ${GREEN}${pass}/${total} passed${NC}"
    fi
    return 0
  else
    echo -e "  ${BOLD}Result:${NC} ${RED}${pass}/${total} passed${NC} — fix required items before deploying"
    return 1
  fi
}

# ============================================================================
# Environment configuration wizard
# ============================================================================
env_setup() {
  section "Environment Configuration"
  echo -e "  This wizard configures ${BOLD}Engram-Platform/.env${NC}."
  echo -e "  Press Enter to accept defaults. Existing values are preserved."

  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${ENV_EXAMPLE}" ]]; then
      cp "${ENV_EXAMPLE}" "${ENV_FILE}"
      info "Created .env from .env.example"
    else
      touch "${ENV_FILE}"
      warn "No .env.example found, starting with empty .env"
    fi
  else
    info "Using existing .env (values preserved)"
  fi

  # Step 1: Authentication
  subsection "Step 1/6: Authentication"
  hint "Clerk provides user authentication for the dashboard."
  hint "Get keys at https://dashboard.clerk.com"
  prompt_value "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "Clerk publishable key (pk_live_... or pk_test_...)" "" "false" ""
  prompt_value "CLERK_SECRET_KEY" "Clerk secret key" "" "true" ""
  local jwt_default
  jwt_default=$(generate_secret)
  prompt_value "JWT_SECRET" "JWT secret (min 32 chars)" "${jwt_default}" "true" "Used for Memory API authentication tokens"

  # Step 2: Embedding Provider
  subsection "Step 2/6: Embedding Provider"
  hint "Embeddings convert text to vectors for semantic search."
  hint "Options: deepinfra (cloud, fast), openai (cloud), ollama (local GPU), nomic (local CPU), local (mock)"
  prompt_value "EMBEDDING_PROVIDER" "Embedding provider" "deepinfra" "false" ""

  local current_provider
  current_provider=$(env_get "EMBEDDING_PROVIDER")

  case "${current_provider}" in
    deepinfra)
      prompt_value "DEEPINFRA_API_KEY" "DeepInfra API key" "" "true" "Get key at https://deepinfra.com/dash/api_keys"
      prompt_value "EMBEDDING_MODEL" "Embedding model" "BAAI/bge-en-icl" "false" ""
      prompt_value "EMBEDDING_DIMENSIONS" "Embedding dimensions" "1024" "false" ""
      ;;
    openai)
      prompt_value "OPENAI_API_KEY" "OpenAI API key" "" "true" "Get key at https://platform.openai.com/api-keys"
      prompt_value "EMBEDDING_MODEL" "Embedding model" "text-embedding-3-small" "false" ""
      prompt_value "EMBEDDING_DIMENSIONS" "Embedding dimensions" "1536" "false" ""
      ;;
    ollama)
      prompt_value "OLLAMA_HOST" "Ollama host URL" "http://host.docker.internal:11434" "false" "Docker host bridge for local Ollama"
      prompt_value "EMBEDDING_MODEL" "Ollama embedding model" "nomic-embed-text:v1.5" "false" ""
      prompt_value "EMBEDDING_DIMENSIONS" "Embedding dimensions" "768" "false" ""
      ;;
    nomic)
      prompt_value "EMBEDDING_DIMENSIONS" "Embedding dimensions" "768" "false" ""
      hint "nomic-embed-text-v1.5 runs locally on CPU (no API key needed)"
      ;;
    *)
      hint "Using mock/local embeddings (no API key needed)"
      ;;
  esac

  # Step 3: LLM Provider
  subsection "Step 3/6: LLM Provider (Memory Maintenance)"
  hint "Used for summarization, entity extraction, contradiction detection."
  prompt_value "LLM_PROVIDER" "LLM provider (ollama|deepinfra|openai|local)" "ollama" "false" ""

  local current_llm
  current_llm=$(env_get "LLM_PROVIDER")

  case "${current_llm}" in
    ollama)
      prompt_value "OLLAMA_HOST" "Ollama host URL" "http://host.docker.internal:11434" "false" ""
      prompt_value "OLLAMA_MAINTENANCE_MODEL" "Summarization model" "liquid/lfm2.5:1.2b" "false" "Light model for memory maintenance tasks"
      prompt_value "OLLAMA_CLASSIFIER_MODEL" "Classification model" "qwen2.5:0.5b-instruct" "false" ""
      hint "Pull models: ollama pull liquid/lfm2.5:1.2b && ollama pull qwen2.5:0.5b-instruct"
      ;;
    deepinfra)
      prompt_value "DEEPINFRA_API_KEY" "DeepInfra API key (if not already set)" "" "true" ""
      prompt_value "DEEPINFRA_CHAT_MODEL" "DeepInfra chat model" "meta-llama/Meta-Llama-3.1-8B-Instruct" "false" ""
      ;;
    openai)
      prompt_value "OPENAI_API_KEY" "OpenAI API key (if not already set)" "" "true" ""
      prompt_value "LLM_MODEL" "OpenAI model" "gpt-4o-mini" "false" ""
      ;;
  esac

  # Step 4: LM Studio
  subsection "Step 4/6: LM Studio (Crawler AI / RAG Chat)"
  hint "LM Studio provides local LLM for OSINT analysis and RAG chat."
  hint "Default: http://host.docker.internal:1234/v1 (Docker host bridge)"
  hint "Recommended models for 16GB RAM:"
  hint "  RAG/Chat:   meta-llama-3.1-8b-instruct (Q4_K_M, ~5GB)"
  hint "  Extraction: qwen2.5-3b-instruct (Q4_K_M, ~2GB)"
  prompt_value "LM_STUDIO_URL" "LM Studio API URL" "http://host.docker.internal:1234/v1" "false" ""

  # Step 5: Network
  subsection "Step 5/6: Network & Tailscale"
  hint "Engram uses Tailscale for secure access. Never use 0.0.0.0 in production."
  prompt_value "BIND_ADDRESS" "Bind address" "127.0.0.1" "false" "127.0.0.1 for local, Tailscale IP for remote access"
  prompt_value "TAILSCALE_HOSTNAME" "Tailscale MagicDNS hostname" "dv-syd-host01.icefish-discus.ts.net" "false" ""
  prompt_value "NEXT_PUBLIC_APP_URL" "Public application URL" "http://localhost:3002" "false" ""

  # Step 6: MCP & Tokens
  subsection "Step 6/6: MCP Server & API Tokens"
  local mcp_default
  mcp_default=$(generate_secret)
  prompt_value "MCP_AUTH_TOKEN" "MCP bearer token" "${mcp_default}" "true" "Authentication token for MCP tool clients"
  local mem_key_default
  mem_key_default=$(generate_secret)
  prompt_value "MEMORY_API_KEY" "Memory API key" "${mem_key_default}" "true" "API key for Memory service access"
  env_set "NEXT_PUBLIC_MEMORY_API_KEY" "$(env_get MEMORY_API_KEY)"

  echo ""
  echo -e "  ${GREEN}${BOLD}Environment configuration complete${NC}"
  echo -e "  File: ${DIM}${ENV_FILE}${NC}"
  hint "Edit manually: nano ${ENV_FILE}"
  hint "Validate:      $0 config"
}

# ============================================================================
# Environment validation
# ============================================================================
validate_env() {
  section "Environment Validation"
  local errors=0

  _check_env_nonempty() {
    local var="$1" label="${2:-$1}"
    local val
    val=$(env_get "${var}")
    if [[ -z "${val}" || "${val}" == *"your-"* || "${val}" == "..." ]]; then
      fail "${label}: missing or placeholder"
      errors=$((errors+1))
    else
      info "${label}: set"
    fi
  }

  _check_env_url() {
    local var="$1" label="${2:-$1}"
    local val
    val=$(env_get "${var}")
    if [[ -z "${val}" ]]; then
      warn "${label}: not set"
      return 0
    fi
    if [[ ! "${val}" =~ ^https?:// ]]; then
      fail "${label}: '${val}' is not a valid URL (must start with http:// or https://)"
      errors=$((errors+1))
    else
      info "${label}: valid URL"
    fi
  }

  _check_env_no_public_bind() {
    local val
    val=$(env_get "BIND_ADDRESS")
    if [[ "${val}" == "0.0.0.0" ]]; then
      fail "BIND_ADDRESS is 0.0.0.0 — publicly exposed. Use 127.0.0.1 or Tailscale IP"
      errors=$((errors+1))
    fi
  }

  _check_env_min_length() {
    local var="$1" min="$2" label="${3:-$1}"
    local val
    val=$(env_get "${var}")
    if [[ -n "${val}" && ${#val} -lt ${min} ]]; then
      fail "${label}: too short (${#val} chars, minimum ${min})"
      errors=$((errors+1))
    fi
  }

  _check_env_numeric() {
    local var="$1" label="${2:-$1}"
    local val
    val=$(env_get "${var}")
    if [[ -n "${val}" && ! "${val}" =~ ^[0-9]+$ ]]; then
      fail "${label}: '${val}' is not numeric"
      errors=$((errors+1))
    fi
  }

  _check_env_nonempty "JWT_SECRET" "JWT_SECRET"
  _check_env_min_length "JWT_SECRET" 32 "JWT_SECRET"
  _check_env_nonempty "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "Clerk publishable key"
  _check_env_nonempty "CLERK_SECRET_KEY" "Clerk secret key"
  _check_env_url "NEXT_PUBLIC_APP_URL" "App URL"
  _check_env_url "LM_STUDIO_URL" "LM Studio URL"
  _check_env_no_public_bind
  _check_env_numeric "EMBEDDING_DIMENSIONS" "Embedding dimensions"

  echo ""
  if [[ "${errors}" -gt 0 ]]; then
    echo -e "  ${RED}${BOLD}Validation failed: ${errors} error(s)${NC}"
    return 1
  else
    echo -e "  ${GREEN}${BOLD}Environment valid${NC}"
    return 0
  fi
}

# ============================================================================
# Pre-flight checks
# ============================================================================
preflight() {
  section "Pre-flight Checks"
  local pass=0 total=0

  # Docker
  total=$((total+1))
  if docker info &>/dev/null 2>&1; then
    info "Docker daemon running"
    pass=$((pass+1))
  else
    fail "Docker daemon not running"
  fi

  # Compose
  total=$((total+1))
  if docker compose version &>/dev/null 2>&1; then
    info "Docker Compose available"
    pass=$((pass+1))
  else
    fail "Docker Compose not available"
  fi

  # .env
  total=$((total+1))
  if [[ -f "${ENV_FILE}" ]]; then
    info "Environment file exists"
    pass=$((pass+1))
  else
    fail "No .env file — run: $0 setup"
  fi

  # Required secrets
  total=$((total+1))
  local missing_vars=()
  for var in JWT_SECRET NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY; do
    local val
    val=$(env_get "${var}")
    if [[ -z "${val}" || "${val}" == *"your-"* || "${val}" == *"..."* ]]; then
      missing_vars+=("${var}")
    fi
  done

  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    fail "Missing or placeholder: ${missing_vars[*]}"
  else
    info "Required secrets configured"
    pass=$((pass+1))
  fi

  # Compose config
  total=$((total+1))
  if docker compose -f "${COMPOSE_FILE}" config --quiet 2>/dev/null; then
    info "Compose config valid"
    pass=$((pass+1))
  else
    warn "Compose config has warnings"
    pass=$((pass+1))
  fi

  # Disk space
  total=$((total+1))
  local disk_avail
  if [[ "$(uname)" == "Darwin" ]]; then
    disk_avail=$(df -g "${ROOT_DIR}" | tail -1 | awk '{print $4}')
  else
    disk_avail=$(df -BG "${ROOT_DIR}" | tail -1 | awk '{print $4}' | tr -d 'G')
  fi
  if [[ "${disk_avail}" -ge 10 ]]; then
    info "Disk: ${disk_avail}GB available"
    pass=$((pass+1))
  else
    fail "Disk: only ${disk_avail}GB available (need 10GB+)"
  fi

  echo ""
  if [[ "${pass}" -eq "${total}" ]]; then
    echo -e "  ${GREEN}${BOLD}Pre-flight: ${pass}/${total} passed${NC}"
    return 0
  else
    echo -e "  ${RED}${BOLD}Pre-flight: ${pass}/${total} passed${NC}"
    return 1
  fi
}

# ============================================================================
# Health checks
# ============================================================================
check_service() {
  local name="$1" method="$2" target="$3"
  local status="fail" detail=""

  case "${method}" in
    http)
      local code
      code=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 "${target}" 2>/dev/null || echo "000")
      if [[ "${code}" =~ ^2 ]]; then
        status="ok"; detail="HTTP ${code}"
      elif [[ "${code}" == "000" ]]; then
        status="fail"; detail="unreachable"
      else
        status="warn"; detail="HTTP ${code}"
      fi
      ;;
    redis)
      if docker exec "${target}" redis-cli ping 2>/dev/null | grep -q PONG; then
        status="ok"; detail="PONG"
      else
        status="fail"; detail="no response"
      fi
      ;;
    container)
      local health
      health=$(docker inspect --format='{{.State.Health.Status}}' "${target}" 2>/dev/null || echo "none")
      if [[ "${health}" == "healthy" ]]; then
        status="ok"; detail="healthy"
      elif [[ "${health}" == "starting" ]]; then
        status="warn"; detail="starting"
      else
        status="fail"; detail="${health}"
      fi
      ;;
  esac

  if [[ "${JSON_OUTPUT}" == true ]]; then
    printf '{"service":"%s","status":"%s","detail":"%s"}\n' "${name}" "${status}" "${detail}"
  else
    case "${status}" in
      ok)   info "${name} ${DIM}(${detail})${NC}" ;;
      warn) warn "${name} ${DIM}(${detail})${NC}" ;;
      fail) fail "${name} ${DIM}(${detail})${NC}" ;;
    esac
  fi

  _log_raw "HEALTH: ${name} ${status} ${detail}"
  [[ "${status}" == "ok" ]]
}

health_check() {
  section "Service Health"

  local healthy=0 total=0

  local http_endpoints=(
    "Memory API|http://localhost:8000/health"
    "Crawler API|http://localhost:11235/"
    "MCP Server|http://localhost:3000/health"
    "Weaviate|http://localhost:8080/v1/.well-known/ready"
    "Platform|http://localhost:3002"
  )

  for entry in "${http_endpoints[@]}"; do
    local name="${entry%%|*}"
    local url="${entry##*|}"
    total=$((total+1))
    check_service "${name}" http "${url}" && healthy=$((healthy+1)) || true
  done

  for redis_name in "crawler-redis" "memory-redis"; do
    total=$((total+1))
    check_service "Redis (${redis_name})" redis "engram-${redis_name}" && healthy=$((healthy+1)) || true
  done

  echo ""
  if [[ "${healthy}" -eq "${total}" ]]; then
    echo -e "  ${GREEN}${BOLD}All ${total} services healthy${NC}"
  elif [[ "${healthy}" -gt 0 ]]; then
    echo -e "  ${YELLOW}${BOLD}${healthy}/${total} services healthy${NC}"
  else
    echo -e "  ${RED}${BOLD}All services offline${NC}"
  fi

  echo ""
  echo -e "  ${BOLD}Container Status:${NC}"
  docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
    | while IFS= read -r line; do echo "  ${line}"; done

  [[ "${healthy}" -eq "${total}" ]]
}

# ============================================================================
# Service status dashboard (compact)
# ============================================================================
status_dashboard() {
  section "System Status"

  # Container overview
  local running stopped total_c
  running=$(docker compose -f "${COMPOSE_FILE}" ps --filter "status=running" -q 2>/dev/null | wc -l | tr -d ' ')
  total_c=$(docker compose -f "${COMPOSE_FILE}" ps -q 2>/dev/null | wc -l | tr -d ' ')
  stopped=$((total_c - running))

  echo -e "  ${BOLD}Containers:${NC}  ${GREEN}${running} running${NC}  ${RED}${stopped} stopped${NC}  ${DIM}(${total_c} total)${NC}"

  # Resource usage
  echo -e "\n  ${BOLD}Resource Usage:${NC}"
  docker stats --no-stream --format "  {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null \
    | column -t -s $'\t' \
    | while IFS= read -r line; do echo "  ${line}"; done

  # Disk volumes
  echo -e "\n  ${BOLD}Volume Usage:${NC}"
  docker system df -v 2>/dev/null | grep -E "^engram|^VOLUME" | head -15 \
    | while IFS= read -r line; do echo "  ${line}"; done
}

# ============================================================================
# Maintenance operations
# ============================================================================
maintenance_menu() {
  section "Maintenance Operations"

  local choice
  choice=$(choose "Select maintenance action:" \
    "Memory Decay — recalculate relevance scores" \
    "Memory Consolidate — merge duplicate memories" \
    "Memory Cleanup — remove expired memories" \
    "Confidence Maintenance — update confidence scores" \
    "Docker Prune — remove unused images/volumes" \
    "Log Rotation — truncate container logs" \
    "Back to main menu")

  case "${choice}" in
    1) run_maintenance "decay" ;;
    2) run_maintenance "consolidate" ;;
    3) run_maintenance "cleanup" ;;
    4) run_maintenance "confidence-maintenance" ;;
    5) docker_prune ;;
    6) log_rotate ;;
    7) return 0 ;;
    *) warn "Invalid selection" ;;
  esac
}

run_maintenance() {
  local action="$1"
  step "Running ${action}..."

  local api_key
  api_key=$(env_get "MEMORY_API_KEY")

  local url="http://localhost:8000/memories/${action}"
  local response
  local -a curl_args=(-sf --max-time 60 -X POST)
  if [[ -n "${api_key}" ]]; then
    curl_args+=(-H "Authorization: Bearer ${api_key}")
  fi
  if response=$(curl "${curl_args[@]}" "${url}" 2>&1); then
    info "${action} completed"
    echo -e "  ${DIM}${response}${NC}"
  else
    fail "${action} failed — is Memory API running?"
    hint "Check: $0 health"
  fi
}

docker_prune() {
  if [[ "${DRY_RUN}" == true ]]; then
    step "Docker prune preview (dry-run):"
    echo -e "  ${DIM}Images that would be removed:${NC}"
    docker image ls --filter "dangling=true" --format "  {{.Repository}}:{{.Tag}} ({{.Size}})" 2>/dev/null || true
    echo -e "  ${DIM}Build cache size:${NC}"
    docker builder du --verbose 2>/dev/null | tail -1 || true
    return 0
  fi
  if confirm "Remove unused Docker images and build cache?"; then
    step "Pruning Docker resources..."
    run_cmd docker image prune -af --filter "until=168h" 2>/dev/null
    run_cmd docker builder prune -af --filter "until=168h" 2>/dev/null || true
    info "Docker prune complete"
  fi
}

log_rotate() {
  step "Truncating container logs..."
  local log_dir="/var/lib/docker/containers"
  if [[ -d "${log_dir}" ]]; then
    sudo find "${log_dir}" -name "*-json.log" -size +50M -exec truncate -s 10M {} \; 2>/dev/null || true
    info "Logs truncated (files > 50MB reduced to 10MB)"
  else
    warn "Docker log directory not accessible (may need sudo)"
  fi
}

# ============================================================================
# Backup operations
# ============================================================================
backup_menu() {
  section "Backup Operations"

  local choice
  choice=$(choose "Select backup action:" \
    "Quick Backup — Redis snapshots + Weaviate schema" \
    "Full Backup — all volumes + config + images" \
    "List Backups" \
    "Back to main menu")

  case "${choice}" in
    1) quick_backup ;;
    2) full_backup ;;
    3) list_backups ;;
    4) return 0 ;;
    *) warn "Invalid selection" ;;
  esac
}

_write_backup_metadata() {
  local dest="$1" type="$2"
  local git_commit="unknown" git_branch="unknown"
  git_commit=$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  git_branch=$(git -C "${ROOT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

  cat > "${dest}/backup.json" <<EOFMETA
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "type": "${type}",
  "script_version": "${VERSION}",
  "git_commit": "${git_commit}",
  "git_branch": "${git_branch}",
  "hostname": "$(hostname)",
  "compose_file": "${COMPOSE_FILE}"
}
EOFMETA
}

quick_backup() {
  local ts
  ts=$(date +%Y%m%d-%H%M%S)
  local dest="${BACKUP_DIR}/quick-${ts}"
  mkdir -p "${dest}"

  step "Backing up Redis snapshots..."
  docker exec engram-memory-redis redis-cli BGSAVE 2>/dev/null || true
  docker exec engram-crawler-redis redis-cli BGSAVE 2>/dev/null || true
  sleep 2
  docker cp engram-memory-redis:/data/dump.rdb "${dest}/memory-redis.rdb" 2>/dev/null || warn "Memory Redis backup failed"
  docker cp engram-crawler-redis:/data/dump.rdb "${dest}/crawler-redis.rdb" 2>/dev/null || warn "Crawler Redis backup failed"

  step "Backing up Weaviate schema..."
  curl -sf http://localhost:8080/v1/schema > "${dest}/weaviate-schema.json" 2>/dev/null || warn "Weaviate schema backup failed"

  step "Backing up environment..."
  cp "${ENV_FILE}" "${dest}/.env" 2>/dev/null || true

  _write_backup_metadata "${dest}" "quick"

  local size
  size=$(du -sh "${dest}" 2>/dev/null | cut -f1)
  info "Quick backup complete: ${dest} (${size})"
}

full_backup() {
  local ts
  ts=$(date +%Y%m%d-%H%M%S)
  local dest="${BACKUP_DIR}/full-${ts}"
  mkdir -p "${dest}"

  step "This may take several minutes..."

  quick_backup

  step "Backing up Docker volumes..."
  for vol in weaviate_data memory_redis_data crawler_redis_data; do
    local full_vol
    full_vol=$(docker volume ls -q | grep "${vol}" | head -1)
    if [[ -n "${full_vol}" ]]; then
      docker run --rm -v "${full_vol}:/data" -v "${dest}:/backup" alpine \
        tar -czf "/backup/${vol}.tar.gz" -C /data . 2>/dev/null || warn "Volume ${vol} backup failed"
    fi
  done

  _write_backup_metadata "${dest}" "full"

  local size
  size=$(du -sh "${dest}" 2>/dev/null | cut -f1)
  info "Full backup complete: ${dest} (${size})"
}

list_backups() {
  if [[ -d "${BACKUP_DIR}" ]] && [[ -n "$(ls -A "${BACKUP_DIR}" 2>/dev/null)" ]]; then
    echo -e "\n  ${BOLD}Available Backups:${NC}"
    ls -lt "${BACKUP_DIR}" | tail -n +2 | while IFS= read -r line; do echo "  ${line}"; done
  else
    warn "No backups found in ${BACKUP_DIR}"
  fi
}

# ============================================================================
# Service control
# ============================================================================
service_control() {
  section "Service Control"

  local services=("all" "memory-api" "crawler-api" "mcp-server" "weaviate" "crawler-redis" "memory-redis" "platform-frontend" "nginx")

  local svc_choice
  svc_choice=$(choose "Select service:" "${services[@]}")
  local target="${services[$((svc_choice-1))]}"

  local action_choice
  action_choice=$(choose "Action for ${target}:" "Start" "Stop" "Restart" "Logs (tail 50)" "Cancel")

  case "${action_choice}" in
    1)
      if [[ "${target}" == "all" ]]; then
        docker compose -f "${COMPOSE_FILE}" up -d
      else
        docker compose -f "${COMPOSE_FILE}" up -d "${target}"
      fi
      info "${target} started"
      ;;
    2)
      if [[ "${target}" == "all" ]]; then
        docker compose -f "${COMPOSE_FILE}" down
      else
        docker compose -f "${COMPOSE_FILE}" stop "${target}"
      fi
      info "${target} stopped"
      ;;
    3)
      if [[ "${target}" == "all" ]]; then
        docker compose -f "${COMPOSE_FILE}" restart
      else
        docker compose -f "${COMPOSE_FILE}" restart "${target}"
      fi
      info "${target} restarted"
      ;;
    4)
      if [[ "${target}" == "all" ]]; then
        docker compose -f "${COMPOSE_FILE}" logs --tail=50
      else
        docker compose -f "${COMPOSE_FILE}" logs --tail=50 "${target}"
      fi
      ;;
    5) return 0 ;;
  esac
}

# ============================================================================
# Deploy
# ============================================================================
do_deploy() {
  local dry_run=false profiles=""
  for arg in "$@"; do
    case "${arg}" in
      --dry-run) dry_run=true ;;
      --monitoring) profiles="${profiles} --profile monitoring" ;;
      --releases) profiles="${profiles} --profile releases" ;;
      --full) profiles="${profiles} --profile monitoring --profile releases" ;;
    esac
  done

  preflight || {
    warn "Pre-flight failed. Run: $0 setup"
    exit 1
  }

  section "Deploying Engram Stack"

  if [[ "${dry_run}" == true ]]; then
    warn "Dry-run mode — no changes will be made"
    docker compose -f "${COMPOSE_FILE}" ${profiles} config --quiet
    info "Compose config validated"
    info "Dry-run complete"
    return 0
  fi

  step "Pulling images..."
  docker compose -f "${COMPOSE_FILE}" ${profiles} pull --ignore-pull-failures 2>/dev/null || true

  step "Building and starting services..."
  docker compose -f "${COMPOSE_FILE}" ${profiles} up -d --build --remove-orphans

  echo ""
  step "Waiting for services to start..."
  local wait_secs=20
  for ((i=1; i<=wait_secs; i++)); do
    progress_bar "${i}" "${wait_secs}" 30 "warming up..."
    sleep 1
  done

  health_check || warn "Some services still starting — recheck with: $0 health"
}

# ============================================================================
# First-time init
# ============================================================================
do_init() {
  banner

  echo -e "  ${BOLD}Welcome to the Engram Platform installer.${NC}"
  echo -e "  This will check your system, configure the environment,"
  echo -e "  build all services, and verify everything is healthy."
  echo ""

  if ! confirm "Ready to begin?" "y"; then
    echo -e "\n  ${DIM}Cancelled. Run again when ready.${NC}"
    exit 0
  fi

  ensure_dirs

  # Step 1: Requirements
  check_requirements || {
    echo ""
    if ! confirm "Continue despite failures?" "n"; then
      exit 1
    fi
  }

  # Step 2: Environment
  env_setup

  # Step 3: Pre-flight
  preflight || {
    warn "Pre-flight issues detected. Review above and fix before deploying."
    if ! confirm "Attempt deploy anyway?" "n"; then
      exit 1
    fi
  }

  # Step 4: Build and start
  section "Building & Starting Services"
  step "This may take 5-15 minutes on first run..."
  echo ""

  docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans 2>&1 | while IFS= read -r line; do
    echo -e "  ${DIM}${line}${NC}"
  done

  echo ""
  step "Waiting for services to initialize..."
  local wait_secs=25
  for ((i=1; i<=wait_secs; i++)); do
    progress_bar "${i}" "${wait_secs}" 30 ""
    sleep 1
  done

  # Step 5: Health
  health_check || true

  # Summary
  section "Setup Complete"

  local app_url
  app_url=$(env_get "NEXT_PUBLIC_APP_URL")
  app_url="${app_url:-http://localhost:3002}"

  echo -e "  ${GREEN}${BOLD}Engram is running!${NC}"
  echo ""
  echo -e "  ${BOLD}Services:${NC}"
  echo -e "    Dashboard:   ${CYAN}${app_url}${NC}"
  echo -e "    Memory API:  ${CYAN}http://localhost:8000${NC}"
  echo -e "    Crawler API: ${CYAN}http://localhost:11235${NC}"
  echo -e "    MCP Server:  ${CYAN}http://localhost:3000${NC}"
  echo -e "    Weaviate:    ${CYAN}http://localhost:8080${NC}"
  echo ""
  echo -e "  ${BOLD}Next steps:${NC}"
  echo -e "    ${DIM}$0${NC}                  ${ARROW} Interactive management console"
  echo -e "    ${DIM}$0 health${NC}           ${ARROW} Verify all services"
  echo -e "    ${DIM}$0 logs${NC}             ${ARROW} Watch service output"
  echo -e "    ${DIM}$0 status${NC}           ${ARROW} Resource usage dashboard"
  echo ""
}

# ============================================================================
# Interactive menu
# ============================================================================
interactive_menu() {
  while true; do
    banner

    echo -e "  ${BOLD}Quick Status:${NC}"
    local running
    running=$(docker compose -f "${COMPOSE_FILE}" ps --filter "status=running" -q 2>/dev/null | wc -l | tr -d ' ')
    local total_c
    total_c=$(docker compose -f "${COMPOSE_FILE}" ps -q 2>/dev/null | wc -l | tr -d ' ')

    if [[ "${running}" -gt 0 ]]; then
      echo -e "    ${GREEN}●${NC} ${running}/${total_c} services running"
    elif [[ "${total_c}" -gt 0 ]]; then
      echo -e "    ${RED}●${NC} Stack stopped (${total_c} containers)"
    else
      echo -e "    ${DIM}●${NC} No containers found"
    fi

    echo ""
    echo -e "  ${BOLD}━━━ Setup & Deploy ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "    ${BOLD}1)${NC}  First-Time Install        ${DIM}Full guided setup${NC}"
    echo -e "    ${BOLD}2)${NC}  Configure Environment      ${DIM}Edit .env interactively${NC}"
    echo -e "    ${BOLD}3)${NC}  Deploy / Update Stack       ${DIM}Build, start, verify${NC}"
    echo -e "    ${BOLD}4)${NC}  Deploy (Dry Run)            ${DIM}Validate without changes${NC}"
    echo ""
    echo -e "  ${BOLD}━━━ Monitor & Manage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "    ${BOLD}5)${NC}  Health Check                ${DIM}Test all service endpoints${NC}"
    echo -e "    ${BOLD}6)${NC}  System Status               ${DIM}Resources, containers, volumes${NC}"
    echo -e "    ${BOLD}7)${NC}  Service Control             ${DIM}Start/stop/restart services${NC}"
    echo -e "    ${BOLD}8)${NC}  View Logs                   ${DIM}Tail service output${NC}"
    echo ""
    echo -e "  ${BOLD}━━━ Maintain & Protect ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "    ${BOLD}9)${NC}  Maintenance                 ${DIM}Decay, consolidate, cleanup${NC}"
    echo -e "   ${BOLD}10)${NC}  Backup                      ${DIM}Quick or full backup${NC}"
    echo -e "   ${BOLD}11)${NC}  System Requirements          ${DIM}Check prerequisites${NC}"
    echo ""
    echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "   ${BOLD}12)${NC}  Stop Stack                  ${DIM}docker compose down${NC}"
    echo -e "    ${BOLD}q)${NC}  Quit"
    echo ""
    printf "  ${CYAN}>${NC} "
    read -r menu_choice

    case "${menu_choice}" in
      1)  do_init ;;
      2)  env_setup ;;
      3)  do_deploy ;;
      4)  do_deploy --dry-run ;;
      5)  health_check || true ;;
      6)  status_dashboard ;;
      7)  service_control ;;
      8)
        local svc=""
        printf "  ${CYAN}?${NC} Service name (blank for all): "
        read -r svc
        docker compose -f "${COMPOSE_FILE}" logs -f --tail=50 ${svc}
        ;;
      9)  maintenance_menu ;;
      10) backup_menu ;;
      11) check_requirements || true ;;
      12)
        if confirm "Stop all Engram services?" "n"; then
          docker compose -f "${COMPOSE_FILE}" down
          info "Stack stopped"
        fi
        ;;
      q|Q|quit|exit)
        echo -e "\n  ${DIM}Goodbye.${NC}\n"
        exit 0
        ;;
      "")
        continue
        ;;
      *)
        warn "Invalid option: ${menu_choice}"
        sleep 1
        ;;
    esac

    echo ""
    echo -e "  ${DIM}Press Enter to return to menu...${NC}"
    read -r
  done
}

# ============================================================================
# Usage / help
# ============================================================================
usage() {
  cat <<EOF

${BOLD}Engram Unified Deployment Console v${VERSION}${NC}

Usage: ./scripts/deploy-unified.sh [options] [command] [args...]
       ./scripts/deploy-unified.sh              ${DIM}(interactive menu)${NC}

${BOLD}Global Options:${NC}
  --auto                    Non-interactive mode (accept all defaults)
  --env-file <path>         Use alternate .env file
  --verbose                 Verbose output
  --json                    Machine-readable JSON output (health only)
  --dry-run                 Preview without changes (deploy, prune)

${BOLD}Setup:${NC}
  init                      Full first-time guided install
  setup                     Interactive environment configuration
  requirements              Check system prerequisites
  validate                  Validate .env against schema rules

${BOLD}Lifecycle:${NC}
  up [args]                 Build and start the stack
  down [args]               Stop the stack
  restart [service]         Restart all or one service
  ps                        Show container status
  logs [service]            Tail logs (all or one service)
  config                    Validate compose config
  pull                      Pull latest images

${BOLD}Deployment:${NC}
  deploy [--dry-run]        Production deploy with pre-flight checks
         [--monitoring]     Include Prometheus/Grafana stack
         [--releases]       Include MinIO release store
         [--full]           Include all optional services

${BOLD}Monitoring:${NC}
  health                    Test all service health endpoints
  status                    Resource usage dashboard (CPU/mem/net)

${BOLD}Maintenance:${NC}
  maintenance <action>      Run: decay, consolidate, cleanup, confidence-maintenance
  backup [quick|full]       Create backup (default: quick)
  prune                     Remove unused Docker resources

${BOLD}Legacy Delegation:${NC}
  deploy:production         Full production deploy
  deploy:devnode            Devnode-optimized deploy
  deploy:memory             Memory system deploy

${BOLD}Examples:${NC}
  ${DIM}# Interactive management console${NC}
  ./scripts/deploy-unified.sh

  ${DIM}# First-time setup on a fresh machine${NC}
  ./scripts/deploy-unified.sh init

  ${DIM}# Non-interactive deploy in CI pipeline${NC}
  ./scripts/deploy-unified.sh --auto deploy

  ${DIM}# Deploy with monitoring stack${NC}
  ./scripts/deploy-unified.sh deploy --monitoring

  ${DIM}# Quick backup before update${NC}
  ./scripts/deploy-unified.sh backup quick

  ${DIM}# Health check with JSON output for CI${NC}
  ./scripts/deploy-unified.sh --json health

  ${DIM}# Validate environment before deploy${NC}
  ./scripts/deploy-unified.sh validate

  ${DIM}# Check everything is healthy${NC}
  ./scripts/deploy-unified.sh health

EOF
}

# ============================================================================
# Legacy delegation
# ============================================================================
delegate() {
  local script="$1"; shift
  if [[ ! -f "${script}" ]]; then
    fail "Script not found: ${script}" >&2; exit 1
  fi
  if [[ ! -x "${script}" ]]; then
    chmod +x "${script}"
  fi
  exec "${script}" "$@"
}

# ============================================================================
# Main entry point
# ============================================================================

# Parse global flags before the command
while [[ ${#} -gt 0 ]]; do
  case "${1}" in
    --auto)       AUTO_MODE=true; shift ;;
    --verbose)    VERBOSE=true; shift ;;
    --json)       JSON_OUTPUT=true; shift ;;
    --dry-run)    DRY_RUN=true; shift ;;
    --env-file)
      shift
      [[ ${#} -eq 0 ]] && die "--env-file requires a path argument"
      ENV_FILE_OVERRIDE="$1"; shift
      ;;
    *)            break ;;
  esac
done

if [[ -n "${ENV_FILE_OVERRIDE}" ]]; then
  if [[ ! -f "${ENV_FILE_OVERRIDE}" ]]; then
    die "Env file not found: ${ENV_FILE_OVERRIDE}"
  fi
  cp "${ENV_FILE_OVERRIDE}" "${ENV_FILE}"
fi

ensure_dirs

command="${1:-}"
shift 2>/dev/null || true

case "${command}" in
  # Setup
  init)           do_init ;;
  setup)          env_setup ;;
  requirements)   check_requirements ;;
  validate)       validate_env ;;

  # Lifecycle
  up)             run_cmd docker compose -f "${COMPOSE_FILE}" up -d --build "$@" ;;
  down)           run_cmd docker compose -f "${COMPOSE_FILE}" down "$@" ;;
  restart)        run_cmd docker compose -f "${COMPOSE_FILE}" restart "$@" ;;
  ps)             docker compose -f "${COMPOSE_FILE}" ps "$@" ;;
  logs)           docker compose -f "${COMPOSE_FILE}" logs -f "$@" ;;
  config)         docker compose -f "${COMPOSE_FILE}" config "$@" ;;
  pull)           run_cmd docker compose -f "${COMPOSE_FILE}" pull "$@" ;;

  # Deployment
  deploy)         do_deploy "$@" ;;

  # Monitoring
  health)         health_check ;;
  status)         status_dashboard ;;

  # Maintenance
  maintenance)
    action="${1:-}"
    if [[ -z "${action}" ]]; then
      maintenance_menu
    else
      run_maintenance "${action}"
    fi
    ;;
  backup)
    mode="${1:-quick}"
    case "${mode}" in
      quick) quick_backup ;;
      full)  full_backup ;;
      list)  list_backups ;;
      *)     warn "Unknown backup mode: ${mode}. Use: quick, full, list" ;;
    esac
    ;;
  prune)          docker_prune ;;

  # Legacy delegation
  deploy:production)  delegate "${ROOT_DIR}/Engram-Platform/scripts/deploy-production.sh" "$@" ;;
  deploy:devnode)     delegate "${ROOT_DIR}/Engram-Platform/scripts/deploy-devnode.sh" "$@" ;;
  deploy:memory)      delegate "${ROOT_DIR}/Engram-AiMemory/scripts/deploy-full.sh" "$@" ;;

  # Help
  -h|--help|help) usage ;;

  # Interactive menu (no command)
  "")             interactive_menu ;;

  *)
    die "Unknown command: ${command}. Run '$0 --help' for usage."
    ;;
esac
