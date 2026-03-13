---
description: 📜 Log Management — Aggregation, Search, Analysis, Archival
argument-hint: [service or query]
---

**Think harder** để phân tích logs: <query>$ARGUMENTS</query>

**IMPORTANT:** Structured logging (JSON) BẮT BUỘC cho mọi service.

## Log Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Collection | Fluentd/Filebeat | Log shipper |
| Aggregation | Loki/Elasticsearch | Index + search |
| Visualization | Grafana/Kibana | Log explorer |
| Alerting | Alertmanager | Log-based alerts |
| Archival | S3/GCS | Long-term storage |

## Log Format Standard

```json
{
  "timestamp": "2026-03-04T10:30:45.123Z",
  "level": "INFO",
  "service": "gateway",
  "trace_id": "abc123def456",
  "span_id": "xyz789",
  "message": "Request processed",
  "method": "POST",
  "path": "/api/v1/missions",
  "status_code": 200,
  "duration_ms": 145,
  "user_id": "user_xxx",
  "metadata": {
    "request_id": "req_xxx",
    "region": "us-east-1"
  }
}
```

## Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `ERROR` | Service-impacting errors | Exception, timeout, 5xx |
| `WARN` | Recoverable issues | Retry, deprecated API |
| `INFO` | Business events | Request completed, user action |
| `DEBUG` | Development debugging | Variable values, flow |
| `TRACE` | Fine-grained tracing | Every function entry/exit |

## Log Queries (LogQL)

### Search by Service
```logql
# Gateway logs
{service="gateway"}

# Filter by level
{service="gateway"} |= "ERROR"

# Exclude debug logs
{service="gateway"} !~ "DEBUG"
```

### Search by Trace ID
```logql
# Full request trace
{trace_id="abc123def456"}

# Across all services
{trace_id=~".*abc123.*"}
```

### Error Analysis
```logql
# Errors in last hour
{service="engine"} |= "ERROR" | time() - timestamp() < 3600

# Count errors by type
sum by (error_type) (count_over_time({service="engine"} |= "ERROR" [1h]))

# Error rate over time
rate(count_over_time({service="gateway"} |= "ERROR" [5m]))
```

### Performance Analysis
```logql
# Slow requests (> 1s)
{service="gateway"} | json | duration_ms > 1000

# P95 latency
quantile_over_time(0.95, {service="gateway"} | json | unwrap duration_ms [5m])

# Latency heatmap
rate({service="engine"} | json | unwrap duration_ms [5m])
```

### User Activity
```logql
# Actions by user
{user_id="user_xxx"} | json

# Session reconstruction
{session_id="session_xxx"} | sort(timestamp)
```

## Log Aggregation Commands

### Tail Logs (Real-time)
```bash
# Live tail for service
loki-cli tail '{service="gateway"}' --since 5m

# Follow with filter
loki-cli tail '{service="engine"} |= "ERROR"'
```

### Search Historical Logs
```bash
# Search last 24 hours
loki-cli query '{service="gateway"} | json | status_code >= 500' \
  --start "$(date -d '24h ago' -Iseconds)" \
  --end "$(date -Iseconds)" \
  --limit 100

# Export to JSON
loki-cli query '{service="gateway"}' --format json > logs.json
```

### Log Statistics
```bash
# Logs per minute
loki-cli stats '{service="gateway"}' --interval 1m

# Log volume by level
loki-cli query 'sum by (level) (count_over_time({service="gateway"}[1h]))'
```

## Log-Based Alerts

```yaml
# Alertmanager rules
groups:
  - name: LogAlerts
    rules:
      # Error Spike
      - alert: ErrorSpike
        expr: sum(rate({service="gateway"} |= "ERROR" | unwrap line [5m])) > 10
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Error rate spike detected"
          description: "{{ $value }} errors/second"

      # Slow Requests
      - alert: SlowRequests
        expr: sum({service="gateway"} | json | duration_ms > 1000 | unwrap line [5m]) > 100
        for: 10m
        labels:
          severity: medium
        annotations:
          summary: "High number of slow requests"
```

## Log Retention Policy

| Tier | Storage | Retention | Use Case |
|------|---------|-----------|----------|
| Hot | SSD (Loki) | 7 days | Active debugging |
| Warm | HDD | 30 days | Recent analysis |
| Cold | S3/GCS | 1 year | Compliance, audit |
| Archive | Glacier | 7 years | Legal requirements |

## Log Sampling

```yaml
# Reduce log volume for high-traffic services
sampling:
  rules:
    - service: gateway
      trace_log: 0.1  # 10% of TRACE logs
      debug_log: 0.5  # 50% of DEBUG logs
      info_log: 1.0   # 100% of INFO+ logs

    - service: engine
      error_log: 1.0  # Always keep errors
      warn_log: 1.0   # Always keep warnings
```

## Common Log Patterns

### Request Logging
```typescript
logger.info('Request received', {
  method: req.method,
  path: req.path,
  query: req.query,
  headers: req.headers,
  trace_id: req.headers['x-trace-id']
});

logger.info('Request completed', {
  status_code: res.statusCode,
  duration_ms: Date.now() - startTime,
  response_size: res.get('content-length')
});
```

### Error Logging
```typescript
logger.error('Database connection failed', {
  error: err.message,
  stack: err.stack,
  code: err.code,
  host: dbConfig.host
});
```

### Business Events
```typescript
logger.info('Mission completed', {
  mission_id: mission.id,
  customer_id: mission.customerId,
  mcu_consumed: mission.mcuCount,
  duration_ms: mission.duration
});
```

## Related Commands

- `/health-check` — System health
- `/monitor` — Monitoring dashboard
- `/alert` — Alert configuration
