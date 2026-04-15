#!/usr/bin/env bash
# Engram MCP — Shell installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-org/engram-mcp/main/install.sh | bash
#   or: ./install.sh
#
# This script checks your Node.js version, installs @engram/mcp, and runs
# the interactive setup wizard (npx @engram/mcp init).

set -euo pipefail

PACKAGE="@engram/mcp"
MIN_NODE="20"

# ── Colour helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'

info()    { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✗${RESET}  $*" >&2; }
fatal()   { error "$*"; exit 1; }

# ── Check Node.js version ──────────────────────────────────────────────────
check_node() {
  if ! command -v node &>/dev/null; then
    fatal "Node.js is not installed.\n  Please install Node.js ${MIN_NODE}+ from https://nodejs.org"
  fi

  local version
  version="$(node --version | sed 's/^v//')"

  local major
  major="$(echo "$version" | cut -d. -f1)"

  if [[ "$major" -lt "$MIN_NODE" ]]; then
    fatal "Node.js ${MIN_NODE}+ required (found v${version}).\n  Please upgrade: https://nodejs.org"
  fi

  info "Node.js v${version}"
}

# ── Check npm / npx availability ──────────────────────────────────────────
check_npm() {
  if ! command -v npm &>/dev/null; then
    fatal "npm is not available. Please install Node.js ${MIN_NODE}+ from https://nodejs.org"
  fi

  if ! command -v npx &>/dev/null; then
    fatal "npx is not available. Please install Node.js ${MIN_NODE}+ from https://nodejs.org"
  fi
}

# ── Install package ────────────────────────────────────────────────────────
install_package() {
  echo "Installing ${PACKAGE}..."

  # Try global install first; fall back silently to npx-only usage
  if npm install -g "${PACKAGE}" --quiet 2>/dev/null; then
    info "${PACKAGE} installed globally"
  else
    warn "Global install skipped (may require sudo). The setup wizard will use npx."
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}🧠 Engram MCP Installer${RESET}"
  echo ""

  check_node
  check_npm
  echo ""

  install_package
  echo ""

  echo "Running interactive setup..."
  echo -e "${DIM}(This will configure your MCP client, copy hookify rules, and update CLAUDE.md)${RESET}"
  echo ""

  npx -y "${PACKAGE}" init
}

main "$@"
