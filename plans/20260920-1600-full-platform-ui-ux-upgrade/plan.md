---
title: "Full Platform UI/UX Upgrade"
description: "Obsidian Cyber-Glass design system rollout across all public and dashboard views — loading/error boundaries, primitive adoption, WCAG AA, mobile polish, empty states, i18n."
status: pending
priority: P1
effort: 12h
branch: main
tags: [ui-ux, design-system, accessibility, i18n, responsive]
created: 2026-09-20
---

## Overview

Upgrade Sophia AI Factory UI/UX to a polished, modern, resilient, accessible, responsive Obsidian Cyber-Glass experience across all public and dashboard views. Six sequential phases, each independently shippable.

## Scope

- **In:** All `[locale]` routes, `(app)` routes, `(auth)` routes, dashboard subroutes, shared components.
- **Out:** Backend billing logic, D1 schema, third-party monitoring widgets, protected flows (Setup Wizard, Telegram Bot, NOWPayments IPN) unless purely presentational.

## Key Files

- Design authority: `src/app/globals.css`
- UI primitives: `src/seed/components/ui/` (30+ components)
- Error boundary: `src/seed/components/dashboard/dashboard-error-boundary.tsx`
- Loading skeleton: `src/seed/components/dashboard/dashboard-loading-skeleton.tsx`
- Skip nav: `src/components/skip-nav.tsx`
- Mobile nav: `src/seed/components/ui/mobile-nav.tsx`
- Sidebar nav: `src/forest/dashboard/dashboard-sidebar-nav.tsx`
- i18n: `messages/en.json`, `messages/vi.json`

## Phases

| Phase | Name | Status | File |
|-------|------|--------|------|
| 1 | Loading & Error Boundaries | completed | [phase-01-loading-error-boundaries.md](./phase-01-loading-error-boundaries.md) |
| 2 | Design System Polish | completed | [phase-02-design-system-polish.md](./phase-02-design-system-polish.md) |
| 3 | Accessibility (WCAG 2.1 AA) | pending | [phase-03-accessibility-wcag.md](./phase-03-accessibility-wcag.md) |
| 4 | Mobile & Responsive | pending | [phase-04-mobile-responsive.md](./phase-04-mobile-responsive.md) |
| 5 | Empty States & i18n | pending | [phase-05-empty-states-i18n.md](./phase-05-empty-states-i18n.md) |
| 6 | Final Verification | pending | [phase-06-final-verify.md](./phase-06-final-verify.md) |

## Success Criteria

- All 15+ dashboard subroutes have `loading.tsx` + `error.tsx`
- Zero raw HTML `<button>` without `aria-label` in icon-only context
- All data tables use `<EmptyState>` when zero rows
- Mobile nav touch targets >= 44px
- `npm run type-check` = 0 errors
- `npx vitest run` = all tests pass
- `npm run build` = 0 errors
- All new strings bilingual (vi/en)

## Risk Notes

- **Protected flows:** Setup Wizard, Telegram Bot, NOWPayments IPN must not break. Changes only presentational.
- **File ownership:** Each phase owns distinct files. No overlap.
- **i18n:** Every new user-facing string must be added to BOTH `messages/en.json` and `messages/vi.json`.
- **No new eslint-disable:** Baseline frozen in `eslint-suppressions.json`.
- **File size:** Keep individual files under 200 lines. Split if needed.
