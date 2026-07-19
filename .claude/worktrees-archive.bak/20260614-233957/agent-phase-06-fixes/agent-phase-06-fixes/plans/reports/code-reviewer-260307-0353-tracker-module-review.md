# Code Review: Usage Metering Tracker Module

**File Reviewed:** `/apps/sophia-ai-factory/apps/sophia-ai-factory/src/lib/usage-metering/tracker.ts`

**Lines Analyzed:** 221

**Date:** 2026-03-07

---

## Overall Assessment

Tracker module is **well-structured** with solid idempotency foundation. Key findings:

- **Type Safety:** 2 `as any` casts need proper typing
- **Phase 2 Integration:** No direct RaaS license validation coupling (correct design)
- **Phase 3 Integration:** `externalCustomerId` tracked but NOT populated from payment webhooks
- **Error Handling:** Good fail-open patterns, consistent try-catch
- **YAGNI/KISS:** Clean, no unnecessary complexity
- **Idempotency:** Correct implementation with DB-level uniqueness

---

## Critical Issues (Must Fix)

### 1. Missing `externalCustomerId` Population [HIGH]

**Problem:** `externalCustomerId` is tracked in `UsageEventInput` and stored in DB, but **never populated** from Polar/Stripe webhook data.

**Current Flow:**
```typescript
// tracker.ts line 70
external_customer_id: event.externalCustomerId ?? null,  // Always null!
```

**Expected Flow:**
- Polar webhook (`polar-webhook-handler.ts`) stores `polarCustomerId` in license metadata
- Tracker should resolve `externalCustomerId` from license nonce

**Impact:** Cannot reconcile usage with Stripe/Polar subscriptions for billing.

**Fix:**
```typescript
// In trackUsage(), resolve externalCustomerId from license:
async function resolveExternalCustomerId(licenseNonce: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('raas_licenses')
    .select('metadata->>polarCustomerId, metadata->>stripeCustomerId')
    .eq('nonce', licenseNonce)
    .single();

  return data?.metadata?.polarCustomerId || data?.metadata?.stripeCustomerId || null;
}
```

---

### 2. Type Safety: `as any` Usage [MEDIUM]

**Locations:**
- Line 33: `(data as any).id` in `checkIdempotencyKey()`
- Line 77: `dbEvent as any` in `insertUsageEvent()`

**Better Approach:**
```typescript
// Line 33 - Use typed response
interface IdempotencyCheckResult {
  id: string;
}

const { data, error } = await supabase
  .from('usage_events')
  .select('id')
  .eq('idempotency_key', idempotencyKey)
  .returns<IdempotencyCheckResult>()
  .single();

return data?.id ?? null;

// Line 77 - Use Omit for DB insert type
type UsageEventInsert = Omit<UsageEventDB, 'id'>;

const { data, error } = await supabase
  .from('usage_events')
  .insert(dbEvent satisfies UsageEventInsert)
  .select('id')
  .single();
```

---

## Suggestions (Nice to Have)

### 3. License Key Validation Integration [ARCHITECTURE]

**Current Design:** Tracker receives pre-validated `licenseKeyHash` and `licenseNonce`.

**Assessment:** **CORRECT** - separation of concerns. RaaS validation happens at API gateway (`raas-gate.ts`), tracker only needs nonce for quota checks.

**No changes needed** - current design follows single responsibility principle.

---

### 4. Idempotency Key Generation [EDGE CASE]

**Current Logic:**
```typescript
// tracker.ts line 106-113
const idempotencyKey = event.idempotencyKey || generateIdempotencyKey({
  requestId: event.requestId,
  userId: event.userId,
  licenseNonce: event.licenseNonce,
  service: event.service,
  action: event.action,
  timestamp: event.createdAt ?? Date.now(),
});
```

**Issue:** Timestamp rounded to seconds creates collision risk for rapid parallel requests.

**Recommendation:**
```typescript
// Use millisecond precision + random suffix
const hash = createHash('sha256')
  .update(`${userId}:${licenseNonce}:${service}:${action}:${Math.floor(timestamp / 100)}:${randomBytes(4).toString('hex')}`)
  .digest('hex');
```

---

### 5. Error Handling Pattern [CONSISTENCY]

**Current:** Returns `{ success: false, error: '...' }` instead of throwing.

**Assessment:** **GOOD** - allows batch processing to continue.

**Minor Improvement:** Add error codes for programmatic handling:
```typescript
export interface IngestionResult {
  success: boolean;
  error?: string;
  errorCode?: 'DUPLICATE' | 'INVALID_LICENSE' | 'QUOTA_EXCEEDED' | 'VALIDATION_ERROR' | 'DATABASE_ERROR';
}
```

---

### 6. Quota Cache in Batch Ingest [PERFORMANCE]

**Location:** `aggregator.ts` lines 590-592, 632-643

**Current:** In-memory `Map` cache during batch processing.

**Assessment:** **GOOD** - avoids redundant DB queries for same license.

**Enhancement:** Add cache invalidation after batch completes to prevent memory leaks.

---

## Integration Analysis

### Phase 2: RaaS License Validation

| Component | Status | Notes |
|-----------|--------|-------|
| `raas-gate.ts` | Validated | API gateway validates HMAC, nonce, expiration |
| `tracker.ts` | Receives pre-validated hash | Correct - no re-validation needed |
| License hash | SHA256 | Consistent with `raas-key-generator.ts` |

**Verdict:** **CORRECT** - tracker trusts gateway validation.

---

### Phase 3: Stripe/Polar Integration

| Component | Status | Gap |
|-----------|--------|-----|
| Polar webhook | Stores `polarCustomerId` | In `raas_licenses.metadata` |
| Stripe webhook | Stores `stripeCustomerId` | In `raas_licenses.metadata` |
| Tracker | `externalCustomerId` field exists | **NOT populated** from license metadata |
| Internal API | Uses `externalCustomerId` for queries | `api/internal/usage/query/route.ts` lines 310-342 |

**Verdict:** **GAP** - `externalCustomerId` is always `null` in usage events.

---

## Idempotency Review

### Current Implementation

```typescript
// 1. Check if key exists
const existingId = await checkIdempotencyKey(idempotencyKey);
if (existingId) {
  return { success: false, reason: 'duplicate', existingRecordId: existingId };
}

// 2. Insert with unique constraint
const { data, error } = await supabase
  .from('usage_events')
  .insert(dbEvent)
  .select('id')
  .single();

// 3. Handle unique constraint violation
if (error?.code === '23505') {
  throw new Error('Duplicate idempotency key');
}
```

**Assessment:** **CORRECT** - double protection with application check + DB constraint.

**Database Schema Required:**
```sql
ALTER TABLE usage_events
  ADD CONSTRAINT usage_events_idempotency_key_unique
  UNIQUE (idempotency_key);
```

---

## Metrics

| Category | Score | Notes |
|----------|-------|-------|
| Type Safety | 8/10 | 2 `as any` casts |
| Error Handling | 9/10 | Consistent, fail-open |
| Idempotency | 10/10 | Correct double protection |
| YAGNI/KISS | 9/10 | No unnecessary complexity |
| DRY | 8/10 | Some repetition in quota checks |
| Phase 2 Integration | 10/10 | Correct separation |
| Phase 3 Integration | 5/10 | `externalCustomerId` gap |

**Overall: 8.4/10**

---

## Recommended Actions

1. **[CRITICAL]** Fix `externalCustomerId` population from license metadata
2. **[HIGH]** Replace `as any` with proper types
3. **[MEDIUM]** Add error codes to `IngestionResult`
4. **[LOW]** Improve idempotency key collision resistance
5. **[LOW]** Document database schema requirements

---

## Unresolved Questions

1. Should `externalCustomerId` be populated at track time or via separate migration job?
2. Is DB unique constraint on `idempotency_key` already in migration file?
3. Should batch ingest cache have TTL or explicit cleanup?

---

## Files Modified

- `apps/sophia-ai-factory/apps/sophia-ai-factory/src/lib/usage-metering/tracker.ts`

## Related Files

- `apps/sophia-ai-factory/apps/sophia-ai-factory/src/lib/usage-metering/types.ts`
- `apps/sophia-ai-factory/apps/sophia-ai-factory/src/lib/usage-metering/idempotency.ts`
- `apps/sophia-ai-factory/apps/sophia-ai-factory/src/lib/usage-metering/aggregator.ts`
- `apps/sophia-ai-factory/apps/sophia-ai-factory/src/lib/payments/polar-webhook-handler.ts`
- `apps/sophia-ai-factory/apps/sophia-ai-factory/src/lib/payments/stripe-webhook-handler.ts`
