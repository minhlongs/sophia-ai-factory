---
title: "Option D - All-In Subscription Pricing"
description: "Switch from bundle (one-time + monthly) to single monthly subscription model"
status: completed
priority: P1
effort: 1.5h
branch: main
tags: [payment, pricing, polar, subscription]
created: 2026-02-07
---

# Option D: All-In Subscription Pricing

## Overview

Replace current bundle pricing (one-time + monthly) with simple monthly subscriptions:

| Tier | Current | New |
|------|---------|-----|
| Starter | $1,200 + $99/mo | **$199/mo** |
| Growth | $2,000 + $199/mo | **$399/mo** |
| Premium | $3,000 + $499/mo | **$799/mo** |

**Commitment**: 12-month minimum (displayed in UI, enforced via Polar subscription settings)

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Create Polar Products](./phase-01-create-polar-products.md) | pending | 20m |
| 2 | [Update Code](./phase-02-update-code.md) | pending | 45m |
| 3 | [Deploy & Verify](./phase-03-deploy-verify.md) | pending | 25m |

## Files to Modify

- `src/lib/polar-config.ts` - Simplify to subscription-only products
- `src/components/pricing-section.tsx` - Update UI for monthly pricing
- `src/app/api/checkout/route.ts` - Simplify to single productId
- `src/lib/services/types.ts` - Revert to single productId
- `src/lib/services/real/payment-service.ts` - Revert to single product
- Vercel env vars - Add new subscription product IDs

## Success Criteria

- [ ] 3 subscription products created in Polar Dashboard
- [ ] Pricing UI shows $X/month with 12-month commitment note
- [ ] Checkout redirects to Polar with single subscription
- [ ] Production verified working

## Dependencies

- Polar Dashboard access
- Vercel environment variable access
