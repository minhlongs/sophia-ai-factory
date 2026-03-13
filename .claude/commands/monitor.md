---
description: 📊 Monitoring Dashboard — Metrics, APM, Performance Tracking
argument-hint: [metric: latency|errors|traffic|saturation|custom]
---

**Think harder** để thiết lập monitoring: <metric>$ARGUMENTS</metric>

**IMPORTANT:** USE Method (Usage, Saturation, Errors, Traffic) cho mọi service.

## Monitoring Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| APM | Sentry/DataDog | Error tracking, performance |
| Metrics | Prometheus/Grafana | Time-series data |
| Logs | ELK/Loki | Log aggregation |
| Uptime | UptimeRobot/Pingdom | External monitoring |
| Real-time | WebSocket dashboard | Live metrics |

## Key Metrics (RED + USE)

### RED Method (Request-driven)
- **Rate**: Requests per second
- **Errors**: Error rate (%)
- **Duration**: Response time (p50, p95, p99)

### USE Method (Resource-driven)
- **Utilization**: % of resource used
- **Saturation**: Queue length, wait time
- **Errors**: Hardware/driver failures

## Dashboard Views

### 1. System Overview
```
┌─────────────────────────────────────────────────┐
│  AGENCYOS MONITORING DASHBOARD                  │
├─────────────────────────────────────────────────┤
│  Status: 🟢 Healthy  |  Uptime: 99.97%         │
│  Active Users: 1,234  |  Requests: 45.6K/s     │
├─────────────────────────────────────────────────┤
│  Service          Status   Latency   Errors    │
│  ─────────────────────────────────────────────  │
│  Gateway          🟢 OK    45ms      0.02%     │
│  Engine           🟢 OK    120ms     0.15%     │
│  Worker           🟢 OK    8ms       0.01%     │
│  Database         🟢 OK    12ms      0.00%     │
│  Queue            🟢 OK    3ms       0.00%     │
└─────────────────────────────────────────────────┘
```

### 2. Latency Breakdown
```bash
# Response time percentiles
curl -s http://prometheus:9090/api/v1/query_range \
  --data-urlencode "query=histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))" \
  --data-urlencode "start=$(date -d '1h ago' +%s)" \
  --data-urlencode "end=$(date +%s)" \
  --data-urlencode "step=60" | jq '.data.result[].values[-1]'

# Expected: p99 < 500ms, p95 < 200ms, p50 < 50ms
```

### 3. Error Tracking
```bash
# Error rate by service
curl -s http://sentry.io/api/0/projects/{org}/{project}/stats/ \
  -H "Authorization: Bearer $SENTRY_TOKEN" | jq '
  .[] | {
    timestamp: .[0],
    received: .[1].received,
    rejected: .[1].rejected
  }'

# Alert threshold: > 1% error rate
```

### 4. Traffic Analysis
```bash
# Requests per second (RPS)
sum(rate(http_requests_total[1m]))

# By endpoint
topk(10, sum by(endpoint) (rate(http_requests_total[5m])))

# By status code
sum by(status_code) (rate(http_requests_total[1m]))
```

### 5. Resource Saturation
```bash
# CPU usage
node_cpu_seconds_total{mode="idle"}

# Memory pressure
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes

# Disk I/O
rate(node_disk_io_time_seconds_total[5m])

# Queue depth
queue_length > 100  # Alert if > 100 pending
```

## Alert Rules (Prometheus)

```yaml
groups:
  - name: AgencyOS Alerts
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # High Latency
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency above 500ms"
          description: "Current p99: {{ $value | humanizeDuration }}"

      # Memory Pressure
      - alert: HighMemory
        expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Memory available below 10%"

      # Service Down
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.job }} is down"
```

## Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "AgencyOS Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "sum(rate(http_requests_total[1m]))"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[1m])) / sum(rate(http_requests_total[1m]))"
        }]
      },
      {
        "title": "Latency (p50, p95, p99)",
        "targets": [{
          "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "p50"
        }, {
          "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "p95"
        }, {
          "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "p99"
        }]
      }
    ]
  }
}
```

## Monitoring Commands

```bash
/monitor latency     # View latency breakdown
/monitor errors      # Error tracking dashboard
/monitor traffic     # Traffic analysis
/monitor saturation  # Resource utilization
/monitor custom      # Custom metrics
```

## Related Commands

- `/health-check` — System health
- `/alert` — Alert configuration
- `/logs` — Log analysis
