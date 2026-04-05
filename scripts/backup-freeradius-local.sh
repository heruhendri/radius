#!/bin/bash
# =============================================================
# Salfanet RADIUS — Backup FreeRADIUS config to local archive
#
# Creates a timestamped tar.gz in backups/freeradius/
# Triggered by web UI (/admin/freeradius/backup) or manually:
#   bash /var/www/salfanet-radius/scripts/backup-freeradius-local.sh
# =============================================================

set -e

APP_DIR="${SALFANET_APP_DIR:-/var/www/salfanet-radius}"
FR_DIR="/etc/freeradius/3.0"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
BACKUP_BASE="${SALFANET_BACKUP_DIR:-$APP_DIR/backups/freeradius}"
BACKUP_DIR="$BACKUP_BASE/freeradius-$TIMESTAMP"
ARCHIVE_NAME="freeradius-$TIMESTAMP.tar.gz"
ARCHIVE_PATH="$BACKUP_BASE/$ARCHIVE_NAME"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}✔ $1${NC}"; }
log() { echo -e "${YELLOW}  $1${NC}"; }
err() { echo -e "${RED}✘ $1${NC}"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
printf "║  FreeRADIUS Backup — %-31s║\n" "$TIMESTAMP"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Sanity checks ─────────────────────────────────────────
[ -d "$FR_DIR" ] || err "FreeRADIUS config dir not found: $FR_DIR"
mkdir -p "$BACKUP_DIR"

FILES=(
    "clients.conf"
    "clients.d/nas-from-db.conf"
    "mods-available/sql"
    "mods-available/rest"
    "mods-available/mschap"
    "mods-enabled/sql"
    "mods-enabled/rest"
    "policy.d/filter"
    "sites-available/default"
    "sites-available/coa"
    "sites-enabled/default"
)

COPIED=0
for f in "${FILES[@]}"; do
    SRC="$FR_DIR/$f"
    DEST="$BACKUP_DIR/$f"
    if [ -f "$SRC" ] || [ -L "$SRC" ]; then
        mkdir -p "$(dirname "$DEST")"
        ACTUAL="$SRC"
        [ -L "$SRC" ] && ACTUAL=$(readlink -f "$SRC")
        cp "$ACTUAL" "$DEST"
        ok "Backed up: $f"
        COPIED=$((COPIED + 1))
    else
        log "SKIP (not found): $f"
    fi
done

echo ""
log "Creating archive..."
cd "$BACKUP_BASE"
tar -czf "$ARCHIVE_NAME" "freeradius-$TIMESTAMP/"
rm -rf "$BACKUP_DIR"

SIZE=$(du -sh "$ARCHIVE_PATH" 2>/dev/null | cut -f1)
ok "Archive created: $ARCHIVE_NAME ($SIZE)"

# ── Keep only last 20 backups ─────────────────────────────
TOTAL=$(ls freeradius-*.tar.gz 2>/dev/null | wc -l)
if [ "$TOTAL" -gt 20 ]; then
    ls -t freeradius-*.tar.gz | tail -n +21 | xargs rm -f
    log "Cleaned old backups (kept last 20)"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Backup selesai ✔                                ║"
printf "║  File  : %-42s║\n" "$ARCHIVE_NAME"
printf "║  Size  : %-6s  Files: %-4s                      ║\n" "$SIZE" "$COPIED"
echo "╚══════════════════════════════════════════════════╝"
# sentinel read by API polling
echo "BACKUP_FILE:$ARCHIVE_NAME"
