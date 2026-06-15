---
phase: 1
title: "i18n wiring + file-size compliance"
status: done
priority: P1
effort: 2h
---

# Phase 01: i18n Wiring + File-Size Compliance

## Context

- [Features section](../../src/app/components/sections/features.tsx) — 124 lines, hardcoded Vietnamese, NO `useTranslations`
- [SocialProof section](../../src/app/components/sections/social-proof.tsx) — 272 lines (over 200 limit), hardcoded Vietnamese
- [ProductionCostCalculator](../../src/app/components/sections/production-cost-calculator.tsx) — 241 lines (over 200 limit), hardcoded `(tron doi)` suffix
- Translation files: `messages/en.json` (has `landing.features.items` with 6 keys), `messages/vi.json`

## Key Insight

`messages/en.json` already has `landing.features.items` and `landing.social_proof` keys, but components don't use them. Wire the existing keys rather than inventing new ones.

## Requirements

### Functional
- All 3 sections use `useTranslations` for every user-facing string
- SocialProof split into sub-components to stay under 200 lines
- ProductionCostCalculator i18n'd for tier suffix and headings

### Non-Functional
- Zero new dependencies
- Build must pass
- No visual regression (same layout, same content)

## Data Flow

```
messages/{locale}.json → next-intl → useTranslations('landing') → component renders translated string
```

## Implementation Steps

### 1. Wire `features.tsx` to existing i18n keys

**File:** `src/app/components/sections/features.tsx` (124 lines)

The component currently has a hardcoded `features` array with 4 items. The translation file has 6 items under `landing.features.items`. Action:

1. Add `import { useTranslations } from "next-intl";`
2. Replace hardcoded `features` array with translation-driven rendering
3. Use `t('features.items.{key}.title')`, `t('features.items.{key}.description')`, `t('features.items.{key}.badge')`
4. Keep icon names and layout config (span, gradient) in a static config array — only text comes from i18n
5. Replace hardcoded section heading ("Nen Tang", "Xay Cho Agency...") with `t('features.title')`, `t('features.subtitle')`
6. Update `messages/en.json` and `messages/vi.json` `landing.features` to match the 4-card bento layout (current 6 items can stay; component picks which items to render)

**Feature card config (non-i18n, stays in code):**
```ts
const FEATURE_CARDS = [
  { key: "ai_engine", icon: "smart_toy", span: "md:col-span-2", gradient: "from-blue-500/20 to-cyan-500/10" },
  { key: "video_factory", icon: "videocam", span: "", gradient: "from-purple-500/20 to-violet-500/10" },
  { key: "credits", icon: "toll", span: "", gradient: "from-amber-500/20 to-orange-500/10" },
  { key: "api", icon: "api", span: "md:col-span-2", gradient: "from-green-500/20 to-emerald-500/10" },
];
```

**i18n keys to add/update in `landing.features.items`:**
- `ai_engine.title`, `ai_engine.description`, `ai_engine.badge`
- `video_factory.title`, `video_factory.description`, `video_factory.badge`
- `credits.title`, `credits.description`, `credits.badge`
- `api.title`, `api.description`, `api.badge`

### 2. Split + i18n `social-proof.tsx` (272 → 2 files under 200)

**Current structure in social-proof.tsx:**
- `useLiveStats()` hook + `AnimatedCounter` component + `FALLBACK_STATS` (lines 1-135) — stats bar logic
- `SocialProof` component (lines 137-272) — renders stats bar + testimonials

**Split plan:**

**Create `social-proof-stats.tsx` (~90 lines):**
- Move `AnimatedCounter`, `useLiveStats`, stat-related types
- Export `StatsBar` component (the stats grid)
- Wire `useTranslations('landing.social_proof')` for stat labels (`t('stats.missions')`, `t('stats.agencies')`, etc.)

**Create `social-proof-testimonials.tsx` (~100 lines):**
- Move testimonials array → derive from `t('testimonials.items.{i}.name')` etc.
- Export `TestimonialsGrid` component
- Wire headings: `t('title')`, `t('subtitle')`, `t('testimonials_disclaimer')`

**Update `social-proof.tsx` (~50 lines):**
- Import `StatsBar` + `TestimonialsGrid`
- Compose them with background glows and ScrollReveal wrappers
- Wire `useTranslations('landing.social_proof')` for section heading

**i18n keys already exist** in `landing.social_proof`: `title`, `subtitle`, `stats`, `testimonials`, `badges`, `testimonials_disclaimer`. Verify exact key paths match what components expect.

### 3. i18n `production-cost-calculator.tsx` (241 lines)

**File:** `src/app/components/sections/production-cost-calculator.tsx`

Minimal i18n fix — only the hardcoded `(tron doi)` suffix at line 17 and any other Vietnamese strings.

1. Add `useTranslations('landing.roi')` (ROI keys already exist in messages)
2. Replace `(tron doi)` with `t('lifetime_suffix')` or use existing `landing.roi` keys
3. Add missing keys to `messages/en.json` and `messages/vi.json` if needed

File is 241 lines. The split into `production-cost-calculator-parts.tsx` (68 lines) already exists. The main file can stay at 241 if we extract the `tierLabels` and `TIER_DEFAULTS` config into the parts file (~20 lines saved), bringing it to ~220. Alternatively, extract the result display section into a separate component.

**Decision:** Extract `CostResultPanel` (the bottom half showing cost breakdown results) into `production-cost-calculator-parts.tsx` to bring main file under 200.

### 4. Update translation files

**`messages/en.json`** — add/update under `landing`:
- `features.items.ai_engine.*`, `features.items.video_factory.*`, `features.items.credits.*`, `features.items.api.*`
- `features.badge_label` (the "Nen Tang" badge → "Platform")
- Verify `social_proof.stats.*` keys match component expectations
- Add `roi.lifetime_suffix` if missing

**`messages/vi.json`** — mirror all new keys with Vietnamese translations (use current hardcoded strings as source)

## Todo List

- [ ] Wire `features.tsx` to `useTranslations` — replace hardcoded array with i18n-driven rendering
- [ ] Add `landing.features.items.{ai_engine,video_factory,credits,api}` to `messages/en.json`
- [ ] Add matching keys to `messages/vi.json` (from current hardcoded Vietnamese)
- [ ] Create `social-proof-stats.tsx` — extract `AnimatedCounter` + `StatsBar`
- [ ] Create `social-proof-testimonials.tsx` — extract testimonials grid
- [ ] Refactor `social-proof.tsx` to compose sub-components (target: <80 lines)
- [ ] Wire all SocialProof sub-components to `useTranslations('landing.social_proof')`
- [ ] i18n `production-cost-calculator.tsx` — replace `(tron doi)` and headings
- [ ] Extract `CostResultPanel` into parts file to bring main under 200 lines
- [ ] Run `npm run build` — 0 errors
- [ ] Verify no visual regression (same layout at 375px, 768px, 1280px)

## Success Criteria

- All 3 sections render text from `messages/*.json` via `useTranslations`
- No file exceeds 200 lines
- `npm run build` passes
- Switching locale between en/vi shows correct translations

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Translation key mismatch (raw keys shown on page) | Medium | High | Grep all `t()` calls and verify against messages/*.json before build |
| AnimatedCounter breaks after extraction | Low | Medium | Keep identical props interface; test in browser |
| SocialProof layout shift from split | Low | Low | Compose sub-components identically to current monolith |

## Failure Modes

1. **Missing translation key** → raw key string shown to user. Mitigation: automated key check script before commit.
2. **Broken dynamic import** → section fails to load. Mitigation: keep `social-proof.tsx` as the barrel export; page.tsx import path unchanged.
3. **Client/server mismatch** → hydration error. Mitigation: all 3 sections are already `"use client"`, no change to rendering mode.
