# Phase 02: PayOS Activation for VN Fiat Payments

**Priority:** HIGH | **Impact:** +30-50% VN checkout completion
**Status:** TODO

## Problem
- NOWPayments crypto-only excludes VN users uncomfortable with USDT
- PayOS code already exists (`src/land/payments/payos.ts`) but flag-gated
- No VND pricing shown on checkout
- Vietnamese users are primary market but forced into crypto flow

## Tasks

- [ ] 2.1 Audit existing PayOS integration (`src/land/payments/payos.ts`)
- [ ] 2.2 Enable FEATURE_PAYOS flag in production wrangler.toml
- [ ] 2.3 Add payment method selector on checkout: "Pay with Crypto (USDT)" | "Pay with Bank Transfer (VND)"
- [ ] 2.4 Add VND price display alongside USD on pricing page
- [ ] 2.5 Wire PayOS webhook handler (if not already)
- [ ] 2.6 Test full PayOS checkout flow end-to-end

## Files to Read/Modify
- `src/land/payments/payos.ts` — existing integration
- `src/land/checkout/checkout-validators.ts` — payment method validation
- `src/app/api/checkout/route.ts` — add PayOS path
- `wrangler.toml` — FEATURE_PAYOS env var
- `src/forest/components/pricing/pricing-card.tsx` — dual currency display

## Success Criteria
- PayOS checkout completes for BASIC tier in VND
- Pricing page shows both USD and VND
- IPN webhook activates tier correctly
- NOWPayments remains default, PayOS is alternative
