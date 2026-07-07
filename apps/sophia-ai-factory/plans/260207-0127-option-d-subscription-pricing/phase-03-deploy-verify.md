---
parent: ./plan.md
status: completed
priority: P1
effort: 25m
---

# Phase 3: Deploy & Verify

## Context
- [Parent Plan](./plan.md)
- [Phase 2](./phase-02-update-code.md) must complete first

## Overview

Deploy changes and verify checkout flow works end-to-end.

## Implementation Steps

1. Add env vars to Vercel
   ```bash
   vercel env add POLAR_PRODUCT_ID_STARTER_SUB
   vercel env add POLAR_PRODUCT_ID_GROWTH_SUB
   vercel env add POLAR_PRODUCT_ID_PREMIUM_SUB
   ```

2. Commit and push
   ```bash
   git add .
   git commit -m "feat(pricing): switch to all-in subscription model"
   git push origin main
   ```

3. Deploy to production
   ```bash
   vercel --prod --yes
   ```

4. Verify UI
   - Navigate to https://sophia.agencyos.network/pricing
   - Confirm 3 cards show: $199/mo, $399/mo, $799/mo
   - Confirm "12-month commitment" note visible

5. Test checkout
   - Click "Get Started" on Starter
   - Verify redirect to Polar
   - Confirm single subscription product in checkout
   - Verify price shows $199/month

## Todo

- [ ] Add env vars to Vercel
- [ ] Commit changes
- [ ] Deploy to production
- [ ] Verify pricing UI
- [ ] Test checkout flow
- [ ] Take screenshot as proof

## Success Criteria

- Production site shows new pricing
- Checkout redirects to Polar subscription
- Single product in checkout (not radio options)

## Rollback Plan

If issues occur:
```bash
git revert HEAD
git push origin main
vercel --prod --yes
```
