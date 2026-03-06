# Phase 4: License-to-Customer Linkage Implementation

**Date:** 2026-03-07
**Status:** ✅ COMPLETED
**Effort:** 2 hours (actual: 1.5 hours)

---

## Overview

Implemented customer linkage for Polar.sh webhooks to match Stripe's implementation, enabling billing reconciliation across both payment providers.

---

## Changes Summary

### 1. Database Schema Updates

**File:** `supabase/migrations/20260307-usage-metering-schema-updates.sql`

**Added to `user_profiles` table:**
- `polar_customer_id TEXT` - For webhook lookups by Polar customer ID
- `stripe_customer_id TEXT` - Already present from Stripe integration (confirmed)

**Added indexes:**
```sql
CREATE INDEX idx_user_profiles_polar_customer
  ON user_profiles(polar_customer_id)
  WHERE polar_customer_id IS NOT NULL;

CREATE INDEX idx_user_profiles_stripe_customer
  ON user_profiles(stripe_customer_id)
  WHERE polar_customer_id IS NOT NULL;
```

---

### 2. Polar Webhook Handler Updates

**File:** `src/lib/payments/polar-webhook-handler.ts`

#### Changes:

1. **Updated `generateLicenseOnPayment()` function:**
   - Added `polarCustomerId?: string` parameter
   - Stores `polarCustomerId` in license metadata

2. **Updated `handleCheckoutSuccess()`:**
   - Extracts `polarCustomerId` from `data.customer.id`
   - Passes `polarCustomerId` to license generation
   - Updates `user_profiles.polar_customer_id` on checkout

3. **Updated `handleSubscriptionCreated()`:**
   - Extracts `polarCustomerId` from event data
   - Passes to `activateSubscription()` with customer ID
   - Logs `polarCustomerId` for debugging

4. **Updated `handleOrderCreated()`:**
   - Extracts `polarCustomerId` from event data
   - Stores in license metadata and user profile

---

### 3. Polar Subscription Service Updates

**File:** `src/lib/payments/polar-subscription-service.ts`

#### Changes:

1. **Updated `activateSubscription()` signature:**
```typescript
export async function activateSubscription(
  userId: string,
  polarSubId: string,
  tier: Tier,
  periodEnd: string | null,
  polarCustomerId?: string | null  // NEW parameter
): Promise<void>
```

2. **Added `findUserByPolarCustomerId()` helper:**
```typescript
export async function findUserByPolarCustomerId(
  polarCustomerId: string
): Promise<string | null>
```

---

### 4. Usage Export Updates

**File:** `src/lib/usage-metering/aggregator.ts`

#### Changes:

**Updated `generateCsvRows()` function:**
- Added `external_customer_id?: string | null` to event type
- Includes `external_customer_id` in CSV export rows

**Result:** CSV exports now include customer linkage for billing reconciliation.

---

## Customer Linkage Flow

### Polar.sh Flow:
```
Polar Webhook
    ↓
Extract polar_customer_id from event.data.customer.id
    ↓
Store in user_profiles.polar_customer_id
    ↓
Store in raas_licenses.metadata.polarCustomerId
    ↓
Usage events → external_customer_id (via tracker)
    ↓
CSV Export → external_customer_id column
```

### Stripe Flow (Already Working):
```
Stripe Webhook
    ↓
Extract stripe_customer_id from event.data.customer
    ↓
Store in user_profiles.stripe_customer_id
    ↓
Store in raas_licenses.metadata.stripeCustomerId
    ↓
Usage events → external_customer_id (via tracker)
    ↓
CSV Export → external_customer_id column
```

---

## Testing Checklist

- [ ] Execute migration on Supabase dev environment
- [ ] Verify `user_profiles.polar_customer_id` column exists
- [ ] Test Polar webhook → customer ID stored correctly
- [ ] Test usage export includes `external_customer_id`
- [ ] Verify reconciliation endpoint returns customer data

---

## Files Changed

| File | Type | Lines Changed |
|------|------|---------------|
| `supabase/migrations/20260307-usage-metering-schema-updates.sql` | UPDATED | +20 |
| `src/lib/payments/polar-webhook-handler.ts` | UPDATED | +40 |
| `src/lib/payments/polar-subscription-service.ts` | UPDATED | +25 |
| `src/lib/usage-metering/aggregator.ts` | UPDATED | +5 |

**Total:** 4 files, ~90 lines added

---

## Migration Required

Execute on Supabase (dev first, then prod):

```bash
# Run migration
psql "$(npx supabase db url)" -f supabase/migrations/20260307-usage-metering-schema-updates.sql

# Verify user_profiles columns
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name IN ('polar_customer_id', 'stripe_customer_id');"

# Verify indexes
psql -c "SELECT indexname FROM pg_indexes WHERE tablename = 'user_profiles' AND indexname LIKE 'idx_user_profiles%customer%';"
```

---

## API Impact

### No Breaking Changes

- All existing APIs remain unchanged
- Customer linkage is backward compatible
- Exports optionally include `external_customer_id` (nullable)

### New Capabilities

1. **Query usage by customer ID:**
   ```typescript
   // Via reconciliation endpoint
   GET /api/admin/usage/reconciliation?customer_id=polar_cust_123
   ```

2. **Export with customer data:**
   ```typescript
   // CSV now includes external_customer_id column
   GET /api/usage/export?format=csv&start=...&end=...
   ```

---

## Next Steps

1. **Phase 6 (Verification):**
   - Execute database migration
   - Test Polar webhook with real customer data
   - Verify customer ID appears in usage exports

2. **Future Enhancement (Phase 10+):**
   - Add customer ID to debug endpoint responses
   - Add customer ID filtering to `/api/usage/debug`

---

## Unresolved Questions

None - Phase 4 is complete and ready for verification.

---

**Report Location:** `plans/reports/phase-4-customer-linkage-260307.md`
