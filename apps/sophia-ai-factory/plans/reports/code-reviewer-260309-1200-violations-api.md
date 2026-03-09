# Code Review Report: Violations API Endpoint

**Date:** 2026-03-09
**Reviewer:** code-reviewer
**Scope:** `/api/violations` endpoint implementation
**Files Reviewed:** 5 files, ~750 lines analyzed

---

## Overall Assessment

**Score: 7.5/10** - Solid implementation with good security foundations, but has type safety issues and some architectural concerns.

### Summary

| Category | Score | Status |
|----------|-------|--------|
| Security | 8/10 | Good |
| Type Safety | 5/10 | Needs Work |
| Code Quality | 7/10 | Good |
| Functionality | 9/10 | Excellent |
| Database Design | 8/10 | Good |

---

## Critical Issues

### 1. Type Safety Violations (HIGH PRIORITY)

**Location:** `src/lib/analytics/queries.ts`

**Issue:** Multiple `any` types violate Binh Pháp Front 2 (Type Safety 100%)

```typescript
// Lines 56, 222, 235, 258, 278, 343, 465, 477, 548, 558, 559, 596, 597
const { data: events, error } = await query as any;
const metadata = license.metadata as any;
const amount = (event.payload as any)?.amount?.usd?.amount || 0;
```

**Impact:** Loss of type checking, potential runtime errors, violates project standards.

**Fix Required:** Define proper interfaces for Supabase query results:

```typescript
// Add to src/lib/analytics/types.ts
interface SupabaseViolationRow {
  id: string;
  type: ViolationType;
  severity: ViolationSeverity;
  user_id: string;
  license_nonce: string;
  tier: string;
  endpoint: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, string> | null;
  created_at: number;
  resolved: boolean;
  resolved_at: number | null;
}

// Then use in queries.ts
const { data: events, error } = await query as unknown as { data: SupabaseViolationRow[]; error: Error | null };
```

---

## Major Issues

### 2. Incomplete Rate Limiting Coverage

**Location:** `src/app/api/violations/route.ts` (lines 66-80)

**Issue:** Rate limiting only applied to API key authentication, NOT JWT authentication.

```typescript
if (jwtResult.valid && jwtResult.payload) {
  // No rate limiting for JWT users!
  userId = jwtResult.payload.sub;
  ...
} else {
  // API key users get rate limited
  const rateLimitResult = await checkRateLimit(...);
  if (!rateLimitResult.allowed) { ... }
}
```

**Security Risk:** JWT-authenticated users can bypass rate limits entirely.

**Fix:** Apply rate limiting to both authentication methods:

```typescript
// After authentication (line 82)
const rateLimitIdentifier = apiKeyId || userId;
const rateLimitPerMinute = apiKeyResult?.apiKey?.rateLimitPerMinute ??
                           (userTier === 'MASTER' ? 1000 : 100);

const rateLimitResult = await checkRateLimit(rateLimitIdentifier, rateLimitPerMinute);
if (!rateLimitResult.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
    { status: 429 }
  );
}
```

### 3. Missing Date Range Validation

**Location:** `src/app/api/violations/route.ts` (lines 165-174)

**Issue:** No validation for maximum date range (queries.ts has 90-day limit but violations doesn't enforce).

```typescript
const filters: ViolationFilters = {
  startTimestamp: start,
  endTimestamp: end,
  // No validation here!
};
```

**Fix:** Add date range validation:

```typescript
// Add after parsing query params
const MAX_DATE_RANGE_DAYS = 90;
if (start && end) {
  const dateRangeDays = (end - start) / 86400;
  if (dateRangeDays > MAX_DATE_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days` },
      { status: 400 }
    );
  }
}
```

### 4. RBAC Helper Signature Mismatch

**Location:** `src/lib/analytics/rbac.ts` (line 126-158)

**Issue:** `verifyLicenseAccess` function signature uses `isAdmin: boolean` but route passes `isAdmin: false` for all non-admin users.

```typescript
// Route calls:
await verifyLicenseAccess(userId, licenseNonce, false);

// But function checks:
if (isAdmin) { return { allowed: true }; }  // Always false for customers
```

**Confusion Risk:** Third parameter should be named `checkOwnership` or the logic should be refactored.

---

## Medium Priority Improvements

### 5. Zod Schema Integer Parsing Without Validation

**Location:** `src/lib/validation/services.ts` (lines 124-128)

```typescript
start: z.string().transform((val) => parseInt(val, 10)).optional(),
end: z.string().transform((val) => parseInt(val, 10)).optional(),
```

**Issue:** `parseInt` silently returns `NaN` for invalid input, which passes through validation.

**Fix:** Add NaN check:

```typescript
start: z.string()
  .transform((val) => parseInt(val, 10))
  .refine((val) => !isNaN(val), 'Must be a valid integer')
  .optional(),
```

### 6. Duplicate Violation Constraint May Cause Issues

**Location:** `supabase/migrations/260309-1149-create-violations-table.sql` (line 82-83)

```sql
ALTER TABLE violations ADD CONSTRAINT violations_license_type_time_unique
  UNIQUE (license_nonce, type, created_at);
```

**Issue:** `created_at` has second-level precision. Rapid violations in same second will be rejected.

**Recommendation:** Consider removing unique constraint or adding deduplication logic in application layer.

### 7. Summary Query Inefficient

**Location:** `src/lib/analytics/queries.ts` (lines 510-603)

**Issue:** `fetchViolationSummary` fetches ALL violations into memory before aggregating, rather than using SQL GROUP BY.

```typescript
const { data: violations, error } = await query as any;
// Then loops through all results in JavaScript
for (const v of violations) {
  byType[v.type] = (byType[v.type] || 0) + 1;
  ...
}
```

**Performance Impact:** Slow for large datasets, high memory usage.

**Fix:** Use SQL aggregation:

```sql
SELECT type, severity, tier, COUNT(*) as count
FROM violations
WHERE ...
GROUP BY type, severity, tier
```

---

## Minor Issues

### 8. Hardcoded Tier Default

**Location:** `src/app/api/violations/route.ts` (line 63)

```typescript
userTier = 'PREMIUM'; // Default tier for API key users
```

**Issue:** API key users should have tier looked up from database, not hardcoded.

### 9. Missing Response Type

**Location:** `src/lib/analytics/types.ts`

**Issue:** No `ViolationsApiResponse` type defined for consistent response format.

**Recommendation:** Add:

```typescript
export interface ViolationsApiResponse {
  violations: ViolationEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  summary: ViolationSummary;
  metadata: {
    queriedAt: string;
    queriedBy: string;
    filters: ViolationFilters & { page: number; limit: number };
  };
}
```

### 10. Logging Inconsistent

**Location:** `src/app/api/violations/route.ts`

**Issue:** Uses `logger.info()` but query functions use `logger.error()` without consistent log levels.

---

## Positive Observations

1. **Comprehensive Authentication:** Dual auth (JWT + API key) well-implemented
2. **Zod Validation:** Query params properly validated with Zod schema
3. **RLS Policies:** Database-level security correctly configured
4. **Audit Logging:** Request/response logging in place
5. **Pagination:** Proper pagination with `hasMore` indicator
6. **Error Handling:** Try-catch blocks with appropriate error responses
7. **Index Coverage:** Good database indexes for common query patterns

---

## Security Audit Summary

| Check | Status | Notes |
|-------|--------|-------|
| JWT Authentication | Pass | Proper Bearer token validation |
| API Key Authentication | Pass | HMAC signature verification |
| RBAC Enforcement | Pass | Admin vs customer separation |
| Rate Limiting | Partial | Missing for JWT users (see #2) |
| Input Validation | Pass | Zod schema validation |
| SQL Injection Prevention | Pass | Supabase parameterized queries |
| RLS Policies | Pass | Row-level security enabled |
| No Console.log | Pass | Uses logger utility |

---

## Recommended Actions

### Immediate (Before Production)

1. **Fix all `any` types** - Replace with proper TypeScript interfaces
2. **Add rate limiting for JWT users** - Critical security gap
3. **Add date range validation** - Prevent abuse via large queries
4. **Fix Zod NaN validation** - Add `refine(!isNaN())` checks

### Short-term (Next Sprint)

5. **Optimize summary query** - Use SQL GROUP BY aggregation
6. **Add response type** - Define `ViolationsApiResponse` interface
7. **Revisit unique constraint** - Evaluate if duplicate prevention is needed
8. **Add API key tier lookup** - Remove hardcoded 'PREMIUM' default

### Long-term

9. **Add violation resolution endpoint** - POST/PUT to mark violations resolved
10. **Add webhook notifications** - Alert on critical violations
11. **Implement violation analytics** - Trend detection, anomaly alerts

---

## Unresolved Questions

1. Why is `verifyLicenseAccess` called with `isAdmin: false` for customer users when the function treats `isAdmin: true` as "skip ownership check"?

2. Should API key rate limits be configurable per key or enforced globally?

3. Is the 90-day max date range appropriate for violations queries, or should it be shorter (e.g., 30 days) for performance?

4. Should duplicate violation suppression be handled at application layer instead of database constraint?

---

## Verification Commands

```bash
# Check for any types
grep -r ": any" src/app/api/violations/ src/lib/analytics/queries.ts

# Check for console.log
grep -r "console\." src/app/api/violations/

# Run linting
npm run lint -- src/app/api/violations/route.ts src/lib/analytics/queries.ts

# Check database migration syntax
psql -c "SELECT 1"  # Requires database connection
```

---

## Conclusion

The `/api/violations` endpoint is **functional but not production-ready**. The 13 `any` type violations and missing JWT rate limiting are critical blockers that must be resolved before deployment.

**Recommendation: REVISE** - Address critical and major issues, then re-review.
