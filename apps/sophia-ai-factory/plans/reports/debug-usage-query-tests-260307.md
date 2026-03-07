# Debug Report: Usage Metering Query Tests

**Date:** 2026-03-07
**Issue:** 7 tests failing in `internal-usage-query.test.ts` with 500 errors
**Status:** RESOLVED - All 16 tests now pass

---

## Root Cause Analysis

### Problem 1: Broken Supabase Mock Chain

**Symptom:** Tests getting 500 errors because Supabase query mock didn't support fluent chaining

**Root Cause:** The mock for `createAdminClient().from().select()` didn't properly handle the query chain pattern used in route.ts:

```typescript
// Actual code in route.ts (line 378-386)
supabase
  .from('usage_events')
  .select('*')
  .eq('user_id', queryUserId!)
  .eq('license_nonce', queryLicenseNonce!)
  .gte('created_at', startTimestamp)
  .lte('created_at', endTimestamp);
```

The original mock expected: `eq → gte → lte → order → ascending`

But the actual code uses: `eq → eq → gte → lte → (await)`

**Fix:** Rewrote the mock to support fluent interface chaining where each method returns the mock query builder:

```typescript
const mockQueryBuilder = {
  eq: vi.fn(function(this: any, column: string, value: any) {
    if (column === 'nonce' || column === 'polar_customer_id' || column === 'stripe_customer_id') {
      return { single: vi.fn(() => Promise.resolve(mockSupabaseSingleResult || mockSupabaseData)) };
    }
    return mockQueryBuilder; // Allow chaining
  }),
  gte: vi.fn(function(this: any) { return mockQueryBuilder; }),
  lte: vi.fn(function(this: any) { return Promise.resolve(mockSupabaseQueryResult); }),
};
```

### Problem 2: Raw Format Early Return Bug

**Symptom:** Tests "returns summary format by default", "includes quota usage in response" failing with undefined values

**Root Cause:** Route logic bug at line 397:

```typescript
// BUGGY CODE
if (format === 'raw' || aggregate === 'none') {
  return NextResponse.json({ /* raw format without totals/quotaUsage */ });
}
```

Since `aggregate` defaults to `'none'` (line 243), this condition was ALWAYS true, causing the route to return raw format even when `format === 'summary'` (the default).

**Fix:** Removed the `|| aggregate === 'none'` condition:

```typescript
// FIXED CODE
if (format === 'raw') {
  return NextResponse.json({
    tenantId: queryUserId,
    licenseNonce: queryLicenseNonce!,
    period: { start: startTimestamp, end: endTimestamp },
    rawEvents: events || [],
    count: events?.length || 0,
    tier,
  });
}
```

---

## Changes Made

### File 1: `src/app/api/internal/usage/query/internal-usage-query.test.ts`

1. Added `mockSupabaseQueryResult` variable for controlling query results
2. Rewrote Supabase mock to support fluent chaining with proper method returning
3. Added `mockSupabaseQueryResult` reset in `beforeEach` for Successful Queries tests

### File 2: `src/app/api/internal/usage/query/route.ts`

**Line 397:** Changed condition from:
```typescript
if (format === 'raw' || aggregate === 'none') {
```

To:
```typescript
if (format === 'raw') {
```

---

## Test Results

**Before Fix:**
- 11 tests passed
- 5 tests failed (all 500 errors)

**After Fix:**
- 16 tests passed
- 0 tests failed

### All Passing Tests:
- Access control tests (3): Unauthorized rejection, invalid secret, missing secret
- Query validation tests (6): Missing params, invalid timestamps, date range validation
- License lookup tests (2): Non-existent license/customer 404s
- Successful query tests (5): Summary format, raw format, default billing period, quota usage, tier info

---

## Unresolved Questions

None - all issues resolved.
