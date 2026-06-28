---
title: "Sophia magic-link E2E validation (GAP 1, BLOCKER for go-live)"
description: "End-to-end verify magic-link → __Secure-better-auth.session_token → /setup-wizard 200, with regression test."
status: complete
completed: 2026-05-03
priority: P1
effort: 2h
branch: main
tags: [sophia, validation, e2e, auth, cloudflare-workers, go-live, blocker]
created: 2026-05-03
---

# Sophia Magic-Link E2E Validation

## Context

- **Project:** Sophia AI Factory — Next.js 16 + Cloudflare Workers + D1 + Better Auth + next-intl
- **Production:** https://sophia.agencyos.network — deployed SHA `b4b281b6` (2026-05-03)
- **D1 binding:** `DB` → database `sophia-raas-db` / id `78bd1961-b62d-43bb-b551-0c5d7d389506`
- **Predecessor plan:** [`plans/260503-0746-setup-wizard-fix-go-live/plan.md`](../260503-0746-setup-wizard-fix-go-live/plan.md) — phases 01 logging + 02 cookie chain alignment ALREADY deployed.
- **GAP:** cold curl confirms 307→/login when unauthenticated (correct), but the cookie chain has NOT been validated end-to-end with a real authenticated session. Hypotheses H1/H2/H3 from debugger report still un-resolved until a magic-link click + browser session test passes.

## Reports

- Debugger root-cause: [`plans/reports/debugger-260503-setup-wizard.md`](../reports/debugger-260503-setup-wizard.md)
- Deploy verification: [`plans/reports/deploy-260503-0801-setup-wizard-fix.md`](../reports/deploy-260503-0801-setup-wizard-fix.md)

## Goal

Prove (or falsify) that the magic-link → `__Secure-better-auth.session_token` → `/setup-wizard` chain works end-to-end on production, and lock the result in with a deterministic regression test.

## Phases

| # | Phase | ETA | Goal |
|---|-------|-----|------|
| 01 | [Test data setup](phase-01-test-data-setup.md) | 20m | Admin script: seed `e2e-test@sophia.local` user + handover row in D1, mint magic-link token |
| 02 | [Browser automation E2E](phase-02-browser-automation-e2e.md) | 30m | `chrome-devtools` skill: hit magic-link → assert Set-Cookie → reload `/setup-wizard` → assert 200 + wizard renders |
| 03 | [Log inspection](phase-03-log-inspection.md) | 15m | Parallel `wrangler tail` capture during browser test; grep for `[setup-wizard] no authenticated user` and `[Welcome/Consume]` markers |
| 04 | [Hypothesis resolution](phase-04-hypothesis-resolution.md) | 20m | If E2E fails: map log evidence to H1/H2/H3 from debugger report; produce concrete fix recommendation (no fix work in this plan) |
| 05 | [Regression test](phase-05-regression-test.md) | 25m | Vitest integration: token validate → `createSessionForUser` → cookie name & attributes assertion. Mocks D1 + Better Auth `internalAdapter`. No network. |
| 06 | [Documentation](phase-06-documentation.md) | 10m | Final verdict report at `plans/reports/e2e-validation-260503-magic-link.md`; update predecessor plan's "Cookie chain fix unverified" note |

## Success Definition

PASS verdict requires ALL of:
1. Browser automation (Phase 02) — `/setup-wizard` returns HTTP 200 after magic-link consumption
2. Set-Cookie header includes `__Secure-better-auth.session_token` with `Path=/; HttpOnly; Secure; SameSite=Lax`
3. `wrangler tail` (Phase 03) shows `[Welcome/Consume] Signed session cookie set` and NO subsequent `[setup-wizard] no authenticated user`
4. Regression test (Phase 05) passes locally and in CI

FAIL verdict (any of above missing) → Phase 04 produces fix path; predecessor plan re-opened.

## Critical Dependencies

- `wrangler` CLI authenticated (D1 access + tail access)
- `chrome-devtools` skill (`~/.claude/skills/chrome-devtools/`) installed
- Predecessor logging (Phase 01 of `260503-0746-*`) already live → required for Phase 03 inspection
- D1 production WRITE access for test-user seed (one-shot, cleaned up in Phase 06)

## Quality Gates

- 0 `:any` types (Sophia rule)
- No fake/mocked data in E2E phases — real D1 row, real Better Auth session
- Regression test deterministic — zero network deps
- Test user `e2e-test@sophia.local` cleaned up after final phase
