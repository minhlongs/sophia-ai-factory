# SOP-04: Cron Job Failure

> Version: 1.0 | Baseline: `5dd1f071` | Owner: Tech Lead | Review: Monthly

---

## When to Use

- Sentry alert for cron route
- `cron_run_log` shows FAILED status
- Scheduled job didn't run

---

## Diagnosis

```bash
# 1. Check recent cron runs
npx wrangler d1 execute sophia-raas-db --command="SELECT job_name, status, error_message, created_at FROM cron_run_log ORDER BY created_at DESC LIMIT 20" --remote

# 2. Check specific cron endpoint
curl -s https://sophia.agencyos.network/api/cron/<job-name> -H "Authorization: Bearer $CRON_SECRET"

# 3. Check Sentry for error details
```

---

## Common Cron Jobs

| Job | Route | Purpose | Schedule |
|---|---|---|---|
| D1 Backup | `/api/cron/d1-backup` | Daily DB dump to R2 | Daily |
| Agent Cost Overrun | `/api/cron/agent-cost-overrun-scan` | Scan AI costs | Daily |
| Mission Abandon | `/api/cron/mission-abandon-scan` | Detect stuck missions | Hourly |
| Quota Reset | `/api/cron/quota-reset` | Reset monthly quotas | Monthly |
| Billing Sync | `/api/cron/billing-sync` | Sync subscription status | Hourly |

---

## Common Failure Causes

| Cause | Symptom | Fix |
|---|---|---|
| Provider timeout | 504 / timeout error | Check provider status, retry |
| D1 write failure | SQL error | Check D1 status, disk space |
| Missing secret | 401 / auth error | Verify CF env vars |
| Idempotency skip | "skipped" status | Expected if recent run succeeded |

---

## Resolution

1. **Transient failure** — Wait for next scheduled run (most resolve)
2. **Persistent failure** — Check code changes, fix, deploy
3. **Manual trigger** — `curl -X POST /api/cron/<job> -H "Authorization: Bearer $CRON_SECRET"`

---

## Escalation

- If cron failure affects customers → SEV-2 (INCIDENT_RESPONSE.md)
- If D1 backup fails 2+ days → SEV-1 (DISASTER_RECOVERY_READINESS.md)

---

## References

- `INCIDENT_RESPONSE.md` — Playbook 4
- `DISASTER_RECOVERY_READINESS.md` — D1 backup procedure