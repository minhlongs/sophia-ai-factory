---
phase: 1
title: "Group A: Marketing Sections"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Group A — Marketing Section Theme Updates

## Overview

Update 8 marketing sections from old purple theme (`#D946EF`) to new indigo dark theme (`#6366F1`, `#0F0F11`). Runs in parallel with Phases 2 and 3.

## Architecture

Each section is an independent component in `src/app/components/sections/`. Updates are visual-only — preserve existing logic, API calls, and data fetching.

## Related Code Files

- **Modify:** `src/app/components/sections/creative-studio-showcase.tsx`
- **Modify:** `src/app/components/sections/cta-section.tsx`
- **Modify:** `src/app/components/sections/social-proof.tsx`
- **Modify:** `src/app/components/sections/social-proof-testimonials.tsx`
- **Modify:** `src/app/components/sections/workflow.tsx`
- **Modify:** `src/app/components/sections/roi-calculator.tsx`
- **Modify:** `src/app/components/sections/production-cost-calculator.tsx`
- **Modify:** `src/app/components/sections/production-cost-calculator-parts.tsx`
- **Modify:** `src/app/components/sections/production-cost-calculator-results.tsx`

## Implementation Steps

1. **Pre-validate** — Run `ui-ux-pro-max search.py --domain style --stack nextjs` for style guidelines
2. **frontend-design pass (parallel)** — Update all 8 sections to indigo dark theme:
   - Replace `#D946EF` → `#6366F1`, purple bg → `#0F0F11`/`#18181B`
   - Update gradient colors, shadows, border colors
   - Add dark surface cards with zinc-800 borders
   - Maintain responsive layout and existing data flow
3. **ui-styling pass (parallel)** — Align Tailwind tokens:
   - Use project's Tailwind config variables where available
   - Ensure consistent rounding (rounded-lg), spacing, font sizes
4. **ui-ux-pro-max review** — Post-implementation UX audit:
   - `search.py --domain ux` for anti-patterns
   - `search.py --domain landing` for page structure validation
   - Check CTA contrast, readability, focus states

## Key Design Tokens

- Primary: `#6366F1` (indigo-500)
- Background: `#0F0F11` (near-black)
- Surface: `#18181B` (zinc-900)
- Surface Card: `#18181B` with `zinc-800` border
- Text Primary: white
- Text Secondary: `#A1A1AA` (zinc-400)
- Rounding: `rounded-lg` (8px)
- Font: Inter (consistent with project)

## Success Criteria

- [ ] All 8 sections use indigo as primary accent color
- [ ] Dark mode is default (no light mode artifacts)
- [ ] Existing data fetching and logic preserved
- [ ] Responsive on mobile (375px) and desktop (1440px)
- [ ] No `console.log` or `:any` types
- [ ] ui-ux-pro-max review passes (zero anti-patterns)

## Risk Assessment

- Risk: Overwriting existing logic during visual update → **Mitigation:** Focus edits on JSX/styling only, keep logic intact
- Risk: Inconsistent indigo shades → **Mitigation:** Use Tailwind indigo-500 consistently, no hex hardcodes
