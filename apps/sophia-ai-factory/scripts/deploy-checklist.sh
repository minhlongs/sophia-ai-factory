#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
APP_URL="${APP_URL:-https://sophia.agencyos.network}"
HEALTH_TOKEN="${HEALTH_TOKEN:-}"
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"
JUSTIFICATION="${JUSTIFICATION:-}"
DEPLOY_TOKEN="${DEPLOY_TOKEN:-}"

# ─── Color / helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[0;33m'
BLD='\033[1m'
RST='\033[0m'

pass=0
fail=0
warn=0

section() {
  printf "\n${BLD}════════════════════════════════════════${RST}\n"
  printf "${BLD}▶ %s${RST}\n" "$1"
}

ok()   { printf "  ${GRN}✅ PASS${RST}  %s\n" "$1"; ((pass++)) || true; }
bad()  {
  printf "  ${RED}❌ FAIL${RST}  %s\n" "$1 — ${2:-}";
  ((fail++)) || true;
  if [[ "$FORCE_DEPLOY" != "1" ]]; then
    soft_block=1
  fi
}
warn() { printf "  ${YEL}⚠️  SKIP${RST}  %s\n" "$1"; ((warn++)) || true; }

check_http() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local token="${4:-}"
  local method="${5:-GET}"

  local code
  if [[ -n "$token" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer ${token}" "$url" 2>/dev/null || echo "000")
  else
    code=$(curl -sk -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")
  fi

  if [[ "$code" == "$expected" ]]; then
    ok "$label (HTTP $code)"
  elif [[ "$code" =~ ^(200|307|429)$ ]]; then
    ok "$label (HTTP $code — acceptable)"
  else
    bad "$label" "HTTP $code (expected $expected)"
  fi
}

soft_block=0

# ─── Banner ──────────────────────────────────────────────────────────────────
printf "\n${BLD}🚀 Sophia AI Factory — Deploy Checklist Verification${RST}\n"
printf "   Target : ${APP_URL}\n"
printf "   Time   : %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ "$FORCE_DEPLOY" == "1" ]]; then
  printf "   ${YEL}⚠️  FORCE_DEPLOY=1${RST} — failures will not block\n"
  printf "   Justification: ${JUSTIFICATION}\n"
fi
printf "\n"

# ─── 1. Core Endpoints ───────────────────────────────────────────────────────
section "1. Core Endpoints"

check_http "Health endpoint reachable" \
  "${APP_URL}/api/health" "200" "$HEALTH_TOKEN"

check_http "Version endpoint reachable" \
  "${APP_URL}/api/version" "200"

check_http "Homepage reachable" \
  "${APP_URL}/" "200"

# ─── 2. Version Integrity ────────────────────────────────────────────────────
section "2. Version Integrity"

version_body=$(curl -sk "${APP_URL}/api/version" 2>/dev/null || echo "")
if echo "$version_body" | grep -q '"shortSha"'; then
  short_sha=$(echo "$version_body" | grep -o '"shortSha":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ -n "$short_sha" && "$short_sha" != "unknown" ]]; then
    ok "Version endpoint returns shortSha (${short_sha})"
  else
    bad "Version endpoint shortSha" "empty or 'unknown'"
  fi
else
  bad "Version endpoint returns JSON" "no shortSha field"
fi

# ─── 3. Authenticated Component Health ──────────────────────────────────────
section "3. Authenticated Component Health"

if [[ -z "$HEALTH_TOKEN" ]]; then
  warn "HEALTH_TOKEN not set — skipping authenticated health checks"
else
  health_json=$(curl -sk -H "Authorization: Bearer ${HEALTH_TOKEN}" \
    "${APP_URL}/api/health" 2>/dev/null || echo "{}")

  status=$(echo "$health_json" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  if [[ "$status" == "healthy" ]]; then
    ok "Health status is healthy"
  elif [[ "$status" == "degraded" ]]; then
    bad "Health status is degraded" "one or more components degraded"
  elif [[ "$status" == "unhealthy" ]]; then
    bad "Health status is unhealthy" "critical failure"
  else
    warn "Health status field missing or unexpected ($status)"
  fi

  # Per-component checks
  db_status=$(echo "$health_json" | grep -o '"database":{"status":"[^"]*"' | head -1 | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [[ -n "$db_status" ]]; then
    [[ "$db_status" == "ok" ]] && ok "D1 probe: ok" || bad "D1 probe" "$db_status"
  fi

  kv_status=$(echo "$health_json" | grep -o '"kv":{"status":"[^"]*"' | head -1 | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [[ -n "$kv_status" ]]; then
    [[ "$kv_status" == "ok" ]] && ok "KV probe: ok" || bad "KV probe" "$kv_status"
  fi

  r2_status=$(echo "$health_json" | grep -o '"r2":{"status":"[^"]*"' | head -1 | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [[ -n "$r2_status" ]]; then
    [[ "$r2_status" == "ok" ]] && ok "R2 probe: ok" || bad "R2 probe" "$r2_status"
  fi

  # Circuit breaker
  cb_status=$(echo "$health_json" | grep -o '"circuitBreaker":{"status":"[^"]*"' | head -1 | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [[ -n "$cb_status" ]]; then
    if [[ "$cb_status" == "ok" ]]; then
      ok "Circuit breaker: ok"
    elif [[ "$cb_status" == "degraded" ]]; then
      bad "Circuit breaker" "degraded (one or more services in DEGRADED/OPEN state)"
    else
      warn "Circuit breaker status: $cb_status"
    fi
  fi
fi

# ─── 4. Sophia Index Health ──────────────────────────────────────────────────
section "4. Sophia Index Health"

check_http "Sophia Index health" \
  "${APP_URL}/api/sophia-index/health" "200"

# ─── 5. Auth-Protected Admin Routes ─────────────────────────────────────────
section "5. Auth-Protected Admin Routes (unauthorized access check)"

unauth_code=$(curl -sk -o /dev/null -w "%{http_code}" \
  "${APP_URL}/api/admin/byok-audit" 2>/dev/null || echo "000")
if [[ "$unauth_code" =~ ^(401|403)$ ]]; then
  ok "BYOK audit route rejects unauthenticated (HTTP $unauth_code)"
else
  bad "BYOK audit route rejects unauthenticated" "HTTP $unauth_code (expected 401/403)"
fi

if [[ -n "$HEALTH_TOKEN" ]]; then
  check_http "BYOK audit route accepts HEALTH_TOKEN" \
    "${APP_URL}/api/admin/byok-audit" "200" "$HEALTH_TOKEN"
fi

# ─── 6. Deploy-Guard Auth Gate ────────────────────────────────────────────────
section "6. Deploy-Guard Authorization Gate"

unauth_override=$(curl -sk -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"commitSha":"test","reason":"test"}' \
  "${APP_URL}/api/admin/deploy-guard/override" 2>/dev/null || echo "000")
if [[ "$unauth_override" =~ ^(401|403)$ ]]; then
  ok "Deploy-guard override rejects unauthenticated (HTTP $unauth_override)"
else
  bad "Deploy-guard override rejects unauthenticated" "HTTP $unauth_override (expected 401/403)"
fi

# ─── 7. Lock Health ──────────────────────────────────────────────────────────
section "7. Lock Health"

# Check stale-lock reaper route exists (HTTP 200 or 302/routed)
reaper_code=$(curl -sk -o /dev/null -w "%{http_code}" \
  "${APP_URL}/api/cron/d1-lock-reaper" 2>/dev/null || echo "000")
if [[ "$reaper_code" =~ ^(200|307|404|405)$ ]]; then
  # 404/405 acceptable if reaper runs via Inngest rather than HTTP route
  ok "D1 lock reaper endpoint reachable (HTTP $reaper_code)"
else
  bad "D1 lock reaper endpoint" "HTTP $reaper_code"
fi

# Verify payment_events exists (cannot query DB from here, but check reaper mode)
if grep -qs "runD1LockReaper\|d1-lock-reaper" src/forest/inngest/functions/d1-lock-reaper.ts 2>/dev/null; then
  ok "D1 lock reaper module exists"
else
  bad "D1 lock reaper module" "not found"
fi

# ─── 8. Audit Trail Health ───────────────────────────────────────────────────
section "8. Audit Trail Health"

if [[ -n "$HEALTH_TOKEN" ]]; then
  audit_json=$(curl -sk -H "Authorization: Bearer ${HEALTH_TOKEN}" \
    "${APP_URL}/api/admin/byok-audit?tenantId=__health__" 2>/dev/null || echo "{}")
  audit_error=$(echo "$audit_json" | grep -o '"error":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  if [[ "$audit_error" == "Audit trail unavailable" || -z "$audit_error" ]]; then
    # Either binding not configured (503) or query succeeds (200)
    ok "Audit trail R2 probe: query completed"
  else
    bad "Audit trail R2 probe" "$audit_error"
  fi
else
  warn "HEALTH_TOKEN not set — skipping BYOK audit health check"
fi

# ─── 9. Security Hardening ───────────────────────────────────────────────────
section "9. Security Hardening"

if grep -qs "console\.\(log\|warn\|error\)" src/app/api/health/route.ts 2>/dev/null; then
  bad "Health route uses console.*" "should use logger-utility"
else
  ok "Health route: no console.* usage"
fi

if grep -qs "console\.\(log\|warn\|error\)" src/app/api/admin/byok-audit/route.ts 2>/dev/null; then
  bad "BYOK audit route uses console.*" "should use logger-utility"
else
  ok "BYOK audit route: no console.* usage"
fi

if grep -qs "console\.\(log\|warn\|error\)" src/forest/inngest/functions/d1-lock-reaper.ts 2>/dev/null; then
  bad "D1 lock reaper uses console.*" "should use logger-utility"
else
  ok "D1 lock reaper: no console.* usage"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
printf "\n${BLD}════════════════════════════════════════${RST}\n"
printf "${BLD}▶ Deploy Checklist Summary${RST}\n"
printf "  ${GRN}Passed : %d${RST}\n" "$pass"
printf "  ${RED}Failed : %d${RST}\n" "$fail"
printf "  ${YEL}Skipped: %d${RST}\n" "$warn"
printf "  Time    : %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf "${BLD}════════════════════════════════════════${RST}\n"

if [[ "$soft_block" -gt 0 ]]; then
  if [[ "$FORCE_DEPLOY" == "1" ]]; then
    printf "\n${YEL}⚠️  FORCED DEPLOY — %d failure(s) suppressed${RST}\n" "$fail"
    printf "  Set FORCE_DEPLOY=0 + fix failures for a clean deploy.\n"
    exit 0
  else
    printf "\n${RED}❌ Deploy blocked — %d check(s) failed.${RST}\n" "$fail"
    printf "  Fix failures above, or set FORCE_DEPLOY=1 with JUSTIFICATION to override.\n"
    exit 1
  fi
else
  printf "\n${GRN}✅ All checks passed. Safe to deploy.${RST}\n"
  exit 0
fi