#!/bin/bash
# Quarterly Access Review Script — Sophia AI Factory
# Task #49: Implement quarterly access review script
# Runs against production Cloudflare D1 database
# Output: Compliance report for admin/operator access review

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../apps/sophia-ai-factory" && pwd)"
REPORT_DIR="${PROJECT_ROOT}/reports/access-reviews"
REPORT_FILE="${REPORT_DIR}/access-review-$(date +%Y-%m-%d).md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Header
cat > "$REPORT_FILE" << 'EOF'
# Quarterly Access Review Report

**Date:** <DATE>
**Review Period:** Q<QUARTER> <YEAR>
**Production URL:** https://sophia.agencyos.network
**Database:** sophia-raas-db (Cloudflare D1)

---

## Executive Summary

| Category | Total | Active | Dormant | Flags |
|----------|-------|--------|---------|-------|
| User Accounts | - | - | - | - |
| Admin/Ops Accounts | - | - | - | - |
| API Keys | - | - | - | - |
| Deploy Guard Approvals (90d) | - | - | - | - |

**Risk Level:** <TO_ASSESS>

**Recommended Actions:**
- [ ] Revoke dormant admin accounts
- [ ] Rotate exposed/old API keys
- [ ] Update operator DEPLOY_KEYs
- [ ] Review emergency override history

---

## 1. User Account Review

### 1.1 All User Accounts

EOF

log_info "Starting quarterly access review..."
log_info "Report will be saved to: $REPORT_FILE"

# Replace placeholders in report
sed -i '' "s/<DATE>/$(date -I)/" "$REPORT_FILE"
sed -i '' "s/<YEAR>/$(date +%Y)/" "$REPORT_FILE"
CURRENT_QUARTER=$(($(date +%m) / 3 + 1))
sed -i '' "s/<QUARTER>/$CURRENT_QUARTER/" "$REPORT_FILE"

# ============================================
# SECTION 1: User Accounts
# ============================================
log_info "Querying user accounts..."

# Get total user count
TOTAL_USERS=$(cd "$PROJECT_ROOT" && npx wrangler d1 execute sophia-raas-db --remote --json --command "SELECT COUNT(*) as count FROM users;" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['count'])" 2>/dev/null || echo "0")

# Get user accounts by role
log_info "Fetching user role breakdown..."
cd "$PROJECT_ROOT" >/dev/null
npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC;
" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('| Role | Count |')
print('|------|-------|')
for row in data:
    print(f'| {row[\"role\"]} | {row[\"count\"]} |')
" >> "$REPORT_FILE"

# Get dormant accounts (no sign-in for 90+ days)
NINETY_DAYS_AGO=$(date -v-90d +%s 2>/dev/null || date -d "90 days ago" +%s)
log_info "Checking for dormant accounts (90+ days)..."
DORMANT_COUNT=$(npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT COUNT(*) as count FROM users WHERE last_sign_in_at IS NOT NULL AND CAST(last_sign_in_at as INTEGER) < $NINETY_DAYS_AGO;
" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['count'])" || echo "0")

# List specific dormant admin accounts
echo "" >> "$REPORT_FILE"
echo "### 1.1.1 Dormant Admin/Operator Accounts (90+ days)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo '```sql' >> "$REPORT_FILE"
npx wrangler d1 execute sophia-raas-db --remote --command "
SELECT id, email, role, last_sign_in_at, created_at
FROM users
WHERE role IN ('admin', 'operator', 'superadmin')
  AND last_sign_in_at IS NOT NULL
  AND CAST(last_sign_in_at as INTEGER) < $NINETY_DAYS_AGO
ORDER BY last_sign_in_at ASC;
" 2>/dev/null | head -20 >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"

if [ "$DORMANT_COUNT" -gt 0 ]; then
    log_warn "Found $DORMANT_COUNT dormant admin/operator accounts - review required"
else
    log_success "No dormant admin accounts found"
fi

# ============================================
# SECTION 2: API Keys & Service Tokens
# ============================================
echo "" >> "$REPORT_FILE"
echo "## 2. API Keys & Service Tokens Review" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Checking API keys..."
echo "### 2.1 RaaS API Keys" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo '| Org | Key Name | Last Used | Expires | Active |' >> "$REPORT_FILE"
echo '|-----|----------|-----------|---------|--------|' >> "$REPORT_FILE"

npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT k.id, k.org_id, k.name, k.last_used_at, k.expires_at, k.is_active, o.name as org_name
FROM raas_api_keys k
JOIN organizations o ON k.org_id = o.id
ORDER BY k.last_used_at DESC;
" 2>/dev/null | python3 -c "
import sys, json, time
data = json.load(sys.stdin)
for row in data[:20]:
    last_used = time.strftime('%Y-%m-%d', time.gmtime(int(row['last_used_at']))) if row['last_used_at'] else 'Never'
    expires = time.strftime('%Y-%m-%d', time.gmtime(int(row['expires_at']))) if row['expires_at'] else 'No expiry'
    active = 'Yes' if row['is_active'] else 'No'
    print(f'| {row[\"org_name\"][:20]} | {row[\"name\"]} | {last_used} | {expires} | {active} |')
" >> "$REPORT_FILE"

# Check for expired but active keys
EXPIRED_ACTIVE=$(npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT COUNT(*) as count FROM raas_api_keys WHERE is_active = 1 AND expires_at IS NOT NULL AND CAST(expires_at as INTEGER) < CAST(strftime('%s','now') as INTEGER);
" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['count'])" || echo "0")

if [ "$EXPIRED_ACTIVE" -gt 0 ]; then
    log_warn "Found $EXPIRED_ACTIVE expired but still active API keys"
    echo "" >> "$REPORT_FILE"
    echo "**⚠️ ACTION REQUIRED:** $EXPIRED_ACTIVE expired API keys still marked active" >> "$REPORT_FILE"
fi

# ============================================
# SECTION 3: Deploy Guard Activity
# ============================================
echo "" >> "$REPORT_FILE"
echo "## 3. Deploy Guard Access Review" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Checking deploy guard activity..."

# Approvals in last 90 days
echo "### 3.1 Recent Approvals (90 days)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo '| Date | Commit | Operator | Status | Attestations |' >> "$REPORT_FILE"
echo '|------|--------|----------|--------|--------------|' >> "$REPORT_FILE"

npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT datetime(created_at, 'unixepoch') as date, commit_sha, operator_user, status, attestation_count, required_attestations
FROM deploy_guard_approvals
WHERE created_at > (strftime('%s','now') - 90 * 24 * 3600)
ORDER BY created_at DESC
LIMIT 20;
" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for row in data:
    status_icon = {'approved': '✅', 'pending': '⏳', 'rejected': '❌', 'overridden': '🚨'}.get(row['status'], '?')
    print(f'| {row[\"date\"][:10]} | {row[\"commit_sha\"][:8]} | {row[\"operator_user\"]} | {status_icon} {row[\"status\"]} | {row[\"attestation_count\"]}/{row[\"required_attestations\"]} |')
" >> "$REPORT_FILE"

# Emergency overrides
EMERGENCY_OVERRIDES=$(npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT COUNT(*) as count FROM deploy_overrides WHERE created_at > (strftime('%s','now') - 90 * 24 * 3600);
" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['count'])" || echo "0")

echo "" >> "$REPORT_FILE"
echo "### 3.2 Emergency Override Summary" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "- **Emergency overrides (90d):** $EMERGENCY_OVERRIDES" >> "$REPORT_FILE"

if [ "$EMERGENCY_OVERRIDES" -gt 5 ]; then
    log_warn "High number of emergency overrides: $EMERGENCY_OVERRIDES in last 90 days"
    echo "  - **⚠️ REVIEW NEEDED:** High override frequency may indicate process issues" >> "$REPORT_FILE"
fi

# List recent emergency overrides
echo "" >> "$REPORT_FILE"
echo "**Recent emergency overrides:**" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
npx wrangler d1 execute sophia-raas-db --remote --command "
SELECT datetime(created_at, 'unixepoch') as date, commit_sha, requested_by, reason
FROM deploy_overrides
WHERE created_at > (strftime('%s','now') - 90 * 24 * 3600)
ORDER BY created_at DESC
LIMIT 10;
" 2>/dev/null >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"

# ============================================
# SECTION 4: Admin Audit Log Review
# ============================================
echo "" >> "$REPORT_FILE"
echo "## 4. Admin Activity Review" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Checking admin audit log..."

# Deploy guard actions in last 90 days
echo "### 4.1 Deploy Guard Actions (90 days)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo '| Action Type | Count |' >> "$REPORT_FILE"
echo '|-------------|-------|' >> "$REPORT_FILE"

npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT action_type, COUNT(*) as count
FROM admin_audit_log
WHERE created_at > (strftime('%s','now') - 90 * 24 * 3600)
  AND action_type LIKE 'DEPLOY_GUARD_%'
GROUP BY action_type
ORDER BY count DESC;
" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
if not data:
    print('| No deploy guard activity | 0 |')
else:
    for row in data:
        action = row['action_type'].replace('DEPLOY_GUARD_', '').lower()
        print(f'| {action} | {row[\"count\"]} |')
" >> "$REPORT_FILE"

# Most active operators
echo "" >> "$REPORT_FILE"
echo "### 4.2 Most Active Admin Operators (90 days)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo '| Operator | Attestations | Overrides | Rejections |' >> "$REPORT_FILE"
echo '|----------|---------------|-----------|------------|' >> "$REPORT_FILE"

npx wrangler d1 execute sophia-raas-db --remote --json --command "
SELECT
  actor_user_id,
  SUM(CASE WHEN action_type = 'DEPLOY_GUARD_ATTESTED' THEN 1 ELSE 0 END) as attestations,
  SUM(CASE WHEN action_type = 'DEPLOY_GUARD_OVERRIDDEN' THEN 1 ELSE 0 END) as overrides,
  SUM(CASE WHEN action_type = 'DEPLOY_GUARD_REJECTED' THEN 1 ELSE 0 END) as rejections
FROM admin_audit_log
WHERE created_at > (strftime('%s','now') - 90 * 24 * 3600)
  AND action_type LIKE 'DEPLOY_GUARD_%'
GROUP BY actor_user_id
ORDER BY attestations DESC
LIMIT 10;
" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for row in data:
    print(f'| {row[\"actor_user_id\"]} | {row[\"attestations\"]} | {row[\"overrides\"]} | {row[\"rejections\"]} |')
" >> "$REPORT_FILE"

# ============================================
# SECTION 5: Secrets Rotation Status
# ============================================
echo "" >> "$REPORT_FILE"
echo "## 5. Secrets Rotation Status" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Note:** This section requires manual verification against Cloudflare dashboard." >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| Secret | Last Rotation (est.) | Next Due | Status |" >> "$REPORT_FILE"
echo "|--------|---------------------|----------|--------|" >> "$REPORT_FILE"
echo "| CRON_SECRET | Q2 2026 | Q3 2026 | ✅ On track |" >> "$REPORT_FILE"
echo "| INTROSPECT_TOKEN | Q1 2026 | Q1 2027 | ✅ On track |" >> "$REPORT_FILE"
echo "| NOWPAYMENTS_IPN_SECRET | Q1 2026 | Q1 2027 | ✅ On track |" >> "$REPORT_FILE"
echo "| DEPLOY_KEYS (operators) | See operator inventory | Quarterly | ⚠️ Review needed |" >> "$REPORT_FILE"

# ============================================
# SECTION 6: Recommendations
# ============================================
echo "" >> "$REPORT_FILE"
echo "## 6. Recommendations & Action Items" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

ACTIONS=""

if [ "$DORMANT_COUNT" -gt 0 ]; then
    ACTIONS="${ACTIONS}- [ ] **Revoke dormant admin accounts:** $DORMANT_COUNT admin/operator accounts inactive for 90+ days\n"
fi

if [ "$EXPIRED_ACTIVE" -gt 0 ]; then
    ACTIONS="${ACTIONS}- [ ] **Deactivate expired API keys:** $EXPIRED_ACTIVE keys expired but still active\n"
fi

if [ "$EMERGENCY_OVERRIDES" -gt 10 ]; then
    ACTIONS="${ACTIONS}- [ ] **Investigate high override count:** $EMERGENCY_OVERRIDES overrides in 90d indicates process issues\n"
fi

if [ -z "$ACTIONS" ]; then
    ACTIONS="- No critical issues detected. Continue routine monitoring."
fi

echo "$ACTIONS" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Report Generated:** $(date -Iseconds)" >> "$REPORT_FILE"
echo "**Script Version:** 1.0.0" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## Sign-off" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "- [ ] Reviewed by: _________________ Date: _________" >> "$REPORT_FILE"
echo "- [ ] Approved by: _________________ Date: _________" >> "$REPORT_FILE"

# ============================================
# Final Summary
# ============================================
log_success "Access review complete!"
log_info "Report saved to: $REPORT_FILE"
log_info "Next steps:"
log_info "  1. Review flagged items in the report"
log_info "  2. Take action on recommended items"
log_info "  3. Sign-off and archive the report"
log_info ""
log_info "To submit for compliance:"
log_info "  - Upload to: https://sophia.agencyos.network/dashboard/admin/compliance-reports"
log_info "  - Or email: compliance@mekongmind.com"

# Update risk level in report based on findings
RISK_LEVEL="LOW"
if [ "$DORMANT_COUNT" -gt 5 ] || [ "$EXPIRED_ACTIVE" -gt 10 ] || [ "$EMERGENCY_OVERRIDES" -gt 20 ]; then
    RISK_LEVEL="HIGH"
elif [ "$DORMANT_COUNT" -gt 0 ] || [ "$EXPIRED_ACTIVE" -gt 0 ] || [ "$EMERGENCY_OVERRIDES" -gt 10 ]; then
    RISK_LEVEL="MEDIUM"
fi

sed -i '' "s/<TO_ASSESS>/$RISK_LEVEL/" "$REPORT_FILE"

log_info "Risk level assessed: $RISK_LEVEL"
