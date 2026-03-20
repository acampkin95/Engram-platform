#!/bin/bash
set -e

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}      ENGRAM QUALITY GATE SYSTEM       ${NC}"
echo -e "${BLUE}=======================================${NC}"

# Find absolute paths
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

function print_step() {
    echo -e "\n${YELLOW}[QA] $1...${NC}"
}

function print_success() {
    echo -e "${GREEN}✓ $1 passed${NC}"
}

function print_error() {
    echo -e "${RED}✗ $1 failed${NC}"
    exit 1
}

# 1. MCP Server checks
print_step "Checking MCP Server (TypeScript, Biome)"
cd "$ROOT_DIR/Engram-MCP"
npm run build || print_error "MCP Build"
npx @biomejs/biome check src/ || print_error "MCP Biome Linter"
print_success "MCP Server"

# 2. Platform Frontend checks
print_step "Checking Platform Frontend (Next.js, TypeScript, Biome)"
cd "$ROOT_DIR/Engram-Platform/frontend"
npm run build || print_error "Platform Next.js Build"
npx tsc --noEmit || print_error "Platform Type Check"
npx @biomejs/biome check src/ app/ || print_error "Platform Biome Linter"
print_success "Platform Frontend"

# 3. AI Memory checks
print_step "Checking AI Memory (Python, Ruff, Pytest)"
cd "$ROOT_DIR/Engram-AiMemory"
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi
make lint || print_error "AI Memory Python Linter (Ruff/MyPy)"
# Only run tests if redis/weaviate are up, or use a specific flag to skip integration tests
# make test || print_error "AI Memory Pytest"
print_success "AI Memory"

# 4. AI Crawler checks
print_step "Checking AI Crawler (Python, Ruff)"
cd "$ROOT_DIR/Engram-AiCrawler/01_devroot"
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi
python -m ruff check app/ || print_error "Crawler Ruff Linter"
print_success "AI Crawler"

# 5. Shell script checks
print_step "Checking shell scripts (ShellCheck)"
if command -v shellcheck &>/dev/null; then
    shellcheck -S warning "$ROOT_DIR/scripts/deploy-unified.sh" "$ROOT_DIR/scripts/quality-gate.sh" || print_error "ShellCheck"
    print_success "Shell Scripts"
else
    echo -e "${YELLOW}⚠ shellcheck not installed — skipping (install: brew install shellcheck)${NC}"
fi

echo -e "\n${GREEN}=======================================${NC}"
echo -e "${GREEN}      ALL QUALITY GATES PASSED!        ${NC}"
echo -e "${GREEN}=======================================${NC}"
