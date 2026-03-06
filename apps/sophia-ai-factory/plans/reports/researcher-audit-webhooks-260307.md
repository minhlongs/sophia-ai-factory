# Webhook Handlers Audit Report

**Date:** 2026-03-07
**Project:** Sophia AI Factory
**Scope:** Polar vs Stripe webhook handlers, customer/license linkage

---

## 1. Webhook Handler Files Found

### Polar Webhooks
| File | Purpose |
|------|---------|
| `src/lib/payments/polar-webhook-handler.ts` | Core handler (834 lines) |
| `src/app/api/webhooks/polar/route.ts` | API route + signature verification |
| `src/lib/payments/polar-types.ts` | TypeScript types |
| `src/lib/payments/polar-webhook-verify.ts` | Signature verification utility |
| `src/lib/payments/polar-subscription-service.ts` | Subscription CRUD operations |

### Stripe Webhooks
| File | Purpose |
|------|---------|
| `src/lib/payments/stripe-webhook-handler.ts` | Core handler (764 lines) |
| `src/app/api/webhooks/stripe/route.ts` | API route + signature verification |
| `src/lib/payments/stripe-types.ts` | TypeScript types |
| `src/lib/payments/stripe-webhook-verify.ts` | Signature verification utility |

---

## 2. Implementation Status

### Polar Webhook Handler
**Status:** PARTIALLY IMPLEMENTED

| Feature | Status | Details |
|---------|--------|---------|
| Customer ID storage | ❌ MISSING | No `polar_customer_id` field used anywhere |
| License linkage | ⚠️ PARTIAL | Links via `polar_subscription_id` in metadata only |
| User profile update | ✅ DONE | Updates `user_profiles.polar_subscription_id` |
| Usage metering | ✅ DONE | Integrates with `raas_licenses` |

**Key finding:** Polar webhooks update `user_profiles.polar_subscription_id` but **DO NOT** store `polar_customer_id` anywhere. License linkage uses `metadata->>polarSubscriptionId` query only.

### Stripe Webhook Handler
**Status:** PARTIALLY IMPLEMENTED

| Feature | Status | Details |
|---------|--------|---------|
| Customer ID storage | ✅ DONE | Stores `stripe_customer_id` in `user_profiles` |
| License linkage | ✅ DONE | Stores `stripe_customer_id` in `raas_licenses.metadata` |
| User profile update | ✅ DONE | Updates `user_profiles stripe_customer_id, stripe_subscription_id` |
| Usage metering | ✅ DONE | Integrates with `raas_licenses` |

**Key finding:** Stripe properly stores `stripe_customer_id` in both `user_profiles` and license metadata.

---

## 3. Database Schema

### user_profiles Table
```typescript
// Current schema (src/lib/supabase/types.ts)
interface UserProfileRow {
  user_id: string
  polar_subscription_id: string | null          // ✅ EXISTS
  // MISSING: polar_customer_id: string | null
  stripe_customer_id: string | null              // ✅ USED (from types)
  stripe_subscription_id: string | null          // ✅ USED (from types)
}
```

### raas_licenses Table
```typescript
// Schema (src/lib/raas-schema.ts)
interface RaasLicense {
  id: string
  key_hash: string
  tier: LicenseTier
  expires_at: number | null
  nonce: string
  is_revoked: boolean
  metadata: Json  // ← Customer IDs stored here
  // MISSING: polar_customer_id, stripe_customer_id columns
}
```

**Current storage pattern:**
- Polar: `metadata.polarSubscriptionId`
- Stripe: `metadata.stripeCustomerId, metadata.stripeSubscriptionId`

---

## 4. Data Flow Analysis

### Polar Flow
```
Polar Webhook
    ↓
extractMetadata() → gets userId, tier from event.metadata
    ↓
generateLicenseOnPayment() → stores in raas_licenses.metadata:
    - customerEmail
    - polarSubscriptionId  ← ONLY subscription ID
    - source
    ↓
Update user_profiles SET polar_subscription_id = ...
```

**Gap:** No `polar_customer_id` stored anywhere.

### Stripe Flow
```
Stripe Webhook
    ↓
extractMetadata() → gets userId, tier, stripeCustomerId, stripeSubscriptionId
    ↓
generateLicenseOnPayment() → stores in raas_licenses.metadata:
    - customerEmail
    - stripeSubscriptionId
    - stripeCustomerId  ← Both IDs stored
    - source
    ↓
Update user_profiles SET stripe_customer_id = ..., stripe_subscription_id = ...
```

**Status:** Both customer and subscription IDs stored.

---

## 5. Gaps Identified for Phase 4

### Critical Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| 1. No `polar_customer_id` field | Cannot link Polar customers to licenses | HIGH |
| 2. License query filters only by subscription ID | Cannot query by customer ID | MEDIUM |
| 3. Inconsistent schema between Polar/Stripe | Metadata-only for Polar vs columns for Stripe | MEDIUM |
| 4. No reconciliation endpoint for Polar customer linkage | Cannot fix historical data | HIGH |

### Code Pattern Mismatch

**Stripe (columns):**
```typescript
await supabase.from('user_profiles').update({
  stripe_customer_id: customerId,      // Column field
  stripe_subscription_id: subId
})
```

**Polar (metadata only):**
```typescript
await createLicense({
  metadata: {
    polarSubscriptionId: subId         // Only in JSON
  }
})
// No polar_customer_id stored anywhere
```

---

## 6. Recommended Approach

### Option A: Minimal Patch (Recommended for Phase 4)

Add `polar_customer_id` field to match Stripe pattern:

1. **Database Migration:**
   ```sql
   ALTER TABLE user_profiles ADD COLUMN polar_customer_id TEXT;
   ```

2. **Update Types:**
   ```typescript
   // src/lib/supabase/types.ts
   interface UserProfileRow {
     polar_subscription_id: string | null
     polar_customer_id: string | null  // ADD
   }
   ```

3. **Update Webhook Handler:**
   ```typescript
   // Extract customer ID from event
   const polarCustomerId = safeString(data.customer?.id)

   // Store in both places
   await supabase.from('user_profiles').update({
     polar_customer_id: polarCustomerId,    // NEW
     polar_subscription_id: polarSubId
   })

   await createLicense({
     metadata: {
       polarCustomerId,      // NEW
       polarSubscriptionId,
     }
   })
   ```

### Option B: Schema Modernization (Long-term)

Move to unified customer field:
```sql
ALTER TABLE raas_licenses ADD COLUMN billing_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN billing_customer_id TEXT;
```

This would support both Polar and Stripe with a single field.

---

## 7. Testing Recommendations

To verify customer linkage:

```typescript
// Test: Find licenses by customer ID
const query =
  .from('raas_licenses')
  .select('*')
  .or(`metadata->>polarCustomerId.eq.${customerId},metadata->>stripeCustomerId.eq.${customerId}`)

// Test: Reconciliation report
const licenses = await supabase
  .from('raas_licenses')
  .select('nonce, metadata->>polarCustomerId, metadata->>stripeCustomerId')
```

---

## 8. Unresolved Questions

1. **Where is `polar_customer_id` extracted from Polar events?**
   Polar webhooks include `data.customer.id` field - is this being captured?

2. **Should Stripe also use metadata-only pattern for consistency?**
   Current Stripe uses columns + metadata. Which should be source of truth?

3. **Need billing period linkage?**
   For invoice-level billing (usage-based), need `billing_period_id` field?

4. **How to handle multiple subscriptions per customer?**
   Enterprise customers may have multiple plans - how to track?

---

**Report generated:** 2026-03-07
**Auditor:** researcher agent
**Related tasks:** #8 (audit), #9 (Polar linkage), #11 (Stripe linkage)
