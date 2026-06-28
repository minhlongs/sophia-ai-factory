# Phase 07: Annual Pricing + Bundle Discounts

**Priority:** LOW | **Impact:** +20% LTV per customer
**Status:** TODO

## Problem
- All tiers are monthly-only (except MASTER lifetime)
- No annual discount — standard SaaS offers 15-20% off for yearly commitment
- No incentive for long-term commitment = higher churn risk
- unified-limits.ts has `billingType: 'monthly' | 'lifetime'` but yearly not implemented

## Tasks

- [ ] 7.1 Add yearly pricing to unified-limits.ts
      - BASIC: $199/mo → $1,990/yr ($166/mo, ~17% savings)
      - PREMIUM: $399/mo → $3,990/yr ($332/mo, ~17% savings)
      - ENTERPRISE: $799/mo → $7,990/yr ($666/mo, ~17% savings)
      - MASTER: stays lifetime $4,999 (no change)
      - Add `yearlyPrice` and `yearlySavingsPercent` fields to UnifiedTierLimits

- [ ] 7.2 Add billing period toggle on pricing page
      - Monthly | Annual toggle switch above pricing cards
      - When Annual selected: show yearly price with "Save 17%" badge
      - Show both monthly equivalent and total yearly price
      - File: `src/app/[locale]/pricing/page.tsx` or pricing section component

- [ ] 7.3 Update checkout flow to accept yearly period
      - `src/land/checkout/checkout-validators.ts` — allow 'yearly' period
      - `src/app/api/checkout/route.ts` — pass period to NOWPayments invoice
      - May need new NOWPayments invoice IDs for yearly plans (document as TODO)

- [ ] 7.4 Add annual badge on pricing cards
      - When annual selected, show "Save 17%" or "Best Value" badge
      - Highlight savings amount: "Save $398/yr on Growth"
      - Bilingual i18n keys

- [ ] 7.5 Update i18n keys for annual pricing
      - `messages/en.json` + `messages/vi.json`
      - Keys: pricing.annual, pricing.monthly, pricing.save_percent, pricing.per_year

## Files to Modify
- `src/seed/config/tiers/unified-limits.ts` — add yearly pricing fields
- `src/forest/components/pricing/pricing-section.tsx` — billing period toggle
- `src/forest/components/pricing/pricing-card.tsx` — annual display + savings badge
- `src/land/checkout/checkout-validators.ts` — yearly period validation
- `messages/en.json` + `messages/vi.json` — i18n

## Constraints
- MASTER tier stays lifetime (no yearly option)
- NOWPayments invoice IDs for yearly may need manual creation — document this
- Don't break existing monthly checkout flow
- Bilingual

## Success Criteria
- Pricing page shows Monthly/Annual toggle
- Annual prices show savings badge
- Checkout accepts yearly period
- Build passes
