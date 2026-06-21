# APM/Observability Runbook — Sophia AI Factory (P3 OTEL)

**Phase:** P3 — OpenTelemetry with Honeycomb
**Effective:** 2026-06-22
**APM Vendor:** Honeycomb (OTLP export)
**Service Name:** sophia-api

---

## Overview

Sophia AI Factory uses OpenTelemetry for distributed tracing and metrics, exporting to Honeycomb for APM (Application Performance Monitoring). This runbook covers:

- Configuration and deployment
- Trace verification and troubleshooting
- Honeycomb dashboard and alert setup
- SLO definitions and monitoring
- Incident response procedures

---

## Environment Variables

| Variable | Where | Description | Required |
|----------|-------|-------------|----------|
| `HONEYCOMB_API_KEY` | CF Worker secret | Honeycomb API key (team or personal) | Yes |
| `HONEYCOMB_DATASET` | CF var | Dataset name (default: `sophia-prod`) | No |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | CF var | OTLP endpoint (default: `https://api.honeycomb.io`) | No |
| `OTEL_SERVICE_NAME` | CF var | Service name (default: `sophia-api`) | No |
| `OTEL_SAMPLERATE` | CF var | Trace sampling rate 0-1 (default: `0.01` = 1%) | No |

**Production values:**
- `HONEYCOMB_DATASET=sophia-prod`
- `OTEL_SAMPLERATE=0.01` (1% sampling for cost control)

**Staging values:**
- `HONEYCOMB_DATASET=sophia-staging`
- `OTEL_SAMPLERATE=1.0` (100% sampling for debugging)

---

## Provisioning Steps

### 1. Create Honeycomb Account and API Key

1. Sign up at https://ui.honeycomb.io/signup
2. Create a new team or use existing
3. Navigate to **Account → API Keys**
4. Create a new API key with permissions:
   - `Create events` (for traces and metrics)
   - `Read events` (for dashboards)
5. Copy the API key (starts with `hny_`)

### 2. Set Secrets on Cloudflare Workers

#### Production:
```bash
cd apps/sophia-ai-factory
npx wrangler secret put HONEYCOMB_API_KEY --name sophia-ai-factory
# Enter the API key when prompted
```

#### Staging:
```bash
cd apps/sophia-ai-factory
npx wrangler secret put HONEYCOMB_API_KEY --config wrangler.staging.toml --name sophia-ai-factory-staging
```

### 3. Set Environment Variables

Add to wrangler.toml [vars] block:

```toml
[vars]
HONEYCOMB_DATASET = "sophia-prod"
OTEL_EXPORTER_OTLP_ENDPOINT = "https://api.honeycomb.io"
OTEL_SERVICE_NAME = "sophia-api"
OTEL_SAMPLERATE = "0.01"
```

For staging (wrangler.staging.toml):

```toml
[vars]
ENVIRONMENT = "staging"
HONEYCOMB_DATASET = "sophia-staging"
OTEL_EXPORTER_OTLP_ENDPOINT = "https://api.honeycomb.io"
OTEL_SERVICE_NAME = "sophia-api-staging"
OTEL_SAMPLERATE = "1.0"
```

---

## Deployment

### Staging Deployment

```bash
cd apps/sophia-ai-factory
bash scripts/deploy-staging.sh
```

Staging URL: https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev

### Production Deployment

```bash
cd apps/sophia-ai-factory
npm run deploy:full
```

Production URL: https://sophia.agencyos.network

---

## Verification

### 1. Check OTEL Initialization

```bash
# Staging
curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/api/version | jq .

# Should return JSON with shortSha and deployedAt
```

### 2. Generate Test Traces

Make a few requests to the staging environment to generate traffic:

```bash
# Test homepage
curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/en > /dev/null

# Test API routes
curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/api/version > /dev/null

# Repeat to generate multiple spans
for i in {1..10}; do
  curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/en > /dev/null &
done
wait
```

### 3. Verify Traces in Honeycomb

1. Log into Honeycomb UI
2. Select dataset `sophia-staging`
3. Go to **Traces** tab
4. Set time range to "Last 5 minutes"
5. You should see traces with service name `sophia-api-staging`
6. Click a trace to see span details:
   - `api.get.` or `api.post.` spans for HTTP handlers
   - `inngest.*` spans for background jobs
   - Child spans show parent-child relationships

### 4. Verify Metrics

In Honeycomb, run a query:

```
COUNT() over the last 5 minutes
GROUP BY service_name
```

Should show metrics from the staging service.

---

## Honeycomb Dashboard Configuration

### Create Dataset

1. Go to **Environments → Datasets**
2. Create dataset `sophia-staging` for staging
3. Create dataset `sophia-prod` for production (or use existing)
4. Copy dataset ID (format: `bed0a...`) for board references

### Recommended Dashboard: "Sophia API Overview"

Create a new board and add these graphs:

#### Graph 1: Request Rate
```
Query: COUNT()
Where: service_name=sophia-api[-staging]
Visualization: Time Series (1-minute buckets)
```

#### Graph 2: Error Rate
```
Query: COUNT(where: http.status_code >= 400) / COUNT()
Where: service_name=sophia-api[-staging]
Visualization: Number (percentage)
Alert: > 5% for 5 minutes
```

#### Graph 3: P50/P95/P99 Latency
```
Query: AVG(duration_ms), P95(duration_ms), P99(duration_ms)
Where: service_name=sophia-api[-staging] AND component=api
Visualization: Number
```

#### Graph 4: Top Slowest Endpoints
```
Query: P95(duration_ms)
Where: service_name=sophia-api[-staging] AND component=api
Group by: http.route
Visualization: Bar Chart (top 10)
```

#### Graph 5: Inngest Job Duration
```
Query: AVG(duration_ms), MAX(duration_ms)
Where: service_name=sophia-api[-staging] AND component=inngest
Group by: inngest.event
Visualization: Bar Chart
```

#### Graph 6: Trace Volume by Service
```
Query: COUNT()
Group by: service_name
Visualization: Single Value (total spans)
```

---

## Alert Rules (Honeycomb SLOs)

Create alerts in Honeycomb: **Alerts → Create Alert**

### Alert 1: High Error Rate
```
Name: Sophia API High Error Rate
Condition: Error rate > 5% over 5 minutes
Query: COUNT(where: http.status_code >= 400) / COUNT() > 0.05
Dataset: sophia-prod (and sophia-staging for staging)
Notification: Slack #alerts, Telegram operator
Severity: P1
```

### Alert 2: Elevated Latency (p95)
```
Name: Sophia API High Latency
Condition: p95(duration_ms) > 2000ms over 5 minutes
Query: P95(duration_ms WHERE component='api') > 2000
Dataset: sophia-prod
Notification: Slack #alerts, Telegram operator
Severity: P2
```

### Alert 3: Service Down (No Traces)
```
Name: Sophia API No Traces
Condition: COUNT() = 0 over 2 minutes
Query: COUNT() = 0
Dataset: sophia-prod
Notification: Slack #alerts, Telegram operator, PagerDuty (if configured)
Severity: P0
```

### Alert 4: Inngest Job Failures
```
Name: Inngest Job Error Rate
Condition: Error count > 10 over 10 minutes
Query: COUNT(where: span.status_code='ERROR' AND component='inngest') > 10
Dataset: sophia-prod
Notification: Slack #alerts
Severity: P2
```

---

## SLO Definitions

| SLO | Target | Measurement | Window |
|-----|--------|-------------|--------|
| **Availability** | 99.9% | Successful HTTP responses (2xx, 3xx) | 30 days |
| **Latency p95** | < 1000ms | API endpoint response time | 7 days |
| **Latency p99** | < 2000ms | API endpoint response time | 7 days |
| **Error Budget** | 0.1% | Error rate (5xx + 4xx) | 30 days |
| **Trace Success Rate** | 99% | Traces reaching Honeycomb | 24 hours |

### Error Budget Burn Rate

Monitor burn rate to detect issues early:

```
Burn rate = (current error rate) / (SLO error budget rate)

If burn rate > 2 → warning
If burn rate > 14 → critical
```

---

## Sample Queries Library

Save these as Honeycomb Heatmap or Graph queries:

### Query: Top Slowest Routes (Last 1h)
```
P95(duration_ms)
WHERE component='api'
GROUP BY http.route
ORDER BY P95 DESC
LIMIT 10
```

### Query: Error Rate by Endpoint
```
COUNT(where: http.status_code >= 400) / COUNT() as error_rate
WHERE component='api'
GROUP BY http.route
ORDER BY error_rate DESC
LIMIT 10
```

### Query: Inngest Job Durations
```
AVG(duration_ms), P95(duration_ms), MAX(duration_ms)
WHERE component='inngest'
GROUP BY inngest.event
ORDER BY AVG DESC
```

### Query: User Journey Analysis
```
Trace tree
WHERE trace.parent_span_id is null
ORDER BY start_time DESC
LIMIT 5
```

---

## Troubleshooting

### Traces Not Appearing in Honeycomb

1. **Check API key is set:**
   ```bash
   npx wrangler secret list --name sophia-ai-factory | grep HONEYCOMB
   ```

2. **Verify OTEL initialization in logs:**
   ```bash
   npx wrangler tail --name sophia-ai-factory 2>/dev/null | grep -i otel
   ```

3. **Test OTLP export locally:**
   ```bash
   HONEYCOMB_API_KEY=your_key npm run test:otel
   ```

4. **Check sampler rate:** If `OTEL_SAMPLERATE=0.01`, only 1% of traces sent. Set to `1.0` for testing.

5. **Check for export errors:** Look for OTel errors in worker logs:
   ```
   [OTel] Exporter error: ...
   ```

### High Latency in Honeycomb but Not in App

This indicates OTEL instrumentation overhead:

1. Check trace buffer sizes and flush intervals
2. Consider reducing span attributes (fewer dimensions = less overhead)
3. Increase `OTEL_SAMPLERATE` to reduce volume (counterintuitive but fewer spans = less work)

### Missing Spans for Certain Routes

Routes must be wrapped with `instrumentRoute()`:

```typescript
import { instrumentRoute } from '@/seed/telemetry/instrument-api';

export const GET = instrumentRoute(
  { route: '/api/campaigns', method: 'GET' },
  async (request) => {
    // handler logic
  }
);
```

### Inngest Spans Not Showing

Inngest functions must use `instrumentInngest()`:

```typescript
import { instrumentInngest } from '@/seed/telemetry/instrument-inngest';

export const generateCampaign = instrumentInngest('generate_campaign', async ({ event, step }) => {
  // handler logic
});
```

---

## Cost Management

Honeycomb pricing is event-based. To control costs:

1. **Sampling:** Use `OTEL_SAMPLERATE=0.01` (1%) in production
2. **Attribute filtering:** Avoid high-cardinality attributes (user IDs, request IDs)
3. **Dataset retention:** Set retention to 7 days (default) or 30 days max
4. **Monitor events/month:** Honeycomb UI shows usage; set alerts at 80% of plan limit

### Estimated Monthly Events

| Traffic | Samplerate | Events/Month |
|---------|------------|--------------|
| 100K req/day | 0.01 | ~300K traces |
| 1M req/day | 0.01 | ~3M traces |
| 100K req/day | 1.0 | ~30M traces (expensive!) |

---

## Security Considerations

- **HONEYCOMB_API_KEY** is a secret; never expose to browser
- API key stored as CF Worker secret (encrypted at rest)
- OTel spans may contain request data — ensure PII scrubbing in handlers
- Dataset access controlled via Honeycomb team permissions
- Export endpoint uses HTTPS with API key authentication

---

## Integration with Existing Observability

Sophia uses **multi-layer observability**:

| Layer | Tool | Purpose |
|-------|------|---------|
| Logs | Better Stack (Logtail) | Structured logging, PII-scrubbed |
| Metrics | Better Stack `/api/metrics` + in-memory ring buffer | Quick per-route stats |
| Traces | **Honeycomb (OTLP)** | Distributed tracing, latency analysis |
| Errors | Sentry (optional, source maps not uploaded) | Error grouping and stack traces |
| Uptime | Better Stack Heartbeats | Liveness monitoring |

These work together:
- **/api/metrics** gives immediate per-route p50/p95/p99 (low-latency, no external calls)
- **Honeycomb** gives detailed trace analysis, dependency mapping, slow query identification
- **Better Stack Logs** gives structured log search with PII scrubbing
- **Sentry** gives error exception grouping (stack traces may be minified)

---

## Runbook Reference

### Incident: High Error Rate Detected

1. Check Honeycomb dashboard for error rate spike
2. Identify affected endpoints (`http.route` dimension)
3. Check corresponding logs in Better Stack:
   ```bash
   # Filter logs by route and time range
   wrangler tail --name sophia-ai-factory 2>/dev/null | grep "route=/api/..."
   ```
4. If 5xx errors: check D1 connectivity, external API status
5. If 4xx errors: check auth, validation, client request format
6. Apply fix and redeploy
7. Verify error rate returns to baseline

### Incident: Elevated Latency

1. Identify slow endpoints in Honeycomb "Top Slowest Routes" graph
2. Drill into specific traces to find slow spans
3. Check for:
   - External API calls (OpenRouter, ElevenLabs, HeyGen)
   - D1 queries (missing indexes)
   - Large response payloads
4. Optimize identified bottleneck
5. Rerun queries to confirm improvement

### Incident: No Traces for >2 Minutes

1. Check worker is running:
   ```bash
   curl -s https://sophia.agencyos.network/api/version
   ```
2. Check HONEYCOMB_API_KEY is valid (not expired/revoked)
3. Check Honeycomb service status: https://status.honeycomb.io
4. Check worker logs for OTel exporter errors
5. If needed, temporarily increase `OTEL_SAMPLERATE` to `1.0` to force export
6. Redeploy if configuration changed

---

## Monthly APM Review Cadence (Task #39)

**Schedule:** First Monday of each month

**Agenda:**
1. Review trace volume and cost (Honeycomb usage)
2. Review top error-prone endpoints
3. Review latency trends (p95, p99)
4. Adjust sampling rate if needed
5. Review and refine alert rules
6. Update dashboard with new metrics of interest
7. Document any incidents from past month

**Output:** Update this runbook with:
- Current sampling rate and cost
- New alert rules added
- Dashboard changes made
- SLO compliance status

---

## Upgrade Path

Future enhancements:

1. **Service Graph:** Enable Honeycomb Service Map for dependency visualization
2. **Correlation:** Link traces to logs via trace_id (already embedded in logs)
3. **SLO Burn Rate Alerts:** Implement burn rate calculations in alerts
4. **Custom Instrumentation:** Add business-specific spans (video generation stages, payment flows)
5. **OTLP Logs Export:** Consider consolidating logs to Honeycomb (currently using Better Stack)

---

## References

- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/)
- [Honeycomb OTLP Ingestion](https://docs.honeycomb.io/ingest-otlp/)
- [Honeycomb SLOs](https://docs.honeycomb.io/using-honeycomb/slos/)
- [OpenTelemetry JS API](https://opentelemetry.io/docs/languages/js/)
- `apps/sophia-ai-factory/src/seed/telemetry/` — OTEL setup code
- `docs/observability-runbook.md` — P2 Better Stack documentation

---

**Last Updated:** 2026-06-22
**Owner:** CTO / Platform Engineering
**Review Cycle:** Monthly
