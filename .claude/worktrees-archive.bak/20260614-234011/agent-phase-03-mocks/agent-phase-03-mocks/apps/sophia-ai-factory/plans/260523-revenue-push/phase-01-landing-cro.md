# Phase 01: Landing Page CRO

**Priority:** HIGH | **Impact:** +10-15% pricing page visits
**Status:** COMPLETE

## Problem
- Hero shows "Video Factory + AI Automation" — WHAT not WHY
- No pricing visible above fold
- CTAs don't show price ("Start" vs "Start for $199/mo")
- No social proof above fold
- Pricing cards on landing have no direct checkout CTA

## Tasks

- [x] 1.1 Update hero value prop: "Turn AI into Revenue — Video Factory for Non-Tech CEOs"
- [x] 1.2 Add price to primary CTA: "Start for $199/mo" (from UNIFIED_TIERS.BASIC.price = 199)
- [x] 1.3 Move SocialProof section immediately after Hero (above fold trust); upgraded trust indicators with real numbers (500+ creators, 99.9% uptime, <200ms)
- [x] 1.4 Pricing cards: CTA changed from "Get Started" → "Subscribe Now" with primary-styled button; Master tier → "Get Lifetime Access Now"
- [x] 1.5 Move ProductionCostCalculator above PricingSection (ROI before price)
- [x] 1.6 Hero badge updated to "✨ Founding Member Spots Open" (urgency signal)

## Files to Modify
- `src/app/[locale]/page.tsx` — section ordering
- `src/app/components/sections/hero-section.tsx` — CTA text + price
- `src/app/components/sections/social-proof-stats.tsx` — position above fold
- `src/forest/components/pricing/pricing-card.tsx` — add checkout CTA
- `messages/en.json` + `messages/vi.json` — i18n keys

## Success Criteria
- Price visible on hero CTA
- Social proof visible without scrolling
- Each pricing card has direct "Subscribe" button
- Build passes, production verified
