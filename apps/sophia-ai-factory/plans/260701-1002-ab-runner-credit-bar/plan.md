---
title: "A/B Runner + Credit Bar Quick Wins"
description: "Wire existing AB module into campaign pipeline + add video-count credit bar to billing page and sidebar"
status: completed
priority: P1
effort: 10h
branch: main
tags: [ab-testing, credit-bar, quick-win, campaign-pipeline, billing]
created: 2026-07-01
---

## Plan Overview

Two independent features sharing a plan (no cross-dependency). Execution can be parallelized.

| Phase | Effort | Status | Blocks |
|-------|--------|--------|--------|
| [Phase 01 — Scaffold & i18n](phase-01-scaffold-i18n.md) | 1h | pending | — |
| [Phase 02 — AB: Wire into campaign creation](phase-02-ab-campaign-creation.md) | 2h | pending | 01 |
| [Phase 03 — AB: Wire into campaign pipeline](phase-03-ab-campaign-pipeline.md) | 2h | pending | 02 |
| [Phase 04 — Credit bar: billing page](phase-04-credit-bar-billing.md) | 1.5h | pending | 01 |
| [Phase 05 — Credit bar: sidebar widget](phase-05-credit-bar-sidebar.md) | 1h | pending | 01 |
| [Phase 06 — Integration tests + build gate](phase-06-tests-build-gate.md) | 2.5h | pending | 03, 05 |

## Dependency Graph

```
Phase 01 (i18n + shared prep)
 ├── Phase 02 (AB: campaign creation) ── Phase 03 (AB: pipeline) ───┐
 └── Phase 04 (Credit bar: billing) ──┬──────────────────────────── Phase 06 (tests + gate)
      Phase 05 (Credit bar: sidebar) ─┘
```

Phases 02+04+05 can start in parallel after Phase 01. Phase 03 needs Phase 02.

## Key Risks

1. **Inngest D1 access**: Variant generation + experiment creation happen inside Inngest function. D1 binding must be available. Low risk (already used for idempotency guard + mission completion).
2. **CreditBar repurpose**: Existing CreditBar is MCU-focused. Repurposing for video count requires prop rename or adding a label prefix. Low risk (component is simple).
3. **Failed AB creation must not block campaign**: worst-case, campaign proceeds with original title. Low risk (variant-generator has built-in fallback).

## Success Criteria

1. Creating a campaign auto-creates an `ab_experiments` row with 2 variants
2. Campaign pipeline uses variant A's title for video generation
3. Bundle publisher selects the active variant caption (existing partial wiring completed)
4. CreditBar renders on billing page showing "X of Y videos this month"
5. Sidebar widget shows compact video count
6. Both bars update correctly based on tier
7. i18n works for VI + EN
8. 0 regressions on campaign pipeline, billing page, sidebar
9. Build passes (0 TS errors), all tests pass
