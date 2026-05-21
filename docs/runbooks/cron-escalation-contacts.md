# Cron Failure Escalation Contacts — Sophia AI Factory

**Gap:** OG-002 — Cron failure alerting  
**Last reviewed:** 2026-05-20  

---

## When to Use This Runbook

1. Sentry fires a "Cron missed check-in" or "Cron still running" alert
2. Better Stack detects missed heartbeat from `/api/cron/heartbeat`
3. Manual investigation finds a cron route returning non-200 or recording `failure` in `cron_run_log`

---

## Cron Schedule Reference

| Cron name | Schedule (UTC) | Expected max runtime | Blast radius if stuck |
|-----------|---------------|---------------------|----------------------|
| `dunning-advance` | Daily 01:00 | 10 min | Past-due accounts not suspended on time |
| `email-drip` | Daily 04:00 | 15 min | Lifecycle emails delayed |
| `email-outbox-flush` | Every 15 min | 5 min | Email queue backs up |
| `fulfillment-retry` | Every 30 min | 5 min | Failed fulfillments not retried |
| `fulfillment-reconcile` | Daily 02:00 | 10 min | Revenue reconciliation lag |
| `heartbeat` | Every 10 min | 1 min | Better Stack silences → missed-heartbeat alert |
| `usage-export` | Daily 03:00 | 15 min | Usage dashboard stale |
| `hourly-rollup` | Every hour :05 | 5 min | Quota counters stale by up to 1h |
| `daily-rollup` | Daily 00:30 | 10 min | Daily usage aggregates stale |
| `subscription-reminders` | Daily 09:00 | 5 min | Renewal reminders missed |
| `d1-backup` | Daily 06:00 | 15 min | Backup window missed |
| `promo-trial-expiry` | Daily 08:00 | 5 min | Expired trials not reverted |
| `scheduled-campaigns` | Every 15 min | 10 min | AI campaign generation delayed |
| `workflow-stepper` | Every 5 min | 3 min | Workflow automation stalls |
| `video-status-sync` | Every 30 min | 5 min | Video render status stale |
| `wallet-rebuild` | Weekly Sunday 00:00 | 30 min | Affiliate wallet balances stale |
| `weekly-signals-digest` | Weekly Monday 07:00 | 10 min | Weekly reports delayed |
| `error-digest` | Daily 23:30 | 5 min | Error digest emails missed |
| `mcu-monthly-reset` | 1st of month 00:00 | 10 min | Monthly usage counters not reset |

---

## On-Call Contacts (Operators — fill before go-live)

| Role | Name | Contact | Escalation tier |
|------|------|---------|-----------------|
| Primary on-call | **[OPERATOR NAME]** | **[TELEGRAM/PHONE]** | P0 + P1 |
| Secondary on-call | **[BACKUP CONTACT]** | **[TELEGRAM/PHONE]** | P0 only |
| Technical lead | **[TECH LEAD]** | **[EMAIL/TELEGRAM]** | P0 incidents > 30 min |

> **ACTION REQUIRED:** Fill in the table above with real contacts before go-live.
> See `docs/runbooks/cron-escalation-contacts.md` — OG-010 tracks this as backlog item.

---

## Sentry Alert Configuration

Sentry Cron Monitors must be created for each cron listed above. Two options:

### Option A — Sentry UI (recommended for initial setup)

1. Log in to https://sentry.io → your Sophia project
2. **Crons** → **Add Monitor**
3. Name: `cron-<name>` (e.g. `cron-dunning-advance`)
4. Schedule: matching crontab expression (see table above)
5. Check-in margin: 5 minutes
6. Max runtime: see table
7. Notify: on-call contact via PagerDuty integration or email

### Option B — Code-side (automatic on first check-in)

The `/api/health/cron-heartbeat` endpoint calls `Sentry.captureCheckIn()` which creates a monitor automatically on first ping. Operator only needs to:
1. Deploy this code
2. Confirm each cron hits the heartbeat endpoint (see "Wiring Crons" below)
3. Configure alert rules in Sentry UI post-creation

---

## Wiring Crons to Heartbeat Endpoint

Each cron handler should ping the heartbeat endpoint at the end of a successful run. Example:

```typescript
// At the bottom of any cron handler, after successful completion:
const PROD_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
const cronSecret = process.env.CRON_SECRET ?? '';

await fetch(
  `${PROD_URL}/api/health/cron-heartbeat?name=${CRON_NAME}&status=ok&duration_ms=${Date.now() - startTime}`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
  }
).catch(() => {
  // Never block cron completion on heartbeat failure
});
```

On failure (in catch block):
```typescript
await fetch(
  `${PROD_URL}/api/health/cron-heartbeat?name=${CRON_NAME}&status=error&error=${encodeURIComponent(errMsg)}`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
  }
).catch(() => {});
```

> **Note:** Heartbeat pings are fire-and-forget — they must NOT block cron execution or cause cron failure.

---

## Escalation Decision Tree

```
Sentry/Better Stack alert fires
          │
          ▼
1. Check Sentry → Crons → <monitor name> for last check-in
          │
          ├── Last check-in was "error" → look at Sentry Issues for cron_route tag
          │       → Fix the root cause → re-trigger cron manually if needed
          │
          ├── No check-in at all → cron not running
          │       → Check wrangler.jsonc cron schedules are deployed
          │       → Check CF Workers logs: `wrangler tail --name sophia-ai-factory`
          │       → Check if CRON_SECRET is set: `wrangler secret list`
          │
          └── Check-in "ok" but alert still firing → Sentry monitor config wrong
                  → Adjust margin / schedule in Sentry UI
```

---

## Severity Classification

| Alert | Severity | SLA |
|-------|----------|-----|
| `dunning-advance` missed | P1 | Fix within 2h (financial impact) |
| `fulfillment-retry` missed | P1 | Fix within 1h (customer activation blocked) |
| `heartbeat` missed | P1 | Fix within 30 min (observability blind) |
| `email-outbox-flush` missed | P2 | Fix within 4h |
| `usage-export` missed | P2 | Fix within 8h |
| Any other cron missed once | P2 | Fix within next business day |
| Any cron missed 3× in a row | P1 | Escalate immediately |
