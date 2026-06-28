---
title: "Landing Page Redesign"
description: "Modernize Hero, Features, add Creative Studio showcase, i18n all hardcoded strings, visual consistency pass"
status: done
priority: P1
effort: 6h
branch: master
tags: [landing-page, i18n, ui, creative-studio]
created: 2026-05-23
---

# Landing Page Redesign

## Problem Statement

The landing page has 5 issues:
1. **Features section** (124 lines) has hardcoded Vietnamese strings — not using `useTranslations`
2. **SocialProof section** (272 lines, over 200-line limit) has hardcoded Vietnamese strings
3. **ProductionCostCalculator** (241 lines, over 200-line limit) has hardcoded Vietnamese strings (e.g. `(tron doi)`)
4. **No Creative Studio showcase** — the flagship feature (5 media tabs: video, image, audio, brand assets, templates) has no landing page presence
5. **31+ inline `style={{}}` calls** across Hero/Features/SocialProof — should use Tailwind utility classes or CSS custom properties

## Current i18n Coverage

| Section | Uses `useTranslations` | Hardcoded strings |
|---------|:-----:|:-----:|
| Hero (188L) | YES | No |
| RaaSShowcase (106L) | YES | No |
| Workflow (99L) | YES | No |
| Features (124L) | **NO** | Vietnamese titles, descriptions, badges |
| RaasDemoTerminal (140L) | YES | No |
| SocialProof (272L) | **NO** | Vietnamese stats labels, testimonials, headings |
| PricingSection (197L) | YES (via tier config) | No |
| ProductionCostCalculator (241L) | **NO** | Vietnamese suffix `(tron doi)` |
| AgiCapabilities (138L) | Partial | Unknown |
| AffiliateDiscovery (185L) | YES | No |
| FAQ (75L) | YES | No |
| CtaSection (77L) | Partial | Unknown |

## Existing Translation Keys

`messages/en.json` has `landing.features` with 6 items (`multi_channel`, `auto_affiliate`, `voice_cloning`, `script_gen`, `auto_publish`, `global_reach`) — but the component ignores these and uses hardcoded card data.

`messages/en.json` has `landing.social_proof` with keys for `title`, `subtitle`, `stats`, `testimonials`, `badges`, `testimonials_disclaimer` — but the component ignores these.

## Design Tokens (verified in globals.css)

```css
--neon-cyan:   #00f0ff (dark) / #06b6d4 (light)
--neon-purple: #7000ff (dark) / #7c3aed (light)
--neon-pink:   #ff00ff (dark) / #db2777 (light)
```

Existing CSS classes: `.text-gradient`, `.gradient-border`, `.glow-primary`, `.animate-float`, `.animate-fade-in-up`, `.animate-drift`, `.animate-blink`, `.animate-glow-pulse`, `.stagger-reveal`

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [i18n + file-size fixes](phase-01-i18n-and-file-size.md) | pending | 2h |
| 2 | [Features section redesign + Creative Studio showcase](phase-02-features-and-creative-studio.md) | pending | 2h |
| 3 | [Hero modernization](phase-03-hero-modernization.md) | pending | 1h |
| 4 | [Visual consistency pass](phase-04-visual-consistency.md) | pending | 1h |

## Dependencies

- Phase 1 BLOCKS Phase 2 (Features needs i18n infrastructure before redesign)
- Phase 3 and Phase 4 are independent of each other, can run after Phase 1

## Rollback

Each phase is a separate commit. Revert any single phase without cascading damage since phases touch distinct files (see file ownership below).

## File Ownership

| Phase | Files owned (modify) | Files owned (create) |
|-------|---------------------|---------------------|
| 1 | `sections/features.tsx`, `sections/social-proof.tsx`, `sections/production-cost-calculator.tsx`, `messages/en.json`, `messages/vi.json` | `sections/social-proof-testimonials.tsx`, `sections/social-proof-stats.tsx` |
| 2 | `sections/features.tsx` (content only, after Phase 1 i18n), `messages/en.json`, `messages/vi.json` | `sections/creative-studio-showcase.tsx`, page.tsx entry |
| 3 | `sections/hero.tsx` | None |
| 4 | `sections/social-proof.tsx` (style-only), `sections/cta-section.tsx`, `agi-capabilities-section.tsx` | None |

**Conflict note:** `features.tsx` touched by Phase 1 (i18n wiring) then Phase 2 (content update). Sequential execution required. `messages/*.json` touched by Phases 1 and 2 — Phase 2 adds new keys, no overlap with Phase 1 keys.

## Success Criteria

- [ ] `npm run build` passes with 0 errors
- [ ] All landing sections use `useTranslations` — zero hardcoded user-facing strings
- [ ] No file exceeds 200 lines
- [ ] Zero new dependencies added
- [ ] `messages/en.json` and `messages/vi.json` have matching key trees for all landing sections
- [ ] Mobile-first responsive design maintained (test at 375px, 768px, 1280px)
- [ ] Creative Studio section visible on landing page with i18n support
- [ ] Inline `style={{}}` count reduced by 50%+ across modified sections
