# Pricing Truth & Invariant Verification — Sophia AI Factory

**Date**: 2026-09-10  
**Status**: VERIFIED & UNIFIED  
**Canonical Source**: `src/seed/config/tiers/unified-limits.ts` (`UNIFIED_TIERS`)  

---

## Canonical Pricing Schedule

| Tier | Name | Monthly (USD) | Annual / Total (USD) | Cents (Canonical) | Billing Model |
|------|------|---------------|----------------------|-------------------|---------------|
| `BASIC` | Starter | $199 | $1,990/yr (~17% savings) | 19,900¢ | Monthly recurring |
| `PREMIUM` | Growth | $399 | $3,990/yr (~17% savings) | 39,900¢ | Monthly recurring |
| `ENTERPRISE` | Premium | $799 | $7,990/yr (~17% savings) | 79,900¢ | Monthly recurring |
| `MASTER` | Master | $4,999 | $4,999 (one-time) | 499,900¢ | Lifetime license |

---

## Audit Findings & Remediation

Prior to remediation, pricing definitions were fragmented across multiple disconnected files with diverging amounts:

1. **Admin Billing Summary MRR Query (`billing-summary-query.ts:62-65`)**:
   - **Prior State**: Hardcoded outdated dummy numbers: BASIC ($49), PREMIUM ($99), ENTERPRISE ($249), MASTER ($499).
   - **Root Cause**: Stale internal prototype constants left uncoordinated with production tier limits.
   - **Remediation**: Replaced hardcoded `TIER_PRICING` with direct derivation from `UNIFIED_TIERS[tier].priceInCents`.

2. **NOWPayments Client (`nowpayments-client.ts:54-59`)**:
   - **Prior State**: Duplicate hardcoded map `TIER_PRICE_CONFIG`.
   - **Remediation**: Derived directly from `UNIFIED_TIERS`:
     - `price`: `UNIFIED_TIERS[tier].price`
     - `yearlyPrice`: `UNIFIED_TIERS[tier].yearlyPrice`
     - `name`: `UNIFIED_TIERS[tier].name`

3. **PayOS Vietnam Gateway (`payos.ts:32-37`)**:
   - **Prior State**: Duplicate local object `TIER_USD_PRICES`.
   - **Remediation**: Derived directly from `UNIFIED_TIERS[tier].price`.

4. **Promo Applier (`promo-applier.ts:15-20`)**:
   - **Prior State**: Hardcoded cents map `TIER_PRICE_CENTS`.
   - **Remediation**: Derived directly from `UNIFIED_TIERS[tier].priceInCents`.

---

## Automated Invariant Test

Verified by automated vitest suite at `src/seed/config/tiers/__tests__/pricing-truth.test.ts`:
- Confirmed `UNIFIED_TIERS` canonical amounts for all 4 tiers.
- Confirmed `priceInCents === price * 100` identity across all tiers.
- Confirmed `TIER_CONFIGS` matches `UNIFIED_TIERS`.
- Confirmed `NOWPayments` client configuration matches `UNIFIED_TIERS`.
- Confirmed `PayOS` conversion calculation matches `UNIFIED_TIERS`.
- Confirmed Admin MRR calculation uses real canonical prices (sum of 4 tiers = 639,600¢ / $6,396 MRR).
