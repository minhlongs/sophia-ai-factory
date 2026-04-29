---
title: "Phase 02 — Tier-2 Security & Observability Backlog"
description: "10 sub-phases addressing auth, security, observability, data quality, DR. TIER-2D (Sentry) completed; others deferred."
status: in_progress
priority: P2
effort: 16h
---

# Phase 02 — Tier-2 Security & Observability Backlog

## Context
- Parent: [plan.md](./plan.md)
- Baseline score: ~83/100
- Each TIER-2 sub-phase lifts score by ~1pt (target: +10 across all 10)
- Current completion: TIER-2D ✅ (Sentry observability, +5 expected)

## TIER-2 Sub-Phases Status

| ID | Phase | Scope | Effort | Status | Plan | Reports |
|----|-------|-------|--------|--------|------|---------|
| A | Type Safety | 462 TS errors → 0 `:any` types | 4h | pending | phase-02-tier2a-type-safety.md | — |
| B | API Auth | JWT validation, session mgmt | 2h | pending | phase-02-tier2b-api-auth.md | — |
| **D** | **Observability** | **Sentry SDK + health probes** | **4h** | **✅ Completed 2026-04-28** | **[../260428-2141-tier2d-sentry-observability/](../260428-2141-tier2d-sentry-observability/)** | **[reports/](../260428-2141-tier2d-sentry-observability/reports/)** |
| C | MFA | TOTP 2FA + backup codes | 3h | pending | phase-02-tier2c-mfa.md | — |
| E | CSP | Content Security Policy nonce injection | 2h | pending | phase-02-tier2e-csp.md | — |
| F | DB Migrations | Cron job schema updates + fallback | 2h | pending | phase-02-tier2f-db-migrations.md | — |
| G | CSRF | Cross-Site Request Forgery protection | 2h | pending | phase-02-tier2g-csrf.md | — |
| H | Data Quality | Audit logging + constraint validation | 3h | pending | phase-02-tier2h-data-quality.md | — |
| I | Disaster Recovery | Backup + restore runbook + RTO/RPO | 2h | pending | phase-02-tier2i-dr.md | — |
| J | Infrastructure | DNS hardening, R2 lifecycle, GitHub secrets audit | 2h | pending | phase-02-tier2j-infra.md | — |

## TIER-2D Sentry Observability — Completion Details

**Completion Date:** 2026-04-28

**Plan Location:** [../260428-2141-tier2d-sentry-observability/plan.md](../260428-2141-tier2d-sentry-observability/plan.md)

**Deliverables:**
- ✅ Phase 01 (Sentry SDK): 6 files created, 3 files modified, build green, 1604/1604 tests pass
- ✅ Phase 02 (Source maps): CI upload wired, manual fallback script, @sentry/cli integrated
- ✅ Phase 03 (Health probes): D1/R2/KV pings, logger consolidation, 4/5 console.error replaced

**Score Impact:** +5 (estimated; actual uplift 83→88 per implementation report)

**Test Results:**
- Build: exit 0
- Tests: 1604 pass / 31 skipped / 0 failed
- Code Review: 3 fixes applied (Sentry options validation, import shape refinement)

**Key Facts:**
- 16 files created (Sentry configs, health probes, build-metadata, sentry-upload script)
- 9 files modified (next.config.ts, package.json, .github/workflows/test.yml, /api/health, logger-internals, error.tsx, coupons, enrichment-log-queue)
- No regressions: Setup Wizard ✅, Telegram Bot ✅, NOWPayments IPN ✅

**User Action Items (Post-Deploy):**
1. Provision Sentry account + project; set worker secrets:
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN`
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
2. Pre-seed R2 sentinel: `echo "ok" | npx wrangler r2 object put sophia-ai-factory-opennext-cache/health-check.txt --pipe`
3. Pre-seed KV sentinel: `npx wrangler kv:key put --binding=EXPERIMENT_KV health:ping ok`

**Reports:**
- [tier2d-implement-260428-2141.md](../260428-2141-tier2d-sentry-observability/reports/tier2d-implement-260428-2141.md)
- [tester-tier2d-260428-2141.md](../260428-2141-tier2d-sentry-observability/reports/tester-tier2d-260428-2141.md)
- [code-review-tier2d-260428-2141.md](../260428-2141-tier2d-sentry-observability/reports/code-review-tier2d-260428-2141.md)

## Deferred TIER-2 Sub-Phases

Remaining sub-phases (A, B, C, E, F, G, H, I, J) deferred to next sprint due to scope + schedule. Each represents ~1-4h of work and should be prioritized per risk/impact:

**High Priority (next):**
- TIER-2A (Type Safety): 462 unresolved TS errors block deploy
- TIER-2C (MFA): client request for 2FA

**Medium Priority:**
- TIER-2B (API Auth), TIER-2G (CSRF), TIER-2E (CSP nonce)

**Low Priority:**
- TIER-2F (DB Migrations), TIER-2H (Data Quality), TIER-2I (DR), TIER-2J (Infrastructure)

## Success Criteria (Phase 02 Overall)
- Score: 83 → ≥88/100 (with TIER-2D done; +5 expected from remaining sub-phases)
- Build: 0 TS errors (post TIER-2A)
- All sub-phase PRs merged with green CI/CD
- Protected flows remain intact throughout

## Next Steps
1. Review TIER-2D completion reports
2. Plan TIER-2A (type safety) scope — address 462 errors
3. Re-evaluate remaining sub-phases per risk/timeline
4. Coordinate with client on MFA requirements (TIER-2C)
