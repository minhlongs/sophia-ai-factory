#!/usr/bin/env bash
# Goal Runtime: Pre-flight checker
# Usage: pre-flight.sh <goal-manifest.json>
set -euo pipefail

MANIFEST="${1:?Usage: pre-flight.sh <goal-manifest.json>}"
MANIFEST_DIR="$(dirname "$MANIFEST")"
APP_DIR="/Users/macbook/repos/sophia-ai-factory/apps/sophia-ai-factory"

cd "$APP_DIR"

# ── Check 1: File Ownership Conflicts ──────────────────────────────
CONFLICTS=""
declare -A FILE_MAP

while IFS= read -r triplet; do
  PLAN_ID=$(echo "$triplet" | cut -d'|' -f1)
  PHASE_ID=$(echo "$triplet" | cut -d'|' -f2)
  FILE=$(echo "$triplet" | cut -d'|' -f3)

  if [[ -n "${FILE_MAP[$FILE]+x}" ]]; then
    PREV="${FILE_MAP[$FILE]}"
    CONFLICTS="${CONFLICTS}\n  CONFLICT: $FILE\n    -> $PREV\n    -> $PLAN_ID/phase-$PHASE_ID"
  else
    FILE_MAP["$FILE"]="$PLAN_ID/phase-$PHASE_ID"
  fi
done < <(jq -r 'if type=="array" then .[] else . end | .plans // . | .[]? | .id as $p | (.phases // [])[] | [$p, .id, (.files_owned // [])[]] | @tsv' "$MANIFEST" 2>/dev/null)

if [[ -n "$CONFLICTS" ]]; then
  echo "❌ FILE_CONFLICTS=FAIL"
  echo -e "$CONFLICTS"
  exit 1
else
  echo "✅ FILE_CONFLICTS=PASS (no overlaps detected)"
fi

# ── Check 2: Plan directories exist ────────────────────────────────
MISSING_DIRS=""
while IFS= read -r plan_id; do
  PLAN_DIR="$APP_DIR/plans/$plan_id"
  if [[ ! -d "$PLAN_DIR" ]]; then
    MISSING_DIRS="${MISSING_DIRS}\n  MISSING: $plan_dir"
  fi
  if [[ ! -f "$PLAN_DIR/plan.md" ]]; then
    MISSING_DIRS="${MISSING_DIRS}\n  NO plan.md: $plan_id"
  fi
done < <(jq -r '.plans[]?.id' "$MANIFEST" 2>/dev/null)

if [[ -n "$MISSING_DIRS" ]]; then
  echo "❌ PLAN_DIRS=FAIL"
  echo -e "$MISSING_DIRS"
  exit 1
else
  echo "✅ PLAN_DIRS=PASS (all plan dirs exist)"
fi

# ── Check 3: Environment ───────────────────────────────────────────
ENV_FAIL=""
if [[ ! -f "$APP_DIR/.env" ]]; then
  ENV_FAIL="⚠ .env not found (may be OK if using CF secrets)"
fi
# Quick sanity: package.json exists
if [[ ! -f "$APP_DIR/package.json" ]]; then
  ENV_FAIL="${ENV_FAIL}\n  CRITICAL: package.json missing, wrong directory?"
fi

if [[ -n "$ENV_FAIL" ]]; then
  echo "⚠️  ENV=WARNING"
  echo -e "$ENV_FAIL"
else
  echo "✅ ENV=PASS"
fi

echo ""
echo "Pre-flight complete. Ready to spawn."
