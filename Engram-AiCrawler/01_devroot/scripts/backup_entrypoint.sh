#!/usr/bin/env bash
# =============================================================================
# backup_entrypoint.sh — rclone backup container entrypoint
# =============================================================================
# Runs inside the rclone/rclone Docker container.
# Modes:
#   (no args)  — daemon loop, runs backup every BACKUP_INTERVAL_HOURS
#   once       — run a single backup and exit (used by cron)
# =============================================================================
set -euo pipefail

INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-6}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup_storj.sh"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

# Ensure backup script is executable
[[ -f "$BACKUP_SCRIPT" ]] || { log "ERROR: backup_storj.sh not found at $BACKUP_SCRIPT"; exit 1; }
chmod +x "$BACKUP_SCRIPT"

run_backup() {
    log "Starting backup cycle..."
    if bash "$BACKUP_SCRIPT"; then
        log "Backup completed successfully."
    else
        log "ERROR: Backup failed (exit code $?)."
        return 1
    fi
}

case "${1:-daemon}" in
    once)
        log "Running one-shot backup..."
        run_backup
        ;;
    daemon)
        log "Starting backup daemon (interval: ${INTERVAL_HOURS}h)..."
        # Run immediately on startup, then loop
        run_backup || true
        while true; do
            SLEEP_SECONDS=$(( INTERVAL_HOURS * 3600 ))
            log "Next backup in ${INTERVAL_HOURS}h (${SLEEP_SECONDS}s)..."
            sleep "$SLEEP_SECONDS"
            run_backup || true
        done
        ;;
    *)
        echo "Usage: $0 [daemon|once]"
        exit 1
        ;;
esac
