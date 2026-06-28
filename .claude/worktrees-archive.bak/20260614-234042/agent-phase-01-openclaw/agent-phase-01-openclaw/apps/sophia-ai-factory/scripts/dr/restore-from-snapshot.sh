#!/bin/bash

################################################################################
# Sophia AI Factory — D1 Database Restore Script
# Purpose: Restore D1 database from snapshot
# Usage: ./scripts/dr/restore-from-snapshot.sh [OPTIONS]
#
# OPTIONS:
#   --confirm     Actually execute restore (default: dry-run only)
#   --snapshot    Specify snapshot file (default: latest in backups/)
#
# Environment variables (optional):
#   BACKUP_DIR — directory containing snapshots (default: backups/)
#   DB_NAME — database name (default: sophia-raas-db)
#
# Examples:
#   ./scripts/dr/restore-from-snapshot.sh              # Dry-run, latest snapshot
#   ./scripts/dr/restore-from-snapshot.sh --confirm    # Restore latest snapshot
#   ./scripts/dr/restore-from-snapshot.sh --snapshot backups/d1-2026-04-28-020000.sql --confirm
################################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-backups}"
DB_NAME="${DB_NAME:-sophia-raas-db}"
CONFIRM=false
SNAPSHOT_FILE=""
LOG_FILE="${BACKUP_DIR}/restore.log"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Function: Log message
log() {
  local level="$1"
  shift
  local msg="$*"
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S')] [$level] $msg" | tee -a "$LOG_FILE"
}

# Function: Parse arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --confirm)
        CONFIRM=true
        shift
        ;;
      --snapshot)
        SNAPSHOT_FILE="$2"
        shift 2
        ;;
      --warm-cache)
        # Future: crawl ISR routes to warm R2 cache
        log "INFO" "Cache warming not yet implemented"
        shift
        ;;
      *)
        log "ERROR" "Unknown option: $1"
        exit 1
        ;;
    esac
  done
}

# Function: Find latest snapshot
find_latest_snapshot() {
  local latest=$(ls -1t "$BACKUP_DIR"/d1-*.sql 2>/dev/null | head -1)
  if [[ -z "$latest" ]]; then
    log "ERROR" "No snapshots found in $BACKUP_DIR"
    exit 1
  fi
  echo "$latest"
}

# Function: Validate snapshot file
validate_snapshot() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    log "ERROR" "Snapshot file not found: $file"
    exit 1
  fi

  local size=$(du -h "$file" | cut -f1)
  log "INFO" "Snapshot file: $file"
  log "INFO" "File size: $size"

  # Check file is readable
  if ! head -n 5 "$file" > /dev/null 2>&1; then
    log "ERROR" "Snapshot file is corrupted or unreadable"
    exit 1
  fi
}

# Function: Execute restore
execute_restore() {
  local snapshot="$1"

  log "WARN" "⚠️  RESTORE WILL OVERWRITE CURRENT DATABASE"
  log "WARN" "Database: $DB_NAME"
  log "WARN" "Snapshot: $snapshot"
  log "WARN" "This action CANNOT be undone."
  log "WARN" ""

  if [[ "$CONFIRM" == false ]]; then
    log "INFO" "DRY-RUN MODE: No changes made"
    log "INFO" "To execute: re-run with --confirm flag"
    return 0
  fi

  log "INFO" "🔄 Starting database restore..."
  log "WARN" "DO NOT INTERRUPT THIS PROCESS"

  if npx wrangler d1 execute "$DB_NAME" \
    --remote \
    --file "$snapshot" \
    >> "$LOG_FILE" 2>&1; then

    log "INFO" "✅ Restore completed successfully"
    log "INFO" "Database: $DB_NAME"
    log "INFO" "Timestamp: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"

    # Quick validation
    log "INFO" "Validating restore..."
    if npx wrangler d1 execute "$DB_NAME" \
      --remote \
      --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table';" \
      >> "$LOG_FILE" 2>&1; then

      log "INFO" "✅ Database validation passed"
    else
      log "WARN" "⚠️  Validation returned unexpected output — check manually"
    fi

  else
    log "ERROR" "❌ Restore failed. Check $LOG_FILE for details."
    exit 1
  fi
}

# Main function
main() {
  parse_args "$@"

  log "INFO" "=== D1 Restore Started ==="
  log "INFO" "Database: $DB_NAME"
  log "INFO" "Confirm mode: $CONFIRM"
  log "INFO" ""

  # Find snapshot if not specified
  if [[ -z "$SNAPSHOT_FILE" ]]; then
    SNAPSHOT_FILE=$(find_latest_snapshot)
  fi

  # Validate snapshot
  validate_snapshot "$SNAPSHOT_FILE"

  # Execute restore
  execute_restore "$SNAPSHOT_FILE"

  log "INFO" "=== D1 Restore Finished ==="
  log "INFO" ""
  log "INFO" "Next steps:"
  log "INFO" "1. Verify production: curl https://sophia.agencyos.network/api/health"
  log "INFO" "2. Test user login"
  log "INFO" "3. Check recent changes: git log --oneline | head -5"
  log "INFO" "4. Document incident in docs/incidents.log"
}

# Run
main "$@"
