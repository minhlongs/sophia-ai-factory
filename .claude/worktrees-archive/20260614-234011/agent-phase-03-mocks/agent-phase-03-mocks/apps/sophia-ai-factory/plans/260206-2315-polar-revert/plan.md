---
title: "Revert Payment System to Polar.sh"
description: "Revert payment system from Lemon Squeezy to Polar.sh, including SDK replacement, configuration restoration, and webhook reimplementation."
status: completed
priority: P1
effort: 2h
branch: main
tags: [payment, polar, lemon-squeezy, revert]
created: 2026-02-06
---

## Context
We migrated to Lemon Squeezy under the assumption that Polar didn't support Vietnam. We have since confirmed that Polar DOES support Vietnam via Wise. We need to revert the changes to use Polar.sh again.

## Requirements
- Uninstall `@lemonsqueezy/lemonsqueezy.js`
- Install `@polar-sh/sdk` and `standardwebhooks`
- Recreate `src/lib/polar-config.ts` with correct pricing tiers
- Recreate `src/lib/polar.ts` client initialization
- Restore `src/app/api/webhooks/polar/route.ts`
- Update `src/components/pricing-section.tsx` to use Polar config
- Update `src/lib/services/real/payment-service.ts` to use Polar SDK
- Remove Lemon Squeezy files

## Phase 1: Dependency Management [Completed]
1. Uninstall Lemon Squeezy SDK
2. Install Polar SDK and webhook utilities

## Phase 2: Configuration & Initialization [Completed]
1. Create `src/lib/polar-config.ts`
   - Define products: Starter ($1,200), Growth ($2,000), Premium ($3,000)
   - Export product definitions and helper functions
2. Create `src/lib/polar.ts`
   - Initialize Polar client
   - Configure environment variables

## Phase 3: Core Implementation [Completed]
1. Update `src/lib/services/real/payment-service.ts`
   - Remove Lemon Squeezy logic
   - Implement `createCheckoutSession` using Polar SDK
   - Map products to Polar product IDs
2. Update `src/components/pricing-section.tsx`
   - Import config from `src/lib/polar-config.ts`
   - Update pricing card logic to match Polar structure

## Phase 4: Webhook Restoration [Completed]
1. Create `src/app/api/webhooks/polar/route.ts`
   - Verify webhook signature
   - Handle checkout/subscription events
   - Update database status

## Phase 5: Cleanup [Completed]
1. Remove `src/lib/lemonsqueezy*`
2. Remove `src/app/api/webhooks/lemonsqueezy`
3. Check for any other Lemon Squeezy references

## Verification [Completed]
1. `npm run build` passed successfully.
2. Verified `payment-service.ts` uses correct Polar SDK API (`products` array).

## Unresolved Questions
- Do we need to migrate any data from Lemon Squeezy back to Polar? (Assuming no, as this is a fresh setup/revert)
- Are the Polar Product IDs the same as before or do they need to be re-generated? (Will assume env vars need to be set/updated by user)
