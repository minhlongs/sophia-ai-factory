# Sophia AI Factory — Documentation Index

This directory is the **root documentation layer**: customer-facing, operator-facing, and cross-project content. It is the source of truth for anyone onboarding, operating, or integrating Sophia.

For engineering-internal content (compliance evidence, migration notes, load-test data, dev-SOPs), see `apps/sophia-ai-factory/docs/`.

---

## Canonical-5 (Core Reference — always current)

| Doc | Description |
|-----|-------------|
| [project-overview-pdr.md](project-overview-pdr.md) | Product requirements, tiers, architecture decisions, deploy doctrine, doctrine ceiling |
| [code-standards.md](code-standards.md) | TypeScript standards, canonical import paths, banned imports, tier enum |
| [codebase-summary.md](codebase-summary.md) | 4-layer architecture, directory structure, CF-direct deploy flow, core stack |
| [deployment-guide.md](deployment-guide.md) | **Operator deploy guide** — prerequisites, CF-direct flow, secrets, D1 migrations, rollback |
| [system-architecture.md](system-architecture.md) | Architecture layers, deploy pipeline, cron auth, observability, doctrine ceiling 87.5/100 |

---

## Domain-Grouped Index

### Handover (Customer-Facing, Bilingual VI-EN)

| File | Description |
|------|-------------|
| [client-handover-sop.md](client-handover-sop.md) | Step-by-step handover SOP for non-tech clients |
| [customer-handover-runbook.md](customer-handover-runbook.md) | Runbook for customer onboarding handover |
| [credentials-handover.md](credentials-handover.md) | Credential transfer checklist |
| [handover-documentation-index.md](handover-documentation-index.md) | Index of all handover documents |
| [sophia-factory-readme.md](sophia-factory-readme.md) | Customer-facing platform overview |
| [faq.md](faq.md) | Frequently asked questions |
| [getting-started.md](getting-started.md) | Getting started guide for new users |
| [pricing-and-tiers.md](pricing-and-tiers.md) | Tier comparison: BASIC / PREMIUM / ENTERPRISE / MASTER |
| [troubleshooting.md](troubleshooting.md) | Common issues and fixes |
| [user-guide-visual.md](user-guide-visual.md) | Visual step-by-step user guide |
| [user-flow.md](user-flow.md) | User flow diagrams |
| [user-journey-visual-guide.md](user-journey-visual-guide.md) | Customer journey visualization |
| [ui-flow-diagram.md](ui-flow-diagram.md) | UI flow and screen map |
| [handover/](handover/) | Additional handover package files |

### Runbooks (Operator)

| File | Description |
|------|-------------|
| [observability-runbook.md](observability-runbook.md) | Monitoring, logging, alerting |
| [secret-rotation-runbook.md](secret-rotation-runbook.md) | Rotating Cloudflare secrets |
| [disaster-recovery.md](disaster-recovery.md) | DR plan and recovery procedures |
| [sophia-activation-runbook.md](sophia-activation-runbook.md) | Platform activation steps |
| [support-escalation.md](support-escalation.md) | Support escalation procedures |
| [telegram-bot-guide.md](telegram-bot-guide.md) | Telegram bot command reference |
| [telegram-bot-setup.md](telegram-bot-setup.md) | Telegram bot setup instructions |

### Ops

| File/Dir | Description |
|----------|-------------|
| [admin-ops/](admin-ops/) | Activation checklist, pricing/payment SOPs, vendor register, compliance register |
| [cloud-infrastructure.md](cloud-infrastructure.md) | Cloudflare bindings, R2, KV, D1 overview |

### Postmortems

| File/Dir | Description |
|----------|-------------|
| [postmortems/](postmortems/) | Incident postmortems |
| [postmortem-template.md](postmortem-template.md) | Postmortem template |

### Launch

| Dir | Description |
|-----|-------------|
| [launch/](launch/) | Launch planning documents (drafts) |

### Roadmap & Changelog

| File | Description |
|------|-------------|
| [development-roadmap.md](development-roadmap.md) | Project roadmap and milestones |
| [project-changelog.md](project-changelog.md) | Changelog index (split by quarter) |
| [changelog/2026-Q2.md](changelog/2026-Q2.md) | 2026 Q2 entries (April–present) |
| [changelog/2026-Q1.md](changelog/2026-Q1.md) | 2026 Q1 entries (Jan–Mar) |
| [changelog/2025-archive.md](changelog/2025-archive.md) | Pre-2026 archive (no entries) |

### Integration & ADRs

| File/Dir | Description |
|----------|-------------|
| [sophia-mekong-integration.md](sophia-mekong-integration.md) | Sophia ↔ Mekong integration reference |
| [architecture-decisions/](architecture-decisions/) | Architecture Decision Records (ADR 0001–0007) |

### Archive

| Dir | Description |
|-----|-------------|
| [archive/](archive/) | Stale or superseded docs (each has `_REASON.md` stub) |

---

## Dual-Docs Policy

This repository maintains **two documentation layers** with distinct scopes:

### Root `docs/` — this directory
- **Audience:** Customers, operators, cross-project contributors
- **Language:** Bilingual VI-EN for customer-facing docs; EN elsewhere
- **Content:** Product requirements, handover guides, operator runbooks, postmortems, ADRs, changelog, roadmap, integration docs
- **Rule:** Customer-facing content → root docs/

### App `apps/sophia-ai-factory/docs/` — engineering-internal layer
- **Audience:** Engineers, compliance auditors
- **Language:** EN only
- **Content:** Compliance evidence (ASVS-L2, SOC2 prep), migration phase notes, load-test raw data, dev-SOPs, GO-LIVE checklist, infra hardening notes, known issues, legacy references
- **Rule:** Engineering-internal content → app docs/

**Future contributors:** Before adding a new doc, ask:
- Customer or operator reads this → root `docs/`
- Engineer or auditor reads this → `apps/sophia-ai-factory/docs/`
- Both → root docs/ (customer wins)
