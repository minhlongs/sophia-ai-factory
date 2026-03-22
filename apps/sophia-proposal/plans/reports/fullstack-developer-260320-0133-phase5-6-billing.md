# Phase 5+6 Implementation Report — MCU Tracking + Billing UI

**Date:** 2026-03-20
**Sprint:** Sprint 3 — Polar Billing Integration
**Phases:** Phase 5 (MCU Tracking) + Phase 6 (Billing Dashboard UI)

---

## Files Created

### Phase 5: MCU Tracking System (lib/billing/)

| File | Lines | Purpose |
|------|-------|---------|
| `usage-tracker.ts` | 168 | Log usage events, deduct MCU atomically, get usage history/summary |
| `balance-checker.ts` | 112 | Check balance, HTTP 402 response, initialize balance, add bonus MCU |

### Phase 6: Billing Dashboard UI

#### Components (components/billing/)
| File | Lines | Purpose |
|------|-------|---------|
| `plan-card.tsx` | 52 | Pricing tier card with upgrade button |
| `billing-status.tsx` | 71 | Subscription status, MCU balance display |
| `usage-chart.tsx` | 44 | 30-day usage visualization |
| `upgrade-button.tsx` | 47 | Reusable upgrade CTA button |

#### Pages (app/(dashboard)/)
| File | Lines | Purpose |
|------|-------|---------|
| `billing/page.tsx` | 44 | Billing overview dashboard |
| `billing/upgrade/page.tsx` | 44 | Plan selection UI |
| `billing/success/page.tsx` | 88 | Post-checkout success page |
| `usage/page.tsx` | 87 | Usage history table with pagination |

#### API Routes
| File | Lines | Purpose |
|------|-------|---------|
| `api/usage/route.ts` | 56 | GET usage history and summary |

### Modified Files

| File | Change |
|------|--------|
| `middleware.ts` | Added MCU balance check for billable routes |
| `api/proposals/generate/route.ts` | Integrated usage tracking, balance check, MCU deduction |

---

## Tasks Completed

### Phase 5 — MCU Tracking
- [x] Created `lib/billing/usage-tracker.ts` with:
  - [x] `logUsage()` — Atomic MCU deduction via `deduct_mcu_balance` RPC
  - [x] `getUsageHistory()` — Paginated usage logs
  - [x] `getUsageSummary()` — Aggregated by feature and daily
- [x] Created `lib/billing/balance-checker.ts` with:
  - [x] `checkBalance()` — Get org balance status
  - [x] `requireBalance()` — Return HTTP 402 if zero balance
  - [x] `getOrInitializeBalance()` — Create balance record if missing
  - [x] `addBonusMcu()` — Credit MCU for promotions
- [x] Updated `middleware.ts` with balance checking logic
- [x] Integrated into `api/proposals/generate/route.ts`

### Phase 6 — Billing UI
- [x] Created `PlanCard` component
- [x] Created `BillingStatus` component
- [x] Created `UsageChart` component
- [x] Created `UpgradeButton` component
- [x] Created `/billing` page — dashboard overview
- [x] Created `/billing/upgrade` page — plan selection
- [x] Created `/billing/success` page — post-checkout
- [x] Created `/usage` page — usage history table
- [x] Created `/api/usage` API route

---

## Type Check Status

```bash
npm run type-check
> tsc --noEmit
✅ 0 errors
```

---

## Architecture Notes

### MCU Flow
```
User Action → API Route → Balance Check (402 if zero)
              ↓
         Execute Feature (e.g., generate proposal)
              ↓
         logUsage() → deduct_mcu_balance() RPC
              ↓
         Return mcuUsed, remainingBalance
```

### Database Dependencies
Requires Phase 1 database schema:
- `subscriptions` table
- `usage_logs` table
- `org_balances` table
- `deduct_mcu_balance()` RPC function
- `credit_mcu_balance()` RPC function

### HTTP 402 Handling
```typescript
if (!balance.hasSufficientBalance) {
  return NextResponse.json({
    error: 'Insufficient MCU balance',
    code: 'INSUFFICIENT_BALANCE',
    rechargeUrl: '/billing/upgrade'
  }, { status: 402 });
}
```

---

## Unresolved Questions

1. **Auth header propagation**: Middleware checks for `x-org-id` header — need to ensure this is set by auth layer or Supabase client
2. **Database RPC functions**: `deduct_mcu_balance()` and `credit_mcu_balance()` must be deployed to Supabase (Phase 1)
3. **NextAuth integration**: Removed next-auth dependency from usage route; may need re-add if using next-auth for sessions

---

## Next Steps (Blocked Phases)

- **Phase 7 (Pilot Onboarding)** — Can now proceed:
  - Add welcome modal with MCU balance explanation
  - Create first-proposal walkthrough
  - Add bonus MCU for new signups

---

## Summary

**Status:** ✅ COMPLETED
**Type Check:** ✅ PASS
**Files Created:** 11
**Files Modified:** 2
**Total Lines:** ~870
