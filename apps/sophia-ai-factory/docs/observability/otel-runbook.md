# OpenTelemetry Runbook

> Sophia AI Factory — OTEL instrumentation, exporter health, and trace debugging
> Last updated: 2026-06-22 (Task #28-39)

## Overview

This runbook covers operational procedures for maintaining OpenTelemetry instrumentation in Sophia AI Factory. Use this when traces are missing, exporter errors occur, or instrumentation issues are suspected.

## Architecture Quick Ref

- **SDK init:** `src/seed/telemetry/opentelemetry-setup.ts` (auto-initializes on import)
- **Middleware tracing:** `src/middleware.ts` wraps all requests with span `middleware.proxy`
- **API route instrumentation:** `src/seed/telemetry/instrument-api.ts` decorates route handlers
- **Inngest instrumentation:** `src/seed/telemetry/instrument-inngest.ts` wraps event jobs
- **Exporter:** OTLP/HTTP → Honeycomb (or Grafana Cloud if configured)
- **Metrics:** In-memory ring buffer → `/api/metrics` endpoint (PROM format)

---

## Common Issues & Responses

### Symptom: No traces appearing in Honeycomb

**Diagnosis:**

1. Check OTel is initialized:
   ```bash
   # Look for log message in Worker logs
   npx wrangler tail --name sophia-ai-factory-staging 2>&1 | grep "\[OTel\]"
   ```
   Expected: `[OTel] Initialized` with service name and sample rate.

2. Verify Honeycomb API key is set:
   ```bash
   npx wrangler secret list --name sophia-ai-factory-staging | grep HONEYCOMB_API_KEY
   ```
   If missing: `npx wrangler secret put HONEYCOMB_API_KEY --name sophia-ai-factory-staging`

3. Check network egress: Cloudflare Workers can reach `https://api.honeycomb.io`. No firewall needed.

4. Verify sample rate: `OTEL_SAMPLERATE=0.01` means 1% of traces. Increase temporarily to `1.0` for debugging:
   ```bash
   npx wrangler secret put OTEL_SAMPLERATE --name sophia-ai-factory-staging --value "1.0"
   ```

5. Generate test traffic (staging):
   ```bash
   curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/api/health
   curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/api/v1/affiliates/list
   ```

6. Check Honeycomb query: `COUNT(trace_id) WHERE service.name = "sophia-api"` over last 5 min.

**If still no traces:**

- Check for import errors: `opentelemetry-setup.ts` must be imported early (it's in `layout.tsx`).
- Verify `initializeOTel()` is called (auto-called on module load).
- Look for exporter errors in logs: `OTLPTraceExporter` timeout or 401/403.
- Ensure `HONEYCOMB_DATASET` is correct (default `sophia-prod`; staging should set to `sophia-staging`).

---

### Symptom: Traces appear but without `http.route` or `http.method` attributes

**Cause:** Middleware instrumentation not attached or span context lost.

**Fix:**

1. Verify `src/middleware.ts` imports `getTracer()` and wraps `proxyImpl`.
2. Check span creation: `tracer.startSpan('middleware.proxy', { attributes: { 'http.method': ..., 'http.route': ... } })`.
3. Ensure `recordMetrics()` is called in finally block.
4. If using `instrumentRoute` wrapper in API routes, verify options.route is correct path pattern.

---

### Symptom: Trace data in Honeycomb but metrics missing from `/api/metrics`

**Diagnosis:**

Metrics are recorded in-memory per Worker isolate and exported via `/api/metrics` route. Check:

1. Route exists and is accessible:
   ```bash
   curl -s https://staging.../api/metrics | head
   ```
   Should return Prom-formatted text starting with `# HELP`.

2. Verify `src/seed/observability/telemetry/metrics.ts` is imported by middleware (it is).
3. Check ring buffer not empty: In `metrics.ts`, `snapshot()` should return non-empty array.
4. Ensure `/api/metrics` route is implemented (it should be in `src/app/api/metrics/route.ts`). If missing, create it:
   ```typescript
   import { snapshot, reset } from '@/seed/observability/telemetry/metrics';
   export async function GET() {
     const metrics = snapshot();
     const body = metrics.map(m =>
       `sophia_request_count{route="${m.route}"} ${m.count}\n` +
       `sophia_request_errors{route="${m.route}"} ${m.errors}\n` +
       `sophia_request_duration_ms{route="${m.route}",quantile="0.5"} ${m.p50}\n` +
       `sophia_request_duration_ms{route="${m.route}",quantile="0.95"} ${m.p95}\n` +
       `sophia_request_duration_ms{route="${m.route}",quantile="0.99"} ${m.p99}\n`
     ).join('\n');
     return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
   }
   ```

---

### Symptom: High export error rate in logs

**Cause:** Network issues, invalid API key, or Honeycomb rate limits.

**Diagnosis:**

Check Worker logs for errors:
```bash
npx wrangler tail --name sophia-ai-factory-staging | grep -i "export\|otlp\|honeycomb"
```

Look for:
- `401 Unauthorized` → API key invalid or missing `x-honeycomb-dataset` header
- `429 Too Many Requests` → Exceeded Honeycomb rate limit or quota
- `ECONNREFUSED` or timeout → Network issue (unlikely on Cloudflare)

**Fix:**

- 401: Re-set API key: `npx wrangler secret put HONEYCOMB_API_KEY --name ...` (copy from Honeycomb UI)
- 429: Reduce `OTEL_SAMPLERATE` (e.g., 0.01 → 0.005) or contact Honeycomb support
- Timeout: Increase `timeoutMillis` in `OTLPTraceExporter` config (currently 10s). If frequent, check for large payloads.

---

### Symptom: Spans have empty `http.route` (show as "unknown" in Honeycomb)

**Cause:** Route pattern not passed correctly to `instrumentRoute` or middleware.

**Fix:**

In `middleware.ts`, the span attribute `'http.route'` is set from `request.nextUrl.pathname`. This should always have a value. If empty, check:
- Is middleware executing before route handling? Yes (order is correct).
- Are there paths that omit `pathname`? No, NextRequest always has it.

If using `instrumentRoute`, ensure `options.route` is a static string (not dynamic with `:id`). Use the actual route pattern like `/api/campaigns` not `/api/campaigns/123`.

---

### Symptom: Trace context not propagated to outgoing fetch calls

**Cause:** `FetchInstrumentation` not enabled or not picking up context.

**Verify:**

In `opentelemetry-setup.ts`, line 71-76:
```typescript
const fetchInstrumentation = new FetchInstrumentation({});
fetchInstrumentation.setTracerProvider(tracerProvider);
fetchInstrumentation.enable();
```

This should auto-instrument all `fetch()` calls from the Worker, adding `traceparent` headers.

**Test:**
1. Create a test route that does `fetch('https://httpbin.org/anything')`.
2. In Honeycomb, find the resulting trace and check if the fetch span exists as a child of the API span.
3. If missing, verify that fetch instrumentation is loaded (no console errors about `FetchInstrumentation` not found).

---

## Staging Verification Checklist

Before declaring OTel healthy in staging:

- [ ] `HONEYCOMB_API_KEY` secret set (verify: `wrangler secret list`)
- [ ] `OTEL_SAMPLERATE` set to 0.1 (10%) for staging visibility
- [ ] Deploy successful: `npm run deploy:full` → SHA match check passes
- [ ] Worker logs show `[OTel] Initialized`
- [ ] Test traffic generates traces: `curl` health and dashboard endpoints
- [ ] Honeycomb query `COUNT(trace_id) BY service.name` shows traffic from last 15 min
- [ ] Sample trace shows spans: `middleware.proxy` → `d1.query` (if DB hit) → `fetch` (if external API)
- [ ] Attributes populated: `http.method`, `http.route`, `duration_ms`, `http.status_code`
- [ ] No OTLP export errors in logs

---

## Production Rollout

Once staging verified for 24h:

1. Set production secrets:
   ```bash
   npx wrangler secret put HONEYCOMB_API_KEY --name sophia-ai-factory
   npx wrangler secret put OTEL_SAMPLERATE --name sophia-ai-factory --value "0.01"
   ```

2. Deploy production: `npm run deploy:full`

3. Verify:
   - `/api/version` SHA matches local commit
   - Production URL HTTP 200
   - Traces appear in `sophia-prod` dataset (check within 5 min)

4. Create production SLOs and dashboard (copy from staging).

---

## Alert Configuration Reference

Honeycomb alert queries:

| Alert | Condition | Severity | Notification |
|-------|-----------|----------|--------------|
| High Error Rate | `error_rate > 1` over 5 min | P2 | Slack #eng-alerts |
| High Latency | `p95(duration_ms) > 1000` over 5 min | P2 | Slack #eng-alerts |
| OTLP Export Down | `COUNT(trace_id) = 0` over 10 min (expected > 0) | P2 | Slack #eng-alerts |
| SLO Burn Critical | SLO burn rate > 0.5% over 1h | P1 | PagerDuty |

Set up via Honeycomb UI: Alerts → New Alert → select query → threshold → notification channel.

---

## Maintenance

### Quarterly

- Review `OTEL_SAMPLERATE` — adjust if cost/volume issues
- Update Honeycomb API key if rotating
- Audit span attributes for PII leakage (check `http.route` contains no user data)
- Refresh SLO targets based on actual performance

### After Incident

- Document OTel-related findings in incident postmortem
- If traces were missing during incident, update this runbook with lessons learned
- Consider temporarily increasing `OTEL_SAMPLERATE` during next incident for deeper visibility

---

## Troubleshooting Commands

```bash
# View Worker logs
npx wrangler tail --name sophia-ai-factory-staging

# List secrets
npx wrangler secret list --name sophia-ai-factory-staging

# Test OTel endpoint manually (simulate span export)
curl -X POST https://api.honeycomb.io/v1/traces \
  -H "X-Honeycomb-Team: $HONEYCOMB_API_KEY" \
  -H "X-Honeycomb-Dataset: sophia-staging" \
  -d '{"data":[{"trace_id":"00000000000000000000000000000000","spans":[{"span_id":"0000000000000000","name":"test","start_time_ms":1,"duration_ms":10}]}]}'

# Verify staging deployment
curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/api/version | jq

# Generate load test
k6 run tests/load/k6-steady.js --vus 10 --duration 30s
```

---

## Contacts

- Observability owner: Engineering team
- On-call: See PagerDuty rotation
- Honeycomb admin: To be assigned
- Escalation: CTO

---

## References

- OpenTelemetry Workers guide: https://opentelemetry.io/docs/instrumentation/js/cloudflare-workers/
- Honeycomb OTLP docs: https://docs.honeycomb.io/teams/ingest-traces/otlp/
- Sophia OTel code: `src/seed/telemetry/opentelemetry-setup.ts`
- Sophia SLO dashboard: `docs/observability/SLO-DASHBOARD.md`
- Sophia APM alerts runbook: `docs/runbooks/APM-ALERTS.md`
