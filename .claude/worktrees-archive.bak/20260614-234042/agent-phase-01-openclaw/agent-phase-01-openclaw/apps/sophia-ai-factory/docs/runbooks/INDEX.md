# Sophia Runbooks Index

Operational runbooks for Sophia AI Factory — standard procedures for common operations. Each runbook is self-contained with steps, prerequisites, and success criteria. See the legend below for documentation status.

## Adding a New Runbook

1. Create `<action-name>.md` in this directory
2. Follow template: Overview | Prerequisites | Steps | Verification | Rollback
3. Update INDEX.md with entry in appropriate category
4. Mark status: ✅ documented, 📝 stub, ❌ undocumented
5. Ensure runbook title matches filename (kebab-case)

---

## Deployment

| Runbook | When | Owner | Time | Status |
|---------|------|-------|------|--------|
| **Deploy to Production** | After committing to main | Git Manager / DevOps | 5 min | ❌ undocumented |
| **Rollback Production** | Live incident / bad deploy | On-call Operator | 2 min | ❌ undocumented |
| **Hotfix Deploy** | Emergency P0 fix | Operator + DevOps | 3 min | ❌ undocumented |
| **Migration Execution** | After code change adds migrations/ | Git Manager | 1 min | ❌ undocumented |

*Reference:* `docs/dev-sops.md` SOP 5 (CF-direct doctrine), `.claude/rules/sophia-deploy-verify.md` (verify sequence)

---

## Database & Infrastructure

| Runbook | When | Owner | Time | Status |
|---------|------|-------|------|--------|
| **D1 Migration Hygiene** | Before major schema change | Database Admin | 5 min | ✅ `d1-migration-hygiene.md` |
| **Emergency D1 Backup** | Before risky migrations / quarterly DR drill | Operator | 5 min | ✅ `docs/dev-sops.md` SOP 11 |
| **D1 Restore from R2** | Post-backup verification / disaster recovery | Operator | 10 min | 📝 stub in SOP 11 |
| **D1 Region Failure** | D1 outage / region-level incident | On-call | 15 min | ✅ `d1-region-failure.md` |
| **R2 Storage Policy** | Monthly review / cost optimization | DevOps | 3 min | ✅ `r2-storage-policy.md` |
| **DB Quota Response** | DB nearing limits | Operator | 2 min | ❌ undocumented |

*Reference:* `docs/dev-sops.md` SOP 11–14 (automated + manual backup), `docs/disaster-recovery.md` (RTO/RPO)

---

## Cron & Scheduled Tasks

| Runbook | When | Owner | Time | Status |
|---------|------|-------|------|--------|
| **Cron Health Debug** | Scheduled job failed / running slow | DevOps | 5 min | ❌ undocumented |
| **Replay Failed Cron Job** | Job errored; need manual retry | Operator | 3 min | ❌ undocumented |
| **Scheduled Handler Audit** | Monthly validation of cron routes | Operator | 10 min | ❌ undocumented |
| **D1 Backup Cron** | Upstash QStash daily backup validation | Operator | 2 min | 📝 in SOP 14 |

*Reference:* `docs/dev-sops.md` SOP 14 (Automated D1 Backup), `src/forest/crons/` routes

---

## Authentication & Security

| Runbook | When | Owner | Time | Status |
|---------|------|-------|------|--------|
| **Revoke User Session** | User account compromise / logout issue | Support | 2 min | ❌ undocumented |
| **Lock Tenant** | Abuse / non-payment / operator request | Operator | 1 min | ❌ undocumented |
| **Rotate BYOK Master Key** | Key expiry / compromise (Better Auth) | Operator | 5 min | ❌ undocumented |
| **Rotate Cron Secret** | CRON_SECRET periodic rotation | Security | 3 min | ❌ undocumented |
| **Reset DMARC Policy** | DMARC p=none → p=quarantine promotion | Operator | 2 min | ❌ undocumented |

*Reference:* `docs/dev-sops.md` SOP 10 (Security Checklist), `.claude/rules/sophia-no-tech-doctrine.md` (operator scope)

---

## Webhooks & Integrations

| Runbook | When | Owner | Time | Status |
|---------|------|-------|------|--------|
| **Replay NOWPayments IPN** | Payment webhook missed / verify reconciliation | Finance | 3 min | ❌ undocumented |
| **Register HeyGen Webhook** | After customer provides HeyGen API key | Customer | 5 min | ❌ undocumented |
| **Webhook Signature Verification** | Debug failed webhook delivery | DevOps | 5 min | ❌ undocumented |

*Reference:* `docs/dev-sops.md` (NOWPayments IPN), `src/app/api/webhooks/`

---

## Provider Integrations (Customer-Managed)

| Runbook | When | Owner | Time | Status |
|---------|------|-------|------|--------|
| **Setup OpenRouter** | Customer adds LLM provider | Customer (via Setup Wizard) | 5 min | 📝 in Setup Wizard |
| **Setup ElevenLabs** | Customer adds voice provider | Customer (via Setup Wizard) | 3 min | 📝 in Setup Wizard |
| **Setup D-ID** | Customer adds avatar provider | Customer (via Setup Wizard) | 3 min | 📝 in Setup Wizard |
| **Setup NOWPayments** | Customer adds payment provider | Customer (via Setup Wizard) | 5 min | 📝 in Setup Wizard |
| **Setup Telegram Bot** | Customer adds Telegram integration | Customer (via app form) | 3 min | ❌ undocumented |

*Note:* All customer integrations are **BYOK** (Bring Your Own Keys). Operator does NOT manage these per `sophia-no-tech-doctrine.md`.

---

## Observability & Monitoring

| Runbook | When | Owner | Time | Status |
|---------|------|-------|------|--------|
| **Tail Cloudflare Logs** | Real-time debugging / live incident | DevOps | 2 min | ❌ undocumented |
| **Check Sentry Errors** | Error spike investigation | DevOps | 5 min | ❌ undocumented |
| **DMARC Report Triage** | Weekly email authentication review | Operator | 5 min | ❌ undocumented |
| **Cost Monitoring** | Monthly spend review / budget validation | Finance | 3 min | ✅ `cost-monitoring.md` |
| **Application Log Retention** | Log lifecycle / cleanup review | DevOps | 2 min | ✅ `application-log-retention.md` |
| **Backup & Restore Drill** | Quarterly DR exercise (RTO validation) | Operator | 30 min | ✅ `backup-restore-drill.md` |

*Reference:* `docs/dev-sops.md` SOP 7 (Debug Issues), SOP 12 (Sentry), SOP 13 (CF Spend), SOP 15 (DR Drill)

---

## Status Summary

**Documented (✅):** 4 runbooks
- `application-log-retention.md`
- `backup-restore-drill.md`
- `cost-monitoring.md`
- `d1-migration-hygiene.md`
- `d1-region-failure.md`
- `r2-storage-policy.md`

**Stubs (📝):** 7 runbooks (referenced in dev-sops.md, need full expansion)
- D1 Backup Cron (SOP 14)
- D1 Restore (SOP 11 partial)
- Setup Wizard flows (customer-managed)

**Undocumented (❌):** 18+ runbooks (Phase 4 backlog)
- Deploy, rollback, hotfix flows
- Cron debugging / replay
- Auth / security operations
- Webhook replay / debugging
- Observability (Sentry, logs, DMARC)
- Tenant lock / session revoke

---

## Cross-References

| Reference | Purpose |
|-----------|---------|
| `docs/dev-sops.md` | All 15 SOPs including deployment, backup, DR procedures |
| `docs/deployment-guide.md` | Production onboarding, RTO/RPO targets, runbook reference list |
| `.claude/rules/sophia-deploy-verify.md` | Authoritative deploy verification sequence (mandatory for Phase 2) |
| `.claude/rules/sophia-no-tech-doctrine.md` | Operator vs customer scope — no operator third-party setup required |
| `docs/sop-ceo-production-smoke.md` | Non-tech operator smoke-test checklist |
| `docs/sophia-supervisor-agent-runbook.md` | Automated supervisor agent for error handling |
| `docs/incident-response-playbook.md` | Incident classification & escalation |

---

## Legend

- **✅ documented** — Runbook exists and is complete
- **📝 stub** — Referenced in dev-sops.md or code comments; needs expansion into full runbook
- **❌ undocumented** — No runbook exists; Phase 4 backlog candidate

*Last updated: 2026-05-22*
