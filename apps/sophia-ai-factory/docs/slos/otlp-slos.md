# OTLP SLOs — OpenTelemetry Export Service Level Objectives

> Sophia AI Factory — Staging and Production telemetry targets
> Last updated: 2026-06-22 (Task #28-39 completion)

## Overview

This document defines the SLOs for OpenTelemetry data export reliability and latency. These SLOs apply to the OTLP exporter pipeline from Sophia Workers to Honeycomb (or Grafana Cloud if configured).

## Scope

- **Service:** OpenTelemetry Collector endpoint (Honeycomb OTLP/HTTP)
- **Data types:** Traces and Metrics
- **Environments:** Staging and Production
- **Measurement period:** Rolling 28-day window

## SLO Definitions

### 1. Trace Export Success Rate

**Target:** 99.9% of spans successfully delivered to Honeycomb within 30 seconds of span end.

**Measurement:**
```
successful_export_count / total_span_count * 100 > 99.9%
```

**Rationale:** OTel SDK uses background async export. Lost spans due to network errors or endpoint unavailability degrade observability.

**Alert:** Export success rate < 99% for 10 minutes.

---

### 2. Trace Ingestion Latency

**Target:** p95 time from span end to availability in Honeycomb query engine < 60 seconds.

**Measurement:**
```
p95(honeycomb.ingestion_latency) < 60s
```

**Rationale:** Near-real-time visibility is required for effective debugging and alerting. Delays > 1 minute impair incident response.

**Alert:** p95 ingestion latency > 90 seconds for 15 minutes.

---

### 3. Metrics Export Reliability

**Target:** 99.5% of metric batches successfully exported (periodic 60s reader).

**Measurement:**
```
COUNT(metric_batch_success) / COUNT(metric_batch_attempt) * 100 > 99.5%
```

**Rationale:** Metrics power dashboards and alerting. Missing batches create blind spots.

**Alert:** Metric export success rate < 98% for 30 minutes.

---

### 4. Sampler Accuracy

**Target:** Effective sampling rate within ±20% of configured `OTEL_SAMPLERATE`.

**Measurement:**
```
actual_sampled_count / total_spans_created ≈ OTEL_SAMPLERATE ± 0.2
```

**Rationale:** Sampling controls cost and volume. Drift indicates sampler misconfiguration or attribute-based overrides.

**Alert:** Actual sample rate deviates > 30% from target for 1 hour.

---

## Configuration Validation

Before declaring OTel pipeline healthy, verify:

1. **Spans appear in Honeycomb:** Run `COUNT(trace_id)` query in last 5 minutes → should be > 0.
2. **Attributes present:** Sample traces show `http.method`, `http.route`, `duration_ms`, `http.status_code`.
3. **Service name correct:** `service.name = sophia-api` (or custom `OTEL_SERVICE_NAME`).
4. **No export errors in logs:** Check Cloudflare tail for `OTLP export failed` messages.
5. **Metrics endpoint returns data:** `curl https://staging.sophia.../api/metrics` shows Prom-formatted metrics.

---

## Sampling Rate Guidelines

| Environment | OTEL_SAMPLERATE | Expected daily trace count | Cost estimate |
|-------------|-----------------|---------------------------|---------------|
| Local dev   | 1.0 (100%)      | ~1,000 per session        | Free          |
| Staging     | 0.1 (10%)       | ~50,000                   | $50-100/mo    |
| Production  | 0.01 (1%)       | ~100,000                  | $200-500/mo   |

Adjust based on actual volume and budget. Higher sampling during incidents: temporarily set `OTEL_SAMPLERATE=0.05` (5%) for deeper visibility.

---

## Honeycomb Configuration Reference

### Required Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HONEYCOMB_API_KEY` | Honeycomb write API key | — | ✅ Yes |
| `HONEYCOMB_DATASET` | Dataset name | `sophia-prod` | No (staging should set explicitly) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP endpoint | `https://api.honeycomb.io` | No |
| `OTEL_SERVICE_NAME` | Service name in traces | `sophia-api` | No |
| `OTEL_SAMPLERATE` | Fraction of traces to sample (0-1) | `0.01` | No |

### Setting Secrets in Cloudflare

```bash
# Staging
npx wrangler secret put HONEYCOMB_API_KEY --name sophia-ai-factory-staging
npx wrangler secret put HONEYCOMB_DATASET --name sophia-ai-factory-staging --value "sophia-staging"
npx wrangler secret put OTEL_SAMPLERATE --name sophia-ai-factory-staging --value "0.1"

# Production
npx wrangler secret put HONEYCOMB_API_KEY --name sophia-ai-factory
npx wrangler secret put OTEL_SAMPLERATE --name sophia-ai-factory --value "0.01"
```

---

## Monitoring OTLP Pipeline Health

Create Honeycomb queries to monitor the exporter itself:

1. **Span count by service:** `COUNT(trace_id) BY service.name` (ensure `sophia-api` appears)
2. **Export errors:** `COUNT(*) WHERE otel.status_code = error` (if SDK sets error status)
3. **Span duration distribution:** `http.server.request.duration` heatmap (verify traces flowing)
4. **Missing attributes:** `COUNT(*) WHERE http.route = ""` (indicates instrumentation gaps)

---

## Incident Response

If OTLP SLOs breach:

1. **Check Honeycomb status:** https://status.honeycomb.io
2. **Verify API key validity:** Re-put secret if recently rotated
3. **Check Cloudflare Worker logs:** `npx wrangler tail --name sophia-ai-factory-staging`
4. **Look for OTel errors:** `OTLP export failed`, `exporter timeout`, `quota exceeded`
5. **Temporary mitigation:** Increase `OTEL_SAMPLERATE` to 1.0 locally to debug; if traces appear locally but not in staging/prod, endpoint/network issue.
6. **If endpoint unreachable:** Verify `OTEL_EXPORTER_OTLP_ENDPOINT` hasn't changed; check CORS/network egress rules (Cloudflare Workers can reach external HTTPS).
7. **Rollback:** If recent deploy broke OTel, rollback to previous version via `wrangler rollback`.

---

## Cost Management

Honeycomb pricing is based on span count. Monitor daily volume:

- Set budget alert at 80% of plan limit
- If cost exceeds forecast, reduce `OTEL_SAMPLERATE` (e.g., 0.01 → 0.005)
- Use attribute filters to drop low-value spans (e.g., health checks) if needed

---

## References

- OpenTelemetry specification: https://opentelemetry.io/docs/specs/otel/
- Honeycomb OTLP ingest: https://docs.honeycomb.io/teams/ingest-traces/otlp/
- Sophia OTel setup: `src/seed/telemetry/opentelemetry-setup.ts`
- Sophia SLO dashboard: `docs/observability/SLO-DASHBOARD.md`
- Deployment doctrine: `.claude/rules/sophia-deploy-verify.md`
