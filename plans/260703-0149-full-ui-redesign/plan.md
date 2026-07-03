---
title: "Full UI Redesign — All Pages"
description: "Full UI redesign of all 45+ Sophia AI Factory pages using Stitch design pipeline: design system → screen generation → Next.js component conversion → integration"
status: active
priority: P1
branch: "main"
tags: [ui-redesign, stitch, amber-theme, bilingual]
created: "2026-07-02T18:51:53.014Z"
updated: "2026-07-03T11:22:00.000Z"
createdBy: "ck:plan"
source: skill
---

# Full UI Redesign — All Pages

## Overview

Complete UI redesign of all 45+ Sophia AI Factory pages with amber theme (#D97706) primary. Pipeline: Phase 0 (design consolidation, COMPLETED) → Phase 1 (P0 screen prompts + amber update) → Phase 2 (parallel Landing/Pricing/Login) → Phase 3 (Setup Wizard + Dashboard Shell) → Phase 4 (integration test).

## Phases (Revised 2026-07-03)

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 0 | [Design System Consolidation](./phase-00-design-system-consolidation.md) | **Completed** | 2h |
| 1 | [P0 Screen Prompts & Amber Update](./phase-01-p0-screen-prompts-amber.md) | Ready | 2h |
| 2 | [Parallel P0 Screens: Landing + Pricing + Login](./phase-02-parallel-screens.md) | Pending | 3-4h |
| 3 | [Setup Wizard + Dashboard Shell](./phase-03-wizard-dashboard.md) | Pending | 3-4h |
| 4 | [Integration Test & Deploy Readiness](./phase-04-integration-test.md) | Pending | 1-2h |

## Dependencies

- Phase 0 combined — design tokens use amber primary (#D97706)
- Phase 1 → blocks 2, 3 (prompts must be amber-updated before generation)
- Phases 2 and 3 run in parallel (different files, no conflicts)
- Phase 4 → depends on 2 + 3 both complete

## Design System

| Token | Value |
|-------|-------|
| Primary | Amber `#D97706` |
| Accent | Indigo `#6366F1` |
| Background | `#0F0F11` |
| Surface | `#18181B` |
| Headline Font | Inter 28px/700 |
| Body Font | Inter 15px/400 |
| Label Font | IBM Plex Sans 13px/500 |
| Rounding | `rounded-lg` (8px) |
| Mode | Dark only |

## Quality Gates (all phases)

- `npm run build` → 0 TypeScript errors
- `npm test` → all tests pass (6694+ tests)
- Zero `:any` types in production code
- Bilingual VN+EN required on all customer-facing text
- Protected flows preserved: Setup Wizard (BYOK), Telegram Bot, NOWPayments IPN
