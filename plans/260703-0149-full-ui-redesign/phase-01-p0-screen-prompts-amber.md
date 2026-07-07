---
phase: 1
title: "P0 Screen Prompts & Amber Theme Update"
status: complete
effort: "2h"
dependsOn: "Phase 0 (Design System Consolidation) — completed"
blocks: ["Phase 2: Parallel P0 Screens", "Phase 3: Setup Wizard + Dashboard Shell"]
---

# Phase 1: P0 Screen Prompts & Amber Theme Update

## Overview

The existing `prompts-stitch-screens.md` was written for **indigo primary (#6366F1)**. Phase 0 changed the canonical design token to **amber primary (#D97706)** with indigo as accent. This phase updates all 10 existing Stitch prompts to use amber primary, fixes the `design-spec.json` which still references indigo, and creates a new prompt for the Setup Wizard screen (currently missing).

**Why this phase before generation:** pasting indigo prompts into Stitch would produce screens we'd have to re-color manually. Updating prompts once saves ~1h of rework per screen.

## Prerequisites

- Phase 0 complete: `.stitch-tokens.json` uses amber `#D97706`, canonical MASTER.md exists
- `prompts-stitch-screens.md` at plan root (10 existing prompts, all indigo-primary)

## Implementation Steps

### Step 1: Fix `design-spec.json`

**File:** `plans/260703-0149-full-ui-redesign/design-spec.json`

Change `"primaryColor": "#6366F1"` → `"primaryColor": "#D97706"`. This is the spec consumed by downstream phases; it currently contradicts Phase 0's amber decision.

### Step 2: Update all 10 Stitch prompts (indigo → amber)

**File:** `plans/260703-0149-full-ui-redesign/prompts-stitch-screens.md`

Systematic replacement across all 10 prompts:

| Old | New |
|-----|-----|
| Primary indigo #6366F1 | Primary **amber #D97706** |
| "indigo" (color references) | "amber" (color references) |
| indigo accent/border/fill | amber accent/border/fill |
| indigo-* Tailwind classes | amber-* equivalents |
| Ring/focus indigo | Ring/focus amber |
| Button primary indigo | Button primary amber |

**Preserve:**
- Indigo as accent/secondary color (indigo dot on logo, indigo sparkle icons, indigo KPI chart line)
- All structural layout, font sizes, spacing, dark mode background
- VN+EN bilingual label references

### Step 3: Create Setup Wizard Stitch prompt (#11)

**Add to:** `prompts-stitch-screens.md` as section #11

New prompt for the BYOK onboarding wizard. Must match:
- 5-step stepper: Welcome → System Check → AI Keys → Provider Credentials → Review
- Amber primary theme, dark mode
- Key fields: OpenRouter, Anthropic, ElevenLabs, D-ID, HeyGen, Resend, NOWPayments
- Status indicators: green dot (configured) / red dot (missing)
- Validation checkmark animation
- Existing API routes preserved: `/api/setup/verify`, `/api/setup/save`, `/api/setup-wizard/*`

**Reference files:**
- `src/app/[locale]/dashboard/onboarding/wizard-client.tsx` — current wizard structure
- `src/tree/components/setup-wizard/` — stepper + step components
- `src/app/actions/complete-onboarding-action.ts` — completion server action

### Step 4: Update Quick Reference section

Update the Quick Reference at the bottom of `prompts-stitch-screens.md` to reflect:
- Amber theme requirement
- Bilingual i18n requirement (use `useTranslations('namespace')`)
- Component replacement step (seed/ui primitives instead of Stitch duplicates)

## Success Criteria

- [x] `design-spec.json` primaryColor is `#D97706` (amber)
- [x] All 10 existing prompts use amber primary with indigo accent (not indigo primary)
- [x] New Setup Wizard prompt (#11) covers all 5 BYOK steps
- [x] Quick Reference updated with amber + i18n + API routes + execution order
- [x] Zero references to indigo as primary color remain in prompts
- [x] Pricing canonicalized to $199/$399/$799/$4999 (matches `unified-limits.ts`)

## Key Files

| File | Action |
|------|--------|
| `plans/260703-0149-full-ui-redesign/design-spec.json` | Fix primaryColor to amber |
| `plans/260703-0149-full-ui-redesign/prompts-stitch-screens.md` | Update 10 prompts + add #11 (Setup Wizard) |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Amber text on dark background readability | Low | Medium | Amber #D97706 on #0F0F11 has WCAG AA contrast ratio 4.6:1 (passes for large text, borderline for body) |
| Setup Wizard prompt misses BYOK fields | Medium | High | Cross-reference wizard-client.tsx:222-282 for exact field list |
| Indigo references missed in prompts | Low | Low | grep for "indigo" and "6366F1" after update to catch stragglers |

## Unresolved Questions

- Setup Wizard is currently indigo-primary in its live implementation. Should we match the new amber theme or keep it visually consistent with the rest of the dashboard during the transition? **Decision needed:** Update to amber for consistency with new design system.
