---
title: "Protected Flows Execution Plan"
description: "Visual-only amber theme update for Setup Wizard + Checkout, E2E test infra fix, and auth E2E verification."
status: completed
priority: P1
effort: 8h
branch: main
tags: [protected-flows, setup-wizard, checkout, e2e, amber-theme]
created: 2026-07-03
---

# Protected Flows Execution Plan

**Context:** Post Phase 1 UI Redesign (10 screens deployed). Focus on the 3 protected flows that MUST never break: Setup Wizard (BYOK), NOWPayments Checkout, and E2E test infrastructure.

**Design System:** Dark mode, Amber #D97706 primary, Background #0F0F11, Surface #18181B, Inter + IBM Plex Sans, 8px rounding.

## Status Table

| Phase | Name | Priority | Effort | Status | Blocks |
|-------|------|----------|--------|--------|--------|
| 01 | Setup Wizard Visual Update | P0 Critical | 2-3h | **completed** | — |
| 02 | Checkout Page Amber + i18n | P0 Critical | 1-2h | **completed** | — |
| 03 | E2E Test Infrastructure Fix | P1 High | 1-2h | **completed** | — |
| 04 | Auth E2E Verification | P1 High | 1h | **completed** | Phase 03 |

## Dependency Graph

```
Phase 01 (Setup Wizard) ──┐
                          ├── No dependencies between them, run in parallel
Phase 02 (Checkout) ─────┘

Phase 03 (E2E Infra) ──► Phase 04 (Auth E2E)
```

Phases 01 and 02 are independent — no shared files. Phases 03 and 04 are serial (03 must complete before 04).

## Files Touched Per Phase (No Conflicts)

| Phase | Files | Layer |
|-------|-------|-------|
| 01 | `tree/components/setup-wizard/*` (8 files) | tree |
| 02 | `app/components/sections/checkout-page.tsx`, `components/stitch/screens/checkout/checkout-page.tsx`, `messages/*.json` | seed + app |
| 03 | `tests/e2e/fixtures/free100-db-helpers.ts`, `playwright.config.ts`, `.env.local` | config |
| 04 | `tests/e2e/auth-flow.spec.ts` (read only, fix if needed) | test |

## Rollback Strategy

Each phase is a single commit. Rollback is `git revert <commit>`. No database migrations, no schema changes, no API changes. Maximum blast radius: visual appearance.

## Success Criteria

1. `npm run build` exits 0
2. `npm test` passes all tests
3. Setup Wizard manual walkthrough: all 5 steps render, API keys save/verify, localStorage persists
4. Checkout page: renders amber theme, i18n keys resolve, NOWPayments options visible
5. `npm run test:e2e -- tests/e2e/auth-flow.spec.ts` passes
6. `npm run test:e2e -- tests/e2e/checkout-flow.spec.ts` passes

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wizard CSS token breakage | Low | High | Wizard uses semantic tokens (bg-primary), only CSS vars change. Snapshot test on api-key-input. |
| Checkout i18n key mismatch | Medium | Medium | Verify `messages/en.json` checkout namespace has all keys before coding. Fall back to English defaults. |
| D1 local init failure | Medium | High | Document `npm run dev` prerequisite. Use existing `free100-db-helpers.ts` pattern. |
| E2E auth-flow break from redesign | Low | Medium | Only run + verify; auth-flow spec is read-only, tests unauthenticated flows. |
