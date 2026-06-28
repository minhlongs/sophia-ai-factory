# Phase 3: Verify Checkout Flow

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 30 minutes

## Purpose

After fixing the payment bug (Phase 1), verify the full checkout flow works end-to-end.

## Prerequisites

- Phase 1 completed (payment bug fixed)
- Environment variables set:
  - `POLAR_PRODUCT_ID_STARTER`
  - `POLAR_PRODUCT_ID_GROWTH`
  - `POLAR_PRODUCT_ID_PREMIUM`
  - `POLAR_ACCESS_TOKEN`

## Test Cases

### Test 1: Basic Tier Checkout

1. [ ] Start dev server: `npm run dev`
2. [ ] Navigate to pricing section
3. [ ] Click "Get Started" on Basic tier
4. [ ] Verify: Redirects to Polar checkout page
5. [ ] Verify: Product shows "$1,200" (Starter)
6. [ ] Screenshot checkout page

### Test 2: Premium Tier Checkout

1. [ ] Click "Get Started" on Premium tier
2. [ ] Verify: Redirects to Polar checkout
3. [ ] Verify: Product shows "$2,000" (Growth)

### Test 3: Enterprise Tier Checkout

1. [ ] Click "Get Started" on Enterprise tier
2. [ ] Verify: Redirects to Polar checkout
3. [ ] Verify: Product shows "$3,000" (Premium)

### Test 4: Error Handling

1. [ ] Temporarily unset `POLAR_PRODUCT_ID_STARTER`
2. [ ] Click "Get Started" on Basic
3. [ ] Verify: Shows user-friendly error (not 500)
4. [ ] Restore env var

## Console Verification

During each test, check browser console for:
- [ ] No "Polar Product ID not found" errors
- [ ] No 500 errors on `/api/checkout`
- [ ] Clean redirect to Polar

## Network Tab Verification

1. [ ] POST `/api/checkout` returns 200
2. [ ] Response contains `{ url: "https://checkout.polar.sh/..." }`

## Success Criteria

- All 3 tiers redirect to correct Polar checkout
- No console errors
- Correct pricing displayed on Polar checkout page
- Screenshot proof of working checkout
