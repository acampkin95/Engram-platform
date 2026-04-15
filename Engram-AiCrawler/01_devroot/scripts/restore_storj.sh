#!/usr/bin/env bash
# =============================================================================
# restore_storj.sh — Restore OSINT platform data from Storj backup
# =============================================================================
# Usage:
#   bash restore_storj.sh [--snapshot TIMESTAMP] [--target DIR] [--dry-run]
#
# Examples:
#   bash restore_storj.sh                           # restore latest
#   bash restore_storj.sh --snapshot 20250115T120000Z
#   bash restore_storj.sh --dry-run                 # preview only
# =============================================================================
set -euo pipefail

# ---- Colour helpers ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---- Defaults ---------------------------------------------------------------
BUCKET="${STORJ_BUCKET:-osint-investigation-backups}"
RCLONE_REMOTE="storj"
SNAPSHOT=""
TARGET_DIR="${1:-/data}"
DRY_RUN=false

# ---- Argument parsing -------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --snapshot) SNAPSHOT="$2"; shift 2 ;;
        --target)   TARGET_DIR="$2"; shift 2 ;;
        --dry-run)  DRY_RUN=true; shift ;;
        --help|-h)
            echo "Usage: $0 [--snapshot TIMESTAMP] [--target DIR] [--dry-run]"
            echo "  --snapshot  Specific snapshot timestamp (e.g. 20250115T120000Z)"
            echo "  --target    Local restore directory (default: /data)"
            echo "  --dry-run   Preview what would be restored without writing"
            exit 0 ;;
        *) warn "Unknown argument: $1"; shift ;;
    esac
done

# ---- Validate rclone config -------------------------------------------------
REQUIRED_VARS=(
    RCLONE_CONFIG_STORJ_TYPE
    RCLONE_CONFIG_STORJ_ACCESS_KEY_ID
    RCLONE_CONFIG_STORJ_SECRET_ACCESS_KEY
    RCLONE_CONFIG_STORJ_ENDPOINT
)
for var in "${REQUIRED_VARS[@]}"; do
    [[ -n "${!var:-}" ]] || err "Missing required env var: $var"
done

RCLONE_FLAGS="--transfers=4 --checkers=8 --retries=3 --stats=60s --log-level=INFO --fast-list"
[[ "$DRY_RUN" == "true" ]] && RCLONE_FLAGS="$RCLONE_FLAGS --dry-run"

# ---- List available snapshots -----------------------------------------------
list_snapshots() {
    local prefix="$1"
    rclone lsf "${RCLONE_REMOTE}:${BUCKET}/${prefix}/" --dirs-only 2>/dev/null \
        | sed 's|/$||' | sort -r || echo ""
}

# ---- Resolve snapshot timestamp ---------------------------------------------
if [[ -z "$SNAPSHOT" ]]; then
    info "No snapshot specified — finding latest ChromaDB snapshot..."
    SNAPSHOT=$(list_snapshots "chroma/snapshots" | head -1)
    if [[ -z "$SNAPSHOT" ]]; then
        warn "No ChromaDB snapshots found. Will restore from 'latest' sync instead."
    else
        info "Latest snapshot: $SNAPSHOT"
    fi
fi

# ---- Safety confirmation ----------------------------------------------------
echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}  OSINT Platform — Restore from Storj${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo ""
echo "  Bucket    : ${RCLONE_REMOTE}:${BUCKET}"
echo "  Snapshot  : ${SNAPSHOT:-latest sync}"
echo "  Target    : $TARGET_DIR"
echo "  Dry run   : $DRY_RUN"
echo ""
if [[ "$DRY_RUN" != "true" ]]; then
    echo -e "${RED}  WARNING: This will OVERWRITE data in $TARGET_DIR${NC}"
    echo ""
    read -rp "  Type 'yes' to confirm restore: " CONFIRM
    [[ "$CONFIRM" == "yes" ]] || { info "Restore cancelled."; exit 0; }
fi
echo ""

# ---- Restore function -------------------------------------------------------
restore_dir() {
    local remote_path="$1"
    local local_path="$2"
    local label="$3"

    info "Restoring $label..."
    info "  From: ${RCLONE_REMOTE}:${BUCKET}/${remote_path}/"
    info "  To:   ${local_path}/"

    mkdir -p "$local_path"

    # shellcheck disable=SC2086
    rclone sync "${RCLONE_REMOTE}:${BUCKET}/${remote_path}/" "$local_path/" \
        $RCLONE_FLAGS \
        2>&1 | sed 's/^/  /'

    ok "$label restored."
}

# ---- Execute restore --------------------------------------------------------
info "Starting restore..."

# Restore from snapshots (point-in-time) if available, else from latest sync
if [[ -n "$SNAPSHOT" ]]; then
    restore_dir "chroma/snapshots/${SNAPSHOT}" "${TARGET_DIR}/chroma"   "ChromaDB (snapshot)"
    restore_dir "cases/snapshots/${SNAPSHOT}"  "${TARGET_DIR}/cases"    "Cases (snapshot)"
else
    restore_dir "chroma/snapshots/$(list_snapshots 'chroma/snapshots' | head -1 || echo '')" \
                "${TARGET_DIR}/chroma" "ChromaDB (latest snapshot)" || \
    restore_dir "cases/latest"  "${TARGET_DIR}/cases"    "Cases (latest sync)"
fi

# Always restore latest for these (no snapshot needed)
restore_dir "cases/latest"       "${TARGET_DIR}/cases"      "Cases (latest)"
restore_dir "face_refs/latest"   "${TARGET_DIR}/face_refs"  "Face refs"
restore_dir "storage/hot"        "${TARGET_DIR}/hot"        "Hot storage"
restore_dir "storage/warm"       "${TARGET_DIR}/warm"       "Warm storage"
restore_dir "storage/cold"       "${TARGET_DIR}/cold"       "Cold storage"
restore_dir "storage/archive"    "${TARGET_DIR}/archive"    "Archive"

# ---- Summary ----------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================================${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${GREEN}  Dry run complete — no data was written.${NC}"
else
    echo -e "${GREEN}  Restore complete!${NC}"
    echo ""
    echo "  Next steps:"
    echo "    1. Restart the application: docker compose -f docker-compose.prod.yml up -d"
    echo "    2. Verify data integrity in the UI"
fi
echo -e "${GREEN}============================================================${NC}"
