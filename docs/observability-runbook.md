# Observability Runbook — Sophia AI Factory (P2)

Phase 2 observability via Better Stack (logs) and Honeycomb (traces/metrics). All logs PII-scrubbed before ship.

---

## Table of Contents

- [Better Stack Logs](#better-stack-logs)
- [Honeycomb OpenTelemetry](#honeycomb-opentelemetry)
- [Cron Schedule](#cron-schedule)
- [CF Subrequest Budget](#cf-subrequest-budget-red-team-9)
- [Log Structure](#log-structure)
- [Heartbeat Monitors](#heartbeat-monitors)
- [Alert Rules](#alert-rules)
- [OTLP Local Verification](#otlp-local-verification)
- [D1 error_log Retention](#d1-error_log-retention)
- [/api/metrics Endpoint](#apimetrics-endpoint)
- [Error Digest Cron](#error-digest-cron)
- [Smoke Test](#smoke-test)

---

## Better Stack Logs

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

## Honeycomb OpenTelemetry

Traces and metrics are exported to Honeycomb via OTLP HTTP protocol. The OpenTelemetry SDK is initialized in `src/app/[locale]/layout.tsx` and instruments all API routes via middleware.

### Environment Variables

| Variable | Where | Description |
|---|---|---|
| `HONEYCOMB_API_KEY` | CF Worker secret / `.env.local` | Honeycomb API key with write permissions |
| `HONEYCOMB_DATASET` | CF var (optional) | Dataset name (default: `sophia-prod`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | CF var (optional) | OTLP endpoint (default: `https://api.honeycomb.io`) |
| `OTEL_SERVICE_NAME` | CF var (optional) | Service identifier (default: `sophia-api`) |
| `OTEL_SAMPLERATE` | CF var (optional) | Trace sampling rate 0-1 (default: `0.01` = 1%) |

**Provision via:**
```bash
# Local development - add to .env.local
echo "HONEYCOMB_API_KEY=your_key" >> .env.local
echo "HONEYCOMB_DATASET=sophia-prod" >> .env.local

# Production - Cloudflare Worker secrets
cd apps/sophia-ai-factory
npx wrangler secret put HONEYCOMB_API_KEY
npx wrangler secret put HONEYCOMB_DATASET
npx wrangler secret put OTEL_SERVICE_NAME
npx wrangler secret put OTEL_SAMPLERATE
```

### Architecture

- **Tracer**: Global tracer provider with `BasicTracerProvider` and `SimpleSpanProcessor`
- **Exporter**: `OTLPTraceExporter` (HTTP) sending to `/v1/traces`
- **Metrics**: `MeterProvider` with `PeriodicExportingMetricReader` (60s interval) to `/v1/metrics`
- **Instrumentation**: `FetchInstrumentation` auto-instruments outgoing HTTP requests
- **Resource Attributes**: `service.name`, `service.version` (from `COMMIT_SHA`), `deployment.environment`

### Sampler Configuration

Default sampler is `TraceIdRatioBasedSampler(0.01)` - traces 1% of requests in production.
For debugging, set `OTEL_SAMPLERATE=1.0` to trace 100% of requests temporarily.

### Key Spans

| Span Name | Origin | Attributes |
|---|---|---|
| `middleware.proxy` | `middleware.ts` | `http.method`, `http.route`, `component`, `duration_ms`, `http.status_code` |
| `inngest.<event>` | `instrument-inngest.ts` | `event.name`, `runId`, `stepName` |
| `api.<handler>` | `instrument-api.ts` | `handler`, `http.method`, `http.route` |

### Honeycomb Queries

**Recent traces (last 15 min):**
```
https://ui.honeycomb.io/ datasets/sophia-prod /?query_type=traces&time=15m
```

**Slow requests (p95 > 1000ms):**
```
https://ui.honeycomb.io/ datasets/sophia-prod /?query_type=traces&granularity=1m&breakdowns=service.name&calculations=avg%28duration_ms%29&time=1h
```

---

## OTLP Local Verification

Task #32: Verify traces export from local machine to vendor endpoint.

### Prerequisites

1. Install OTel dependencies:
```bash
cd apps/sophia-ai-factory
npm install
```

2. Configure environment variables:
```bash
# .env.local
HONEYCOMB_API_KEY=your_honeycomb_api_key
HONEYCOMB_DATASET=sophia-prod
OTEL_SAMPLERATE=1.0  # trace all for verification
```

### Run Verification Script

```bash
npm run verify:otlp
```

The script will:
1. Initialize OTel with test configuration
2. Create a test span named `verify-otlp-test`
3. Export the span to Honeycomb OTLP endpoint
4. Report success/failure

### Manual Verification Steps

1. Start the dev server: `npm run dev`
2. Make a few requests to your local app (e.g., visit http://localhost:3000)
3. Run the verification script: `npm run verify:otlp`
4. Open Honeycomb UI: https://ui.honeycomb.io
5. Select your dataset
6. Search for `span.name="verify-otlp-test"`
7. Verify span appears with attributes:
   - `test.purpose = "otlp-export-verification"`
   - `local.dev = true`
   - `service.name = "sophia-api"` (or your `OTEL_SERVICE_NAME`)

### Troubleshooting

| Symptom | Check |
|---|---|
| Script fails with "dependencies missing" | Run `npm install @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http @opentelemetry/sdk-metrics @opentelemetry/exporter-metrics-otlp-http` |
| Script fails with "API key required" | Verify `HONEYCOMB_API_KEY` is set in `.env.local` |
| Spans not appearing in Honeycomb | Check dataset name and API key permissions |
| Network timeout | Verify no firewall blocking `https://api.honeycomb.io` |
| No spans from middleware | Confirm `initializeOTel()` is called in `layout.tsx` |

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

# Verify OTLP trace export (local dev)
npm run verify:otlp
# → Should print "✅ Trace export successful!"
# Then verify span appears in Honeycomb UI
```

---

## Appendix: OTel Dependencies

Required packages (all at version ^0.219.0):
- `@opentelemetry/api`
- `@opentelemetry/sdk-trace-base`
- `@opentelemetry/sdk-metrics`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/exporter-metrics-otlp-http`
- `@opentelemetry/resources`
- `@opentelemetry/semantic-conventions`
- `@opentelemetry/instrumentation-fetch`
- `@opentelemetry/sdk-trace-web` (transitive)

Installed via npm in `apps/sophia-ai-factory/package.json`.

