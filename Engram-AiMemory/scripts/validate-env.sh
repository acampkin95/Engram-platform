#!/usr/bin/env bash
# validate-env.sh — Validate required environment variables before deployment
# Usage: source .env && bash scripts/validate-env.sh
set -euo pipefail

ERRORS=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

check_required() {
  local var_name="$1"
  local description="$2"
  if [[ -z "${!var_name:-}" ]]; then
    echo "❌ MISSING: $var_name — $description"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ $var_name"
  fi
}

check_not_default() {
  local var_name="$1"
  local default_value="$2"
  local description="$3"
  local value="${!var_name:-}"
  if [[ -z "$value" ]]; then
    echo "❌ MISSING: $var_name — $description"
    ERRORS=$((ERRORS + 1))
  elif [[ "$value" == "$default_value" ]]; then
    echo "❌ DEFAULT VALUE: $var_name is still set to the default '$default_value' — $description"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ $var_name"
  fi
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

echo "=== AI Memory System Environment Validation ==="
echo ""

echo "--- Security ---"
check_required "JWT_SECRET" "JWT signing secret (generate with: openssl rand -hex 32)"
check_not_default "JWT_SECRET" "change-me-in-production" "Must be a unique random secret"

echo ""
echo "--- Weaviate ---"
check_required "WEAVIATE_URL" "Weaviate HTTP URL (e.g. http://localhost:8080)"

echo ""
echo "--- Redis ---"
check_required "REDIS_URL" "Redis connection URL (e.g. redis://localhost:6379)"

echo ""
echo "--- Dashboard ---"
check_required "NEXT_PUBLIC_API_URL" "Public URL of the API (used by browser-side Next.js code)"

echo ""
echo "--- Optional but recommended ---"
if [[ -z "${CORS_ORIGINS:-}" ]]; then
  echo "⚠️  CORS_ORIGINS not set (defaulting to localhost:3001)"
else
  echo "✅ CORS_ORIGINS"
fi

if [[ -z "${OLLAMA_HOST:-}" ]]; then
  echo "ℹ️  OLLAMA_HOST not set (AI maintenance features disabled)"
else
  echo "✅ OLLAMA_HOST"
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "⚠️  OPENAI_API_KEY not set (required if EMBEDDING_PROVIDER=openai)"
else
  echo "✅ OPENAI_API_KEY"
fi

if [[ -z "${ADMIN_PASSWORD_HASH:-}" ]]; then
  echo "⚠️  ADMIN_PASSWORD_HASH not set (dashboard login will fail)"
else
  echo "✅ ADMIN_PASSWORD_HASH"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo "❌ Validation FAILED: $ERRORS error(s) found"
  exit 1
else
  echo "✅ All required environment variables are set"
fi
