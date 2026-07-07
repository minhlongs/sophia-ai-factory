#!/usr/bin/env bash
# Goal Runtime: Checkpoint writer — survives context compaction
# Usage: checkpoint-hook.sh <plan-id> <phase-id> <status> [next-phase]
#   status: pending | running | completed | failed | blocked
set -euo pipefail

PLAN_ID="${1:?Usage: checkpoint-hook.sh <plan-id> <phase-id> <status> [next-phase]}"
PHASE_ID="${2:?Usage: checkpoint-hook.sh <plan-id> <phase-id> <status> [next-phase]}"
STATUS="${3:?Usage: checkpoint-hook.sh <plan-id> <phase-id> <status> [next-phase]}"
NEXT_PHASE="${4:-}"
APP_DIR="/Users/macbook/repos/sophia-ai-factory/apps/sophia-ai-factory"
PLAN_DIR="$APP_DIR/plans/$PLAN_ID"
CHECKPOINT_FILE="$PLAN_DIR/reports/audit-state.json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$(dirname "$CHECKPOINT_FILE")"

# Read existing checkpoint or start fresh
if [[ -f "$CHECKPOINT_FILE" ]]; then
  EXISTING=$(cat "$CHECKPOINT_FILE")
else
  EXISTING="{}"
fi

# Update phase status in checkpoint
# We use jq to update; if jq unavailable, write raw
if command -v jq &>/dev/null; then
  UPDATED=$(echo "$EXISTING" | jq \
    --arg ts "$TIMESTAMP" \
    --arg phase "$PHASE_ID" \
    --arg status "$STATUS" \
    --arg next "${NEXT_PHASE:-}" \
    '. + {
      plan_id: env.PLAN_ID,
      last_checkpoint: $ts,
      phases: (.phases // {} | . + {($phase): {status: $status, updated_at: $ts}}),
      (if $next != "" then "next_phase" else . end): (if $next != "" then $next else . end)
    }')
  echo "$UPDATED" > "$CHECKPOINT_FILE"
else
  # Fallback without jq
  cat > "$CHECKPOINT_FILE" <<EOF
{
  "plan_id": "$PLAN_ID",
  "last_checkpoint": "$TIMESTAMP",
  "phase": "$PHASE_ID",
  "status": "$STATUS",
  "next_phase": "${NEXT_PHASE:-}"
}
EOF
fi

echo "✅ Checkpoint written: $PLAN_ID/phase-$PHASE_ID → $STATUS"
