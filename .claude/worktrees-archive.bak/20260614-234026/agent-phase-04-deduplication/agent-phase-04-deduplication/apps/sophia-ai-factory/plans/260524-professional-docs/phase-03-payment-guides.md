# Phase 03: Payment & Billing Guides

**Priority:** HIGH | **Impact:** Reduce payment friction
**Status:** TODO

## Problem
- No dedicated payment guide pages
- Users don't know how to pay with USDT or VND bank transfer
- Annual plan savings not explained anywhere in guides
- FAQ mentions payments but no step-by-step guide

## Tasks

- [ ] 3.1 Create /guide/payments/usdt page — "Pay with USDT (Crypto)"
      - What is USDT (simple explanation for non-tech)
      - Step-by-step: Choose plan → Select crypto → Send USDT → Wait confirmation
      - Supported networks (ERC-20, TRC-20, etc.)
      - GuideCallout for common questions
      - Bilingual

- [ ] 3.2 Create /guide/payments/vnd page — "Pay with VND Bank Transfer"
      - PayOS flow: Choose plan → Select VND → Scan QR → Transfer → Auto-confirm
      - Supported banks
      - GuideCallout: "Only available for Vietnam users"
      - Bilingual

- [ ] 3.3 Create /guide/payments/plans page — "Plans & Pricing Guide"
      - 4 tiers comparison table (BASIC/PREMIUM/ENTERPRISE/MASTER)
      - Monthly vs Annual savings (17%)
      - What's included per tier
      - Upgrade/downgrade info
      - Bilingual

## Files to Create
- `src/app/[locale]/guide/payments/usdt/page.tsx`
- `src/app/[locale]/guide/payments/vnd/page.tsx`
- `src/app/[locale]/guide/payments/plans/page.tsx`

## Files to Modify
- `messages/en.json` — add guide.payments.* keys
- `messages/vi.json` — add corresponding VI keys

## Constraints
- Non-technical language (CEO audience)
- Bilingual
- Under 200 lines per page
- Reference UNIFIED_TIERS for accurate pricing (don't hardcode)

## Success Criteria
- 3 payment guide pages accessible
- All bilingual
- Build passes
