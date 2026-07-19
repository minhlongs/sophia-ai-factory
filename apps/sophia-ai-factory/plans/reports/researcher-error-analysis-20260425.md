# TS Error & Test Failure Analysis Report

**Researcher:** Claude Code
**Date:** 2026-04-25
**Status:** Research Complete

## Executive Summary

Found **7 build errors + 4 failing tests** blocking production deployment. Root causes identified:

1. **Critical: "use server" export rule violation** — re-exporting async functions from "use server" file (campaigns.ts)
2. **Type mismatches** — RaasUsageMetrics vs UsageMetrics naming confusion, unknown error types
3. **Type assertion errors** — Campaign[] type conversion and string state mismatches
4. **Test pagination type mismatch** — Zod schema returns number but test expects string

---

## Build Errors (Turbopack)

### Error 1: campaigns.ts — "use server" Export Rule Violation

**File:** `src/app/actions/campaigns.ts:10`
**Severity:** CRITICAL (blocks build)
**Error Message:** "Only async functions are allowed to be exported in a 'use server' file"

```typescript
// Line 10 - INCORRECT
export { retryCampaign, resumeCampaign } from './campaigns-retry-resume';
```

**Root Cause:** 
Next.js "use server" directive requires ALL exports to be async functions. Re-exporting from another module breaks this rule. The re-exported functions `retryCampaign` and `resumeCampaign` are defined as async functions in `campaigns-retry-resume.ts`, but Next.js compiler treats re-exports specially and rejects them.

**Fix:**
Move re-export to a non-"use server" barrel file or import & wrap:

```typescript
// Option 1: Remove re-export, import directly in client files
import { retryCampaign, resumeCampaign } from '@/app/actions/campaigns-retry-resume';

// Option 2: In campaigns.ts, remove re-export line entirely:
// Delete line 10
// Keep only async function exports
```

**Impact:** Affects 2 downstream files:
- `src/app/[locale]/dashboard/components/campaign-creation-form-with-template-selector.tsx` (imports `createCampaign`)
- `src/app/[locale]/dashboard/components/campaign-list.tsx` (imports `retryCampaign, resumeCampaign`)

---

## TypeScript Type Errors

### Error 2: usage-analytics-view.tsx:86, 88 — Property 'summary' doesn't exist

**File:** `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx:86-88`
**Type:** Property doesn't exist on UsageMetrics

```typescript
// Line 86-88 - INCORRECT
const summary = usageData.summary;
return {
  requests: summary.totalRequests,
```

**Root Cause:**
Code assumes `usageData` (UsageMetrics) has a `summary` property. The type IS correctly defined in `src/lib/analytics/types.ts:67-71`:

```typescript
export interface UsageMetrics {
  summary: UsageSummary;  // ← Property DOES exist
  timeSeries: TimeSeriesPoint[];
  serviceBreakdown: ServiceBreakdown[];
}
```

**Diagnosis:** The error likely occurs during type inference. The hook `useUsageMetrics()` may be returning `unknown` or not properly typed. The code itself is correct. **Likely false positive from stale type cache** OR the hook return type needs explicit generic.

**Fix:**
Ensure hook is properly typed:
```typescript
const { data: usageData } = useUsageMetrics<UsageMetrics>({
  // ... options
});
```

---

### Error 3: usage-analytics-view.tsx:164, 198 — setMetric argument type mismatch

**File:** `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx:164, 198`
**Type:** Argument of type 'string' not assignable to SetStateAction

```typescript
// Line 164, 198 - INCORRECT
onValueChange={(v: string) => setMetric(v)}
// setMetric expects type 'requests' | 'credits' | 'tokens'
// but (v: string) ⇒ passes generic string
```

**Root Cause:**
State initialized as:
```typescript
const [metric, setMetric] = useState<UsageMetric>('requests');
```

But `UsageMetric` type is too narrow. The Select component's `onValueChange` callback receives generic `string`, not the literal union type.

**Fix:**
```typescript
onValueChange={(v) => {
  if (['requests', 'credits', 'tokens'].includes(v)) {
    setMetric(v as UsageMetric);
  }
}}
```

---

### Error 4: usage-analytics-view.tsx:254 — Property 'timeSeries' doesn't exist

**File:** `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx:254`

```typescript
data={usageData?.timeSeries || null}
```

**Root Cause:**
Same as Error 2. The type IS correct in `UsageMetrics`. Likely hook return type inference issue or type guard needed.

**Fix:**
Add type guard:
```typescript
data={(usageData && 'timeSeries' in usageData) ? usageData.timeSeries : null}
```

---

### Error 5: usage-analytics-view.tsx:265 — Property 'serviceBreakdown' doesn't exist

**File:** `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx:265`

**Root Cause:** Same as Errors 2 & 4.

---

### Error 6: usage-analytics-view.tsx:271 — Property 'utilization' doesn't exist on array

**File:** `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx:271`

```typescript
data={licenseData?.utilization || null}
```

**Root Cause:**
Type is correct in `src/lib/analytics/types.ts:146-150`:
```typescript
export interface LicenseMetrics {
  total: number;
  byTier: Record<string, number>;
  utilization: LicenseUtilization[];  // ← Array, property exists
}
```

Likely hook return type issue or missing type assertion.

---

### Error 7: admin/analytics/usage/page.tsx:62, 87 — 'errorData' is 'unknown'

**File:** `src/app/[locale]/(admin)/admin/analytics/usage/page.tsx:62, 87`

```typescript
// Line 61-62 - Type error
const errorData = await response.json();
throw new Error(errorData.error || 'Failed to fetch usage metrics');
```

**Root Cause:**
`response.json()` returns `unknown` type. Must validate before accessing properties.

**Fix:**
```typescript
const errorData = await response.json() as { error?: string };
// Or with Zod validation
const errorDataSchema = z.object({ error: z.string().optional() });
const errorData = errorDataSchema.parse(await response.json());
```

---

### Error 8: admin/users/admin-users-client.tsx:48, 49, 53, 63 — 'data' is 'unknown'

**File:** `src/app/[locale]/(admin)/admin/users/admin-users-client.tsx:48, 49, 53, 63`

```typescript
// Line 46 - Type error
const data = await res.json();  // unknown type

if (data.success) {  // ← Property access on unknown
  setFeedback(data.message);
```

**Root Cause:**
Same as Error 7. JSON response is `unknown`.

**Fix:**
```typescript
const dataSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  userId: z.string().optional(),
});
const data = dataSchema.parse(await res.json());
```

---

### Error 9: dashboard/billing/page.tsx:133-140 — 'usageData' possibly undefined

**File:** `src/app/[locale]/dashboard/billing/page.tsx:133-140`

```typescript
// Line 132-145 - Type error
const hourlyUsage = {
  used: Math.round(usageData.usage.apiCalls / 24),  // ← usageData could be undefined
```

**Root Cause:**
`useQuery<UsageSummaryResponse>()` can return `data: undefined` but code doesn't check.

**Fix:**
```typescript
if (!usageData) return null;

const hourlyUsage = {
  used: Math.round(usageData.usage.apiCalls / 24),
```

---

### Error 10: dashboard/analytics/page.tsx:54 — Campaign[] type conversion

**File:** `src/app/[locale]/dashboard/analytics/page.tsx:54`

```typescript
// Line 54 - Type assertion
if (data) campaigns = data as Campaign[];
```

**Root Cause:**
Type assertion suggests TypeScript can't infer `data` as `Campaign[]` from Supabase query. The D1 client query returns `unknown` type. Zod validation recommended.

**Fix:**
```typescript
import { z } from 'zod';

const campaignSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  // ... other fields
});

if (data) {
  campaigns = z.array(campaignSchema).parse(data);
}
```

---

## Test Failures

### Test 1: src/app/api/violations/route.test.ts:218

**File:** `src/app/api/violations/route.test.ts:218`
**Test Name:** "Query Validation > should cap limit to 100"
**Severity:** MEDIUM (assertion failure)

**Error Message:**
```
expected vi.fn() to be called with arguments:
  [ Anything, '1', 100 ]

Received:
  [ { filters object }, 1, 100 ]
```

**Root Cause:**
Test expects `page` parameter as string `'1'` but the Zod schema returns number `1`. The `.default('1')` in Zod schema was supposed to keep it as string, but Zod's type coercion converted it to number.

**Fix:**
Update test expectation:
```typescript
// Line 218 - Current
expect(fetchViolations).toHaveBeenCalledWith(expect.anything(), '1', 100);

// Fixed
expect(fetchViolations).toHaveBeenCalledWith(expect.anything(), 1, 100);
```

OR in schema, ensure string type:
```typescript
const querySchema = z.object({
  page: z.union([z.string(), z.number()])
    .transform(v => String(v))
    .default('1'),
});
```

---

### Test 2: src/app/api/violations/route.test.ts:345

**File:** `src/app/api/violations/route.test.ts:345`
**Test Name:** "Response Format > should return paginated violations with summary"
**Severity:** MEDIUM (assertion failure)

**Error:**
```
expected pagination.page: '1' (string)
received pagination.page: 1 (number)
```

**Root Cause:**
Same as Test 1. Zod schema default type mismatch.

**Fix:**
Update test expectation (Line 347):
```typescript
// Current
page: '1',

// Fixed
page: 1,
```

---

### Test 3 & 4: src/lib/auth/jwt-nonce-tracker.test.ts:326

**File:** `src/lib/auth/jwt-nonce-tracker.test.ts:326`
**Tests:** 2 KV error handling tests
**Severity:** MEDIUM (logic assertion)

**Error Pattern:**
```
Expected: false
Received: true
```

**Root Cause:**
KV storage error handling not returning false as expected. Likely `preRegisterNonce` is catching error but returning true instead of false on KV failure.

**Fix:**
In `src/lib/auth/jwt-nonce-tracker.ts`, ensure error path returns false:
```typescript
export async function preRegisterNonce(nonce: string, userId: string): Promise<boolean> {
  try {
    // ... KV operations
    return true;
  } catch (err) {
    logger.error('KV error', err);
    return false;  // ← Must return false on error
  }
}
```

---

## Summary Table

| # | File | Line | Type | Severity | Root Cause |
|---|------|------|------|----------|-----------|
| 1 | campaigns.ts | 10 | Build | CRITICAL | Re-export from "use server" file |
| 2-6 | usage-analytics-view.tsx | 86-271 | Type | HIGH | Hook return type inference (UsageMetrics/LicenseMetrics) |
| 7 | admin/analytics/usage/page.tsx | 62, 87 | Type | HIGH | response.json() returns unknown |
| 8 | admin-users-client.tsx | 48-63 | Type | HIGH | response.json() returns unknown |
| 9 | dashboard/billing/page.tsx | 133 | Type | MEDIUM | Unchecked undefined after useQuery |
| 10 | dashboard/analytics/page.tsx | 54 | Type | MEDIUM | Type assertion instead of validation |
| T1-T2 | violations/route.test.ts | 218, 345 | Test | MEDIUM | Zod pagination type mismatch (string vs number) |
| T3-T4 | jwt-nonce-tracker.test.ts | 326 | Test | MEDIUM | Error handling returns wrong boolean |

---

## Unresolved Questions

1. **Hook return type inference:** Why does `useUsageMetrics()` infer `unknown` when it should return `UsageMetrics`? Need to verify hook signature in `src/hooks/analytics/use-usage-metrics.ts`.

2. **Zod pagination default:** Should pagination.page be string or number? Current schema returns number but test expects string. Need to verify API contract and unify types.

3. **Why Supabase D1 query returns unknown?** Should have proper type inference. May need explicit type cast or Zod schema at query level.

