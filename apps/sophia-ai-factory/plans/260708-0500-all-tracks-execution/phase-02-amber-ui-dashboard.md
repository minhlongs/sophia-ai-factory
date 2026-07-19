# Phase 2: Amber UI — Dashboard Screens (Saigon Skyline)
> Status: pending | Priority: P1 | Parallel with Phase 3

## Context
Saigon Skyline design system deployed June 2026. 3 of 7 screens converted: Landing, Pricing, Login. 4 dashboard screens remain on old token system.

## Requirements
1. All 4 screens visually match converted screens (amber accent + indigo surface, no blue/purple)
2. Dark mode parity — tokens must resolve correctly in `.dark`
3. All existing tests pass (no logic changes)
4. i18n keys unchanged (no new translation work)

## Token Migration Pattern
| Old Token | New Token/CSS | Notes |
|-----------|---------------|-------|
| `bg-primary` / `text-primary` | `bg-saigon-amber` / `text-saigon-amber` | Warm amber #d97706 |
| `bg-card` | `saigon-card` class | Glass card utility |
| `bg-background-secondary` | `bg-surface-overlay` or `bg-surface-raised` | Indigo-tinted surface |
| `--foreground` | `--ink-primary` | Text color token |
| Border defaults | `border-border-color` | Light/dark adaptive |

## Files to Modify
| # | Screen | File | Estimated |
|---|--------|------|-----------|
| 1 | Dashboard Overview | `src/app/[locale]/dashboard/page.tsx` | ~155 lines, bg-primary/bg-card bindings |
| 2 | Campaigns | `src/components/stitch/screens/campaigns/campaigns-page.tsx` | Lucide imports + styling |
| 3 | Dashboard Shell | `src/components/stitch/screens/dashboard-shell/dashboard-shell.tsx` | Sidebar/navbar old tokens |
| 4 | Settings | `src/components/stitch/screens/settings/settings-page.tsx` | Card/primary surface bindings |

## Implementation Steps
1. Start each file: identify all `--primary`, `--foreground`, `--card`, `--background-secondary` token references
2. Replace with new tokens per migration pattern above
3. Verify color contrast: amber on indigo ≥ 4.5:1 (WCAG AA)
4. Visual QA: compare against converted Landing/Pricing screens side-by-side
5. Run `npm test` — confirm 0 regressions

## Out of Scope
- `.theme-skew` transform decision (separate UX call)
- Non-dashboard screens (affiliate, admin, etc.)
- Any logic/behavioral changes — cosmetic only
