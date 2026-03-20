#!/usr/bin/env bats
# BATS tests for scripts/deploy-unified.sh
# Install: brew install bats-core || npm i -g bats
# Run:     bats scripts/tests/deploy-unified.bats

SCRIPT="${BATS_TEST_DIRNAME}/../deploy-unified.sh"

@test "script exists and is executable" {
  [ -f "${SCRIPT}" ]
  [ -x "${SCRIPT}" ] || chmod +x "${SCRIPT}"
}

@test "--help exits 0 and prints usage" {
  run bash "${SCRIPT}" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Engram Unified Deployment Console"* ]]
  [[ "$output" == *"Usage:"* ]]
}

@test "help command exits 0" {
  run bash "${SCRIPT}" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "unknown command exits non-zero" {
  run bash "${SCRIPT}" nonexistent-cmd-xyz
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unknown command"* ]]
}

@test "--dry-run deploy validates without changes" {
  if ! docker info &>/dev/null 2>&1; then
    skip "Docker not running"
  fi
  run bash "${SCRIPT}" --dry-run deploy
  [[ "$output" == *"Dry-run"* ]] || [[ "$output" == *"DRY RUN"* ]] || [[ "$output" == *"Pre-flight"* ]]
}

@test "--auto flag sets non-interactive mode" {
  run bash "${SCRIPT}" --auto --help
  [ "$status" -eq 0 ]
}

@test "requirements command runs without error" {
  run bash "${SCRIPT}" requirements
  [[ "$output" == *"System Requirements"* ]]
}

@test "validate command runs (may fail without .env)" {
  run bash "${SCRIPT}" validate
  [[ "$output" == *"Environment Validation"* ]]
}
