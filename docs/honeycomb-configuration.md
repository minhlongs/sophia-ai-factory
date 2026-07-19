# Honeycomb Dashboard & Alert Configuration — Sophia AI Factory

This document specifies the exact Honeycomb UI configuration for OTEL observability.

---

## Datasets

| Environment | Dataset Name | Purpose |
|-------------|--------------|---------|
| Staging | `sophia-staging` | Staging traces (100% sampling) |
| Production | `sophia-prod` | Production traces (1% sampling) |

### Create Datasets

1. Go to **Environment → Datasets**
2. Click **Create Dataset**
3. Name: `sophia-staging`
4. Retention: 7 days (adjustable)
5. Click **Create**
6. Repeat for `sophia-prod`

---

## Board: "Sophia API Overview"

Create a new board: **Boards → New Board → Blank Board**

Name: `Sophia API Overview`
Visibility: Team (or Private if preferred)

### Add Graphs

#### Graph 1: Request Rate (Time Series)

**Query:**
```
COUNT()
```

**Where:**
```
service_name = "sophia-api"
```

**Group By:** `none`

**Visualization:** Time Series

**Settings:**
- Time window: `1m` buckets
- Y-axis: Linear
- Show markers: Off

**Title:** Request Rate (req/min)

---

#### Graph 2: Error Rate (Number)

**Query:**
```
COUNT(where: http.status_code >= 400) / COUNT()
```

**Where:**
```
service_name = "sophia-api"
```

**Visualization:** Number

**Format:** Percentage (0-100%)

**Title:** Error Rate (4xx + 5xx)

---

#### Graph 3: Latency p50/p95/p99

**Query:**
```
AVG(duration_ms) as p50
P95(duration_ms) as p95
P99(duration_ms) as p99
```

**Where:**
```
service_name = "sophia-api" AND component = "api"
```

**Visualization:** Number (multiple values)

**Title:** API Latency (ms)

---

#### Graph 4: Top 10 Slowest Endpoints

**Query:**
```
P95(duration_ms)
```

**Where:**
```
service_name = "sophia-api" AND component = "api"
```

**Group By:** `http.route`

**Order By:** `P95(duration_ms)` descending

**Limit:** 10

**Visualization:** Bar Chart

**Title:** Top 10 Slowest Endpoints (p95 ms)

---

#### Graph 5: Inngest Job Performance

**Query:**
```
AVG(duration_ms) as avg
P95(duration_ms) as p95
MAX(duration_ms) as max
```

**Where:**
```
service_name = "sophia-api" AND component = "inngest"
```

**Group By:** `inngest.event`

**Order By:** `AVG(duration_ms)` descending

**Visualization:** Bar Chart

**Title:** Inngest Job Durations (ms)

---

#### Graph 6: Total Traces Volume

**Query:**
```
COUNT()
```

**Where:** (leave empty for all traces)

**Group By:** `service_name`

**Visualization:** Single Value

**Title:** Total Traces (24h)

---

#### Graph 7: Error Distribution by Status Code

**Query:**
```
COUNT()
```

**Where:**
```
service_name = "sophia-api" AND http.status_code >= 400
```

**Group By:** `http.status_code`

**Order By:** `COUNT()` descending

**Visualization:** Bar Chart

**Title:** Errors by HTTP Status Code

---

#### Graph 8: Top Error Endpoints

**Query:**
```
COUNT(where: http.status_code >= 400) as error_count
COUNT() as total_count
(error_count / total_count) as error_rate
```

**Where:**
```
service_name = "sophia-api" AND component = "api"
```

**Group By:** `http.route`

**Order By:** `error_rate` descending

**Limit:** 10

**Visualization:** Bar Chart

**Title:** Top 10 Error-Prone Endpoints

---

#### Graph 9: Trace Duration Distribution (Heatmap)

**Query:**
```
COUNT()
```

**Where:**
```
service_name = "sophia-api" AND component = "api"
```

**Group By:**
- X-axis: `start_timestamp` (1-hour buckets)
- Y-axis: `duration_ms` (log scale)

**Visualization:** Heatmap

**Title:** API Latency Heatmap (24h)

---

#### Graph 10: Inngest Job Error Rate

**Query:**
```
COUNT(where: span.status_code = "ERROR") / COUNT()
```

**Where:**
```
service_name = "sophia-api" AND component = "inngest"
```

**Group By:** `inngest.event`

**Visualization:** Number (percentage)

**Title:** Inngest Job Error Rate

---

## Alert Rules

Create each alert in **Alerts → Create Alert**

### Alert 1: Critical Error Rate

**Name:** `Sophia API: High Error Rate`

**Condition (Visual Builder):**
```
Query: COUNT(where: http.status_code >= 400) / COUNT()
Where: service_name = "sophia-api"
Dataset: sophia-prod
Trigger when: > 0.05 (5%)
For: 5 minutes
```

**Notification Channels:**
- Slack: `#alerts`
- Telegram: Operator chat
- Email: `founder@sophia.agencyos.network`

**Severity:** P1 (Critical)

**Message Template:**
```
🚨 High Error Rate detected on Sophia API

Service: sophia-api
Error rate: {{value}}% (threshold: 5%)
Duration: 5 minutes
Dataset: sophia-prod

Quick links:
- Honeycomb: https://ui.honeycomb.io/datasets/sophia-prod
- Production URL: https://sophia.agencyos.network
```

---

### Alert 2: High Latency

**Name:** `Sophia API: High Latency (p95)`

**Condition:**
```
Query: P95(duration_ms)
Where: service_name = "sophia-api" AND component = "api"
Dataset: sophia-prod
Trigger when: > 2000 ms
For: 5 minutes
```

**Notification Channels:**
- Slack: `#alerts`
- Telegram: Operator chat

**Severity:** P2 (High)

**Message Template:**
```
⚠️ High API Latency detected

Service: sophia-api
p95 latency: {{value}}ms (threshold: 2000ms)
Dataset: sophia-prod

Check: Top Slowest Endpoints graph in Honeycomb board
```

---

### Alert 3: Service Down (No Traces)

**Name:** `Sophia API: No Traces (Service Down?)`

**Condition:**
```
Query: COUNT()
Where: service_name = "sophia-api"
Dataset: sophia-prod
Trigger when: = 0
For: 2 minutes
```

**Notification Channels:**
- Slack: `#alerts` (with @here)
- Telegram: Operator chat (with priority flag)
- PagerDuty (if integrated)

**Severity:** P0 (Critical - Service Down)

**Message Template:**
```
🛑 NO TRACES detected from Sophia API for 2 minutes!

Service may be down or OTel export broken.
Dataset: sophia-prod

Immediate actions:
1. Check worker status: https://sophia.agencyos.network/api/version
2. Check CF Workers logs: npx wrangler tail --name sophia-ai-factory
3. Check Honeycomb API key validity
4. Consider rollback: npx wrangler rollback --name sophia-ai-factory
```

---

### Alert 4: Inngest Job Failures

**Name:** `Inngest: High Job Error Rate`

**Condition:**
```
Query: COUNT(where: span.status_code = "ERROR") / COUNT()
Where: service_name = "sophia-api" AND component = "inngest"
Dataset: sophia-prod
Trigger when: > 0.10 (10%)
For: 10 minutes
```

**Notification Channels:**
- Slack: `#alerts`

**Severity:** P2 (High)

**Message Template:**
```
⚠️ Inngest job error rate elevated

Error rate: {{value}}% (threshold: 10%)
Check individual jobs in Honeycomb with:
  inngest.event:* AND span.status_code:ERROR
```

---

### Alert 5: Staging Error Rate (for development)

**Name:** `Staging: Error Rate Warning`

**Condition:**
```
Query: COUNT(where: http.status_code >= 400) / COUNT()
Where: service_name = "sophia-api-staging"
Dataset: sophia-staging
Trigger when: > 0.10 (10%)
For: 5 minutes
```

**Notification Channels:**
- Slack: `#dev-alerts`

**Severity:** P2

**Message Template:**
```
⚠️ Staging error rate elevated: {{value}}%

Staging URL: https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev
Dataset: sophia-staging
```

---

## Dashboard JSON Export

Save as `honeycomb-dashboard-sophia-api.json`:

```json
{
  "name": "Sophia API Overview",
  "description": "APM dashboard for Sophia AI Factory - traces and metrics",
  "graphs": [
    {
      "id": "graph-request-rate",
      "title": "Request Rate (req/min)",
      "query": { "primary": "COUNT()" },
      "where": "service_name = \"sophia-api\"",
      "visualization": "timeSeries",
      "yAxis": { "scale": "linear" },
      "time": { "bucket": "1m" }
    },
    {
      "id": "graph-error-rate",
      "title": "Error Rate (4xx + 5xx)",
      "query": { "primary": "COUNT(where: http.status_code >= 400) / COUNT()" },
      "where": "service_name = \"sophia-api\"",
      "visualization": "number",
      "number": { "format": "percentage" }
    },
    {
      "id": "graph-latency-pct",
      "title": "API Latency p50/p95/p99 (ms)",
      "query": {
        "primary": "AVG(duration_ms) as p50",
        "secondary": "P95(duration_ms) as p95",
        "tertiary": "P99(duration_ms) as p99"
      },
      "where": "service_name = \"sophia-api\" AND component = \"api\"",
      "visualization": "number"
    },
    {
      "id": "graph-slow-endpoints",
      "title": "Top 10 Slowest Endpoints (p95 ms)",
      "query": { "primary": "P95(duration_ms)" },
      "where": "service_name = \"sophia-api\" AND component = \"api\"",
      "group_by": ["http.route"],
      "order_by": "P95(duration_ms) DESC",
      "limit": 10,
      "visualization": "bar"
    },
    {
      "id": "graph-inngest-jobs",
      "title": "Inngest Job Durations (ms)",
      "query": {
        "primary": "AVG(duration_ms) as avg",
        "secondary": "P95(duration_ms) as p95",
        "tertiary": "MAX(duration_ms) as max"
      },
      "where": "service_name = \"sophia-api\" AND component = \"inngest\"",
      "group_by": ["inngest.event"],
      "order_by": "AVG(duration_ms) DESC",
      "visualization": "bar"
    },
    {
      "id": "graph-trace-volume",
      "title": "Total Traces (24h)",
      "query": { "primary": "COUNT()" },
      "where": "",
      "group_by": ["service_name"],
      "visualization": "singleValue"
    }
  ]
}
```

Import via **Boards → Import Board** (paste JSON).

---

## Alert Configuration Export

For infrastructure-as-code approach, use Honeycomb's API:

```bash
# Create alert via API (example)
curl -X POST https://api.honeycomb.io/1/alerts \
  -H "X-Honeycomb-Team: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophia API: High Error Rate",
    "dataset": "sophia-prod",
    "query": {
      "type": "count",
      "filters": [
        { "column": "service_name", "op": "=", "value": "sophia-api" },
        { "column": "http.status_code", "op": ">=", "value": "400" }
      ],
      "aggregates": []
    },
    "condition": {
      "type": "threshold",
      "threshold": 0.05,
      "operator": ">",
      "window_sec": 300
    },
    "notification": {
      "slack": { "channel": "#alerts" }
    }
  }'
```

---

## Integration Checklist

- [ ] Create `sophia-staging` dataset in Honeycomb
- [ ] Create `sophia-prod` dataset in Honeycomb
- [ ] Obtain `HONEYCOMB_API_KEY` for production
- [ ] Set `HONEYCOMB_API_KEY` as CF Worker secret on production
- [ ] Set `HONEYCOMB_API_KEY` as CF Worker secret on staging
- [ ] Configure environment variables in wrangler.toml (prod) and wrangler.staging.toml (staging)
- [ ] Deploy to staging and verify traces appear in `sophia-staging` dataset
- [ ] Import "Sophia API Overview" board to Honeycomb
- [ ] Create 5 alert rules (Error Rate, Latency, Service Down, Inngest Failures, Staging)
- [ ] Configure notification channels (Slack, Telegram)
- [ ] Test alert triggers with intentional high latency or errors
- [ ] Document operator escalation paths in apm-runbook.md
- [ ] Schedule monthly review cadence

---

## Notes

- Staging uses 100% sampling (`OTEL_SAMPLERATE=1.0`) for complete visibility
- Production uses 1% sampling (`OTEL_SAMPLERATE=0.01`) for cost control
- Adjust sampling based on monthly trace volume and Honeycomb plan limits
- All span attributes are automatically captured by OpenTelemetry instrumentation
- Custom attributes can be added via `span.setAttribute(key, value)` in code

---

**Last Updated:** 2026-06-22
**Document Owner:** Platform Engineering
