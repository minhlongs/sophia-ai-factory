#!/bin/bash

################################################################################
# Sophia AI Factory — D1 Database Snapshot Script
# Purpose: Export D1 database to SQL file for disaster recovery
# Usage: ./scripts/dr/d1-snapshot.sh
#
# Environment variables (optional):
#   BACKUP_DIR — directory to store snapshots (default: backups/)
#   DB_NAME — database name (default: sophia-raas-db)
#   RETENTION_DAYS — keep snapshots newer than this (default: 30)
################################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-backups}"
DB_NAME="${DB_NAME:-sophia-raas-db}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date -u +"%Y-%m-%d-%H%M%S")
SNAPSHOT_FILE="${BACKUP_DIR}/d1-${TIMESTAMP}.sql"
LOG_FILE="${BACKUP_DIR}/snapshot.log"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Function: Log message
log() {
  local level="$1"
  shift
  local msg="$*"
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S')] [$level] $msg" | tee -a "$LOG_FILE"
}

# Function: Cleanup old snapshots (keep last N days)
cleanup_old_snapshots() {
  log "INFO" "Cleaning up snapshots older than $RETENTION_DAYS days..."

  find "$BACKUP_DIR" -name "d1-*.sql" -type f -mtime "+$RETENTION_DAYS" -delete || true

  local count=$(find "$BACKUP_DIR" -name "d1-*.sql" -type f | wc -l)
  log "INFO" "Current snapshots retained: $count"
}

# Main: Export database
main() {
  log "INFO" "=== D1 Snapshot Started ==="
  log "INFO" "Database: $DB_NAME"
  log "INFO" "Output: $SNAPSHOT_FILE"

  # Verify wrangler is available
  if ! command -v npx &> /dev/null; then
    log "ERROR" "npx not found. Please install Node.js"
    exit 1
  fi

  # Export D1 database
  log "INFO" "Exporting D1 database '$DB_NAME'..."

  if npx wrangler d1 execute "$DB_NAME" \
    --remote \
    --command "SELECT sql FROM sqlite_master WHERE sql NOT NULL;" \
    > "${SNAPSHOT_FILE}.tmp" 2>> "$LOG_FILE"; then

    mv "${SNAPSHOT_FILE}.tmp" "$SNAPSHOT_FILE"

    # Get file size
    local size=$(du -h "$SNAPSHOT_FILE" | cut -f1)
    log "INFO" "✅ Snapshot completed successfully"
    log "INFO" "File size: $size"

  else
    log "ERROR" "Failed to export database. Check logs above."
    rm -f "${SNAPSHOT_FILE}.tmp"
    exit 1
  fi

  # Cleanup old snapshots
  cleanup_old_snapshots

  log "INFO" "=== D1 Snapshot Finished ==="
  echo "Snapshot saved: $SNAPSHOT_FILE"
}

# Run
main "$@"
