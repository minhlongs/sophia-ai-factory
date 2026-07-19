# Incident Response Runbook — Sophia AI Factory

This runbook outlines procedures for diagnosing, containing, and resolving production incidents on the Sophia AI Factory platform.

---

## 1. Severity Levels

| Level | Description | SLA (Response / Resolution) | Actions |
|---|---|---|---|
| **P0 — Critical** | Platform is entirely offline (HTTP 500/503), checkout/payment is broken, or active data exposure is detected. | 15 min / 1 hour | Convene emergency response channel. Trigger rollback or apply hotfix. |
| **P1 — High** | Core features (e.g. video rendering, login) are failing for multiple users. | 30 min / 4 hours | Assign triage lead. Monitor error logs. Post updates on status channel. |
| **P2 — Medium** | Intermittent errors, background job delays, or single-tenant failures. | 2 hours / 24 hours | File tracking issue. Schedule fix for next patch release. |
| **P3 — Low** | Typos, minor UI display anomalies, or non-blocking issues. | 24 hours / Next release | Address in standard sprint cycles. |

---

## 2. Immediate Diagnostic Checks (First Responder)

Run these checks within the first 60 seconds of a suspected incident:

```bash
# 1. Check server HTTP status
curl -sI https://sophia.agencyos.network | head -3

# 2. Check system health endpoint
curl -s https://sophia.agencyos.network/api/health | jq .

# 3. Verify deployed code version matches recent commits
curl -s https://sophia.agencyos.network/api/version | jq .shortSha

# 4. Stream active server logs to inspect errors
npx wrangler tail --name sophia-ai-factory
```

---

## 3. Reversion / Rollback Steps

If a new deployment is identified as the root cause of an outage, revert to the last stable deployment:

```bash
# Step 1: Rollback active production build on Cloudflare
npx wrangler rollback --name sophia-ai-factory --yes

# Step 2: Confirm rollback is active via version API
sleep 5
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
```

---

## 4. D1 Database Restore Procedure

In the event of database corruption or deletion, restore from the daily snapshots stored in Cloudflare R2:

1. **Locate backups** in the `sophia-backups` R2 bucket (files are structured as `sophia-d1-<timestamp>.sql.gz`).
2. **Download and decompress** the target SQL file.
3. **Execute SQL recovery** against the production database:
   ```bash
   npx wrangler d1 execute sophia-raas-db --file=/tmp/sophia-d1-target.sql --remote
   ```
4. **Run health checks** to confirm database access is restored.

---

## 4. Deploy Guard Incidents

Deploy Guard is the SOC 2-mandated approval mechanism for deployments (CC6.1 - separation of duties). When guard blocks a deployment, follow these procedures.

### Incident Types

| Type | Description | Severity | SLA |
|------|-------------|----------|-----|
| **Blocked Deploy** | Deploy script fails due to insufficient attestations | P2 | 4 hours |
| **Rejected Approval** | Admin rejects a pending deployment | P2 | Next business day |
| **Emergency Override** | Operator bypasses guard with emergency reason | P1 | 1 hour review |
| **Quorum Not Reached** | Approval pending with insufficient signatures | P3 | Next maintenance window |

### Diagnostic Commands

```bash
# 1. Check current pending approvals
curl -s https://sophia.agencyos.network/api/admin/deploy-guard/pending \
  -H "Authorization: Bearer $INTROSPECT_TOKEN" | jq .

# 2. Check approval history (last 24h)
curl -s https://sophia.agencyos.network/api/admin/deploy-guard/history \
  -H "Authorization: Bearer $INTROSPECT_TOKEN" | jq .

# 3. Check specific approval details
curl -s https://sophia.agencyos.network/api/admin/deploy-guard/approvals/<approval-id> \
  -H "Authorization: Bearer $INTROSPECT_TOKEN" | jq .

# 4. Query database directly for recent approvals
npx wrangler d1 execute sophia-raas-db --remote --command \
  "SELECT id, commit_sha, status, attestation_count, required_attestations, created_at FROM deploy_guard_approvals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;"
```

### Resolution Procedures

#### Scenario A: Deploy Blocked Due to Missing Attestations

**Detection:** `./scripts/deploy-with-sha.sh` exits with "Insufficient attestations" message.

**Steps:**
1. **Verify approval exists:** Run diagnostic commands above to get the `approval_id`.
2. **Notify admin operators:** Alert operators via Telegram/Slack to attest the deployment.
3. **Operator attestation:** Each operator visits `/dashboard/admin/deploy-guard` and clicks **Attest**.
4. **Verify quorum:** Once `attestation_count >= required_attestations` (typically 2), deploy automatically proceeds.
5. **If urgent:** Use Emergency Override (see Scenario B).

**RTO:** 30 minutes to 2 hours (depends on operator availability).

---

#### Scenario B: Emergency Override Required

**When to use:**
- Production hotfix with operators unavailable
- Guard malfunction blocking critical security patch
- Time-sensitive compliance fix

**Steps:**
1. **Execute emergency override:**
   ```bash
   # Option 1: Via deploy script with override flag
   ./scripts/deploy-with-sha.sh --override "Urgent: Production outage fix - P0 incident"

   # Option 2: Via Admin UI
   # Navigate to: https://sophia.agencyos.network/dashboard/admin/deploy-guard
   # Scroll to Emergency Override section, enter commit SHA and reason
   ```

2. **Override record created:** A `deploy_overrides` record is inserted with `requested_by` and reason.
3. **Deploy proceeds:** Guard bypasses quorum check for this commit.
4. **Post-deploy audit:** Admin reviews override within 24 hours and documents justification.

**RTO:** 5-15 minutes.

---

#### Scenario C: Rejected Approval Investigation

**Detection:** Approval status shows `rejected` in history.

**Steps:**
1. **Query rejection reason:**
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --command \
     "SELECT payload FROM admin_audit_log WHERE action_type = 'DEPLOY_GUARD_REJECTED' ORDER BY created_at DESC LIMIT 1;"
   ```

2. **Review the rejected deployment:**
   - Check diff summary and files changed
   - Identify compliance concerns or code quality issues

3. **Fix and retry:**
   - Address rejection reason (e.g., missing tests, security concern)
   - Create new commit and restart deployment flow

4. **If rejection appears erroneous:** Escalate to senior admin for review and possible override.

---

#### Scenario D: Stuck Approval (No Operators Available)

**Detection:** Approval pending > 24 hours, operators unavailable.

**Steps:**
1. **Check operator availability:** Confirm on-call rotation and contact info.
2. **Escalate to secondary approvers:** If primary operators unavailable, use backup admin accounts.
3. **Last resort - Manual Deploy with Override:**
   ```bash
   ./scripts/deploy-with-sha.sh --override "No operators available after 24h - business continuity"
   ```

4. **Post-incident:** Review operator rotation procedures to prevent recurrence.

### Prevention & Monitoring

- **On-call rotation:** Ensure at least 2 admins have active DEPLOY_KEYs and access to Admin UI.
- **Approval SLA monitoring:** Alert if approvals pending > 4 hours.
- **Quarterly access review:** Verify admin accounts and DEPLOY_KEY distribution (see `QUARTERLY_ACCESS_REVIEW.md`).

### Audit Trail

All deploy guard actions are logged to `admin_audit_log` with:
- `actor_user_id` (operator performing action)
- `action_type`: `DEPLOY_GUARD_CREATED`, `DEPLOY_GUARD_ATTESTED`, `DEPLOY_GUARD_REJECTED`, `DEPLOY_GUARD_OVERRIDDEN`, `DEPLOY_GUARD_APPROVED`
- `payload`: JSON with `approvalId`, `reason`, `metadata`

Access logs via Admin UI → Deploy Guard → History tab, or query database directly.

---

## 5. Security Incident Mitigation

### Cross-Tenant Data Access
If a cross-tenant data leak is reported or suspected:
1. **Revoke Active Sessions**: Terminate all active sessions for the affected org ID.
2. **Lock Tenant Accounts**: Temporarily disable logins to the compromised organization via the Admin dashboard.
3. **Audit Log Forensics**: Query the `audit_logs` table for unauthorized org access patterns.

### BYOK Key Exposure
If a master encryption key (`BYOK_MASTER_KEY` or `CREDENTIALS_MASTER_KEY`) is suspected of exposure:
1. **Rotate Master Key**: Generate a new key and update the secret in wrangler:
   ```bash
   npx wrangler secret put BYOK_MASTER_KEY
   ```
2. **Redeploy and Re-encrypt**: Deploy the app and trigger the credential re-encryption script.
3. **Customer Notification**: Prompt users to re-save their API credentials in the Setup Wizard.
