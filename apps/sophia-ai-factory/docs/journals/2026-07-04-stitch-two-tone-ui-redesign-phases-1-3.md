# Journal: Stitch Two-Tone UI Redesign — Phases 1-3

**Date:** 2026-07-04
**Plan:** `plans/260704-1739-stitch-two-tone-orchestrator/`
**Status:** Phases 1-3 Complete (Foundation + Public Amber Retrofit + Admin Indigo Retrofit)

## What Changed

**Phase 1 — Foundation:**
- Added `"enable_ui_redesign"` to the `FeatureFlag` compile-time string union in `src/seed/types/index.ts`
- Registered flag in `FEATURE_FLAGS` + `DEFAULT_FLAGS` in `src/seed/config/flags.ts` (default OFF, BASIC tier)
- Added `.theme-amber` and `.theme-indigo` CSS classes to `globals.css` using the existing `--primary` HSL pattern matching the existing `:root/.dark/@theme inline` system
- Root layout applies `.theme-amber` to `<body>`; dashboard layout applies `.theme-indigo` to root `<div>` — both via `getFeatureFlag('enable_ui_redesign')`

**Phases 2+3 — Color Retrofit (5 parallel agents, 15 screens):**

Replaced hardcoded `#6366F1` (indigo), `indigo-500`/`indigo-400` Tailwind classes, and `brand-indigo` CSS variables with `var(--primary)` / `bg-primary` / `text-primary` / `border-primary` equivalents across all existing Stitch screens. The theme system now controls colors — amber when `.theme-amber`, indigo when `.theme-indigo`.

| File | Replacements |
|------|:------------:|
| `landing-hero.tsx` | 14 |
| `dashboard-overview.tsx` | 18 |
| `login/*.tsx` (3 files) | 11 |
| `settings-page.tsx` | 5 |
| `admin-page-content.tsx` | 3 |
| `campaigns-page.tsx` | 9 |
| `dashboard-shell.tsx` | 4 |

## Key Decisions

1. **CSS naming**: Used `--primary` (matching existing `:root/.dark` pattern) not `--color-primary` — this works with the existing `@theme inline { --color-primary: hsl(var(--primary)) }` bridge
2. **Feature flag approach**: Seed-layer type union + `getFeatureFlag()` server-side — no React hook needed. Layouts are server components, so server-side flag check works natively
3. **Rollout strategy**: Flag defaults to OFF; override with `NEXT_PUBLIC_FEATURE_UI_REDESIGN=true` env var
4. **No `git add -A`**: Explicit file paths only in ship phase

## Critical Finding (Red Team)

The original plan assumed Stitch HTML → Next.js "conversion" was needed. **21 Stitch screens already existed** at `src/components/stitch/screens/` — actively imported across 20+ pages. The real work was retrofitting hardcoded colors to CSS variable tokens. The plan was rewritten post-red-team to reflect this.

## Verification

- TypeScript: 0 errors
- Tests: 6785/6785 passed
- Zero hardcoded `#6366F1`, `indigo-*`, `brand-indigo` remain in any Stitch screen

## Remaining

Phases 4-5 (Integration QA + Ship) deferred per request. Enable flag to preview:
`NEXT_PUBLIC_FEATURE_UI_REDESIGN=true npm run dev`
