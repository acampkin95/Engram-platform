#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Engram v1.0 Release Smoke Test
# Run this after deploying to verify all services are healthy.
# Usage: ./scripts/release-smoke-test.sh [BASE_URL]
# Default BASE_URL: http://localhost
# =============================================================================

BASE_URL="${1:-http://localhost}"
PASS=0
FAIL=0
WARN=0

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$1"; }

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local status
  status=$(curl -k -L -fsS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expect" ]; then
    green "PASS: $name ($url) -> $status"
    PASS=$((PASS + 1))
  else
    red "FAIL: $name ($url) -> $status (expected $expect)"
    FAIL=$((FAIL + 1))
  fi
}

check_json() {
  local name="$1" url="$2" field="$3"
  local body
  body=$(curl -k -L -fsS --max-time 10 "$url" 2>/dev/null || echo '{}')
  if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$field' in d" 2>/dev/null; then
    green "PASS: $name ($url) has '$field'"
    PASS=$((PASS + 1))
  else
    red "FAIL: $name ($url) missing '$field'"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================="
echo "  Engram Release Smoke Test"
echo "  Target: $BASE_URL"
echo "  Date:   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "============================================="
echo ""

echo "--- Service Health Endpoints ---"
check "Memory API health"    "$BASE_URL/api/memory/health"
check "Crawler API health"   "$BASE_URL/api/crawler/health"
check "MCP Server health"    "$BASE_URL/mcp/health"
check "Platform frontend"    "$BASE_URL/sign-in"

echo ""
echo "--- Health Response Structure ---"
check_json "Memory API status field"  "$BASE_URL/api/memory/health"  "status"
check_json "MCP Server version field" "$BASE_URL/mcp/health"  "version"

echo ""
echo "--- MCP OAuth Endpoints ---"
check "MCP OAuth metadata" "$BASE_URL/.well-known/oauth-authorization-server"

echo ""
echo "--- API Functional Checks ---"
check "Memory API docs" "$BASE_URL/api/memory/docs"
check "Crawler API docs" "$BASE_URL/api/crawler/docs"

echo ""
echo "============================================="
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "============================================="

if [ "$FAIL" -gt 0 ]; then
  red "SMOKE TEST FAILED - $FAIL check(s) did not pass"
  exit 1
else
  green "SMOKE TEST PASSED - all $PASS checks passed"
  exit 0
fi
