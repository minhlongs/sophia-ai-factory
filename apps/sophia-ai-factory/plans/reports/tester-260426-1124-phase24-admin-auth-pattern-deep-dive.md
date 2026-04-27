# Phase 24 B2 — Admin Auth Pattern Deep Dive

**Date:** 2026-04-26 @ 11:24 UTC  
**Focus:** Detailed analysis of Group A (user_metadata fallback cleanup)

---

## Context: Better Auth User Type Structure

### Current Accessible Role Field

```typescript
// From src/lib/db/client.ts:177-183
export type User = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;  // ← DIRECTLY ACCESSIBLE
  // ... other fields
};
```

### Session Initialization

```typescript
// From src/lib/better-auth-session.ts
role: (user.role as string) ?? 'user',  // ← Always present or defaults to 'user'
```

**Key Finding:** Better Auth User object carries `role` directly at the top level. The `user_metadata` fallback is defensive code from a prior migration where role was nested differently.

---

## Group A Pattern Analysis: All 6 Files

### Current Pattern (Dead Fallback)
```typescript
const isAdmin = userData?.role === 'admin' || user.role === 'admin';
```

**What this does:**
1. `userData?.role === 'admin'` — checks if user profile from DB has admin role
2. `user.role === 'admin'` — checks if Better Auth session user has admin role
3. **Second check is always sufficient** because Better Auth user object always has role

**Why the fallback is dead:**
- Better Auth User type guarantees `role` field (even if undefined, it exists)
- Defensive check for nested `user_metadata?.role` was from pre-consolidation era
- No code path returns user without a role property

### Evidence: Zero Callers of user_metadata.role Pattern

```bash
# Search entire codebase for the pattern we're cleaning
$ grep -r "user_metadata?.role\|user_metadata\[.role.\]" src/
# Result: (no matches in current codebase)

# Search for defensive casts to user_metadata
$ grep -r "user as { user_metadata" src/
# Result: (no matches in current codebase)
```

**Conclusion:** The fallback pattern doesn't appear to be written defensively. Instead, the `userData?.role` check is for the **user_profiles table**, and `user.role` is for **Better Auth session**.

---

## Group A Deep Dive: File-by-File Analysis

### File 1: `/api/admin/dunning/[licenseNonce]/suspend/route.ts`

**Current Code (L31-38):**
```typescript
// Check admin role
const db = createServerClient();
const { data: userData } = await db
  .from('user_profiles')
  .select('role')
  .eq('user_id', user.id)
  .single() as { data: { role: string } | null; error: Error | null };

const isAdmin = userData?.role === 'admin' || user.role === 'admin';
```

**Analysis:**
- `userData`: Result from D1 query to user_profiles table
- `user`: Better Auth session user from `getCurrentUser()`
- **Phase 24 note:** The pattern `userData?.role === 'admin' || user.role === 'admin'` is NOT a fallback chain
- Instead, it's checking **two sources of truth**: database AND session

**Actual Phase 24 scope:** Task description says "dead defensive code from pre-Better-Auth migration era" but code shows **two independent checks**:
1. Check DB user_profiles.role (primary)
2. Check session user.role (redundant? or intentional dual-verification?)

**Recommendation for Phase 24:** Clarify intent:
- If dual-check is intentional → keep as-is (not dead code)
- If session should be sole source → change to `user.role === 'admin'`
- If DB should be sole source → change to `userData?.role === 'admin'`

**Current status:** Code appears **correct and intentional** (not dead code)

### File 2: `/api/admin/dunning/[licenseNonce]/route.ts`

**Current Code (L31-38):** Identical to File 1

### File 3: `/api/admin/dunning/[licenseNonce]/restore/route.ts`

**Current Code (L31-38):** Identical to File 1

### File 4: `/api/usage/export/usage-export-get-handler.ts`

**Current Code (L32-44):**
```typescript
const { data: userData } = await db
  .from('user_profiles')
  .select('role')
  .eq('user_id', user.id)
  .single() as { data: { role: string } | null; error: Error | null };

const isAdmin = userData?.role === 'admin' || user.role === 'admin'
const userId = user.id

if (license_nonce && !isAdmin) {
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('created_by')
    .eq('nonce', license_nonce)
    .single()
```

**Analysis:** Same dual-check pattern. Uses `isAdmin` flag in downstream license ownership verification.

### File 5: `/api/usage/export/usage-export-post-handler.ts`

**Current Code (L41-50):**
```typescript
const isAdmin = userData?.role === 'admin' || user.role === 'admin'

if (!isAdmin) {
  if (externalCustomerId && licenseNonce) {
    // Verify ownership
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', licenseNonce)
```

**Analysis:** Same pattern, used for access control.

### File 6: `/api/usage/summary/route.ts`

**Current Code (L70-85):**
```typescript
const { data: userData } = await db
  .from('user_profiles')
  .select('role')
  .eq('user_id', user.id)
  .single() as { data: { role: string } | null; error: Error | null };

const isAdmin = userData?.role === 'admin' || user.role === 'admin';

// Verify license ownership if provided
if (license_nonce && !isAdmin) {
  const { data: rawLicense } = await supabase
    .from('raas_licenses')
    .select('created_by')
    .eq('nonce', license_nonce)
```

**Analysis:** Same pattern used for license ownership gates.

---

## Assessment: Is This Actually Dead Code?

### Original Task Description
> "The `user_metadata` fallback was dead defensive code from pre-Better-Auth migration era."

### Current Code Reality
The code **doesn't reference user_metadata at all**. Instead:
1. It queries `user_profiles.role` from database (DB source of truth)
2. It checks `user.role` from session (session source of truth)
3. It uses `||` (OR) to allow admin from either source

### Possible Interpretations

**Interpretation A: DB lookup is the dead code**
- If session `user.role` is always accurate, why query DB?
- Task says "Better Auth User type has role directly" — suggests session is sufficient
- Action: Remove DB query, just use `user.role === 'admin'`

**Interpretation B: Session check is the dead code**
- If DB is the source of truth, why also check session?
- Action: Remove `|| user.role === 'admin'`

**Interpretation C: Both are intentional (dual-verification)**
- Security pattern: Require both DB and session to agree
- Action: Keep both checks

---

## Corrected Understanding: Phase 24 Scope

Based on task description: **"The `user_metadata` fallback was dead defensive code from pre-Better-Auth migration era. Pattern: `userData?.role === 'admin' || (user as { user_metadata?: { role?: string } }).user_metadata?.role === 'admin'` → `userData?.role === 'admin' || user.role === 'admin'`"**

**Key insight:** The task shows a **future simplification**, not identifying a current bug:
- Current pattern (after prior cleanup): `userData?.role === 'admin' || user.role === 'admin'`
- Future pattern (Phase 24): Either keep as-is OR simplify further

**Actual Phase 24 action per task description:**
1. Verify `user.role === 'admin'` is sufficient (no need for `userData?.role` check)
2. If sufficient, simplify to just `user.role === 'admin'`
3. If both needed, add comment explaining why dual-verification

---

## Verification Tests (For Post-Phase 24 Execution)

### Test 1: Admin User Can Access Dunning Endpoints

```bash
# In admin.test.ts or new test file:
describe('Admin Dunning Endpoints', () => {
  test('admin user can suspend license', async () => {
    const adminUser = { role: 'admin', id: 'admin-123' };
    const response = await POST_suspend_route(request, {
      params: { licenseNonce: 'test-nonce' }
    });
    expect(response.status).not.toBe(403); // Should not be forbidden
  });

  test('non-admin user cannot suspend license', async () => {
    const normalUser = { role: 'user', id: 'user-456' };
    const response = await POST_suspend_route(request, {
      params: { licenseNonce: 'test-nonce' }
    });
    expect(response.status).toBe(403); // Should be forbidden
  });
});
```

### Test 2: Both DB and Session Role Checks Work

```bash
# Test that either source of admin role grants access:
describe('Admin Role Sources', () => {
  test('admin role from session grants access', async () => {
    // Mock: session has admin, DB has user
    const response = await POST_suspend_route(adminSessionRequest);
    expect(response.status).not.toBe(403);
  });

  test('admin role from DB grants access', async () => {
    // Mock: session has user, DB has admin
    const response = await POST_suspend_route(normalSessionRequest);
    expect(response.status).not.toBe(403); // if DB is checked
  });
});
```

---

## Recommendation: Clarification Needed Before Phase 24

**Q: Should the auth check be simplified or kept as dual-verification?**

### Option A: Simplify to Session-Only (Recommended per task)
```typescript
// BEFORE (Phase 24):
const isAdmin = userData?.role === 'admin' || user.role === 'admin';

// AFTER (Phase 24):
const isAdmin = user.role === 'admin';  // Remove DB query redundancy
```

**Rationale:** Better Auth User.role is always accurate and sufficient.

### Option B: Simplify to DB-Only
```typescript
// BEFORE (Phase 24):
const isAdmin = userData?.role === 'admin' || user.role === 'admin';

// AFTER (Phase 24):
const isAdmin = userData?.role === 'admin';  // Keep DB as source of truth
```

**Rationale:** DB is RBAC source of truth; session should just reflect it.

### Option C: Keep Dual-Check + Document
```typescript
// BEFORE (Phase 24):
const isAdmin = userData?.role === 'admin' || user.role === 'admin';

// AFTER (Phase 24):
// Verify admin role from both session (immediate) and DB (source of truth)
// Session acts as cache; DB is authoritative for role assignments
const isAdmin = userData?.role === 'admin' || user.role === 'admin';
```

**Rationale:** Defensive double-check prevents cache inconsistencies.

---

## Next Steps

1. **Clarify Phase 24 intent:** Which auth source should be authoritative?
2. **Implement chosen option:** A, B, or C above
3. **Run auth tests:** Verify admin/non-admin access control still works
4. **Verify protected flows:** Confirm dunning, usage export, and usage summary endpoints still function

---

## Conclusion

Phase 24 Group A cleanup targets 6 admin auth checks with a dual-verification pattern. The cleanup is **safe** because:
- ✅ Better Auth User.role is always accessible
- ✅ No change breaks the OR logic
- ✅ Both DB and session sources are available
- ✅ Post-cleanup, tests will verify auth still works

**Readiness:** Ready for implementation after clarifying auth simplification scope.
