---
description: ⏱️ Uptime Check — Website Monitoring, Status Page, Alert Rules
argument-hint: [--interval=60s] [--regions=us,eu,asia]
---

**Think harder** để uptime check: <$ARGUMENTS>

**IMPORTANT:** Monitoring PHẢI multi-region, alert qua multiple channels.

## Uptime Configuration

```yaml
# uptime-config.yaml
monitors:
  - name: Production API
    url: https://api.example.com/health
    interval: 60s
    timeout: 10s
    regions:
      - us-east
      - eu-west
      - asia-south
    assertions:
      - type: status-code
        value: 200
      - type: response-time
        value: < 1000ms
      - type: ssl-cert
        value: > 30d
    alerts:
      - type: slack
        channel: '#alerts'
      - type: email
        recipients: [ops@example.com]
      - type: pagerduty
        service-id: abc123
```

## CLI Commands

```bash
# === Check Single URL ===
curl -w "@curl-format.txt" -o /dev/null -s https://example.com

# === Multi-region Check (simulated) ===
for region in us eu asia; do
  curl -H "X-Region: $region" https://api.example.com/health
done

# === SSL Expiry Check ===
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -dates
```

## Status Page

```html
<!-- status.html -->
<!DOCTYPE html>
<html>
<head>
  <title>System Status</title>
  <meta http-equiv="refresh" content="60">
</head>
<body>
  <h1>🟢 All Systems Operational</h1>
  <div id="metrics">
    <p>API: <span class="status">UP</span> (98ms)</p>
    <p>Web: <span class="status">UP</span> (45ms)</p>
    <p>DB: <span class="status">UP</span> (12ms)</p>
  </div>
  <p>Last updated: <span id="timestamp"></span></p>
</body>
</html>
```

## Related Commands

- `/monitor` — System monitoring
- `/alert` — Alert configuration
- `/health-check` — Health checks
