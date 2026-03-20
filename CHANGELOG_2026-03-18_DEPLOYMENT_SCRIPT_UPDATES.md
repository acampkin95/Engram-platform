# Changelog: Deployment Script Improvements (2026-03-18)

## Summary

Hardened `scripts/deploy-unified.sh` (v2.0.0 -> v2.1.0) with safety, CI-readiness, non-interactive mode, structured health checks, env validation, backup metadata, and shell testing infrastructure.

## Changes

### scripts/deploy-unified.sh

**Script Hardening**
- Added `DEBUG=1` flag for `set -x` trace mode
- Added `die()` helper for fatal errors with log output
- Added `run_cmd()` wrapper that respects `--dry-run` and `--verbose` flags
- Added `_init_logging()` with fallback to `/tmp` when `/var/log/engram` is not writable
- Added `_log_raw()` for timestamped file logging of all operations
- Added `trap` handler for INT/TERM signals (clean interrupt message)
- Removed unused variables flagged by ShellCheck: `ITALIC`, `DOT`, box-drawing chars (`H_LINE`, `V_LINE`, `TL`, `TR`, `BL`, `BR`, `T_DOWN`, `T_UP`, `T_RIGHT`, `T_LEFT`, `CROSS_BOX`)
- Fixed SC2155: separated `readonly` declaration from assignment for `ROOT_DIR`
- Fixed unused `auth_header` in `run_maintenance()` — now uses `curl_args` array
- Version bumped to 2.1.0

**Non-Interactive Mode**
- Added `--auto` flag: skips all interactive prompts, accepts defaults
- Added `--env-file <path>` flag: load env from alternate file (CI/GitOps)
- Added `--verbose` flag: show executed commands
- Added `--json` flag: machine-readable JSON output for health checks
- `confirm()` auto-accepts defaults in `--auto` mode
- `prompt_value()` auto-applies defaults in `--auto` mode (skips if no default)

**Unified Health Check**
- New `check_service()` helper with 3 methods: `http`, `redis`, `container`
- Returns structured status (`ok`/`warn`/`fail`) with detail string
- Supports `--json` output mode for CI consumption
- All health results logged to file via `_log_raw()`
- `health_check()` refactored to use `check_service()` for all endpoints

**Environment Validation**
- New `validate` command: schema-based validation of `.env`
- `_check_env_nonempty()`: rejects empty/placeholder values
- `_check_env_url()`: validates URL format (must start with `http://` or `https://`)
- `_check_env_no_public_bind()`: rejects `BIND_ADDRESS=0.0.0.0` (security)
- `_check_env_min_length()`: enforces minimum string length (JWT_SECRET >= 32 chars)
- `_check_env_numeric()`: validates numeric-only fields (EMBEDDING_DIMENSIONS)

**Backup Metadata**
- New `_write_backup_metadata()` writes `backup.json` alongside every backup
- Includes: timestamp, backup type, script version, git commit, git branch, hostname, compose file
- Applied to both `quick_backup` and `full_backup`

**Maintenance Dry-Run**
- `docker_prune` now supports `--dry-run`: previews dangling images and build cache size
- Uses `run_cmd` wrapper for prune operations

**CLI Improvements**
- Global flags parsed before command dispatch (`--auto`, `--verbose`, `--json`, `--dry-run`, `--env-file`)
- `up`, `down`, `restart`, `pull` now wrapped with `run_cmd` for dry-run support
- Unknown commands use `die()` instead of inline `fail` + `exit`
- Updated usage/help text with all new flags and examples

### scripts/quality-gate.sh

- Added ShellCheck step (#5) to the quality gate pipeline
- Gracefully skips if `shellcheck` is not installed

### scripts/tests/deploy-unified.bats (NEW)

- BATS test scaffold with 8 test cases:
  - Script exists and is executable
  - `--help` exits 0 with usage text
  - `help` command works
  - Unknown command exits non-zero
  - `--dry-run deploy` validates without changes
  - `--auto` flag accepted
  - `requirements` command runs
  - `validate` command runs

## ShellCheck Status

`deploy-unified.sh`: 0 warnings (clean)
`quality-gate.sh`: 0 warnings (clean)

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `scripts/deploy-unified.sh` | 1225 -> 1477 | Hardened, non-interactive, validation |
| `scripts/quality-gate.sh` | 68 -> 76 | Added ShellCheck step |
| `scripts/tests/deploy-unified.bats` | 0 -> 48 | New BATS test scaffold |

## Usage Examples

```bash
# CI pipeline: non-interactive deploy
./scripts/deploy-unified.sh --auto deploy

# CI health check with JSON output
./scripts/deploy-unified.sh --json health

# Validate env before deploy
./scripts/deploy-unified.sh validate

# Dry-run deploy preview
./scripts/deploy-unified.sh --dry-run deploy

# Use alternate env file
./scripts/deploy-unified.sh --env-file /path/to/.env.staging deploy

# Debug mode
DEBUG=1 ./scripts/deploy-unified.sh health

# Run BATS tests
bats scripts/tests/deploy-unified.bats
```
