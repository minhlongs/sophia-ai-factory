#!/usr/bin/env bash
# Goal Runtime: Rollback — surgical revert of a failed phase
# Usage: rollback.sh <plan-id> <phase-id> [reason]
set -euo pipefail

PLAN_ID="${1:?Usage: rollback.sh <plan-id> <phase-id> [reason]}"
PHASE_ID="${2:?Usage: rollback.sh <plan-id> <phase-id> [reason]}"
REASON="${3:-manual rollback}"
APP_DIR="/Users/macbook/repos/sophia-ai-factory/apps/sophia-ai-factory"
MANIFEST="$APP_DIR/plans/goal-runtime/goal-manifest.json"
PLAN_DIR="$APP_DIR/plans/$PLAN_ID"
REPORT_DIR="$APP_DIR/plans/goal-runtime/reports"
mkdir -p "$REPORT_DIR"

echo "↩️  Rolling back plan=$PLAN_ID phase=$PHASE_ID — $REASON"

# ── 1. Determine owned files ──────────────────────────────────────────
FILES=$(jq -r --arg p "$PLAN_ID" --arg ph "$PHASE_ID" \
  '.plans[] | select(.id == $p) | .phases[] | select(.id == $ph) | .files_owned[]?' \
  "$MANIFEST" 2>/dev/null)

if [[ -z "$FILES" ]]; then
  echo "⚠️  No files_owned found for $PLAN_ID/phase-$PHASE_ID — skipping file revert"
else
  # ── 2. Revert each file to HEAD (discard working tree changes) ──────
  REVERTED=0
  FAILED=0
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    FULL_PATH="$APP_DIR/$file"
    if [[ -f "$FULL_PATH" ]]; then
      if git -C "$APP_DIR" diff --quiet HEAD -- "$file" 2>/dev/null; then
        echo "  (unchanged) $file"
      else
        git -C "$APP_DIR" checkout HEAD -- "$file" 2>/dev/null || true
        echo "  ✅ reverted: $file"
        REVERTED=$((REVERTED + 1))
      fi
    else
      echo "  ⏭  not found (skip): $file"
    fi
  done <<< "$FILES"

  # ── 3. Revert migration files (safety: don't touch applied migrations) ─
  MIGRATIONS=$(echo "$FILES" | grep -E "^migrations/.*\.sql$" || true)
  if [[ -n "$MIGRATIONS" ]]; then
    echo "  ⚠️  Migration files detected — verify D1 state before re-applying:"
    while IFS= read -r mig; do
      [[ -z "$mig" ]] && continue
      echo "    $mig"
    done <<< "$MIGRATIONS"
  fi
fi

# ── 4. Reset phase status to pending in manifest ──────────────────────
TMP=$(mktemp)
jq --arg p "$PLAN_ID" --arg ph "$PHASE_ID" \
  '(.plans[] | select(.id == $p) | .phases[] | select(.id == $ph) | .status) = "pending"' \
  "$MANIFEST" > "$TMP" && mv "$TMP" "$MANIFEST"
echo "  📝 Phase $PHASE_ID status → pending"

# ── 5. Write rollback checkpoint ──────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CHECKPOINT_FILE="$PLAN_DIR/reports/audit-state.json"
mkdir -p "$(dirname "$CHECKPOINT_FILE")"
if command -v jq &>/dev/null; then
  if [[ -f "$CHECKPOINT_FILE" ]]; then
    EXISTING=$(cat "$CHECKPOINT_FILE")
  else
    EXISTING="{}"
  fi
  echo "$EXISTING" | jq \
    --arg ts "$TIMESTAMP" \
    --arg phase "$PHASE_ID" \
    --arg reason "$REASON" \
    '. + {
      plan_id: env.PLAN_ID,
      last_checkpoint: $ts,
      rollback: {phase: $phase, reason: $reason, timestamp: $ts},
      phases: (.phases // {} | . + {($phase: {status: "pending", rolled_back_at: $ts})})
    }' > "$CHECKPOINT_FILE"
fi

# ── 6. Record in reports ──────────────────────────────────────────────
ROLLBACK_LOG="$REPORT_DIR/rollback-${PLAN_ID}-phase${PHASE_ID}.json"
cat > "$ROLLBACK_LOG" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "plan_id": "$PLAN_ID",
  "phase_id": "$PHASE_ID",
  "reason": "$REASON",
  "status": "rolled_back"
}
EOF

echo "✅ Rollback complete. Re-run: ./run.sh goal-runtime"
