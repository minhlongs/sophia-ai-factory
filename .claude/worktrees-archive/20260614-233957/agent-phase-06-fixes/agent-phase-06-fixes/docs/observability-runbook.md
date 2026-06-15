# Observability Runbook — Sophia AI Factory (P2)

Phase 2 observability via Better Stack. All logs PII-scrubbed before ship.

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `BETTER_STACK_LOGS_TOKEN` | CF Worker secret | Logtail HTTPS bearer (PLATFORM key, not customer) |
| `BETTER_STACK_INGESTING_HOST` | CF var (optional) | Default: `https://in.logtail.com/` |
| `BETTER_STACK_HEARTBEAT_URL` | CF Worker secret | Full heartbeat URL incl. token, e.g. `https://heartbeat.betterstack.com/api/v1/heartbeat/abc123` |
| `CRON_SECRET` | CF Worker secret | Shared by all cron routes. Rotate quarterly. |
| `INTROSPECT_TOKEN` | CF Worker secret | Bearer for `/api/metrics` (same gate as P1 `/api/version`) |
| `FOUNDER_EMAIL` | CF Worker secret | Recipient for daily error-digest email |

**Provision via:**
```bash
wrangler secret put BETTER_STACK_LOGS_TOKEN
wrangler secret put BETTER_STACK_HEARTBEAT_URL
wrangler secret put CRON_SECRET
wrangler secret put INTROSPECT_TOKEN
wrangler secret put FOUNDER_EMAIL
```

---

## Cron Schedule

| Cron | Route | Purpose |
|---|---|---|
| `*/5 * * * *` | `/api/cron/uptime-check` | Self-ping + Telegram alert |
| `5 * * * *` | `/api/cron/usage-export` | Usage rollup |
| `0 1 * * *` | `/api/cron/daily-rollup` | Daily aggregation |
| `0 2 * * *` | `/api/cron/subscription-reminders` | Renewal reminders |
| `0 3 * * *` | `/api/cron/scheduled-campaigns` | Auto-campaigns |
| `0 4 * * *` | `/api/cron/email-drip` | Nurture drip |
| `*/10 * * * *` | `/api/cron/heartbeat` | Better Stack liveness ping |
| `0 5 * * *` | `/api/cron/error-digest` | Daily error summary → email + Telegram |

All cron routes accept `Authorization: Bearer <CRON_SECRET>` (CF Workers standard) plus legacy `x-cron-secret` header and `x-cf-cron: true`.

Future: migrate to CF `scheduled()` handler to remove HTTP exposure entirely.

---

## CF Subrequest Budget (RED-TEAM #9)

CF Workers hard limit: **50 subrequests per request**.

P2 telemetry accounting per request:
| Subrequest | Count |
|---|---|
| Better Stack log batch flush (`ctx.waitUntil`) | 1 |
| Max log entries per request | 3 |
| **Total P2 telemetry budget** | **1 subrequest** |

Flush runs via `ctx.waitUntil()` — executes AFTER response is sent, zero latency impact.
Excess log entries (>3) dropped to in-memory counter, visible in `/api/metrics` as `droppedLogs`.

Remaining budget for application code: **49 subrequests**.

---

## Log Structure

Every log entry:
```json
{
  "ts": 1713312000000,
  "level": "info|warn|error|fatal",
  "msg": "scrubbed message (max 4KB)",
  "ctx": { "route": "/api/...", "commit": "abc123" },
}
```

PII scrubbed before D1 insert AND before Better Stack push:
- `sk-[20+]` → `[REDACTED-SK]`
- `pk_[20+]` → `[REDACTED-PK]`
- `eyJ...` (JWT) → `[REDACTED-JWT]`
- `Bearer <token>` → `Bearer [REDACTED]`
- email addresses → `[REDACTED-EMAIL]`
- phone numbers → `[REDACTED-PHONE]`

---

## Heartbeat Monitors

Configure in Better Stack dashboard:

| Monitor name | Heartbeat URL | Period | Grace |
|---|---|---|---|
| sophia-liveness | `BETTER_STACK_HEARTBEAT_URL` | 10 min | 5 min |

**Missed heartbeat = D1 or Worker is down.** Alert triggers immediately (grace 5 min).

D1 probe logic: heartbeat cron runs `SELECT 1` on D1 first.
- D1 healthy → ping heartbeat (BS shows green)
- D1 down → SKIP ping (silence triggers BS missed-heartbeat alert) + push fatal log directly to BS

---

## Alert Rules (configure in Better Stack UI)

| Alert | Condition | Action |
|---|---|---|
| Fatal D1 | `msg = "D1_UNAVAILABLE"` | Telegram + email |
| Error spike | `level = error, count > 10 in 5 min` | Telegram |
| Missed heartbeat | sophia-liveness misses 1 ping | Telegram + email |

Webhook target for canary rollback: `POST https://api.github.com/repos/longtho638-jpg/sophia-ai-factory/actions/workflows/rollback.yml/dispatches` (P1 workflow).

---

## D1 error_log Retention

Table: `error_log` (migration `0004_error_log.sql`).
Retention policy: `daily-rollup` cron deletes rows older than 30 days:
```sql
DELETE FROM error_log WHERE ts < datetime('now', '-30 days');
```
Add this cleanup to `apps/sophia-ai-factory/src/lib/usage-metering/rollup-service.ts` daily-rollup step.

---

## /api/metrics Endpoint

```
GET /api/metrics
Authorization: Bearer <INTROSPECT_TOKEN>
```

Returns per-route p50/p95/p99 from in-memory ring buffer (best-effort, per Worker isolate):
```json
{
  "ok": true,
  "ts": 1713312000000,
  "metrics": [
    { "route": "/api/cron/heartbeat", "count": 6, "errors": 0, "p50": 120, "p95": 180, "p99": 220 }
  ]
}
```

---

## Error Digest Cron

Daily 05:00 UTC → `/api/cron/error-digest`.

Ships to OpenRouter: only `{class, fingerprint, count}` tuples — **never raw stacks or messages** (RED-TEAM #2).
Founder receives email + Telegram summary even with zero errors ("No errors past 24h").

---

## Smoke Test

```bash
# Trigger test error (dev only)
curl -X POST https://sophia.agencyos.network/api/cron/heartbeat \
  -H "Authorization: Bearer $CRON_SECRET"
# → Better Stack shows liveness ping within 10s

# Check metrics
curl https://sophia.agencyos.network/api/metrics \
  -H "Authorization: Bearer $INTROSPECT_TOKEN"
# → JSON with route stats
```
