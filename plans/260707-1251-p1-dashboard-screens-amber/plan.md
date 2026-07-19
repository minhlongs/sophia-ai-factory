---
title: "P1 Dashboard Screens — Amber Theme"
description: "Amber theme redesign for Campaign Management, Video Creation, Affiliate Portal, and Settings screens. Continuation of 260703 full-ui-redesign."
status: active
priority: P1
branch: "main"
tags: [ui-redesign, amber-theme, dashboard, bilingual]
created: "2026-07-07T12:51:00.000Z"
createdBy: "ck:plan"
source: cook
---

# P1 Dashboard Screens — Amber Theme

## Overview
Continuation of the full UI redesign (260703-0149). Apply amber theme to 4 remaining dashboard screens not covered in Phases 0-4.

## Phases

| Phase | Name | Status | Effort | Files |
|-------|------|--------|--------|-------|
| 1 | Campaign Management Screen | Pending | 2h | 4-6 |
| 2 | Video Creation Screen | Pending | 2h | 4-6 |
| 3 | Affiliate Portal Screen | Pending | 1-2h | 3-5 |
| 4 | Settings Screen | Pending | 1-2h | 3-5 |
| 5 | Build + Test Verification | Pending | 30m | 0 |
| 6 | Finalize + Deploy Readiness | Pending | 30m | 0 |

## Design System (from Phase 0)
- Primary: Amber `#D97706` (HSL: 35 80% 56%)
- Accent: Indigo `#6366F1`
- Background: `#0F0F11`
- Surface: `#18181B`
- Rounding: `rounded-lg` (8px)
- Mode: Dark only

## Quality Gates (all phases)
- `npm run build` → 0 TypeScript errors
- `npm test` → all tests pass
- Zero `:any` types in production code
- Protected Flows preserved: Setup Wizard, Telegram Bot, NOWPayments IPN
