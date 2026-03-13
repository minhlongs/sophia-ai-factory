---
description: 📊 Status Page — Public Status, Incident History, SLA Metrics
argument-hint: [--update] [--incident]
---

**Think harder** để status page: <$ARGUMENTS>

**IMPORTANT:** Status page PHẢI public, auto-update, historical data.

## Status Page Structure

```
status/
├── index.html          # Public status page
├── api/
│   └── status.json     # API status endpoint
└── history/
    └── incidents.md    # Incident history
```

## Status API

```json
{
  "status": "operational",
  "updated_at": "2026-03-04T10:00:00Z",
  "services": [
    {
      "name": "API",
      "status": "operational",
      "uptime": "99.98%",
      "response_time": "98ms"
    },
    {
      "name": "Web App",
      "status": "operational",
      "uptime": "99.95%",
      "response_time": "145ms"
    },
    {
      "name": "Database",
      "status": "operational",
      "uptime": "99.99%",
      "response_time": "12ms"
    }
  ],
  "incidents": []
}
```

## Incident Template

```markdown
# Incident History

## [YYYY-MM-DD] Brief Description

**Status:** Resolved
**Impact:** Full/Partial outage
**Duration:** 45 minutes
**Affected Services:** API, Web App

### Timeline

- **10:00 UTC** - Issue detected via monitoring
- **10:05 UTC** - Team notified
- **10:30 UTC** - Root cause identified
- **10:45 UTC** - Fix deployed
- **10:50 UTC** - All services restored

### Root Cause

Brief description of what caused the issue.

### Resolution

Steps taken to resolve the issue.

### Prevention

Measures to prevent recurrence.
```

## Related Commands

- `/uptime-check` — Uptime monitoring
- `/monitor` — System monitoring
- `/alert` — Alert configuration
