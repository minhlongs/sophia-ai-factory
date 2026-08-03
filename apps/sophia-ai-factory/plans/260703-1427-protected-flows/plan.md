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

**Context:** Post Phase 1 UI Redesign (10 screens deployed). Focus on the 3 protected flows.

## Status Table

| Phase | Name | Priority | Effort | Status | Blocks |
|-------|------|----------|--------|--------|--------|
| 01 | Setup Wizard Visual Update | P0 Critical | 2-3h | Complete | — |
| 02 | Checkout Page Amber + i18n | P0 Critical | 1-2h | Complete | — |
| 03 | E2E Test Infrastructure Fix | P1 High | 1-2h | Complete | — |
| 04 | Auth E2E Verification | P1 High | 1h | Complete | Phase 03 |

## Notes

All visual amber/inbound theme work was already implemented via prior design wave.
Phases 01/02 use semantic Tailwind tokens (no indigo classes remain).
Phases 03/04 were implemented by plan `260802-e2e-test-infrastructure` (completed).

See `plans/reports/sync-260803-1427-protected-flows.md` for evidence.
