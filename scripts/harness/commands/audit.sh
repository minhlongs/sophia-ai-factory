#!/usr/bin/env bash
# scripts/harness/commands/audit.sh
# `harness audit [--gate N] [--fix] [--skip N,M,...]`
# Runs quality gates 1-N, optionally auto-fixes, generates report.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB_DIR="$HARNESS_DIR/lib"
APP_DIR="$(cd "$HARNESS_DIR/../.." && pwd)/apps/sophia-ai-factory"

# ── Args ───────────────────────────────────────────────────────
GATE_FILTER=""
FIX_MODE="false"
SKIP_GATES=""

while [ $# -gt 0 ]; do
  case "$1" in
    --gate)  GATE_FILTER="$2"; shift 2 ;;
    --fix)   FIX_MODE="true"; shift ;;
    --skip)  SKIP_GATES="$2"; shift 2 ;;
    *)       echo "Usage: audit.sh [--gate N] [--fix] [--skip 2,4]"; exit 1 ;;
  esac
done

# ── Source framework ───────────────────────────────────────────
source "$LIB_DIR/gates.sh"

# ── Register gates ─────────────────────────────────────────────
GATES=("typecheck" "lint" "tests" "security" "bundle" "i18n" "migrations" "sha-match")

# Apply --skip filter
SKIP_LIST=""
if [ -n "$SKIP_GATES" ]; then
  SKIP_LIST=$(echo "$SKIP_GATES" | tr ',' '\n' | sort -rn)
fi

# ── Run gates ──────────────────────────────────────────────────
OVERALL="PASS"
FAILED_GATES=()

for idx in "${!GATES[@]}"; do
  gate_name="${GATES[$idx]}"
  gate_num=$((idx + 1))

  # --gate filter
  if [ -n "$GATE_FILTER" ] && [ "$gate_num" -ne "$GATE_FILTER" ]; then
    continue
  fi

  # --skip filter
  if [ -n "$SKIP_LIST" ]; then
    if echo "$SKIP_LIST" | grep -q "^${gate_num}$"; then
      gate_skip "$gate_name" "user-skipped"
      continue
    fi
  fi

  echo ""
  echo "═══ Gate $gate_num/8: $gate_name ═══"

  GATE_SCRIPT="$LIB_DIR/gate-$(printf '%02d' $gate_num)-${gate_name}.sh"
  if [ ! -f "$GATE_SCRIPT" ]; then
    gate_skip "$gate_name" "script not found: $GATE_SCRIPT"
    continue
  fi

  if [ "$FIX_MODE" = "true" ] && [ "$gate_name" = "lint" ]; then
    # Auto-fix lint before checking
    (cd "$APP_DIR" && npm run lint -- --fix 2>&1) || true
  fi

  if [ "$FIX_MODE" = "true" ] && [ "$gate_name" = "i18n" ]; then
    # Auto-fix i18n via scaffold
    (cd "$APP_DIR" && npm run i18n:validate 2>&1) || true
  fi

  set +e
  bash "$GATE_SCRIPT"
  GATE_EXIT=$?
  set -e

  # Check if this gate failed (gates.sh sets status via gate_fail)
  current_status="${GATE_STATUS[$gate_name]:-}"
  if [ "$current_status" = "fail" ]; then
    OVERALL="FAIL"
    FAILED_GATES+=("$gate_name")
  fi
done

# ── Summary ────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  HARNESS AUDIT COMPLETE"
echo "═══════════════════════════════════════════════════════════════"

gate_summary 2>/dev/null || true

# ── Save state ─────────────────────────────────────────────────
gate_save_state "$OVERALL"

# ── Report fixable gates ───────────────────────────────────────
if [ "$FIX_MODE" = "true" ]; then
  echo ""
  echo "Fixable gates that still need attention:"
  for name in "${GATE_ORDER[@]}"; do
    if [ "${GATE_STATUS[$name]}" = "fail" ] && [ "${GATE_FIXABLE[$name]}" = "true" ]; then
      echo "  ⚠️  $name — re-run without --fix or fix manually"
    fi
  done
fi

# ── Exit code ──────────────────────────────────────────────────
if [ "$OVERALL" = "FAIL" ]; then
  echo ""
  echo "Failed gates: ${FAILED_GATES[*]}"
  exit 1
fi

echo ""
echo "All gates passed."
exit 0
