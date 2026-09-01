# Incident Response Runbook — Sophia AI Factory

**Version:** 1.1.0  
**Last updated:** 2026-08-31  
**Scope:** Production at https://sophia.agencyos.network  
**Deploy:** CF-direct via wrangler CLI (GitHub Actions disabled by design)

---

## Severity Ladder

| Level | Examples | SLA | Actions |
|-------|----------|-----|---------|
| **P0 — Critical** | Platform down (HTTP 503+) · checkout broken · BYOK key compromise · cross-tenant data leak | 15 min detection, 60 min fix | War room (Slack #incidents). Page on-call. Rollback or hotfix. |
| **P1 — High** | API endpoint 500 error rate >5% · NOWPayments IPN drop >10 min · webhook timeout >30s | 30 min detection, 4 hr fix | Alert escalation. Debug on-call. Post postmortem. |
| **P2 — Medium** | Campaign generation slow (>60s) · video queue backlog >100 jobs · single user lockout · incomplete payment event | 2 hr detection, 24 hr fix | Triage in standup. Fix in next sprint if non-critical. |
| **P3 — Low** | UI typo · analytics delay >1 hr · non-urgent migration needed | Next business day | Log in JIRA. Plan in next 2-week sprint. |

---

## First-Response Checklist (60 seconds)

**Goal:** Confirm prod is down or recover without escalation.

```bash
# 1. Detect: Is platform accessible?
curl -sI https://sophia.agencyos.network | head -3
# Expected: HTTP/2 200 OK
# If: HTTP 502/503/504 or timeout → PLATFORM DOWN (P0)

# 2. Detect: Is health endpoint responding?
curl -s https://sophia.agencyos.network/api/health | jq .status
# Expected: "ok" or similar
# If: timeout/error → PLATFORM DOWN (P0)

# 3. Detect: Is deploy SHA live?
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Compare to: git rev-parse HEAD | cut -c1-8
# If: mismatch → STALE DEPLOY (attempt redeploy)
# If: match → deploy OK, issue is operational

# 4. Detect: Sentry alerts (if configured)
# Check Slack #incidents for Sentry page
# If: SENTRY_AUTH_TOKEN provisioned, errors flow to https://sentry.io → check org dashboard

# 5. Poll Cloudflare Logs (canonical real-time stream)
cd apps/sophia-ai-factory
npx wrangler tail --status ok,error
# Expected: 200/304 responses, occasional 4xx for invalid requests
# If: 500s or errors → DEBUG REQUIRED (see Debug Path below)
```

**Decision Tree:**
- HTTP 200 + `/api/version` matches HEAD SHA → **Platform OK, issue is operational**
- HTTP 200 + `/api/version` does NOT match HEAD SHA → **Stale deploy (see Rollback below)**
- HTTP 502/503/timeout → **Platform down (see Rollback below)**

---

## Rollback Procedure

**Goal:** Revert to last-known-good deploy in ~3 minutes.

```bash
cd apps/sophia-ai-factory

# Step 1: Identify last good SHA
git log --oneline -10
# Find the last deploy SHA from: git show <sha>:src/app/api/version/route.ts
# OR check Cloudflare Workers deployment history:
npx wrangler deployments list --name sophia-ai-factory | head -5

# Step 2: Rollback
npx wrangler rollback --name sophia-ai-factory --message "Incident <id>: reverting to last good" --yes
# Wrangler will print: "Deployment rolled back successfully"

# Step 3: Verify rollback
sleep 5  # allow CF propagation
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Should match the prior deploy's short SHA (not current HEAD)

# Step 4: Report
echo "Rollback complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Live SHA: $(curl -s https://sophia.agencyos.network/api/version | jq .shortSha)"
echo "Post to #incidents with severity + root cause investigation status"
```

**If rollback fails:**
1. Check wrangler auth: `npx wrangler whoami`
2. Re-deploy last stable commit:
   ```bash
   git checkout <known-good-sha>
   npm run deploy:full
   git checkout main
   ```

---

## D1 Recovery Procedure (Manual)

**Goal:** Restore database from R2 30-day backup if corruption detected.

**Prerequisite:** Backup route exists at `/api/cron/d1-backup` (file: `src/app/api/cron/d1-backup/route.ts`).

```bash
# Step 1: Trigger manual backup (if not recent)
curl -X POST https://sophia.agencyos.network/api/cron/d1-backup \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d "force=true"
# Expected: { "status": "success", "backupId": "...", "backupSize": "..." }

# Step 2: List available backups in R2 (sophia-backups bucket)
# Via Cloudflare Dashboard:
# Dashboard → R2 → sophia-backups bucket → list .sql.gz files by date
# OR via CLI (if available): npx wrangler r2 list --bucket sophia-backups

# Step 3: Download backup
gsutil cp gs://sophia-backups/sophia-d1-<YYYYMMDD-HHMMSS>.sql.gz /tmp/
gunzip /tmp/sophia-d1-*.sql.gz

# Step 4: Restore to remote D1 (DESTRUCTIVE — coordinate with team)
cd apps/sophia-ai-factory
npx wrangler d1 execute sophia-raas-db --file=/tmp/sophia-d1-*.sql --remote
# Wrangler will execute SQL file line-by-line. Monitor output for errors.

# Step 5: Verify restore
curl -s https://sophia.agencyos.network/api/health | jq .
# Check D1 connectivity and row counts match pre-corruption state

# Step 6: Post-incident
echo "D1 restored from backup: $(ls -lh /tmp/sophia-d1-*.sql)"
echo "Restored at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Root cause: [data corruption / accidental delete / migration gone wrong]"
echo "Next: Run full restore test in staging, archive backup for RCA"
```

**Known gaps:**
- No automated restore drill (Phase 4 candidate)
- R2 lifecycle is fire-and-forget; no alerting if backup fails to write
- Recovery time untested (assumed <10 min for <500MB)

---

## Cron Failure Detection & Remediation

**Goal:** Detect hung or silent cron jobs; remediate without operator skill.

```bash
# Cron Health Indicators
# (Reference: Phase 1 research — 18 patterns, 12 unscheduled)

# Step 1: Check cron_run_log for recent failures
curl -s https://sophia.agencyos.network/api/admin/cron-status \
  -H "Authorization: Bearer $MASTER_SESSION_JWT" | jq '.last_runs[] | select(.status != "success")'

# Step 2: Detect CRON_SECRET missing (silent skip)
# Symptom: cron route returns 401 Unauthorized
# Check wrangler.toml [env.production] for CRON_SECRET binding
# Verify via: npx wrangler secret list | grep CRON_SECRET

# Step 3: Manual retry (if cron skipped)
curl -X POST https://sophia.agencyos.network/api/cron/<handler-name> \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
# Expected: 200 OK with handler-specific response

# Step 4: Check CF logs for timeout (>30s threshold)
npx wrangler tail --status error | grep -i timeout
# If: worker exceeded CPU time → split into smaller batches, queue via Inngest instead

# Common handlers (18 scheduled in wrangler.toml):
# - /api/cron/d1-backup (manual + scheduled, 6am UTC)
# - /api/cron/daily-rollup (mission rollup, 2am UTC)
# - /api/cron/affiliate-payout-sync (payout batch, 1am UTC)
# - /api/cron/circuit-breaker-scan (slash-15 min — P3 alert cron)
# - /api/cron/billing-anomaly-scan (07:00 UTC daily — P3 alert cron)
# - /api/cron/mission-abandon-scan (slash-30 min — P3 alert cron)
# - 12 others listed in Phase 1 synthesis (see unscheduled candidates)
```

**Mitigation:**
- All cron handlers MUST log to `cron_run_log` (verified at handler entry)
- `CRON_SECRET` MUST be provisioned in CF Workers secrets (document in deploy checklist)
- Handlers returning >30s must be split into smaller units or moved to Inngest

### P3 Alert Crons (New — Phase 3 Production Hardening)

Three new observability crons detect anomalies and write to the `user_alerts` D1 table (AlertCategory = `platform`):

| Cron | Schedule | Table read | Alert key | Throttle (KV) |
|------|----------|------------|-----------|---------------|
| `/api/cron/circuit-breaker-scan` | slash-15 min | `circuit_breaker_state` | `cb_alert:<service>` (per open) | 15 min |
| `/api/cron/billing-anomaly-scan` | 07:00 UTC daily | `production_graph_runs` + `org_members` | `billing_alert:<workspaceId>` | 6h |
| `/api/cron/mission-abandon-scan` | slash-30 min | `performance_events` | `abandon_alert:global` | 2h |

**Detection rule:** 24h spend/breaches vs 7-day rolling baseline. Fires when multiplier exceeded (3x for billing, 3x for circuit-breaker opens, 5x for abandon rate).

**Manual trigger (force re-scan):**
```bash
curl -X POST https://sophia.agencyos.network/api/cron/billing-anomaly-scan \
  -H "Authorization: Bearer $CRON_SECRET"
curl -X POST https://sophia.agencyos.network/api/cron/mission-abandon-scan \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Alert throttle:** Backed by `EXPERIMENT_KV` (no new namespace). If KV binding is missing, alerts still fire (dedup best-effort via `user_alerts` per-run constraint).

**Health check endpoint:** `GET /api/reality-loop/health` (public shape when no `HEALTH_TOKEN` bearer; full emitter detail when authenticated). Verifies the 13 canonical Reality Loop event types: 11 wired, 2 deferred (`creative.edited`, `memory.corrected`).

---

## Webhook Failure (NOWPayments IPN)

**Goal:** Recover from dropped or mishandled payment confirmations.

**Impact:** Customer tier not activated after payment; revenue under-recorded.

```bash
# Step 1: Detect
# Symptom: Customer paid but tier still BASIC, email not sent
# Check: D1 payment_events table for IPN entry

curl -s -u "admin:$ADMIN_BASIC_AUTH" https://sophia.agencyos.network/api/admin/payment-audit \
  -d "invoice_id=<INVOICE_ID>" | jq .

# Expected: { "invoice_id": "...", "status": "completed", "tier_set": true, "email_sent": true }
# If: status "pending" or missing → IPN not received or not processed

# Step 2: Manual replay (requires IPN secret + webhook signature)
# NOWPayments docs: https://nowpayments.io/api#webhooks
# Signature header: x-nowpayments-sig = HMAC-SHA256(body, IPN_SECRET)

PAYLOAD='{"payment_id":"...", "order_id":"<INVOICE_ID>", "status":"finished", "invoice_id":"<INVOICE_ID>"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$NOWPAYMENTS_IPN_SECRET" | cut -d' ' -f2)

curl -X POST https://sophia.agencyos.network/api/webhooks/nowpayments \
  -H "Content-Type: application/json" \
  -H "x-nowpayments-sig: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected: { "success": true, "tier": "PREMIUM", "message": "Tier activated" }

# Step 3: Verify tier activation
curl -s https://sophia.agencyos.network/api/user/tier \
  -H "Authorization: Bearer $USER_SESSION_JWT" | jq .tier
# Should show PREMIUM or higher

# Step 4: Send activation email manually (if webhook processing succeeded but email failed)
curl -X POST https://sophia.agencyos.network/api/admin/resend-activation-email \
  -H "Authorization: Bearer $MASTER_SESSION_JWT" \
  -d "user_id=<USER_ID>"
```

**Known issues:**
- If NOWPayments request was never sent (user aborted checkout) → no IPN to replay; user must restart
- IPN signature validation is strict; any body tampering fails (by design)
- Idempotency key prevents double-activation; safe to replay

---

## Cross-Tenant Data Exposure

**Goal:** Detect and contain unauthorized tenant access.

**Triggers:** Audit log anomaly + customer report + Sentry alert.

```bash
# Step 1: Detect (if flagged by Sentry or customer)
# Phase 1 finding: B2 fix (d68b4d96) closes HeyGen webhook leak
# Symptom: User A sees User B's video rows OR tier-change events
# Mitigation: validateTenantIsolation() middleware + query-time org_id filter

# Check recent incident logs
curl -s https://sophia.agencyos.network/api/admin/audit-log \
  -H "Authorization: Bearer $MASTER_SESSION_JWT" | jq '.entries[] | select(.action == "cross_tenant_access")'

# Step 2: Identify affected tenants
# (If B2-like issue) Search D1 for org_id mismatches in video_rows or signals_events
# Query (for research only — do NOT run on production without backup):
# SELECT org_id, user_id, COUNT(*) FROM video_rows GROUP BY org_id, user_id HAVING COUNT(*) > 1;

# Step 3: Contain
# Revoke session for affected user:
curl -X POST https://sophia.agencyos.network/api/admin/revoke-sessions \
  -H "Authorization: Bearer $MASTER_SESSION_JWT" \
  -d "user_id=<AFFECTED_USER_ID>"

# Lock tenant from further writes:
curl -X POST https://sophia.agencyos.network/api/admin/lock-tenant \
  -H "Authorization: Bearer $MASTER_SESSION_JWT" \
  -d "org_id=<ORG_ID>" \
  -d "reason=security_incident"

# Step 4: Notify customer
# Compose email with:
# - Scope of exposure (which rows, date range)
# - Containment action taken
# - Recommended password reset
# - Link to security incident report (post-RCA)

# Step 5: Post-incident
# Archive audit logs for forensics
# Run schema audit to verify no new org_id-less columns added (Phase 4 task)
```

**Known gaps:**
- `campaigns` table keyed on `user_id` only (no `org_id`) — RLS audit candidate (Phase 4)
- `signals_events` has nullable `org_id` — query-time filter may miss rows (Phase 4)
- No immutable audit log for credential mutations (Phase 4)

---

## BYOK Key Compromise

**Goal:** Revoke leaked API key; audit customer's third-party integrations.

**Scope:** BYOK master key compromise = all encrypted keys at risk.

```bash
# Step 1: Detect (Sentry alert + manual report)
# Symptom: Unauthorized API usage on customer's OpenRouter/ElevenLabs account
# Evidence: Third-party provider shows usage spike from unfamiliar IPs

# Step 2: If customer key only (not master key):
# Revoke at customer's provider (customer action — we CANNOT do this for them per no-tech doctrine)

# Provide customer with:
# 1. Date/time of suspected compromise
# 2. List of API key IDs stored in Sophia
# 3. Instructions to rotate key in each provider's dashboard
# 4. Link to re-enter key in Sophia Setup Wizard

# Step 3: If BYOK_MASTER_KEY suspected compromised:
# CRITICAL: All encrypted keys must be considered exposed

# Workflow:
# 1. Rotate BYOK_MASTER_KEY in CF Workers secrets
#    - Generate new 32-byte key: openssl rand -base64 32
#    - Update CF dashboard Secrets → BYOK_MASTER_KEY
#    - Redeploy: npm run deploy:full

# 2. Re-encrypt all stored keys with new master key
#    - (Procedure not yet documented — Phase 4 candidate)
#    - Requires: READ all keys with OLD master, WRITE with NEW master
#    - Manual SQL procedure or migration-based approach TBD

# 3. Notify all customers
#    - Explain: MASTER KEY was rotated (transparent to them)
#    - Action required: Re-enter API keys in Setup Wizard to ensure freshness
#    - Link: https://sophia.agencyos.network/dashboard/setup

# Step 4: Audit and recover
# Search D1 for any plaintext key leaks in logs or error messages
curl -s https://sophia.agencyos.network/api/admin/audit-log \
  -H "Authorization: Bearer $MASTER_SESSION_JWT" | jq '.entries[] | select(.details | contains("key") or contains("secret"))'
```

**Known gaps:**
- BYOK master key rotation procedure not yet implemented (Phase 4)
- No per-customer key versioning (if one key rotated, all must rotate)
- No notification system for "re-enter keys" bulk email (Phase 4)

---

## Hash Chain Integrity Breach

**Goal:** Detect and respond to tampering of the immutable audit log.

**Severity:** P0 (Critical) — SOC 2 CC7.2 compromise

**Detection:** `scripts/audit/verify-hash-chain.js` returns `valid: false`
**Impact:** Audit trail integrity compromised — potential undetected tampering of compliance records.

```bash
# Step 1: Isolate
# Halt new writes to raas_audit_logs by enabling maintenance mode or rate limiting
echo "Isolating audit log write path..."
# Temporarily block /api/admin/audit/* routes via CF firewall rule or maintenance page
# (Procedure: update wrangler.toml with maintenance route, deploy emergency patch)

# Step 2: Preserve evidence
# Export full audit log table for forensic analysis (do NOT delete or truncate)
mkdir -p /tmp/incident-audit-$(date +%Y%m%d-%H%M%S)
cd /tmp/incident-audit-$(date +%Y%m%d-%H%M%S)
npx wrangler d1 export sophia-raas-db --table raas_audit_logs --output=raas_audit_logs-full-export.json
# Verify export succeeded: file should contain all rows
ls -lh raas_audit_logs-full-export.json

# Step 3: Identify break point
# Run verification with extended timeframe to find earliest broken entry
node scripts/audit/verify-hash-chain.js --since 2026-01-01 --export=verification-result.json
cat verification-result.json
# Note: firstInvalidIndex indicates which row breaks the chain

# Step 4: Investigate
# Check for:
# - Direct SQL edits: Query Cloudflare Logs for D1 API calls modifying raas_audit_logs
#   npx wrangler tail --format json | grep -i 'raas_audit_logs.*UPDATE\|DELETE'
# - Compromised operator credentials: Review admin_audit_log for suspicious admin actions
# - Application bug: Check deploy history around break point date for code changes to audit-logger.ts
#
# Pull relevant rows from export (before/after break) for manual review
jq ".results[] | select(.id >= <break_id> - 10 and .id <= <break_id> + 10)" raas_audit_logs-full-export.json > break-neighborhood.json

# Step 5: Remediate decision
# Option A: Rebuild chain (if break was due to system error, not malicious)
#   - Identify the last valid entry before the break
#   - Recompute content_hash for all subsequent entries from that point forward
#   - Requires: A script to backfill content_hash and previous_log_hash sequentially
#   - Run: node scripts/audit/rebuild-hash-chain.js --from <valid_entry_id>
#
# Option B: Flag entries as invalid (if tampering confirmed but cannot rebuild)
#   - Update hash_chain_valid = 0 for all entries from break point onward
#   - Document rationale in incident report
#   - SOC 2 note: invalid entries must be disclosed to auditor with compensating controls
#
# Option C: Full audit log reset (extreme case — only if entire chain corrupted)
#   - Archive current raas_audit_logs table as evidence
#   - Create new empty table (migration)
#   - Gap period: [date range] — must be documented and justified to auditor

# Step 6: Post-incident
# - Update audit-logger.ts to add additional safeguards (e.g., DB trigger to prevent UPDATE/DELETE)
# - Rotate AUDIT_HASH_SALT secret in CF Workers
# - Add alerting: daily cron runs verify-hash-chain.js and sends Slack alert on failure
# - Run full forensic review with compliance officer

# Step 7: Notification
# If customer data exposure is possible (based on investigation), notify:
# - Compliance officer
# - Legal team
# - Affected customers (per DPA breach notification requirements)
```

**Known gaps:**
- No automated daily hash chain verification (add to cron)
- No DB-level protection against UPDATE/DELETE on raas_audit_logs (application-only)
- No alerting on chain breaks (Phase 4 candidate)

---

## War-Room Template

**Incident:** [P0/P1] [Service] — [Brief description]  
**Started:** [ISO timestamp]  
**Detected:** [ISO timestamp]  
**Commander:** [Name]  
**Slack channel:** #incidents

### Timeline
```
[HH:MM:SS UTC]  Detection: [alert source, what was observed]
[HH:MM:SS UTC]  Triage: [severity assessment, initial hypothesis]
[HH:MM:SS UTC]  Action: [what was done, by whom]
[HH:MM:SS UTC]  Resolution: [fix deployed, time to live]
[HH:MM:SS UTC]  Verification: [health checks passed]
```

### Status updates (every 5 min until resolved)
```
🔴 INCIDENT
Platform: [Down/Degraded/Up]
Impact: [N customers affected / $X revenue at risk / est. duration]
ETA: [est. fix time or rollback time]
Next update: [HH:MM UTC]
```

### Post-incident (within 24 hr)
- **Blameless postmortem** (template below)
- **Root cause:** [chain of events, not individual blame]
- **Corrective:** [fix applied to code or process]
- **Preventive:** [monitoring/test/doc to prevent recurrence]
- **Timeline:** [when each fix ships]

---

## Postmortem Template

```markdown
# Postmortem: [Incident title] — [Date]

## Summary
[1-sentence description of what happened]

## Impact
- **Duration:** [start]–[end] ([X minutes])
- **Scope:** [N customers] / [service areas]
- **Revenue loss:** [$X or estimate]

## Timeline
[Detailed timeline of events — who did what, when, why it happened]

## Root Cause
[Causal chain — what condition allowed this to happen]
[Not "developer made a mistake" but "test coverage for X was zero, so Y went undetected"]

## What Went Well
[Detection, response, communication]

## What Went Poorly
[Slow detection, unclear runbook, lack of monitoring]

## Corrective Actions
| Action | Owner | Date | Status |
|--------|-------|------|--------|
| [e.g., add metric for X] | [@person] | [target] | open |

## Preventive Actions
| Action | Prevents | Owner | Target |
|--------|----------|-------|--------|
| [e.g., write integration test for Y] | [similar incident] | [@person] | [date] |

## Appendix
- Links to: Sentry errors, CF logs, git commit, related issues
- Config changes made during incident (to revert or document)
```

---

## Contact & Escalation

| Role | Contact | On-call |
|------|---------|---------|
| **On-call Engineer** | Slack @on-call-eng | 24/7 rotation |
| **Engineering Lead** | [email] | Weekdays 9–5 UTC |
| **Operations** | #incidents Slack channel | Weekdays 9–5 UTC |
| **Status Page** | https://status.agencyos.network | Auto-updated by monitoring |

---

## Appendix: Procedures Missing (Phase 4+ Candidates)

- [ ] **D1 restore drill** — full database recovery from R2 backup, test in staging monthly
- [ ] **BYOK master key rotation** — procedure to re-encrypt all stored keys
- [ ] **Bulk customer notification** — email system for "re-enter keys" or security advisories
- [ ] **Metrics dashboard** — error rate, webhook latency, tier activation time (SLOs)
- [ ] **Cron handler audit** — document 12 unscheduled handlers, remove dead code
