#!/usr/bin/env bash
# ============================================
# Engram Platform - Interactive .env Setup
# ============================================
# Creates or fills .env from .env.example with guided prompts.
# Run: ./scripts/setup-env.sh
# Options:
#   --force    Overwrite existing .env
#   --minimal  Only prompt for required vars
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"
ENV_FILE="$PROJECT_DIR/.env"

FORCE=false
MINIMAL=false

for arg in "$@"; do
  case "$arg" in
    --force)   FORCE=true ;;
    --minimal) MINIMAL=true ;;
  esac
done

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }
header(){ echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

# ─── Preflight ────────────────────────────────────────────────────────────────

if [[ ! -f "$ENV_EXAMPLE" ]]; then
  err ".env.example not found at $ENV_EXAMPLE"
  exit 1
fi

if [[ -f "$ENV_FILE" && "$FORCE" != "true" ]]; then
  warn ".env already exists at $ENV_FILE"
  read -rp "Overwrite? (y/N): " overwrite
  if [[ "$overwrite" != "y" && "$overwrite" != "Y" ]]; then
    info "Keeping existing .env. Use --force to overwrite."
    info "Checking for missing required variables..."
    echo
    FILL_EXISTING=true
  else
    FILL_EXISTING=false
  fi
else
  FILL_EXISTING=false
fi

# ─── Copy template ───────────────────────────────────────────────────────────

if [[ "$FILL_EXISTING" != "true" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  ok "Created .env from .env.example"
fi

# ─── Helper: read current value from .env ─────────────────────────────────────

get_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- || echo ""
}

# ─── Helper: set value in .env ────────────────────────────────────────────────

set_val() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # Use a temp file for portability (macOS sed -i requires backup ext)
    local tmp
    tmp=$(mktemp)
    sed "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" > "$tmp" && mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# ─── Helper: prompt for a value ───────────────────────────────────────────────

prompt_var() {
  local key="$1"
  local description="$2"
  local default="${3:-}"
  local required="${4:-false}"
  local secret="${5:-false}"

  local current
  current=$(get_val "$key")

  # Skip if already set to a real value (not a placeholder)
  if [[ -n "$current" && "$current" != *"your-"* && "$current" != *"pk_live_..."* && "$current" != *"sk_live_..."* && "$current" != *"..."* ]]; then
    ok "$key already set"
    return
  fi

  echo -e "  ${BOLD}$key${NC}"
  echo -e "  ${description}"
  if [[ -n "$default" ]]; then
    echo -e "  Default: ${CYAN}${default}${NC}"
  fi
  if [[ "$required" == "true" ]]; then
    echo -e "  ${RED}REQUIRED${NC}"
  fi

  local prompt_text="  Value"
  if [[ -n "$default" ]]; then
    prompt_text="  Value [$default]"
  fi

  local value
  if [[ "$secret" == "true" ]]; then
    read -rsp "$prompt_text: " value
    echo
  else
    read -rp "$prompt_text: " value
  fi

  if [[ -z "$value" && -n "$default" ]]; then
    value="$default"
  fi

  if [[ -z "$value" && "$required" == "true" ]]; then
    warn "Skipped required variable $key - you must set this before deployment"
    return
  fi

  if [[ -n "$value" ]]; then
    set_val "$key" "$value"
    ok "$key set"
  fi
  echo
}

# ─── Helper: auto-generate a secret ──────────────────────────────────────────

gen_secret() {
  openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64
}

prompt_or_generate() {
  local key="$1"
  local description="$2"

  local current
  current=$(get_val "$key")

  if [[ -n "$current" && "$current" != *"your-"* && "$current" != *"min-32"* ]]; then
    ok "$key already set"
    return
  fi

  echo -e "  ${BOLD}$key${NC}"
  echo -e "  ${description}"
  read -rp "  Auto-generate? (Y/n): " autogen

  if [[ "$autogen" != "n" && "$autogen" != "N" ]]; then
    local secret
    secret=$(gen_secret)
    set_val "$key" "$secret"
    ok "$key auto-generated"
  else
    read -rsp "  Enter value: " value
    echo
    if [[ -n "$value" ]]; then
      set_val "$key" "$value"
      ok "$key set"
    else
      warn "Skipped $key"
    fi
  fi
  echo
}

# ─── Detect environment ──────────────────────────────────────────────────────

detect_environment() {
  header "Environment Detection"

  local ts_ip=""
  if command -v tailscale &>/dev/null; then
    ts_ip=$(tailscale ip -4 2>/dev/null || echo "")
  fi

  if [[ -n "$ts_ip" ]]; then
    ok "Tailscale detected: $ts_ip"
    DETECTED_BIND="$ts_ip"
  else
    warn "Tailscale not detected - using 127.0.0.1 (local only)"
    DETECTED_BIND="127.0.0.1"
  fi

  local hostname
  hostname=$(hostname 2>/dev/null || echo "localhost")
  info "Hostname: $hostname"
}

# ============================================================================
# Main setup flow
# ============================================================================

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║     Engram Platform - .env Setup         ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

detect_environment

# ─── 1. Clerk Authentication ─────────────────────────────────────────────────

header "1/7 Clerk Authentication"
info "Get keys from https://dashboard.clerk.com"
echo

prompt_var "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" \
  "Publishable key from Clerk dashboard (starts with pk_)" \
  "" "true" "false"

prompt_var "CLERK_SECRET_KEY" \
  "Secret key from Clerk dashboard (starts with sk_)" \
  "" "true" "true"

# ─── 2. Secrets ───────────────────────────────────────────────────────────────

header "2/7 Secrets"
echo

prompt_or_generate "JWT_SECRET" \
  "JWT signing secret for Memory API (min 32 chars)"

prompt_or_generate "MCP_AUTH_TOKEN" \
  "Bearer token for MCP server authentication"

# ─── 3. Embedding Provider ───────────────────────────────────────────────────

if [[ "$MINIMAL" != "true" ]]; then
  header "3/7 Embedding Provider"
  echo -e "  Options: ${CYAN}deepinfra${NC} (default), openai, ollama, nomic, local"
  echo

  prompt_var "EMBEDDING_PROVIDER" \
    "Which embedding provider to use" \
    "deepinfra" "false" "false"

  local_provider=$(get_val "EMBEDDING_PROVIDER")

  if [[ "$local_provider" == "deepinfra" ]]; then
    prompt_var "DEEPINFRA_API_KEY" \
      "DeepInfra API key for embeddings" \
      "" "true" "true"
  elif [[ "$local_provider" == "openai" ]]; then
    prompt_var "OPENAI_API_KEY" \
      "OpenAI API key for embeddings" \
      "" "true" "true"
  fi
fi

# ─── 4. Network / Tailscale ──────────────────────────────────────────────────

header "4/7 Network Configuration"
echo

prompt_var "BIND_ADDRESS" \
  "IP to bind exposed ports (use Tailscale IP for production)" \
  "$DETECTED_BIND" "true" "false"

prompt_var "NEXT_PUBLIC_APP_URL" \
  "Public URL for the application" \
  "https://memory.velocitydigi.com" "false" "false"

# ─── 5. LM Studio ────────────────────────────────────────────────────────────

if [[ "$MINIMAL" != "true" ]]; then
  header "5/7 LM Studio (Crawler AI)"
  echo

  prompt_var "LM_STUDIO_URL" \
    "LM Studio endpoint for crawler AI analysis" \
    "http://host.docker.internal:1234" "false" "false"
fi

# ─── 6. Sentry (optional) ────────────────────────────────────────────────────

if [[ "$MINIMAL" != "true" ]]; then
  header "6/7 Sentry Error Tracking (optional)"
  echo -e "  ${YELLOW}Skip these if you don't use Sentry${NC}"
  echo

  prompt_var "NEXT_PUBLIC_SENTRY_DSN" \
    "Sentry DSN for error tracking" \
    "" "false" "false"

  if [[ -n "$(get_val 'NEXT_PUBLIC_SENTRY_DSN')" ]]; then
    prompt_var "SENTRY_AUTH_TOKEN" \
      "Sentry auth token for source map uploads" \
      "" "false" "true"
    prompt_var "SENTRY_ORG" \
      "Sentry organization slug" \
      "" "false" "false"
    prompt_var "SENTRY_PROJECT" \
      "Sentry project slug" \
      "" "false" "false"
  fi
fi

# ─── 7. Summary ──────────────────────────────────────────────────────────────

header "7/7 Summary"
echo

# Check required vars
MISSING=0
for key in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY JWT_SECRET MCP_AUTH_TOKEN BIND_ADDRESS; do
  val=$(get_val "$key")
  if [[ -z "$val" || "$val" == *"your-"* || "$val" == *"..."* || "$val" == *"min-32"* ]]; then
    err "MISSING: $key"
    MISSING=$((MISSING + 1))
  else
    ok "$key"
  fi
done

# Optional vars
for key in DEEPINFRA_API_KEY NEXT_PUBLIC_SENTRY_DSN LM_STUDIO_URL; do
  val=$(get_val "$key")
  if [[ -n "$val" && "$val" != *"your-"* ]]; then
    ok "$key"
  else
    info "$key (optional, not set)"
  fi
done

echo
if [[ "$MISSING" -gt 0 ]]; then
  warn "$MISSING required variable(s) not set. Edit $ENV_FILE manually before deploying."
else
  ok "All required variables configured!"
  info "File saved: $ENV_FILE"
  echo
  echo -e "  ${BOLD}Next steps:${NC}"
  echo -e "  1. Review: ${CYAN}cat $ENV_FILE${NC}"
  echo -e "  2. Validate: ${CYAN}docker compose config --quiet${NC}"
  echo -e "  3. Deploy:  ${CYAN}./scripts/deploy-unified.sh deploy${NC}"
fi
echo
