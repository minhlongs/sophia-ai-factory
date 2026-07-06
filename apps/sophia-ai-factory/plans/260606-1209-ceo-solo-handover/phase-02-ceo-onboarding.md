---
title: "Phase 2: CEO Onboarding Setup"
description: "FREE100 promo code, cash payment config, first customer record"
status: completed
priority: P1
effort: 3h
branch: master
tags: [onboarding, promo, payment, ceo]
created: 2026-06-06
---

# Phase 2: CEO Onboarding Setup

**Priority:** P1 — gates Phase 4
**Status:** pending
**Effort:** 3h

## Context Links
- Promo codes: `land/promo/`
- Tier config: `@/seed/config/tiers`
- Billing: `land/billing/`
- Handover: `tree/handover/`

## Requirements
1. FREE100 promo code: 100% discount on MASTER tier, single-use for CEO
2. Cash/offline payment: manual approval flow for first customer
3. First customer record: CEO account with MASTER tier, zero payment

## Implementation Steps

### Step 1: FREE100 Promo Code (30 min)
**File:** `land/promo/promo-codes.ts` (verify existing or add)

Add promo code entry:
- Code: `FREE100`
- Discount: 100%
- Tier: MASTER only
- Max uses: 1
- Expiry: 2026-12-31
- Eligible: CEO email (longtho)

Verify code exists in DB or config:
```bash
grep -rn "FREE100\|promo" apps/sophia-ai-factory/src/land/promo/
```

**Acceptance:** FREE100 applies 100% discount to MASTER tier in checkout

### Step 2: Cash Payment Config (45 min)
**Files to check:**
- `land/billing/payment-methods.ts`
- `land/payouts/`

Add "cash/offline" payment method:
- Status: MANUAL_APPROVAL
- No gateway integration (no NOWPayments/PayOS)
- Creates invoice with PENDING_MANUAL status
- Operator (Solo Company Media) marks as PAID manually

**Acceptance:** Admin can mark cash invoice as PAID; tier activates

### Step 3: First Customer Record (30 min)
Create CEO customer record via:
1. Signup flow: https://sophia.agencyos.network/signup
2. Apply FREE100 at checkout
3. Verify tier = MASTER in DB

Or direct DB insert (if needed):
```bash
# Verify tier assignment
grep -rn "MASTER\|tier" apps/sophia-ai-factory/src/seed/db/
```

**Acceptance:** CEO account shows MASTER tier, $0 billed, active

### Step 4: Operator Entity Config (45 min)
**File:** `tree/handover/operator-config.ts` (verify/create)

Record Solo Company Media as operator:
- Company name: Solo Company Media
- Contact: Long Tho
- Role: Platform operator
- Revenue share: 100% (sole operator)

**Acceptance:** Operator record in DB, visible in admin panel

## Success Criteria
- [ ] FREE100 code works: 100% off MASTER tier
- [ ] Cash payment method configurable in admin
- [ ] CEO account = MASTER tier, $0 billed
- [ ] Solo Company Media recorded as operator

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FREE100 not in promo system | Medium | High | Add to `land/promo/` if missing |
| Cash payment breaks tier activation | Low | Medium | Manual tier override as fallback |
| CEO email mismatch | Low | Low | Verify email in signup matches promo eligibility |

## Rollback
Disable promo code: set `active = false` in promo store. CEO tier: manual override via admin.
