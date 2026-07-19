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
