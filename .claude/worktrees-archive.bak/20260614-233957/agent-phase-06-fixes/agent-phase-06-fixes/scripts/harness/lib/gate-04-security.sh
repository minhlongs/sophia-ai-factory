#!/usr/bin/env bash
# Gate 4 — Security scan (secrets + OWASP patterns)
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/security.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "security"

cd "$APP_DIR"
START_MS=$(date +%s%N)

FINDINGS=()
SEVERITY="pass"

# Check 1: Hardcoded secrets in src/
SECRET_PATTERN='(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{36,}|api[_-]?key\s*[:=]|password\s*[:=]|secret\s*[:=])'
SECRET_HITS=$(grep -rnE "$SECRET_PATTERN" src --include="*.ts" --include="*.tsx" --include="*.env*" 2>/dev/null | grep -v '__tests__' | grep -v '.test.' | grep -v '// ' | grep -v 'process.env' | grep -v 'env\.' | grep -v 'getEnv' | grep -v 'example' || true)
if [ -n "$SECRET_HITS" ]; then
  FINDINGS+=("{\"type\":\"hardcoded_secret\",\"severity\":\"critical\",\"count\":$(echo "$SECRET_HITS" | wc -l | tr -d ' ')}")
  SEVERITY="fail"
fi

# Check 2: SQL injection patterns (string concatenation in queries)
SQL_INJECT=$(grep -rn "query\|execute\|raw(" src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -E '\$\{|"\s*\+|'\''\s*\+' | grep -v '__tests__' | head -5 || true)
if [ -n "$SQL_INJECT" ]; then
  FINDINGS+=("{\"type\":\"sql_injection_risk\",\"severity\":\"high\",\"count\":$(echo "$SQL_INJECT" | wc -l | tr -d ' ')}")
  [ "$SEVERITY" != "fail" ] && SEVERITY="warn"
fi

# Check 3: Missing auth on API routes
UNAUTH_ROUTES=$(grep -rn "export async function \(GET\|POST\|PUT\|DELETE\)" src/app/api --include="*.ts" 2>/dev/null | while read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  # Check if file has getCurrentUser or auth check
  if ! grep -q "getCurrentUser\|createServerClient\|auth()" "$file" 2>/dev/null; then
    echo "$file"
  fi
done | sort -u | head -10 || true)
if [ -n "$UNAUTH_ROUTES" ]; then
  COUNT=$(echo "$UNAUTH_ROUTES" | wc -l | tr -d ' ')
  FINDINGS+=("{\"type\":\"missing_auth_check\",\"severity\":\"high\",\"count\":$COUNT}")
  [ "$SEVERITY" != "fail" ] && SEVERITY="warn"
fi

END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

DETAILS_JSON=$(printf '%s\n' "${FINDINGS[@]}" | jq -s '.' 2>/dev/null || echo "[]")

if [ "$SEVERITY" = "pass" ]; then
  gate_run "security" "$DURATION" "[]" "false"
elif [ "$SEVERITY" = "warn" ]; then
  gate_run "security" "$DURATION" "$DETAILS_JSON" "false"
else
  gate_fail "security" "$DURATION" "$DETAILS_JSON" "false"
fi

gate_summary
[ "$SEVERITY" = "fail" ] && exit 1 || exit 0
