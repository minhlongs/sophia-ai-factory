---
title: "Sophia /dashboard Zero-Bug Harden (P0+P1+P3)"
description: "Test pyramid + auth/admin gates + i18n hybrid across 71 dashboard pages — deferring 4-layer refactor and ops i18n."
status: in_progress
priority: P1
effort: 16d
progress: "phase-01 + phase-02 complete (2026-05-18); phase-03 pending fresh session"
branch: main
tags: [sophia, dashboard, test-pyramid, security, a11y, visual-regression]
created: 2026-05-18
last_updated: 2026-05-18
---

# Plan — Sophia /dashboard Zero-Bug Harden

**Plan ID:** 260518-1728-sophia-zero-bug-dashboard
**Date:** 2026-05-18
**Status:** pending
**Scope decision (user):** P0 + P1 + P3 only. Skip P2/P4/P5/P6/P7/P8 (see "Deferred" below).

## Context

Sophia AI Factory ships 71 `/dashboard` pages. Audit found 6 client-only pages missing server auth gate, 14 admin pages with NO role check, 4 admin pages with hardcoded EN strings, 1 flaky NOWPayments payout webhook test, and zero a11y / visual-regression / contract-test infrastructure. Goal: harden existing surface to a defined zero-bug bar — without refactoring the 4-layer architecture (deferred) and without touching the no-tech doctrine.

## Acceptance Criteria (binding)

13 mandatory items from `tech-stack-synthesis.md` section 9. Summary:

- Build/test/lint green (0 TS errors, 4563+ tests, no lint regression vs 341 baseline)
- Vitest coverage `/dashboard` ≥ 65% lines / 50% branches / 60% functions (newly enforced)
- 6 client pages have server-side `getCurrentUser()` gate
- 14 admin pages enforce `tier=MASTER`
- Help-page anon access audited + documented
- Customer-touched admin pages migrated to `t()` (VI+EN); ops-internal pages tagged EN-only policy + ESLint exception
- `@axe-core/playwright` — 0 serious/critical WCAG 2.1 AA on 5 critical routes
- Playwright `.toHaveScreenshot()` baselines captured for same 5 routes
- Zod contract tests on 10 high-risk API routes
- Deploy verify per `.claude/rules/sophia-deploy-verify.md`: `/api/version` SHA == local short SHA, HTTP 200, browser smoke (Rule 13)

Full list: see `tech-stack-synthesis.md` section 9.

## Phases

| # | Phase | Duration | Status | Depends-on |
|---|---|---:|---|---|
| 01 | [Foundation primitives](./phase-01-foundation-primitives.md) | 2-3 d | ✅ complete (2026-05-18) | — |
| 02 | [Security hardening](./phase-02-security-hardening.md) | 3-5 d | ✅ complete (2026-05-18) — i18n string migration deferred to next iteration | 01 |
| 03 | [Test pyramid build-out](./phase-03-test-pyramid-buildout.md) | 11 d | pending — recommend fresh `/cook --auto` session | 01, 02 |

Critical path: 01 → 02 → 03. Sub-tracks inside 03 (A/B/C) can parallelize.

**Total effort:** ~16-19 dev-days (solo).

## Deferred (carried forward, NOT in this plan)

Per user decision D1 (synthesis section 8):

1. P2 — 4-layer ESLint guard + 22 import violations (researcher-05)
2. P4 — Full i18n on ops-internal admin pages
3. P5 — ClaudeKit admin routes (`/dashboard/admin/skills|commands|teams|agent-runs`)
4. P6 — Mekong reusables (logger + EventObserver CF Workers compat spike)
5. P7 — NOWPayments doctrine fix on handover wizard (surfaced for product call, no code touch)
6. P8 — Docs regen (`docs/system-architecture.md`, `development-roadmap.md`, `code-standards.md` rev2, `project-changelog.md`)

## References

- Synthesis (DECISIONS + acceptance): `./tech-stack-synthesis.md`
- Researcher-01 (audit): `./research/researcher-01-existing-dashboard-audit.md`
- Researcher-04 (test stack): `./research/researcher-04-zero-bug-stack.md`
- Researcher-05 (4-layer): `./research/researcher-05-four-layer-compliance.md`
- Deploy verify: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- No-tech doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`

## Activation

```bash
node .claude/scripts/set-active-plan.cjs /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/plans/260518-1728-sophia-zero-bug-dashboard
```
