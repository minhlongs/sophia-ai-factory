# Incident Runbook — Sophia AI Factory

> Operational playbook for responding to production incidents.

## Quick Reference

| Incident Type | Primary Runbook | Response Time | Key Contacts |
|---------------|----------------|---------------|--------------|
| Deployment failure | `runbooks/DEPLOYMENT-FAILURE.md` | 15 min | DevOps lead |
| Payment webhook down | `runbooks/PAYMENT-WEBHOOK-FAILURE.md` | 30 min | Billing engineer |
| Database migration issue | `runbooks/DB-MIGRATION-ROLLBACK.md` | Immediate | DBA + CTO |
| Quota overrun | `runbooks/QUOTA-OVERRUN.md` | 1 hour | Platform ops |

## General Response Procedure

1. **Acknowledge** the alert in the notification channel
2. **Assess** impact and severity:
   - P0: Production down, all users affected
   - P1: Core functionality degraded
   - P2: Non-critical feature failure
   - P3: Monitoring anomaly only
3. **Invoke** the appropriate runbook below
4. **Communicate** status to stakeholders (Slack #sophia-incidents)
5. **Resolve** or **escalate** per runbook escalation paths
6. **Post-mortem** for P0/P1 incidents within 48 hours

## Runbook Conventions

Each runbook contains:

- **Symptoms** — how to recognize this incident
- **Diagnosis** — commands to run, logs to check
- **Remediation** — step-by-step fix procedure
- **Rollback** — how to revert if fix fails
- **Escalation** — when to involve additional teams
- **Post-incident** — follow-up actions

## Access Required

- Cloudflare Dashboard ( Workers, D1, R2 )
- Sentry project access
- Honeycomb (if enabled)
- GitHub repository ( deploy keys )
- Telegram bot admin (for notifications)

## Emergency Contacts

| Role | Contact | Slack |
|------|---------|-------|
| DevOps On-call | Check PagerDuty | #sophia-devops |
| Platform Engineer | `@platform-team` | #sophia-platform |
| Billing Specialist | `@billing-team` | #sophia-billing |
| Incident Commander | Designated per incident | #sophia-incidents |

## Tool Cheatsheet

```bash
# Deploy verification
npm run deploy:verify

# Check health endpoint
curl https://sophia.agencyos.network/api/health

# Get current version
curl https://sophia.agencyos.network/api/version

# View Cloudflare logs
npx wrangler tail --name sophia-ai-factory

# D1 database query
npx wrangler d1 execute sophia-raas-db --remote --command "SELECT ..."

# Rollback to previous version
npx wrangler rollback --name sophia-ai-factory --yes

# View Sentry issues
# Open: https://sentry.io/organizations/.../issues/

# Honeycomb query (if enabled)
# Open: https://ui.honeycomb.io/.../datasets/sophia-production
```

## Incident Communication Template

```
[INCIDENT] <Short title>

Status: <Investigating | Identified | Monitoring | Resolved>
Severity: <P0 | P1 | P2 | P3>
Impact: <Description of user impact>
Started: <timestamp>
ETA: <if known>

Updates to follow in this thread.
```

---

## Runbooks

- [Deployment Failure](runbooks/DEPLOYMENT-FAILURE.md)
- [Payment Webhook Failure](runbooks/PAYMENT-WEBHOOK-FAILURE.md)
- [Database Migration Rollback](runbooks/DB-MIGRATION-ROLLBACK.md)
- [Quota Overrun](runbooks/QUOTA-OVERRUN.md)
