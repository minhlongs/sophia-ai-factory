# Cron Failure Escalation Contacts — Sophia AI Factory

**Gap:** OG-002 — Cron failure alerting  
**Last reviewed:** 2026-05-21

---

## When to Use This Runbook

1. Sentry fires a "Cron missed check-in" or "Cron still running" alert
2. Better Stack detects missed heartbeat from `/api/cron/heartbeat`
3. Manual investigation finds a cron route returning non-200 or recording `failure` in `cron_run_log`

---

## Cron Schedule Reference

Source of truth:
- Cloudflare cron patterns: `apps/sophia-ai-factory/wrangler.toml` `[triggers].crons`
- Runtime dispatch map: `apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` `CRON_ROUTES`
- External scheduler exception: `d1-backup` is triggered by Upstash QStash and writes R2 snapshots to `sophia-backups`

If a cron pattern exists in `wrangler.toml` but is absent from `CRON_ROUTES`, Cloudflare will fire the scheduled event but the injected handler logs "No handler for cron pattern" and does not call a route.

| Cron route | Schedule (UTC) | Trigger source | Expected max runtime | Blast radius if stuck |
|-----------|---------------|----------------|---------------------|----------------------|
| `fulfillment-retry` | Every 2 min | CF scheduled handler | 5 min | Failed fulfillments not retried |
| `email-outbox-flush` | Every 2 min | CF scheduled handler | 5 min | Email queue backs up |
| `uptime-check` | Every 5 min | CF scheduled handler | 1 min | Production outage alert delayed |
| `video-status-sync` | Every 5 min | CF scheduled handler | 5 min | Video render status stale |
| `sop-scheduler` | Every 5 min | CF scheduled handler | 3 min | SOP automation delayed |
| `usage-export` | Hourly :05 | CF scheduled handler | 15 min | Usage dashboard stale |
| `dunning-advance` | Daily 01:00 | CF scheduled handler | 10 min | Past-due accounts not suspended on time |
| `subscription-reminders` | Daily 02:00 | CF scheduled handler | 5 min | Renewal reminders missed |
| `scheduled-campaigns` | Daily 03:00 | CF scheduled handler | 10 min | AI campaign generation delayed |
| `email-drip` | Daily 04:00 | CF scheduled handler | 15 min | Lifecycle emails delayed |
| `fulfillment-reconcile` | Daily 06:00 | CF scheduled handler | 10 min | Revenue reconciliation lag |
| `weekly-signals-digest` | Weekly Monday 06:00 | CF scheduled handler | 10 min | Weekly reports delayed |
| `smoke-one-time` | Every 15 min | CF scheduled handler | 5 min | One-time bundle smoke signal delayed |
| `clearance-promote` | Daily 00:00 | CF scheduled handler | 5 min | Pending clearance not released |
| `promo-trial-expiry` | Daily 00:00 | CF scheduled handler | 5 min | Expired trials not reverted |
| `mcu-monthly-reset` | 1st of month 00:00 | CF scheduled handler | 10 min | Monthly usage counters not reset |
| `handover-status-sync` | Hourly :07 | CF scheduled handler | 5 min | Handover statuses stale |
| `d1-backup` | External daily window | Upstash QStash -> route | 15 min | Backup window missed |

Known schedule drift to verify before adding Sentry monitors:

| Pattern in `wrangler.toml` | Commented route intent | Current risk |
|----------------------------|------------------------|--------------|
| `0 5 * * *` | `error-digest` | Pattern is not mapped in `CRON_ROUTES` |
| `*/10 * * * *` | `heartbeat` | Pattern is not mapped in `CRON_ROUTES` |
| `0 7 * * *` | `llm-cache-purge` | Pattern is not mapped in `CRON_ROUTES` |
| `10 * * * *` | `wallet-rebuild` | Pattern is not mapped in `CRON_ROUTES` |
| `0 */4 * * *` | `affiliate-scout` | Pattern is not mapped in `CRON_ROUTES` |

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

Sentry Cron Monitors must be created for each mapped route in the first table. Do not add production paging monitors for the schedule-drift rows until `CRON_ROUTES` maps them or a separate external scheduler owns them. Two options:

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
          │       → Check `apps/sophia-ai-factory/wrangler.toml` cron patterns are deployed
          │       → Check `scripts/inject-scheduled-handler.mjs` maps the pattern to a live route
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
| `heartbeat` missed | P1 | Fix within 30 min after schedule mapping is restored (observability blind) |
| `email-outbox-flush` missed | P2 | Fix within 4h |
| `usage-export` missed | P2 | Fix within 8h |
| Any other cron missed once | P2 | Fix within next business day |
| Any cron missed 3× in a row | P1 | Escalate immediately |
