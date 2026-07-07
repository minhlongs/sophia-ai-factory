#!/usr/bin/env bash
# Goal Runtime: Orchestrator
# Usage: run.sh [goal-manifest.json]
#   Reads goal-manifest.json → pre-flight → enqueue phases → wait for LLM → audit → gate
# Exit codes: 0 = handover approved, 1 = blocked, 2 = setup error
set -euo pipefail

APP_DIR="/Users/macbook/repos/sophia-ai-factory/apps/sophia-ai-factory"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="${1:-$APP_DIR/plans/goal-runtime/goal-manifest.json}"

# ── Helpers ─────────────────────────────────────────────────────────
ts()   { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
ok()   { echo "  ✅ $*"; }
fail() { echo "  ❌ $*" >&2; }
info() { echo "  ℹ️  $*"; }
die()  { echo "💥 $*" >&2; exit 2; }

# ── Load & validate manifest ────────────────────────────────────────
[[ -f "$MANIFEST" ]] || die "Manifest not found: $MANIFEST"
jq empty "$MANIFEST" 2>/dev/null || die "Manifest is not valid JSON"

GOAL_NAME=$(jq -r '.name' "$MANIFEST")
TOTAL_PLANS=$(jq '.plans | length' "$MANIFEST")
MAX_PARALLEL=$(jq -r '.global_config.max_parallel_plans // 1' "$MANIFEST")
MANDATORY_STEP6=$(jq -r '.global_config.mandatory_step6 // false' "$MANIFEST")
HANDOVER_GATE=$(jq -r '.global_config.handover_gate_required // false' "$MANIFEST")
AUTO_ROLLBACK=$(jq -r '.global_config.auto_rollback_on_audit_fail // false' "$MANIFEST")
MANIFEST_STATUS=$(jq -r '.status // "unknown"' "$MANIFEST")

echo "════════════════════════════════════════════════════════════"
echo " Goal Runtime: $GOAL_NAME"
echo " Plans: $TOTAL_PLANS | Parallel: $MAX_PARALLEL | Status: $MANIFEST_STATUS"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Pre-flight (fail-fast) ──────────────────────────────────────────
source "$SCRIPT_DIR/pre-flight.sh" "$MANIFEST"
PREFLIGHT_EXIT=$?
if [[ $PREFLIGHT_EXIT -ne 0 ]]; then
  die "Pre-flight failed — fix conflicts and re-run"
fi
ok "Pre-flight passed"

# ── Register goal-runtime paths ─────────────────────────────────────
REPORTS_DIR="$APP_DIR/plans/goal-runtime/reports"
STATE_DIR="$APP_DIR/plans/goal-runtime/state"
mkdir -p "$REPORTS_DIR" "$STATE_DIR"

PHASE_QUEUE="$STATE_DIR/phase-queue.json"
FLOW_LOG="$REPORTS_DIR/flow-log.jsonl"

log_flow() { echo "{\"ts\":\"$(ts)\",\"event\":\"$*\"}" >> "$FLOW_LOG"; }

# ── Dependency-sort phases within each plan ─────────────────────────
# Returns JSON array of phase IDs in dependency order
sort_phases() {
  local plan_json="$1"
  echo "$plan_json" | jq -r '
    .phases // []
    | (. as $all
       | map(.id) as $ids
       | map({
           id: .id,
           deps: (.depends_on // [] | map(select(. as $d | $ids | index($d))))
         })
       | recurse(. as $p
                 | (. + {ready: (all(.deps[]; false))})
                 | select(.ready) | .id)
       | . // empty)
  '
}

# Check if all dependencies are "completed" in manifest
deps_met() {
  local phase_json="$1"
  local plan_phases="$2"
  local deps
  deps=$(echo "$phase_json" | jq -r '.depends_on // [] | .[]?' 2>/dev/null)
  for dep in $deps; do
    local dep_status
    dep_status=$(echo "$plan_phases" | jq -r --arg d "$dep" '.[] | select(.id == $d) | .status // "pending"' 2>/dev/null)
    if [[ "$dep_status" != "completed" ]]; then
      return 1
    fi
  done
  return 0
}

# ── Enqueue ready phases ────────────────────────────────────────────
enqueue_ready() {
  local plan_id="$1"
  local plan_json
  plan_json=$(jq -c --arg pid "$plan_id" '.plans[] | select(.id == $pid)' "$MANIFEST")
  local sorted_ids
  sorted_ids=$(echo "$plan_json" | jq -r '.phases // [] | .[].id')

  # Rebuild queue preserving order — only phases not yet completed
  local queue="[]"
  for pid in $sorted_ids; do
    local phase
    phase=$(echo "$plan_json" | jq -c --arg id "$pid" '.phases[] | select(.id == $id)')
    local status
    status=$(echo "$phase" | jq -r '.status // "pending"')
    [[ "$status" == "completed" ]] && continue

    if deps_met "$phase" "$(echo "$plan_json" | jq '.phases')"; then
      queue=$(echo "$queue" | jq --arg ph "$phase" '. + [($ph | fromjson)]' 2>/dev/null || echo "$queue")
    fi
  done
  echo "$queue"
}

# ── Process phases ─────────────────────────────────────────────────
process_plan() {
  local plan_id="$1"
  local plan_name
  plan_name=$(jq -r --arg pid "$plan_id" '.plans[] | select(.id == $pid) | .id' "$MANIFEST")
  info "Processing plan: $plan_id"

  local processed=0
  while true; do
    # Get current queue
    local queue
    queue=$(enqueue_ready "$plan_id")

    local qlen
    qlen=$(echo "$queue" | jq 'length')

    if [[ "$qlen" -eq 0 ]]; then
      # Check if plan is fully completed
      local remaining
      remaining=$(jq -r --arg pid "$plan_id" '
        [.plans[] | select(.id == $pid) | .phases[] | select(.status != "completed")] | length
      ' "$MANIFEST")
      if [[ "$remaining" -eq 0 ]]; then
        ok "Plan $plan_id — all phases complete"
        break
      fi
      # Some phases blocked (waiting on deps not in this plan — shouldn't happen, but handle)
      info "Plan $plan_id — waiting for external deps or stalled (remaining: $remaining)"
      break
    fi

    # Process first ready phase (FIFO respects dependency order)
    local phase_entry
    phase_entry=$(echo "$queue" | jq -c '.[0]')
    local phase_id phase_name
    phase_id=$(echo "$phase_entry" | jq -r '.id')
    phase_name=$(echo "$phase_entry" | jq -r '.name')

    info "[$plan_id] Phase $phase_id: $phase_name"

    # Mark phase as running
    tmp_update_phase "$plan_id" "$phase_id" "running"
    log_flow "phase_start plan=$plan_id phase=$phase_id name=$phase_name"

    # ── Write ready-queue for LLM consumption ──────────────────────
    cat > "$PHASE_QUEUE" <<'HEADER'
# Goal Runtime — Current Phase Queue
# Each phase below is READY (dependencies met).
# Work on the first entry, then write "done" to the phase status.
HEADER
    echo "$queue" | jq -r '.[] | "## Phase \(.id): \(.name)\nStatus: **running**\nFiles: \(.files_owned | join(", "))\nDeps: \(.depends_on | join(" → ") // "none")\n"' >> "$PHASE_QUEUE"
    echo "" >> "$PHASE_QUEUE"
    echo "**Instructions for LLM:**" >> "$PHASE_QUEUE"
    echo "1. Implement the phase following the plan in \`plans/$plan_id/phase-0${phase_id}-*.md\`" >> "$PHASE_QUEUE"
    echo "2. Run tests + build" >> "$PHASE_QUEUE"
    echo "3. Run: \`bash $SCRIPT_DIR/checkpoint-hook.sh $plan_id $phase_id completed\`" >> "$PHASE_QUEUE"
    echo "4. Return here to continue" >> "$PHASE_QUEUE"

    # ── Phase watcher: wait for completion signal ──────────────────
    local phase_complete=false
    local WATCH_INTERVAL=10  # seconds
    local MAX_WAIT=3600      # 1 hour max per phase (safety)
    local waited=0

    while [[ "$phase_complete" == "false" ]]; do
      sleep "$WATCH_INTERVAL"
      waited=$((waited + WATCH_INTERVAL))

      # Re-read manifest to check if LLM marked phase done
      local cur_status
      cur_status=$(jq -r --arg pid "$plan_id" --arg ph "$phase_id" '
        .plans[] | select(.id == $pid) | .phases[] | select(.id == $ph) | .status // "running"
      ' "$MANIFEST" 2>/dev/null)

      if [[ "$cur_status" == "completed" ]]; then
        phase_complete=true
        log_flow "phase_complete plan=$plan_id phase=$phase_id waited=${waited}s"
      elif [[ "$cur_status" == "failed" ]]; then
        fail "Phase $phase_id marked as failed"
        if [[ "$AUTO_ROLLBACK" == "true" ]]; then
          info "Auto-rollback enabled — reverting phase $phase_id"
          "$SCRIPT_DIR/rollback.sh" "$plan_id" "$phase_id" "auto-rollback after failure"
        else
          die "Phase $phase_id failed. Fix manually, then re-run run.sh"
        fi
      elif [[ "$waited" -ge $MAX_WAIT ]]; then
        fail "Phase $phase_id timed out after ${MAX_WAIT}s"
        die "Manual intervention required for plan=$plan_id phase=$phase_id"
      fi
    done

    processed=$((processed + 1))
    ok "Phase $phase_id complete"
  done

  # Mark entire plan as completed
  tmp_update_plan "$plan_id" "completed"
}

# ── Manifest mutation helpers (atomic via temp file) ────────────────
tmp_update_phase() {
  local plan_id="$1" phase_id="$2" status="$3" next="${4:-}"
  local tmp
  tmp=$(mktemp)
  jq --arg pid "$plan_id" --arg ph "$phase_id" --arg st "$status" --arg next "${next}" --arg ts "$(ts)" '
    (.plans[] | select(.id == $pid) |
      .phases |= [.[] |
        if .id == $ph then
          . + {status: $st, updated_at: $ts}
        else . end
      ]
    ) |
    (if $next != "" then .plans[] | select(.id == $pid) | .next_phase = $next else . end)
  ' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
}

tmp_update_plan() {
  local plan_id="$1" status="$2"
  local tmp
  tmp=$(mktemp)
  jq --arg pid "$plan_id" --arg st "$status" --arg ts "$(ts)" '
    (.plans[] | select(.id == $pid) | .status) = $st |
    .updated_at = $ts
  ' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
}

# ── Main loop: process plans ────────────────────────────────────────
FAILED_PLANS=0
COMPLETED_PLANS=0

while read -r plan_id; do
  [[ -z "$plan_id" ]] && continue
  process_plan "$plan_id"
  COMPLETED_PLANS=$((COMPLETED_PLANS + 1))
done < <(jq -r '.plans[].id' "$MANIFEST")

echo ""
echo "────────────────────────────────────────────────────────────"
echo " Plan execution: $COMPLETED_PLANS/$TOTAL_PLANS completed"
echo "────────────────────────────────────────────────────────────"
echo ""

# ── Handover Audit Gate ─────────────────────────────────────────────
if [[ "$HANDOVER_GATE" == "true" || "$MANIFEST_STATUS" == "running" ]]; then
  info "Running handover audit..."
  GATE_REPORT="$REPORTS_DIR/handover-gate.json"

  if "$SCRIPT_DIR/handover-audit.sh" "$APP_DIR" "$REPORTS_DIR"; then
    OVERALL="PASS"
    ok "Handover gate: APPROVED"
  else
    OVERALL="FAIL"
    fail "Handover gate: BLOCKED — see $GATE_REPORT"
    if [[ "$AUTO_ROLLBACK" == "true" ]]; then
      info "Auto-rollback: reverting incomplete phases..."
      # Rollback any non-completed phases
      jq -r '.plans[].phases[] | select(.status != "completed") | "\(.id)"' "$MANIFEST" 2>/dev/null | while read -r ph; do
        [[ -z "$ph" ]] && continue
        for pid in $(jq -r '.plans[].id' "$MANIFEST"); do
          "$SCRIPT_DIR/rollback.sh" "$pid" "$ph" "handover audit fail — auto rollback"
        done
      done
    fi
  fi

  # Update manifest final status
  tmp=$(mktemp)
  jq --arg st "$OVERALL" --arg ts "$(ts)" '.status = $st | .updated_at = $ts' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
else
  OVERALL="PASS"
fi

# ── Final report ───────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
if [[ "$OVERALL" == "PASS" ]]; then
  echo "│  🎉  GOAL COMPLETE — $GOAL_NAME                           │"
  echo "│  Sophia AI Factory READY for CEO handover                  │"
else
  echo "│  ⛔  GOAL INCOMPLETE — $GOAL_NAME                          │"
  echo "│  Review $REPORTS_DIR/handover-gate.json                    │"
fi
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Reports: $REPORTS_DIR"
echo "Manifest: $MANIFEST"

exit $( [[ "$OVERALL" == "PASS" ]] && echo 0 || echo 1 )
