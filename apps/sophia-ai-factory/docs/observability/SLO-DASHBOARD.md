# Observability — SLO & Dashboard Guide

> Sophia AI Factory — OpenTelemetry + Honeycomb
> Last updated: 2026-06-21

## Overview

Sophia uses OpenTelemetry (OTel) for distributed tracing and metrics, exported to Honeycomb via OTLP/HTTP. This document defines the SLOs and describes the dashboard.

## Architecture

### Components

- **OpenTelemetry SDK** (`@/seed/telemetry/opentelemetry-setup.ts`)
  - Tracer provider with Honeycomb OTLP exporter
  - Metric provider with periodic export (60s)
  - Fetch instrumentation for outgoing HTTP
  - Configured via environment variables

- **Tracing** (`src/middleware.ts`)
  - Middleware wraps every request with span
  - Attributes: `http.method`, `http.route`, `duration_ms`, `http.status_code`
  - Exceptions recorded with stack traces

- **Metrics** (`@/seed/observability/telemetry/metrics.ts`)
  - In-memory ring buffer per Worker isolate
  - Tracks: request count, error count, p50/p95/p99 latency per route
  - Exported via `/api/metrics` endpoint (PROM format compatible)

- **Logger** (`@/seed/observability/telemetry/logger.ts`)
  - Structured JSON logs with PII scrubbing
  - Batched flush to Better Stack (log management)
  - Global buffer for non-request-scoped logs

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `HONEYCOMB_API_KEY` | (required) | Honeycomb API key (set via `wrangler secret put`) |
| `HONEYCOMB_DATASET` | `sophia-prod` | Dataset name for traces/metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `https://api.honeycomb.io` | OTLP ingest endpoint |
| `OTEL_SERVICE_NAME` | `sophia-api` | Service name in traces |
| `OTEL_SAMPLERATE` | `0.01` (1%) | Sampling rate (0-1). Use 1.0 for local dev |

Set secrets:
```bash
cd apps/sophia-ai-factory
npx wrangler secret put HONEYCOMB_API_KEY
npx wrangler secret put HONEYCOMB_DATASET  # optional if not sophia-prod
npx wrangler secret put OTEL_SAMPLERATE    # optional if not 0.01
```

---

## SLO Definitions

All SLOs apply to the **production dataset** (`sophia-prod`). Time window: **28 days**.

### 1. Availability

**Target:** 99.9% successful requests (2xx + 3xx status codes)

**Query:**
```
success_ratio = COUNT(http.server.request{status_class=~"2xx|3xx"}) / COUNT(http.server.request) * 100
```

**Burn rate alert:** If success ratio < 99.9% for 1 hour, error budget burns at 1x rate.

### 2. Latency

**Target:** 95th percentile latency < 500ms for successful requests

**Query:**
```
p95(http.server.request.duration{status_class="2xx"}) < 0.5  # seconds
```

**Burn rate alert:** If p95 > 500ms for 30 min, error budget burns at 2x rate (latency double-burn).

### 3. Error Rate

**Target:** 5xx error rate < 0.1%

**Query:**
```
COUNT(http.server.request{status_class="5xx"}) / COUNT(http.server.request) * 100 < 0.1
```

**Burn rate alert:** If error rate > 0.1% for 15 min, error budget burns at 5x rate (errors high severity).

---

## Error Budget Policy

- **Initial error budget:** 100% - SLO target (e.g., 0.1% for availability = 0.999 burn threshold)
- **Consumption:** Tracked continuously via Honeycomb SLO burn rate indicators
- **Freeze threshold:** If error budget remaining < 20%, freeze all non-critical deploys
- **Burn multiple:** Higher multiples (2x, 5x) accelerate budget consumption for severe violations
- **Review:** Monthly SLO review meeting (see "Cadence" below)

---

## Honeycomb Dashboard

### Dashboard Name: `Sophia APM — Production`

Create a Honeycomb board with these widgets (queries assume `http.server.request` and `http.server.request.duration`):

#### 1. Request Rate (RPS)
- **Query:** `COUNT() / 60` (per minute)
- **Visualization:** Time series line chart
- **Duration:** Last 24 hours

#### 2. Error Rate
- **Query:** `COUNT(http.server.request{status_class="5xx"}) / COUNT(http.server.request) * 100`
- **Visualization:** Single-value (percentage)
- **Thresholds:** Green < 0.1%, Yellow 0.1-0.5%, Red > 0.5%

#### 3. Latency Heatmap
- **Query:** `http.server.request.duration{status_class="2xx"}` histogram
- **Visualization:** Heatmap (heatmap chart)
- **Breakdown:** Optionally BY `http.route`

#### 4. Top 10 Slowest Endpoints
- **Query:** `p95(http.server.request.duration) BY http.route LIMIT 10`
- **Visualization:** Table (route, p50, p95, p99)

#### 5. SLO Status Cards
- **Availability:** `success_ratio` from above (green/red based on 99.9% threshold)
- **Latency:** `p95(duration) < 500ms` boolean (green/red)
- **Error rate:** `5xx rate < 0.1%` boolean (green/red)
- **Error budget remaining:** SLO burn indicator (percentage)

#### 6. Trace Volume
- **Query:** `COUNT(trace_id)` unique traces per minute
- **Visualization:** Area chart
- **Purpose:** Verify sampling is working (should be steady)

#### 7. Status Code Breakdown
- **Query:** `COUNT() BY status_class`
- **Visualization:** Stacked bar or pie chart
- **Time window:** Last 1 hour

---

## Alert Configuration

Configure alerts in Honeycomb (Alerts → New Alert) or via API. All alerts route to Slack `#eng-alerts` (or Telegram webhook if Slack unavailable).

### Alert 1: High Error Rate
- **Condition:** `COUNT(http.server.request{status_class="5xx"}) / COUNT(http.server.request) * 100 > 1` over 5 minutes
- **Severity:** P2
- **Runbook:** See `docs/runbooks/APM-ALERTS.md#high-error-rate`

### Alert 2: High Latency
- **Condition:** `p95(http.server.request.duration) > 1.0` (seconds) over 5 minutes
- **Severity:** P2
- **Runbook:** See `docs/runbooks/APM-ALERTS.md#high-latency`

### Alert 3: SLO Burn Critical
- **Condition:** SLO burn rate > 0.5% over 1 hour (use SLO alert)
- **Severity:** P1
- **Runbook:** See `docs/runbooks/APM-ALERTS.md#slo-burn-rate-critical`

### Alert 4: Trace Drop (OTel Exporter Down)
- **Condition:** `COUNT(trace_id) = 0` over 10 minutes (when expected > 0)
- **Severity:** P2
- **Runbook:** See `docs/runbooks/APM-ALERTS.md#trace-drop`

---

## Local Development Testing

1. Set env vars in `.env.local`:
   ```bash
   HONEYCOMB_API_KEY=your-dev-key
   HONEYCOMB_DATASET=sophia-dev
   OTEL_SAMPLERATE=1.0  # 100% sampling
   ```

2. Start dev server: `npm run dev`

3. Generate traffic:
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/v1/video/generate  # if available
   ```

4. Verify traces appear in Honeycomb dataset `sophia-dev` within 30 seconds.

5. Check OTel debug logs in console (should see `[OTel] Initialized`).

---

## Production Rollout Checklist

- [ ] Honeycomb API key added to Cloudflare secrets: `npx wrangler secret put HONEYCOMB_API_KEY`
- [ ] `OTEL_SAMPLERATE` set to `0.01` (1%) in production via `wrangler.toml` [vars] or secret
- [ ] Staging verified: traces appearing in `sophia-staging` dataset
- [ ] SLOs created in Honeycomb (Availability, Latency, Error Rate)
- [ ] Dashboard built and shared with team
- [ ] Alerts configured (error rate, latency, SLO burn, trace drop)
- [ ] Runbook reviewed by on-call team
- [ ] Monthly review cadence scheduled (calendar invite sent)
- [ ] Production deploy verified: `npm run deploy:full` → SHA match check → traces in `sophia-prod`

---

## Maintenance

### Quarterly
- Review SLO targets (are 99.9% / 500ms still appropriate?)
- Adjust sampling rate if cost/volume issues (higher sample = more cost)
- Update dashboard widgets based on new endpoints

### After Incidents
- Document in `docs/incidents/` with root cause
- Review if SLO thresholds were appropriate
- Update runbook with new lessons learned

### Monthly Review Agenda
1. SLO compliance report (last 28 days)
2. Error budget remaining and burn rate
3. Top 5 slowest routes (action items for optimization)
4. Trace volume trends (sampling adequacy)
5. Alert noise review (any false positives? mute or adjust)
6. Cost report (Honeycomb bill vs. budget)

---

## References

- OpenTelemetry Cloudflare Workers: https://opentelemetry.io/docs/instrumentation/js/cloudflare-workers/
- Honeycomb OTLP ingest: https://docs.honeycomb.io/teams/ingest-traces/otlp/
- SLO best practices: https://sre.google/workbook/implementing-slos/
- Sophia deploy doctrine: `.claude/rules/sophia-deploy-verify.md`

## Contacts

- **Observability owner:** Engineering team
- **Honeycomb admin:** [Name/email] (to be filled)
- **On-call escalation:** See `docs/runbooks/INDEX.md`
