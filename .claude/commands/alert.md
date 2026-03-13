---
description: 🚨 Alert Management — Configure, Test, Silence, Escalate
argument-hint: [action: configure|test|silence|escalate|history]
---

**Think harder** để quản lý alerts: <action>$ARGUMENTS</action>

**IMPORTANT:** Alerts phải ACTIONABLE — không alert nếu không có action.

## Alert Severity Levels

| Level | Color | Response Time | Use Case |
|-------|-------|---------------|----------|
| `critical` | 🔴 | 5 min | Service down, data loss |
| `high` | 🟠 | 30 min | Degraded performance |
| `medium` | 🟡 | 4 hours | Non-urgent issues |
| `low` | 🟢 | Next business day | Informational |

## Alert Channels

| Channel | Severity | Use Case |
|---------|----------|----------|
| Slack (urgent) | Critical, High | Immediate attention |
| Slack (general) | Medium | Team awareness |
| Email | Low, Info | Daily digest |
| PagerDuty | Critical | On-call rotation |
| SMS | Critical | Fallback |

## Alert Configuration

### 1. Create Alert Rule
```bash
# Prometheus alert rule
cat > alerts/service-alerts.yaml << 'EOF'
groups:
  - name: ServiceAlerts
    interval: 30s
    rules:
      - alert: ServiceDown
        expr: up{job="gateway"} == 0
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Gateway service is down"
          description: "Gateway has been down for > 1 minute"
          runbook_url: "https://docs.agencyos.network/runbooks/gateway-down"
EOF
```

### 2. Configure Notification Channel
```yaml
# Alertmanager config
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
    - match:
        severity: high
      receiver: 'slack-urgent'
    - match:
        severity: medium
      receiver: 'slack-general'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: '$SLACK_WEBHOOK_URL'
        channel: '#alerts'
        send_resolved: true

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '$PAGERDUTY_SERVICE_KEY'
```

### 3. Test Alert
```bash
# Trigger test alert
curl -X POST http://alertmanager:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "medium",
      "service": "test"
    },
    "annotations": {
      "summary": "Test alert",
      "description": "This is a test"
    },
    "startsAt": "'$(date -Iseconds)'",
    "endsAt": "'$(date -d "+5 minutes" -Iseconds)'"
  }]'

# Verify alert received
# Check Slack #alerts channel
```

### 4. Silence Alert
```bash
# Silence alerts during maintenance
curl -X POST http://alertmanager:9093/api/v1/silence \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [
      {"name": "alertname", "value": "HighLatency"},
      {"name": "service", "value": "engine"}
    ],
    "startsAt": "'$(date -Iseconds)'",
    "endsAt": "'$(date -d "+2 hours" -Iseconds)'",
    "createdBy": "deployment-script",
    "comment": "Silence during deployment"
  }'
```

### 5. Escalate Alert
```bash
# Manual escalation via API
curl -X POST https://api.pagerduty.com/incidents \
  -H "Authorization: Token token=$PAGERDUTY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "type": "incident",
      "title": "Gateway Performance Degraded",
      "service": {
        "id": "PXXXXXX",
        "type": "service_reference"
      },
      "urgency": "high",
      "body": {
        "type": "incident_body",
        "details": "P99 latency at 2.5s (threshold: 500ms)"
      }
    }
  }'
```

## Alert Templates

### Slack Message
```json
{
  "attachments": [
    {
      "color": "#FF0000",
      "title": "🔴 CRITICAL: Service Down",
      "text": "Gateway service has been down for 5 minutes",
      "fields": [
        {"title": "Service", "value": "Gateway", "short": true},
        {"title": "Severity", "value": "Critical", "short": true},
        {"title": "Started", "value": "2026-03-04 10:30:00 UTC", "short": true},
        {"title": "Duration", "value": "5m 23s", "short": true}
      ],
      "actions": [
        {
          "type": "button",
          "text": "View Runbook",
          "url": "https://docs.agencyos.network/runbooks/gateway-down"
        },
        {
          "type": "button",
          "text": "Acknowledge",
          "url": "https://pagerduty.com/incidents/XXXXX"
        }
      ]
    }
  ]
}
```

## On-Call Rotation

```
Week 1: Alice (Platform Lead)
Week 2: Bob (Backend Engineer)
Week 3: Carol (SRE)
Week 4: Dave (Full-stack)

Escalation Policy:
1. On-call engineer (5 min response)
2. Team lead (15 min if no response)
3. Engineering Manager (30 min)
4. CTO (1 hour for critical)
```

## Alert History & Analytics

```bash
# View alert history
curl -s "http://alertmanager:9093/api/v1/alerts/history?start=$(date -d '7 days ago' -Iseconds)" | jq '
  .[] | {
    alertname: .labels.alertname,
    severity: .labels.severity,
    started: .startsAt,
    resolved: .endsAt,
    duration: ((.endsAt | fromdateiso8601) - (.startsAt | fromdateiso8601))
  }'

# Alert fatigue analysis
# Count alerts per week — target: < 20/week
```

## Best Practices

1. **Actionable**: Every alert must have a runbook
2. **Specific**: Alert on symptoms, not causes
3. **Escalatable**: Clear escalation path
4. **Testable**: Test alerts monthly
5. **Reviewable**: Weekly alert review meeting

## Related Commands

- `/health-check` — System health
- `/monitor` — Monitoring dashboard
- `/logs` — Log analysis
- `/incident` — Incident response
