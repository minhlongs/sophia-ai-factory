# GAP → GO LIVE — Sophia AI Factory

**Created:** 2026-05-20 22:16
**Status:** PARALLEL AUDIT IN FLIGHT
**Owner:** Long Tho
**Predecessor:** `plans/260520-2151-docs-harness-alignment/` (docs aligned)

---

## Goal
Identify **every blocker** between current production state and a *full* GO LIVE (paying customers, oncall coverage, scale-ready, no narrative inflation).

## Current Baseline (verified facts)
- Build GREEN, 181 static pages (32.2s)
- Docs harness aligned (canonical-5 + dual-docs policy)
- Doctrine ceiling: **87.5/100** (honest 10-layer audit)
- ASVS L2: **29/31 (94%)** — 2 controls outstanding
- D1 migrations: 117 (0001-0117 as of 2026-05-19)
- Payment: NOWPayments primary (USDT crypto) + PayOS backup (VN); Polar REJECTED
- Deploy: CF-direct via `npm run deploy:full` (GH Actions disabled by design)
- Telegram bot: @Sophia_Bbot live; 7-9 commands (drift noted)
- Client: NON-TECH Vietnamese CEO (bilingual VI-EN required for customer docs)

## 5 Parallel Gap Domains
| Domain | Audit lens | Output report |
|---|---|---|
| **A. Product Readiness** | Feature completeness vs roadmap, tier matrix, edge cases, broken paths | `research/gap-A-product.md` |
| **B. Ops Readiness** | Oncall, monitoring/alerts, runbooks, escalation, DR drills, incident history | `research/gap-B-ops.md` |
| **C. Security & Compliance** | ASVS-L2 remaining 2 controls, secrets posture, audit log retention, pentest residue, dep CVEs | `research/gap-C-security.md` |
| **D. Customer / Handover** | Onboarding flow gaps, bilingual coverage, FAQ depth, support email/loop, refund/cancellation paths | `research/gap-D-customer.md` |
| **E. Infra / Scale / Cost** | Load test ceiling, CF quota, D1 limits, backup verification, cost/run, rollback drill, cron health | `research/gap-E-infra.md` |

## Phases
- **Phase 0** (IN FLIGHT): 5 parallel scout/researcher agents produce gap reports
- **Phase 1**: Synthesize into prioritized **GO-LIVE punch-list** (P0/P1/P2) with effort sizing (S/M/L)
- **Phase 2** (gated): Long approves punch-list → execute P0 gaps in parallel waves
- **Phase 3**: Re-verify (build, smoke, ASVS, doctrine score)
- **Phase 4**: GO LIVE checklist sign-off

## Success Criteria
- Every P0 gap closed or has documented mitigation
- Doctrine score holds ≥87.5 or moves up with evidence
- Punch-list committed under this plan dir
- Final report: production-ready or honest blocker list

## Non-Goals
- Not re-deploying or changing prod state during audit phase
- Not adding new features (feature work goes in separate plans)
- Not touching docs/ (just aligned)
