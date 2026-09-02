# SOP-05: Incident Response Process

> Version: 1.0 | Baseline: `5dd1f071` | Owner: Tech Lead | Review: Quarterly

---

## Severity Quick Reference

| SEV | Response | Target Resolution | Examples |
|---|---|---|---|
| **SEV-1** | Page immediately | 2 hours | Platform down, data loss, protected flow broken |
| **SEV-2** | Within 30 min | 8 hours | Core feature broken, performance, cron failures |
| **SEV-3** | Within 4 hours | 24 hours | Non-critical bug, single-user issue |
| **SEV-4** | Next business day | 72 hours | Enhancement, minor UX |

---

## Incident Lifecycle

```
DETECT → CLASSIFY → RESPOND → RESOLVE → POSTMORTEM
```

---

## Step-by-Step

### 1. DETECT
- Sentry alert, monitoring alert, customer report, health check failure

### 2. CLASSIFY
- Determine SEV level using table above
- SEV-1/2: Page Tech Lead immediately
- SEV-3/4: Create GitHub issue, handle in normal workflow

### 3. RESPOND
- Follow relevant playbook in `INCIDENT_RESPONSE.md`
- Communicate status via Slack/Telegram
- If founder-dependent (credentials, provider): Escalate to Founder

### 4. RESOLVE
- Apply fix (rollback, code fix, config change)
- Verify health checks pass
- Confirm with customer if customer-reported

### 5. POSTMORTEM (within 24h for SEV-1, 48h for SEV-2)
- Timeline
- Root cause
- What went well / wrong
- Action items with owners + due dates

---

## Communication Templates

### Internal (Slack)
```
🚨 SEV-[X] INCIDENT
What: [description]
Impact: [who/what affected]
Status: [investigating/fixing/resolved]
Next: [what's being done]
Owner: [name]
```

### Customer (Telegram)
```
⚠️ Sophia Platform Status Update
We're experiencing [issue].
Impact: [what's affected]
Status: [investigating/fixing/resolved]
ETA: [estimated resolution]
— Sophia Team
```

---

## References

- `INCIDENT_RESPONSE.md` — Full playbooks (10 scenarios)
- `DEPLOYMENT_RUNBOOK.md` — Deploy/rollback
- `DISASTER_RECOVERY_READINESS.md` — DR procedures