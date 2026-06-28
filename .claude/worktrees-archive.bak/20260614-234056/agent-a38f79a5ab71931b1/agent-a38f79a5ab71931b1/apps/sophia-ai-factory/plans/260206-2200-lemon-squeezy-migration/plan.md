---
title: "Lemon Squeezy Migration Plan"
description: "Migration from Polar to Lemon Squeezy for payments to support Vietnam region"
status: completed
priority: P1
effort: 3h
branch: main
tags: [payment, migration, lemonsqueezy]
created: 2026-02-06
---

# 🍋 Lemon Squeezy Migration Plan

## Context
We are migrating from Polar to Lemon Squeezy to support payments in Vietnam. The current implementation uses Polar for one-time payments across 3 tiers (Starter, Growth, Premium). We will replace the entire payment flow while maintaining the existing tier structure and pricing display.

## Architecture Changes

### 1. Configuration (`lib/lemonsqueezy-config.ts`)
We will map internal Tiers (BASIC, PREMIUM, ENTERPRISE) to Lemon Squeezy Variant IDs via environment variables.

| Tier | Product Name | Price | Env Var |
|------|-------------|-------|---------|
| BASIC | Starter | $1,200 | `LEMONSQUEEZY_VARIANT_ID_BASIC` |
| PREMIUM | Growth | $2,000 | `LEMONSQUEEZY_VARIANT_ID_PREMIUM` |
| ENTERPRISE | Premium | $3,000 | `LEMONSQUEEZY_VARIANT_ID_ENTERPRISE` |

### 2. Payment Flow
- **Frontend**: `PricingSection` -> `POST /api/checkout`
- **Backend**: `RealPaymentService` -> Lemon Squeezy API -> Checkout URL
- **Webhook**: Lemon Squeezy -> `POST /api/webhooks/lemonsqueezy` -> Update User/Subscription

## Implementation Steps

### Phase 1: Setup & Configuration
1.  **Dependencies**
    - Uninstall `@polar-sh/nextjs`, `@polar-sh/sdk`, `standardwebhooks`
    - Install `@lemonsqueezy/lemonsqueezy.js`
2.  **Environment Variables**
    - Add `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`
    - Add Variant IDs for each tier
3.  **Config File**
    - Create `src/lib/lemonsqueezy-config.ts` replacing `polar-config.ts`

### Phase 2: Core Implementation
4.  **Client Library**
    - Create `src/lib/lemonsqueezy.ts` for SDK initialization and helper functions
5.  **Payment Service**
    - Update `src/lib/services/real/payment-service.ts` to implement `createCheckoutSession` using Lemon Squeezy
6.  **Webhook Handler**
    - Create `src/app/api/webhooks/lemonsqueezy/route.ts` to handle `order_created` events
    - Logic: Verify signature -> Extract user email -> Update database (via existing subscription logic if applicable, or direct DB update)

### Phase 3: UI & Cleanup
7.  **Pricing UI**
    - Update `src/components/pricing-section.tsx` to import from `lemonsqueezy-config`
8.  **Cleanup**
    - Remove `src/lib/polar.ts`, `src/lib/polar-config.ts`
    - Remove `src/app/api/polar/*`
    - Remove `src/app/api/webhooks/polar`

## Verification Plan

### Manual Verification
- [x] **Build Check**: `npm run build` passes with no type errors
- [ ] **Env Check**: All required env vars are present
- [ ] **Checkout Flow**: Clicking "Get Started" redirects to Lemon Squeezy checkout
- [ ] **Webhook Test**: Simulate a webhook event locally to verify processing

### Automated Tests
- [x] Update `src/lib/services/real/payment-service.test.ts` (if exists)
- [x] Add `src/app/api/webhooks/lemonsqueezy/route.test.ts`
- [x] **Regression Test**: All 153 tests passed (including `telegram-bot.test.ts`)

## Questions
- Do we need to migrate existing subscriptions/customers? (Assuming NO as these are one-time payments and we are "starting fresh" or existing users stay as is).
- Are we using Lemon Squeezy License Keys? (Assuming NO, just simple order verification).
