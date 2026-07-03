---
phase: 2
title: "Parallel P0 Screens — Landing, Pricing, Login/Register"
status: pending
effort: "3-4h"
dependsOn: "Phase 1 (P0 Screen Prompts & Amber Update)"
blocks: ["Phase 4: Integration Test & Deploy Readiness"]
---

# Phase 2: Parallel P0 Screens — Landing, Pricing, Login/Register

## Overview

Generate and integrate 3 P0 screens in parallel from amber-updated Stitch prompts. Per-screen pipeline: Stitch generation → HTML download → Next.js 16 component conversion → seed/ui component replacement → i18n wiring → route integration → build verification.

These 3 screens have **zero file overlap** and can run in parallel subagents.

## Prerequisites

- Phase 1 complete: all prompts use amber primary (#D97706), Setup Wizard prompt exists
- Phase 0 complete: design tokens consolidated
- Stitch accessible at [stitch.withgoogle.com](https://stitch.withgoogle.com) (manual paste workflow)
- `npm run dev` working in `apps/sophia-ai-factory/`

---

## Common Pipeline (all screens)

### Step A: Generate in Stitch
1. Open [stitch.withgoogle.com](https://stitch.withgoogle.com)
2. Paste the amber-updated prompt from `prompts-stitch-screens.md`
3. Generate screen at "Desktop High-Fidelity" setting
4. Use **Stitch Export → HTML** to download
5. Save HTML to `plans/260703-0149-full-ui-redesign/reports/<screen-name>.html`

### Step B: Convert HTML → Next.js Components
6. Analyze Stitch HTML output:
   - Extract: layout grid, color tokens, font sizes, spacing, component hierarchy
   - Map Stitch HTML elements → React components
   - Map hardcoded colors → CSS custom properties / Tailwind amber classes
7. Create component files in `src/components/stitch/screens/<screen-name>/`

### Step C: Replace with seed/ui Primitives
8. Replace Stitch-generated button/input/card/badge with `@/seed/components/ui/*` equivalents:
   - `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx`, `progress.tsx`, `tabs.tsx`, `tooltip.tsx`, `skeleton.tsx`, `pagination.tsx`, `breadcrumb.tsx`
   - Keep only Stitch-specific layout/styling wrappers
9. Apply amber color system: `bg-[#D97706]` / `bg-amber-600`, `text-amber-*`, `border-amber-*`, `ring-amber-*`
10. Use CSS custom properties where Tailwind amber classes don't suffice

### Step D: Wire i18n
11. Use `useTranslations('namespace')` in client components, `getTranslations('namespace')` in server components
12. Add new translation keys to `messages/en.json` and `messages/vi.json`
13. Duplicate all customer-facing text (VN + EN)

### Step E: Route Integration
14. Import new component into existing route page
15. Preserve existing: SEO metadata, structured data (schema.org), error boundaries, Suspense boundaries, redirects
16. Replace Stitch HTML hardcoded content with dynamic i18n-rendered text

### Step F: Verify
17. `npm run type-check` → 0 errors
18. `npm run lint` → 0 errors (may have new i18n key warnings — those are expected additions)
19. `npm run build` → 0 errors (final gate)

---

## Screen 1: Landing Hero (Hero + Features + FAQ + CTA)

| Attribute | Value |
|-----------|-------|
| Prompt Source | `prompts-stitch-screens.md` #1 (amber-updated) |
| Target Route | `src/app/[locale]/page.tsx` |
| Current State | Complex dynamic imports with 13+ sections |
| Key Challenge | Must preserve all existing sections while restyling |

### Current Sections (must preserve)
- Hero (`.Hero`), SocialProof, RaaSShowcase, Workflow, Features
- CreativeStudioShowcase, RaasDemoTerminal, ProductionCostCalculator
- PricingSection, AgiCapabilitiesSection, AffiliateDiscovery, FAQ, CtaSection
- Footer, StickyMobileCta
- Schema.org structured data (FAQPage, Organization)

### Implementation Approach

**Option A (staged):** Generate Stitch Hero + Features + FAQ + CTA as a new cohesive landing block. Keep existing sections (SocialProof, RaaSShowcase, etc.) wrapped in separate dynamic imports. Replace only the hero area.

**Option B (full):** Generate the complete landing page in Stitch and replace `page.tsx` content. **Riskier** — 13 dynamic imports, SEO schemas, edge caching (`revalidate = 60`).

**Recommended: Option A** — replace Hero, Features, FAQ, CTA as a single Stitch-generated block. Preserve other sections as-is.

### Steps
1. Generate Hero + Features + FAQ + CTA block from Stitch prompt #1
2. Create `src/components/stitch/screens/landing/landing-hero-block.tsx`
3. Replace Hero import + Features import + FAQ import + CTA import with single `LandingHeroBlock`
4. Add i18n keys under `landing` namespace (VN+EN)
5. Verify: `npm run build`, structured data still renders, edge cache still works

### Key Files
| File | Action |
|------|--------|
| `src/app/[locale]/page.tsx` | Replace Hero/Features/FAQ/CTA sections with LandingHeroBlock |
| `src/components/stitch/screens/landing/landing-hero-block.tsx` | CREATE — Stitch-generated block |
| `messages/en.json` → `landing` namespace | ADD new hero/features/faq/cta keys |
| `messages/vi.json` → `landing` namespace | ADD Vietnamese equivalents |

---

## Screen 2: Pricing Page

| Attribute | Value |
|-----------|-------|
| Prompt Source | `prompts-stitch-screens.md` #2 (amber-updated) |
| Target Route | `src/app/[locale]/pricing/page.tsx` |
| Current State | Already uses Stitch components: `PricingStitchSection`, `PricingFaq` |

### Current Architecture
- `PricingStitchSection` from `@/forest/components/pricing/pricing-stitch-section` — 4 tier cards
- `PricingFaq` from `@/forest/components/pricing/pricing-faq` — accordion FAQ
- HeyGen configure prompt (amber-already `border-amber-500/30`)
- Product schemas + breadcrumb schemas
- `revalidate = 3600` edge cache
- Tier-aware pricing display (highlights user's current tier)

### Steps
1. Generate pricing page from Stitch prompt #2 (amber-updated)
2. Update `src/forest/components/pricing/pricing-stitch-section.tsx` with new amber theme
3. Update `src/forest/components/pricing/pricing-faq.tsx` with new amber theme
4. Replace any indigo references with amber: `#6366F1` → `#D97706`, `indigo-*` → `amber-*`
5. Preserve: tier highlighting logic, HeyGen prompt, schemas, edge cache
6. Update i18n keys under `pricing` namespace (VN+EN)
7. Verify: 4 tier cards render, monthly/yearly toggle works, FAQ accordion works

### Key Files
| File | Action |
|------|--------|
| `src/app/[locale]/pricing/page.tsx` | Update import paths if needed |
| `src/forest/components/pricing/pricing-stitch-section.tsx` | UPDATE — restyle to amber theme |
| `src/forest/components/pricing/pricing-faq.tsx` | UPDATE — restyle to amber theme |
| `messages/en.json` → `pricing` namespace | UPDATE keys if layout changes |
| `messages/vi.json` → `pricing` namespace | UPDATE Vietnamese equivalents |

---

## Screen 3: Login + Register

| Attribute | Value |
|-----------|-------|
| Prompt Source | `prompts-stitch-screens.md` #6 (amber-updated Login) + derived Register |
| Target Routes | `src/app/[locale]/login/page.tsx` (login tab) + Register in same tab-switch |
| Current State | Stitch components: `LoginPage`, `RegisterPage` |

### Current Architecture
- `src/app/[locale]/login/page.tsx` — Suspense wrapper, tab-based (`?tab=signup`)
- `src/components/stitch/screens/auth/login-page.tsx` — Login form with email/password/magic link
- `src/components/stitch/screens/auth/register-page.tsx` — Register form with company name/email/password/terms
- `src/app/[locale]/signup/page.tsx` — Redirect-only page → `/login?tab=signup`

### Steps
1. Generate login page from Stitch prompt #6 (amber-updated)
2. Update `src/components/stitch/screens/auth/login-page.tsx` — restyle to amber theme
3. Update `src/components/stitch/screens/auth/register-page.tsx` — restyle to amber theme
4. Replace hardcoded indigo: `#6366F1` → `#D97706`, `bg-[#6366F1]` → `bg-[#D97706]`, `text-[#6366F1]` → `text-amber-600`, `ring-[#6366F1]` → `ring-amber-500`
5. Preserve: auth logic (authClient.signIn.email, authClient.signUp.email, magicLink), password validation, error handling, redirect flow
6. Replace inline HTML with `@/seed/components/ui/input`, `@/seed/components/ui/button`, `@/seed/components/ui/card` where applicable
7. Update i18n keys under `stitch.auth.login` + `stitch.auth.register` namespaces (VN+EN)
8. Verify: login works, register works, password validation works, magic link works, locale toggle works

### Key Files
| File | Action |
|------|--------|
| `src/app/[locale]/login/page.tsx` | May need no changes (imports LoginPage/RegisterPage) |
| `src/components/stitch/screens/auth/login-page.tsx` | UPDATE — amber theme |
| `src/components/stitch/screens/auth/register-page.tsx` | UPDATE — amber theme |
| `src/app/[locale]/signup/page.tsx` | May need no changes (redirect-only) |
| `messages/en.json` → `stitch.auth.login` + `stitch.auth.register` | UPDATE keys |
| `messages/vi.json` → `stitch.auth.login` + `stitch.auth.register` | UPDATE Vietnamese |

---

## Parallel Execution Strategy

All 3 screens have **zero file overlap** — different source files, different components, different i18n namespaces. Run as 3 parallel subagents:

```
Subagent A → Landing Hero Block    (src/components/stitch/screens/landing/)
Subagent B → Pricing Page          (src/forest/components/pricing/)
Subagent C → Login + Register      (src/components/stitch/screens/auth/)
```

**No shared files modified.** i18n namespaces are independent (`landing`, `pricing`, `stitch.auth`).

## Success Criteria (per screen)

- [ ] Stitch HTML generated and saved to `reports/`
- [ ] Next.js component created/updated with amber theme
- [ ] seed/ui primitives used instead of duplicated Stitch HTML elements
- [ ] Bilingual VN+EN i18n wired (no hardcoded English strings)
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes with 0 errors
- [ ] Existing functionality preserved (SEO schemas, redirects, auth flow, edge cache)

## Rollback Plan

If a screen conversion fails or breaks the build:
1. `git checkout -- <modified-files>` to revert
2. Regenerate Stitch prompt with different parameters
3. Re-apply conversion with lessons learned
