---
title: "Wave 19 — FREE100 RaaS Dashboard 100/100"
description: "Lift FREE100 user RaaS dashboard from ~60/100 to 100/100 by closing verified correctness, UX, and observability gaps."
status: pending
priority: P1
effort: 4-5d (Phases 01-06 = P0/P1 must-do; Phase 07 defer-eligible)
branch: main
tags: [wave19, free100, raas-dashboard, correctness, ux, observability]
created: 2026-05-09
---

# Wave 19 — FREE100 100/100

**Status Update:** Phase 01+02+03 SHIPPED 2026-05-09 — C2/C3/C5/C8 fixed + C1/C4/C6 regression locks + i18n batch (M4-M10) +20 keys EN/VI parity + 1 parity test. Tests: 3055/3055. Commit pending.

## Goal

Close every verified gap blocking a FREE100 (MASTER tier) user from a smooth happy-path experience: video generate → channel connect → distribute → status visibility, with proper sign-out, error boundaries, retries, and i18n parity.

## Verification-Before-Plan Findings

Several originally-claimed CRITICAL items were re-verified against current code and reclassified:

| Original | Status After Verify | Action |
|---|---|---|
| C1 — `getUserTier()` returns DB tier passed to `reserveVideoSlot()` mismatched | **FALSE** — `VIDEO_QUOTA_BY_TIER` already keys uppercase (BASIC/PREMIUM/ENTERPRISE/MASTER); MASTER → 1000 quota. No conversion needed. | Drop. Add a unit test as guardrail. |
| C4 — `complete-onboarding-action` Supabase chain on D1 silent fail | **PARTIAL** — D1 client exposes a Supabase-compatible `from().update().eq()` chain returning `{data, error}`. Works correctly. The `as { error: ... }` cast is a code smell, not a silent fail. | Downgrade to type-cast cleanup. |
| C6 — Mission stream missing user_id guard | **FALSE** — `route.ts:148` already has `.eq('user_id', userId)`. | Drop. Add a regression test. |
| C2 / C3 / C5 / C8 + all M-series | CONFIRMED | Plan as below. |

This collapses Phase 02 (planned for unverified items) into a single test-coverage task.

## Phase Table

| Phase | Title | Priority | Effort | Status | Blocks |
|---|---|---|---|---|---|
| 01 | Critical correctness fixes (C2 + C3 + C5 + C8) | P0 | 0.5d | ✅ done (commit pending) | 02 |
| 02 | Verify-and-lock regression tests (C1, C4, C6 guardrails + cleanup) | P0 | 0.5d | ✅ done (commit pending) | 03 |
| 03 | i18n + UX state batch (M4, M5, M6, M9, M10) | P1 | 1d | ✅ done (commit pending) | 04 |
| 04 | Distribute publish-status polling (M1) | P1 | 1d | pending | — |
| 05 | Telegram dispatch retry on 429/network (M2) | P1 | 0.5d | pending | — |
| 06 | Sentry wiring + error boundaries + 404 (M3, M7) | P1 | 0.5d | pending | — |
| 07 | Production hardening + nice-to-haves (defer-eligible) | P2 | 1d | pending | — |

**Total P0–P1 effort: 4d. Phase 07 adds 1d if executed.**

## Dependency Graph

```
01 (correctness) ──► 02 (regression tests + cleanups)
                       │
                       ├──► 03 (i18n + UX) ──► 04 (distribute polling)
                       │                          │
                       │                          ▼
                       └──► 05 (Telegram retry)  06 (Sentry + error boundaries)
                                                   │
                                                   ▼
                                                  07 (defer-eligible)
```

03/04/05/06 all unblock independently after 02. They may run in parallel branches if dev capacity allows; otherwise sequential in listed order.

## Token Budget Per Phase

| Phase | Est. tokens (planner+impl+test+review) | Rationale |
|---|---|---|
| 01 | 25k | 4 small fixes, focused diffs |
| 02 | 20k | Pure tests, low context |
| 03 | 40k | i18n keys + 5 components |
| 04 | 35k | New polling logic + UI |
| 05 | 20k | Single function + tests |
| 06 | 25k | Sentry + 2 error boundaries |
| 07 | 30k | Multiple small items |
| **Total** | **~195k** | Within budget |

## Coordinator Pipeline (per phase)

`planner → fullstack-developer → tester → code-reviewer → finalize` (commit + CF-direct deploy + SHA verify per `sophia-deploy-verify.md`).

## Acceptance Criteria — "Wave 19 Done"

A FREE100 user logging in should:

1. ✅ Generate a video (Phase 01: correctness preserved; Phase 02: locked)
2. ✅ Connect/disconnect ALL 8 channel providers without 404 (C2)
3. ✅ Sign out cleanly with session invalidated (C3)
4. ✅ Onboarding step2 reflects either publishing_channels OR telegram (C5)
5. ✅ See translated UI (no raw `dashboard.videos.generate.*` keys) (M4-M10)
6. ✅ Watch publish-status update live after distribute submit (M1)
7. ✅ Have Telegram dispatches retry transient 429/network errors (M2)
8. ✅ See a real error page (not white screen) with Sentry capture (M3)
9. ✅ See 404 page for `/dashboard/<garbage>` instead of crash (M7)
10. ✅ All builds + tests + deploy:full + SHA match GREEN.

## Recommended Schedule

- **Day 1 (2026-05-10):** Phase 01 + Phase 02 (P0 batch, single deploy)
- **Day 2 (2026-05-11):** Phase 03 (i18n + UX)
- **Day 3 (2026-05-12):** Phase 04 (distribute polling)
- **Day 4 (2026-05-13):** Phase 05 + Phase 06 (Telegram retry + Sentry batch)
- **Day 5 (optional):** Phase 07 nice-to-haves OR slip / defer to Wave 20

## Files — Single-Source Index

Phase files live alongside this `plan.md`:

- `phase-01-critical-correctness.md`
- `phase-02-regression-tests-and-cleanup.md`
- `phase-03-i18n-and-ux-state-batch.md`
- `phase-04-distribute-status-polling.md`
- `phase-05-telegram-retry-mechanism.md`
- `phase-06-sentry-and-error-boundaries.md`
- `phase-07-production-hardening.md`

## Unresolved Questions

- Phase 07 scope (account page actions, sidebar quota widget, MASTER lifetime badge, `.env.example` complete) — defer or include? Owner decision required by start of Day 4.
- Should Phase 02 also fold in a CI check that fails on cast-coercion of `from().update().eq()` results? (would prevent C4-style regressions)
- Should Phase 04 publish-status polling use SSE (consistent with mission stream) or simple JSON poll? Decision to be made at start of Phase 04 based on user count vs CF Workers concurrency cost.
