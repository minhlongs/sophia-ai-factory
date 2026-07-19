# Sophia AI Factory — Handover Documentation Index

**Last Updated:** 2026-06-22  
**Purpose:** Centralized index for all handover and operational documentation

---

## Quick Start (Read First)

| Document | Audience | Purpose |
|----------|----------|---------|
| [CEO-QUICK-START.md](../CEO-QUICK-START.md) | CEO / New Operator | 5-minute onboarding — deploy, verify, run agents |
| [EXECUTIVE-SUMMARY.md](../EXECUTIVE-SUMMARY.md) | Executive Stakeholders | High-level delivery confirmation and status |
| [HANDOVER-MANIFEST.md](../HANDOVER-MANIFEST.md) | Handoff Recipient | Complete inventory of artifacts and verification checklist |

---

## Architecture & Code

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [docs/system-architecture.md](system-architecture.md) | Full system design, layers, data flow, API reference | 2026-05-20 |
| [docs/codebase-summary.md](codebase-summary.md) | Comprehensive 740-line codebase overview | 2026-05-22 |
| [docs/code-standards.md](code-standards.md) | Type safety, architectural patterns, quality gates | 2026-06-20 |
| [CLAUDE.md](../CLAUDE.md) | Project constitution — rules, doctrine, commands | 2026-06-21 |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System summary and layer model | 2026-05-30 |

---

## Deployment & Operations

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [docs/operator-quick-reference.md](operator-quick-reference.md) | **Operator quick reference — one-page cheat sheet** | 2026-06-22 |
| [docs/deployment-guide.md](deployment-guide.md) | CF-direct deploy flow, secrets, cron setup | 2026-06-20 |
| [docs/ops-runbook.md](ops-runbook.md) | Daily operations, health checks, cron jobs | 2026-05-30 |
| [docs/observability-runbook.md](observability-runbook.md) | APM, Honeycomb, SLOs, alert response | 2026-06-20 |
| [docs/incident-response.md](incident-response.md) | Incident handling, escalation, postmortem | 2026-06-22 |
| [docs/disaster-recovery.md](disaster-recovery.md) | Backup strategy, restore procedures, DR drills | 2026-05-21 |
| [apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md](../../apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md) | Mandatory deploy verification sequence | 2026-05-03 |

---

## Security & Compliance

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [docs/security.md](../SECURITY.md) | Security standards, auth, encryption, compliance | 2026-05-30 |
| [docs/compliance/](compliance/) | SOC 2 evidence, audit logs, access reviews | 2026-06-22 |
| [docs/audit/](audit/) | Audit reports, findings, remediation tracking | 2026-06-22 |
| [apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md](../../apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md) | No-code/no-tech positioning and implications | 2026-05-15 |
| [docs/secret-rotation-runbook.md](secret-rotation-runbook.md) | Credential rotation procedures | 2026-05-30 |

---

## Agent System

| Document | Purpose |
|----------|---------|
| [.sophia-factory/orchestrator.md](../../.sophia-factory/orchestrator.md) | Auto-routing logic — which agent handles what |
| [.sophia-factory/agents/cto.md](../../.sophia-factory/agents/cto.md) | CTO agent — tech, security, infra, QA |
| [.sophia-factory/agents/cmo.md](../../.sophia-factory/agents/cmo.md) | CMO agent — marketing, content, SEO (VN+EN) |
| [.sophia-factory/agents/cso.md](../../.sophia-factory/agents/cso.md) | CSO agent — sales, pricing, churn |
| [.sophia-factory/agents/coo.md](../../.sophia-factory/agents/coo.md) | COO agent — ops, support, capacity |
| [.sophia-factory/agents/mekong-cli.md](../../.sophia-factory/agents/mekong-cli.md) | Mekong CLI — cross-repo SDLC, eval |
| [.sophia-factory/CLAUDE.specification.md](../../.sophia-factory/CLAUDE.specification.md) | Agent specification format |

---

## Recent Completions (as of 2026-06-22)

| Feature | Status | Documentation |
|---------|--------|---------------|
| **OTEL Staging** | ✅ Verified | [OTEL-STAGING-VERIFICATION-REPORT.md](../OTEL-STAGING-VERIFICATION-REPORT.md) |
| **SOC 2 Type I** | 🔄 In Progress | [docs/compliance/soc2/](compliance/soc2/) |
| **Deploy Guard** | ✅ Production | [docs/deployment-guide.md](deployment-guide.md#deploy-guard) |
| **BYOK Rotation** | 🔄 Framework Ready | [docs/security.md](../SECURITY.md#byok-encryption) |
| **Audit Logging** | ✅ Hash Chain Active | [docs/audit/](audit/) |

---

## Runbooks & Troubleshooting

| Document | Purpose |
|----------|---------|
| [docs/troubleshooting.md](troubleshooting.md) | Debugging guide for common issues |
| [docs/runbooks/](runbooks/) | Operational runbooks (cron, backups, monitoring) |
| [docs/handover/](handover/) | Founder-specific guides (DNS, email, Sentry setup) |
| [docs/postmortems/](postmortems/) | Past incident analysis and lessons learned |

---

## Testing & Quality

| Document | Purpose |
|----------|---------|
| [docs/testing.md](../apps/sophia-ai-factory/docs/testing-guide.md) | Test execution, coverage, E2E |
| [apps/sophia-ai-factory/docs/](../../apps/sophia-ai-factory/docs/) | Engineering-internal runbooks and migration notes |

---

## Configuration Reference

| File | Purpose |
|------|---------|
| [package.json](../package.json) | Root tooling scripts |
| [apps/sophia-ai-factory/package.json](../../apps/sophia-ai-factory/package.json) | App dependencies and scripts |
| [apps/sophia-ai-factory/wrangler.jsonc](../../apps/sophia-ai-factory/wrangler.jsonc) | Cloudflare Workers configuration |
| [apps/sophia-ai-factory/tsconfig.json](../../apps/sophia-ai-factory/tsconfig.json) | TypeScript strict mode config |
| [.claude/settings.json](../../.claude/settings.json) | Claude Code harness settings |

---

## Key Canonical Paths

These are the single sources of truth for core concerns:

| Concern | Import Path |
|---------|-------------|
| Auth session | `@/seed/auth/better-auth-session` |
| DB client | `@/seed/db/client` (sync, do not await) |
| Tier lookup | `@/seed/db/get-user-tier` |
| Tier config | `@/seed/config/tiers` |
| Logger | `@/seed/utils/logger-utility` |
| OTel setup | `@/seed/telemetry/opentelemetry-setup` |

See [docs/code-standards.md](code-standards.md) for complete standards.

---

## Important URLs

| Purpose | URL |
|---------|-----|
| Production | https://sophia.agencyos.network |
| Health Check | https://sophia.agencyos.network/api/health |
| Version (SHA) | https://sophia.agencyos.network/api/version |
| Status Page | https://sophia.agencyos.network/status |
| Telegram Bot | @Sophia_Bbot |
| Staging (OTEL) | https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev |
| Honeycomb Staging | Dataset: `sophia-staging` |
| Honeycomb Prod | Dataset: `sophia-prod` (1% samplerate) |
| **Operator Quick Ref** | [`docs/operator-quick-reference.md`](operator-quick-reference.md) |

---

## Contact & Support

| Need | How to Get Help |
|------|-----------------|
| Technical issues | `mekong --agent cto` |
| Content/docs | `mekong --agent cmo` |
| Support/ops | `mekong --agent coo` |
| Pricing/billing | `mekong --agent cso` |
| Routing help | `mekong --agent sophia-orchestrator` |

---

## Document Maintenance

This index should be updated when:
- New major features are shipped
- Documentation is added, moved, or deprecated
- Handover status changes
- Production URLs or contact methods change

**Maintainer:** Project team via `docs/` directory updates

---

*End of Handover Documentation Index*
