# Customer Handover Execution

> **Mục đích / Purpose** Execute a complete customer handover — from checkout to first SOP run.

---

## Overview

Triggered when a customer completes their first purchase or uses a FREE100 promo code. The handover pipeline creates the user account, assigns the correct tier, pre-installs starter SOPs, creates a handover record, and sends a welcome email with a magic link.

| When | Trigger |
|------|---------|
| FREE100 promo used | Checkout route → `triggerAutoHandover` |
| Paid via NOWPayments | IPN handler → `triggerAutoHandover` |
| Paid via PayOS | IPN handler → `triggerAutoHandover` |

---

## Prerequisites

- Customer has signed up or has a user account
- Promo code validated (if applicable)
- Payment confirmed (if paid route)
- D1 database accessible

---

## Execution Steps

### 1. Validate Payment / Promo

| Path | Validator |
|------|-----------|
| FREE100 promo | `validatePromoCode(code)` → discount_type = `free_full` |
| NOWPayments | IPN webhook verified by HMAC signature |
| PayOS | Webhook verified by X-Callback-Signature |

### 2. Trigger Auto Handover

```typescript
import { triggerAutoHandover } from '@/tree/handover/auto-handover';

const result = await triggerAutoHandover({
  paymentId: `promo_FREE100_${userId}_${Date.now()}`,
  userId,
  email: customerEmail,
  fullName: customerName,
  tier: 'MASTER',  // or BASIC/PREMIUM/ENTERPRISE
  agencyType: 'solo_ceo',  // or b2b_saas/ecom/content_creator/service/other
  locale: 'vi',
  isFirstPurchase: true,
});
```

### 3. Verify Handover Result

| Field | Expected Value |
|-------|----------------|
| `handoverId` | UUID string (not null) |
| `isNewCustomer` | `true` (first purchase) or `false` (upgrade) |
| `magicLink` | Full URL or null (email-only mode) |
| `sopsInstalled` | Array of SOP slugs (count = TIER_SOP_COUNTS[tier]) |
| `skipped` | `false` |

### 4. Record Promo Redemption (if applicable)

```typescript
await incrementAndRecord({
  codeId: validation.codeId,
  promoCode: 'FREE100',
  userId,
  email: customerEmail,
  appliedToTier: 'MASTER',
  discountAppliedCents: 499900,  // full MASTER price
  trialDaysGranted: 0,
  handoverId: result.handoverId,
  status: 'redeemed',
});
```

### 5. Confirm in Admin Panel

Navigate to `/admin` → verify:
- Customer record exists with correct tier
- Handover record with status = `active`
- SOPs pre-installed count matches TIER_SOP_COUNTS
- Magic link sent (check welcome email sent timestamp)

---

## Idempotency

- Each `paymentId` is unique. Calling `triggerAutoHandover` twice with the same `paymentId` returns the existing handover (skip).
- Promo redemption uses `incrementAndRecord` — D1 batch ensures atomic increment + insert.

---

## Rollback

To undo a handover:
1. Update `customer_handovers.status` to `'churned'`
2. Revert tier: `UPDATE subscriptions SET tier='BASIC' WHERE user_id=?`
3. (Optional) Remove SOP assignments

---

## Cross-References

- `docs/operator-playbook/smoke-test-walkthrough.md` — end-to-end test guide
- `docs/operator-playbook/incident-playbook.md` — failure handling
- `.claude/rules/sophia-handover-rules.md` — protected flows (DO NOT BREAK)
