# Cron Escalation Contacts
**Document ID:** RUN-CRON-ESC-001
**Effective Date:** 2026-06-04
**Owner:** Platform Ops

## Escalation Contacts

| Severity | Response Time | Primary | Backup | Contact |
|----------|--------------|---------|--------|---------|
| P0 — Cron down > 1h | < 15 min | On-call Engineer | Platform Lead | Telegram: @Sophia_Bbot |
| P1 — Cron error > 30min | < 30 min | Platform Ops | DevOps | support@mekongmind.com |
| P2 — Single job failure | < 4h | Platform Ops | — | support@mekongmind.com |

## Monitoring
- Sentry alert: `cron_route` tag missing heartbeat > 1h → page
- BetterStack heartbeat: 29 cron handlers wired
- CF quota alerts: 70% / 90% / 100%

## Incident Procedure
1. Check `/api/health/cron-heartbeat` for last check-in timestamps
2. Check Sentry for `cron_route` tagged errors
3. Notify primary + backup via Telegram @Sophia_Bbot
4. Replay failed job via operator script if applicable

*Operator: Fill in actual human contacts when available.*
