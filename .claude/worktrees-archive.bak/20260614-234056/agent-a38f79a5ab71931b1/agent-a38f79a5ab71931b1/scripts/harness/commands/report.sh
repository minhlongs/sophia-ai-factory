#!/usr/bin/env bash
# scripts/harness/commands/report.sh
# `harness report [--format markdown|json]`
# Generates a quality report from last-run.json.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$HARNESS_DIR/state"
REPORTS_DIR="$(cd "$HARNESS_DIR/../.." && pwd)/plans/reports"
APP_DIR="$(cd "$HARNESS_DIR/../.." && pwd)/apps/sophia-ai-factory"

FORMAT="${1:-markdown}"
STATE_FILE="$STATE_DIR/last-run.json"

if [ ! -f "$STATE_FILE" ]; then
  echo "No previous run found. Run 'harness audit' first."
  exit 1
fi

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPORT_SLUG="harness-audit-$(date +%y%m%d-%H%M)"
REPORT_FILE="$REPORTS_DIR/${REPORT_SLUG}.md"

# Parse state
DATA=$(cat "$STATE_FILE")
OVERALL=$(echo "$DATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('overall','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
TS=$(echo "$DATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('timestamp','?'))" 2>/dev/null || echo "?")

# Count pass/fail/skip
PASS_COUNT=$(echo "$DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); g=d.get('gates',{}); print(sum(1 for v in g.values() if v.get('status')=='pass'))" 2>/dev/null || echo "0")
FAIL_COUNT=$(echo "$DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); g=d.get('gates',{}); print(sum(1 for v in g.values() if v.get('status')=='fail'))" 2>/dev/null || echo "0")
SKIP_COUNT=$(echo "$DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); g=d.get('gates',{}); print(sum(1 for v in g.values() if v.get('status')=='skip'))" 2>/dev/null || echo "0")

# Git info
cd "$APP_DIR"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

if [ "$FORMAT" = "json" ]; then
  echo "$DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
d['branch'] = '$BRANCH'
d['sha'] = '$SHA'
print(json.dumps(d, indent=2))
"
  exit 0
fi

# ── Markdown report ────────────────────────────────────────────
cat > "$REPORT_FILE" << EOF
# Harness Audit Report

**Generated:** $TIMESTAMP
**Branch:** \`$BRANCH\`
**SHA:** \`$SHA\`
**Overall:** $([ "$OVERALL" = "PASS" ] && echo "✅ PASS" || echo "❌ FAIL")

## Summary

| Metric | Value |
|--------|-------|
| Pass | $PASS_COUNT |
| Fail | $FAIL_COUNT |
| Skip | $SKIP_COUNT |
| Overall | $OVERALL |

## Gate Results

| # | Gate | Status | Duration | Details |
|---|------|--------|----------|---------|
EOF

# Add gate rows
echo "$DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
gates = d.get('gates', {})
for i, (name, info) in enumerate(gates.items(), 1):
    status = info.get('status', '?')
    icon = {'pass':'✅','fail':'❌','skip':'⏭️'}.get(status, '?')
    dur = info.get('duration_ms', 0)
    details = info.get('details', [])
    detail_str = ', '.join(str(x) for x in details) if details else '-'
    if len(detail_str) > 60:
        detail_str = detail_str[:57] + '...'
    print(f'| {i} | {name} | {icon} {status} | {dur}ms | {detail_str} |')
" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << EOF

## Evidence Files

EOF

# List evidence files modified today
ls -lt "$APP_DIR/plans/evidence/" 2>/dev/null | head -9 | tail -8 | awk '{print "  - " $9 " (" $6 " " $7 " " $8 ")"}' >> "$REPORT_FILE" || echo "  - (none)" >> "$REPORT_FILE"

echo ""
echo "Report written to: $REPORT_FILE"
cat "$REPORT_FILE"
