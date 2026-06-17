# Phase 03 — Real APM Implementation

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Observability category)
- Gap: "Observability is theatrical (26.5/60)" — Better Stack documented but `src/lib/telemetry/logger.ts` has 0 prod imports; 595 source files dispatch via `@/seed/utils/logger-utility` → `console.*`
- Related: Phase 2 (DR) benefits from APM for health checks; Phase 10 (Track Record) needs SLO metrics

## Overview

- **Priority:** P1 (independent; unblocks Observability gap)
- **Status:** pending
- **Description:** Implement real Application Performance Monitoring (APM) with OpenTelemetry instrumentation in Cloudflare Workers. Establish SLOs, latency dashboards, and Sentry alert rules. Replace theatrical Better Stack doc with wired observability stack.

## Key Insights

- Current logging: All `logger.*` calls go to `console.*` → CF Workers 7-day tail only → no aggregation, no retention, no alerting
- Sentry SDK is configured but sourcemap upload is non-fatal (exits 0 on failure); no traces, only errors
- Better Stack (Logtail) token referenced in config but logs never reach it (no imports of `src/lib/telemetry/logger.ts` in prod)
- Observability sub-scores were 4/10 average (logging, metrics, traces all effectively zero)

## Requirements

### Functional
1. **OpenTelemetry instrumentation** — Worker spans for each incoming request, outbound fetch calls, D1 queries, Inngest event processing
2. **Metrics collection** — p50/p95/p99 latency, error rate, throughput per endpoint
3. **SLO definition** — 99% of webhook requests < 500ms; 99.9% availability
4. **Dashboard** — Grafana Cloud or Honeycomb dashboard showing latency heatmaps, error rates, SLO burn rate
5. **Alerting** — Sentry alerts for error rate > 1% or latency p95 > 1000ms (escalate to Telegram)
6. **Log aggregation** — Ship `console.*` output to a log platform (Datadog/Logtail/Grafana Loki) with structured parsing

### Non-functional
- APM overhead < 5% CPU, < 10ms per request
- Sample traces at 1% rate to control cost (adjustable)
- Retain metrics for 90 days, traces for 30 days
- All logs structured JSON with requestId correlation

## Architecture

### OpenTelemetry Setup

Cloudflare Workers have native OpenTelemetry support via `@opentelemetry/sdk-cloudflare` and `@cloudflare/opentelemetry-exporter`.

```typescript
// src/seed/telemetry/opentelemetry-setup.ts
import { diag, DiagConsoleLogger } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/sdk-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-grpc';
import { metrics } from '@opentelemetry/api';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Configure sampling
const sampler = {
  shouldSample: (context, traceId, kind) => ({
    decision: 2, // TRACE_YES_RECORD_AND_SAMPLED (1% random)
    attributes: {},
  }),
};

// Initialize SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'sophia-ai-factory',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.NEXT_VERSION || 'dev',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.honeycomb.io',
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY!,
    },
  }),
  metricExporter: new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.honeycomb.io',
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY!,
    },
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ /* config */ }),
    exportIntervalMillis: 60000,
  }),
  sampler,
});

sdk.start();

// Instrument fetch
import { fetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { httpInstrumentation } from '@opentelemetry/instrumentation-http';
sdk.addInstrumentation(new fetchInstrumentation());
sdk.addInstrumentation(new httpInstrumentation());
```

**Integration point:** Import `src/seed/telemetry/opentelemetry-setup.ts` in `src/app/layout.ts` (root layout) to initialize on worker start.

### Metrics to Collect

| Metric | Description | Target | Labels |
|---|---|---|
| `http.server.request.duration` | Request latency | p95 < 500ms | method, route, status_code |
| `http.server.request.count` | Requests per second | — | method, route, status_code |
| `http.server.error.count` | Error responses (4xx+5xx) | rate < 1% | method, route, status_code |
| `d1.query.duration` | Database query latency | p95 < 100ms | query_type |
| `inngest.event.process.duration` | Background job latency | p95 < 1000ms | event_name |

**SLO calculation:** `success_rate = 1 - (error_count / total_count)` over 28-day window; target 99.9% availability.

### Log Aggregation

Replace `console.*` calls with structured logger that ships to Logtail (Better Stack) or Loki:

```typescript
// src/seed/telemetry/structured-logger.ts
import { logger } from '@/seed/utils/logger-utility'; // keep as fallback

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  userId?: string;
  route?: string;
  duration?: number;
  [key: string]: any;
}

async function shipLog(entry: LogEntry): Promise<void> {
  const payload = JSON.stringify(entry);
  // Ship to Logtail (Better Stack) if configured
  if (process.env.BETTER_STACK_API_KEY) {
    await fetch('https://in.logs.betterstack.com/v1/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BETTER_STACK_API_KEY}`,
      },
      body: payload,
    }).catch(() => {
      // Fallback to console
      logger[entry.level](entry.message, entry);
    });
  } else {
    logger[entry.level](entry.message, entry);
  }
}

export const telemetryLogger = {
  info: async (msg: string, meta: Record<string, any> = {}) => {
    await shipLog({ timestamp: new Date().toISOString(), level: 'info', message: msg, ...meta });
  },
  warn: async (msg: string, meta: Record<string, any> = {}) => {
    await shipLog({ timestamp: new Date().toISOString(), level: 'warn', message: msg, ...meta });
  },
  error: async (msg: string, err?: Error, meta: Record<string, any> = {}) => {
    await shipLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: msg,
      error: err?.stack,
      ...meta,
    });
  },
};
```

**Migration strategy:**
1. Keep existing `logger` calls; wrap them in `telemetryLogger` async fire-and-forget
2. Gradually migrate critical paths to use `telemetryLogger` directly
3. After 2 weeks of stability, remove `console.*` fallback

### Dashboard & Alerts

**Honeycomb (recommended)**
- Create dataset `sophia-production`
- Build derived columns: `route` (extract from URL), `status_class` (2xx/4xx/5xx)
- SLO: `COUNT(http.server.request{status_class="2xx"}) / COUNT(http.server.request)` > 0.999
- Alert: SLO burn rate > 0.5% over 1h → PagerDuty/Telegram

**Grafana Cloud (alternative)**
- Use Prometheus metrics from OpenTelemetry Collector
- Dashboard: latency heatmap, error rate gauge, RPS graph
- Alerts: `increase(http_requests_total{status_code=~"5.."}[1h]) > 0.01 * increase(http_requests_total[1h])`

## Related Code Files

**Files to create:**
- `src/seed/telemetry/opentelemetry-setup.ts`
- `src/seed/telemetry/structured-logger.ts`
- `src/app/layout.ts` — add OTLP initialization
- `scripts/telemetry/setup-honeycomb.js` — dashboard + SLO definition
- `docs/runbooks/APM-ALERTS.md` — alert routing and runbook responses

**Files to modify:**
- `src/seed/utils/logger-utility.ts` — add telemetry ship-on-debug/info/warn/error
- `src/app/api/*/route.ts` — add route labels to spans
- `src/forest/inngest/functions/*` — add event_name labels
- `.env.example` — add `HONEYCOMB_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`
- `wrangler.toml` — ensure no bundling of OTLP (use `nodeExternal` patterns)

## Implementation Steps

1. **Select APM vendor** — Honeycomb (recommended, good CF Workers support) vs Grafana Cloud vs Datadog
2. **Create Honeycomb account + dataset** — obtain API key; add to `.env.local`
3. **Build OTLP setup PoC** — instrument sample route; verify traces in Honeycomb
4. **Implement structured logger** — integrate with existing `logger` calls
5. **Roll out OTLP globally** — import in `layout.ts`; verify all endpoints traced
6. **Define SLOs in Honeycomb** — create SLO for 99% < 500ms; create burn-rate alerts
7. **Configure alert routing** — connect Honeycomb alerts to Telegram via webhook
8. **Build dashboard** — latency heatmap, error rate, top slow endpoints
9. **Validate metrics** — Check that p95/p99 numbers match real user experience
10. **Document runbook** — `docs/runbooks/APM-ALERTS.md` with what to do on each alert
11. **Retire Better Stack doc** — either delete `src/lib/telemetry/logger.ts` or repurpose it as wrapper
12. **Set up retention budget alerts** — monitor Honeycomb volume; set sampling adjustments

## Todo List

- [ ] Select APM vendor (Honeycomb vs alternatives) and obtain API key
- [ ] Add OTLP dependencies to package.json
- [ ] Create `opentelemetry-setup.ts` with Cloudflare instrumentation
- [ ] Test OTLP on local dev (use Honeycomb dev API key)
- [ ] Deploy to staging; verify traces appear in Honeycomb
- [ ] Implement structured logger with fallback
- [ ] Roll out to production (main)
- [ ] Define SLOs: 99% < 500ms, 99.9% availability
- [ ] Configure alert rules (error rate, latency, SLO burn)
- [ ] Build Grafana/Honeycomb dashboard
- [ ] Document alert response runbook
- [ ] Set up monthly review cadence for APM data

## Success Criteria

- ✅ Traces from 100% of production requests visible in Honeycomb (1% sample acceptable)
- ✅ p95 latency metric showing < 500ms median (baseline established)
- ✅ SLO dashboard showing current burn rate and error budget remaining
- ✅ Alerts firing in Telegram for test violations
- ✅ `docs/runbooks/APM-ALERTS.md` exists with clear response steps
- ✅ Better Stack theatrical doc either removed or repurposed as active wrapper

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OTLP instrumentation increases latency >10ms | Low | Med | Benchmark; adjust sampling rate |
| Honeycomb costs exceed budget | Med | Low | Set daily volume cap; adjust sampling |
| Trace context lost across Inngest boundary | Med | Med | Ensure traceparent header propagation |
| Structured logger becomes blocking bottleneck | Low | Med | Make shipLog fire-and-forget with error swallow |
| Alert fatigue (too many pages) | High | Med | Start with warning alerts; tune thresholds |

## Security Considerations

- OTLP endpoint uses HTTPS with API key; store key in `CF Workers Secrets`
- Logs may contain PII (userId, request body snippets) — ensure log redaction for sensitive fields
- Trace data retention: 30 days max; do not store raw request bodies in traces
- Sampling must be random (not all-users) to avoid privacy bias

## Next Steps

1. **Immediate:** Decide on APM vendor (Honeycomb recommended; has good CF Workers DX)
2. **Week 1:** Get API key, set up account, add secrets
3. **Week 1-2:** Build PoC instrumenting 1-2 routes
4. **Week 3:** Roll out globally; build dashboard
5. **Week 4:** Configure alerts; document runbook
