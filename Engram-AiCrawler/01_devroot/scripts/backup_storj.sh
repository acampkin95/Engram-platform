#!/usr/bin/env bash
# =============================================================================
# backup_storj.sh — Backup OSINT platform data volumes to Storj via rclone
# =============================================================================
# Requires env vars:
#   RCLONE_CONFIG_STORJ_TYPE, RCLONE_CONFIG_STORJ_ACCESS_KEY_ID,
#   RCLONE_CONFIG_STORJ_SECRET_ACCESS_KEY, RCLONE_CONFIG_STORJ_ENDPOINT,
#   STORJ_BUCKET, BACKUP_RETENTION_DAYS
# Volume mount paths (read-only inside container):
#   /data/chroma, /data/cases, /data/face_refs,
#   /data/hot, /data/warm, /data/cold, /data/archive
# =============================================================================
set -euo pipefail

# ---- Configuration ----------------------------------------------------------
BUCKET="${STORJ_BUCKET:-osint-investigation-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
RCLONE_REMOTE="storj"

log()     { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [BACKUP] $*"; }
log_err() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [ERROR]  $*" >&2; }

# ---- Validate rclone config env vars ----------------------------------------
REQUIRED_VARS=(
    RCLONE_CONFIG_STORJ_TYPE
    RCLONE_CONFIG_STORJ_ACCESS_KEY_ID
    RCLONE_CONFIG_STORJ_SECRET_ACCESS_KEY
    RCLONE_CONFIG_STORJ_ENDPOINT
)
for var in "${REQUIRED_VARS[@]}"; do
    [[ -n "${!var:-}" ]] || { log_err "Missing required env var: $var"; exit 1; }
done

# ---- rclone helper ----------------------------------------------------------
rclone_sync() {
    local src="$1"
    local dest="$2"
    local label="$3"

    if [[ ! -d "$src" ]]; then
        log "SKIP: $label — source directory $src does not exist."
        return 0
    fi

    log "Syncing $label → ${RCLONE_REMOTE}:${BUCKET}/${dest}/"
    rclone sync "$src" "${RCLONE_REMOTE}:${BUCKET}/${dest}/" \
        --transfers=4 \
        --checkers=8 \
        --retries=3 \
        --low-level-retries=5 \
        --stats=60s \
        --log-level=INFO \
        --fast-list \
        2>&1 | sed 's/^/  /'
    log "$label sync complete."
}

rclone_copy_snapshot() {
    local src="$1"
    local dest_prefix="$2"
    local label="$3"

    if [[ ! -d "$src" ]]; then
        log "SKIP: $label snapshot — source $src does not exist."
        return 0
    fi

    log "Snapshot $label → ${RCLONE_REMOTE}:${BUCKET}/${dest_prefix}/${TIMESTAMP}/"
    rclone copy "$src" "${RCLONE_REMOTE}:${BUCKET}/${dest_prefix}/${TIMESTAMP}/" \
        --transfers=4 \
        --checkers=8 \
        --retries=3 \
        --stats=60s \
        --log-level=INFO \
        --fast-list \
        2>&1 | sed 's/^/  /'
    log "$label snapshot complete."
}

# ---- Main backup ------------------------------------------------------------
log "=========================================="
log "Backup started — timestamp: $TIMESTAMP"
log "Bucket: ${BUCKET}"
log "Retention: ${RETENTION_DAYS} days"
log "=========================================="

ERRORS=0

# 1. Continuous sync (latest state always mirrored)
rclone_sync /data/cases      "cases/latest"    "Cases"        || ((ERRORS++))
rclone_sync /data/face_refs  "face_refs/latest" "Face refs"   || ((ERRORS++))
rclone_sync /data/hot        "storage/hot"      "Hot storage" || ((ERRORS++))
rclone_sync /data/warm       "storage/warm"     "Warm storage"|| ((ERRORS++))
rclone_sync /data/cold       "storage/cold"     "Cold storage"|| ((ERRORS++))
rclone_sync /data/archive    "storage/archive"  "Archive"     || ((ERRORS++))

# 2. Timestamped snapshots for ChromaDB (vector DB — point-in-time important)
rclone_copy_snapshot /data/chroma "chroma/snapshots" "ChromaDB" || ((ERRORS++))

# 3. Timestamped snapshot for cases (daily forensic record)
rclone_copy_snapshot /data/cases  "cases/snapshots"  "Cases snapshot" || ((ERRORS++))

# ---- Retention pruning ------------------------------------------------------
log "Pruning snapshots older than ${RETENTION_DAYS} days..."

prune_old_snapshots() {
    local prefix="$1"
    local label="$2"
    local cutoff
    cutoff=$(date -u -d "-${RETENTION_DAYS} days" '+%Y%m%dT' 2>/dev/null || \
             date -u -v "-${RETENTION_DAYS}d" '+%Y%m%dT' 2>/dev/null || echo "")

    if [[ -z "$cutoff" ]]; then
        log "WARN: Could not compute cutoff date for pruning $label. Skipping."
        return 0
    fi

    # List snapshot directories
    local dirs
    dirs=$(rclone lsf "${RCLONE_REMOTE}:${BUCKET}/${prefix}/" --dirs-only 2>/dev/null || echo "")

    local pruned=0
    while IFS= read -r dir; do
        # dir format: 20250115T123456Z/
        dir_ts="${dir%/}"
        if [[ "$dir_ts" < "$cutoff" ]]; then
            log "  Pruning old snapshot: ${prefix}/${dir_ts}"
            rclone purge "${RCLONE_REMOTE}:${BUCKET}/${prefix}/${dir_ts}/" \
                --log-level=INFO 2>&1 | sed 's/^/    /' || true
            ((pruned++))
        fi
    done <<< "$dirs"

    log "  Pruned $pruned old snapshots from $label."
}

prune_old_snapshots "chroma/snapshots" "ChromaDB snapshots" || true
prune_old_snapshots "cases/snapshots"  "Cases snapshots"    || true

# ---- Summary ----------------------------------------------------------------
log "=========================================="
if [[ $ERRORS -eq 0 ]]; then
    log "Backup completed successfully — no errors."
else
    log_err "Backup completed with $ERRORS error(s). Check logs above."
fi
log "=========================================="

exit $ERRORS
