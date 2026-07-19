# Code Review: User Flow Fixes (Onboarding + Org Guard + API v1)

**Date:** 2026-03-26
**Reviewer:** code-reviewer agent
**Scope:** 4 files, ~310 LOC

---

## Overall Assessment

Code quality: **Acceptable with 2 critical and 2 high-priority issues.** Auth patterns are mostly sound, but there are race conditions in onboarding and a silent auth failure path in the dashboard layout that could leave users in a broken state.

---

## Critical Issues

### C1. Race condition: User can create multiple orgs (double-submit)

**File:** `app/api/onboarding/route.ts` lines 54-77

No idempotency guard. If user double-clicks "Create Organization" or network retries, two orgs get created for the same user. The `org_members` insert has a `try/catch` that silently ignores UNIQUE constraint (line 70-72), but `createOrganization()` itself will succeed twice creating two separate orgs.

**Impact:** Orphaned organizations with API keys and 200 MCU credits each. Data integrity corruption.

**Fix:**
```typescript
// Before createOrganization, check if user already has an org
const { getUserOrganization } = await import('@/lib/db/auth');
const existingOrg = await getUserOrganization(userId);
if (existingOrg) {
  return NextResponse.json(
    { organization: { id: existingOrg.id } },
    { status: 200 }, // idempotent — return existing
  );
}
```

### C2. `/api/onboarding` NOT in middleware `protectedApiRoutes` -- auth bypass possible

**File:** `middleware.ts` line 29

`/api/onboarding` is neither in `publicRoutes` nor in `protectedApiRoutes`. The middleware logic at line 96-107 only enforces auth for `protectedApiRoutes`. For other non-public API routes, it falls through to `NextResponse.next()` at line 147 **without checking auth cookie**.

Wait -- re-reading: line 80 checks `isPublicRoute` and returns early. Line 97 checks `pathname.startsWith("/api/")`. For `/api/onboarding`:
- Not public -> doesn't return at line 81
- Is API route -> enters the API block at line 97
- Not in `protectedApiRoutes` -> skips the 401 at line 102-107
- Falls to `NextResponse.next()` at line 147

**This means `/api/onboarding` is accessible WITHOUT auth cookie from the middleware perspective.** The route handler itself checks JWT (lines 17-36 of onboarding/route.ts), so there's defense in depth, but middleware should be the first gate.

**Impact:** Medium-high. If onboarding route.ts JWT check has a bug, there's no fallback protection.

**Fix:** Add `/api/onboarding` to `protectedApiRoutes`:
```typescript
const protectedApiRoutes = ["/api/org", "/api/billing", "/api/onboarding"];
```

---

## High Priority

### H1. Dashboard layout: silent JWT failure allows page render without org check

**File:** `app/(dashboard)/layout.tsx` lines 42-44

```typescript
} catch {
  // JWT invalid — middleware will handle, let page render
}
```

If `verifyJwt()` throws (e.g., JWT_SECRET=REDACTED not set, malformed token), the catch block silently continues. The page renders with full sidebar but no org guard was applied. User could be in a state where they have no org but see the full dashboard.

**Impact:** Broken UX -- user sees dashboard without an org, leading to errors on all subsequent API calls.

**Fix:** On JWT verify failure, redirect to login:
```typescript
} catch {
  redirect('/login');
}
```

### H2. `orgSlug`, `role`, `useCase` sent to API but ignored

**File:** `components/onboarding/org-setup-form.tsx` line 76-77 vs `app/api/onboarding/route.ts` line 46

The form sends `{ orgName, orgSlug, role, useCase }` but the API only reads `orgName`. The `orgSlug` validated client-side is never persisted. The `organizations` table insert in `lib/raas/onboarding.ts` has no `slug` field.

**Impact:** User sees a slug field, validates it, but it's thrown away. The org has no slug stored.

**Fix:** Either:
- (a) Pass `slug` through to `createOrganization` and persist it, OR
- (b) Remove slug field from the form if not needed yet (YAGNI)

---

## Medium Priority

### M1. `console.error` in production code

**File:** `app/api/onboarding/route.ts` line 79

```typescript
console.error('POST /api/onboarding error:', err);
```

Per project rules (sophia-handover-rules: "No console.log in production code"), this should use structured logging or be removed.

### M2. No input length cap on `orgName`

**File:** `app/api/onboarding/route.ts` line 46-52

Minimum length of 2 enforced, but no maximum. User could send a 100KB org name. D1 will likely truncate or error, but validation should cap it.

**Fix:**
```typescript
if (orgName.length > 100) {
  return NextResponse.json(
    { error: 'Organization name must be at most 100 characters' },
    { status: 400 },
  );
}
```

### M3. No Zod validation on API input

Per `code-standards.md`: "Zod validation on all API inputs." The onboarding endpoint uses manual type checking instead of Zod schema.

### M4. `createOrganization` not atomic

**File:** `lib/raas/onboarding.ts` lines 54-91

Three sequential inserts (org, api_key, org_balances) without a transaction. If `raas_api_keys` insert fails, an orphaned org row remains. D1 supports transactions -- should wrap all three.

---

## Low Priority

### L1. `api/v1/route.ts` -- `force-dynamic` unnecessary for static JSON

The endpoint returns hardcoded JSON. `force-dynamic` disables caching for no benefit. Could be removed or use `force-static`.

### L2. Dynamic imports in layout for auth modules

**File:** `app/(dashboard)/layout.tsx` lines 35, 38

`await import('@/lib/db/auth-verify')` is a dynamic import. Since this runs server-side on every dashboard page load, a static import at the top would be cleaner and avoid repeated module resolution overhead.

---

## Edge Cases Found by Scouting

| Edge Case | Status | Notes |
|-----------|--------|-------|
| User already has org, hits /api/onboarding again | **NOT HANDLED** | Creates duplicate org (C1) |
| JWT expired during dashboard render | Handled | `verifyJwt` returns null, but layout silently continues (H1) |
| JWT_SECRET=REDACTED not set | Handled | `verifyJwt` returns null, middleware returns 503 |
| Double-click on submit button | **PARTIAL** | Client disables button, but no server-side idempotency |
| `/api/onboarding` called without auth | **PARTIAL** | Route handler checks JWT, but middleware doesn't gate it (C2) |
| Very long org name | **NOT HANDLED** | No max length (M2) |
| `createOrganization` partial failure | **NOT HANDLED** | No transaction (M4) |

---

## Positive Observations

- JWT verification uses HMAC-SHA256 with constant-time-ish comparison (crypto.subtle)
- Auth derives user identity from JWT, not from user-controllable headers (good security pattern)
- API key uses SHA-256 hash storage, never stores plaintext
- Client form has proper loading state and error handling
- PBKDF2 with 100k iterations for password hashing is solid

---

## Recommended Actions (Priority Order)

1. **[Critical]** Add idempotency check in `/api/onboarding` -- check existing org before creating
2. **[Critical]** Add `/api/onboarding` to `protectedApiRoutes` in middleware
3. **[High]** Fix dashboard layout catch block -- redirect to login on JWT failure
4. **[High]** Either persist `orgSlug` or remove the field from the form
5. **[Medium]** Add max length validation for orgName
6. **[Medium]** Wrap `createOrganization` inserts in a D1 transaction
7. **[Medium]** Replace manual validation with Zod schema
8. **[Low]** Remove `force-dynamic` from `/api/v1/route.ts`
9. **[Low]** Convert dynamic imports to static in layout

---

## Metrics

- Type Coverage: Good -- no `:any` types found in reviewed files
- Test Coverage: Unknown -- no tests found for these endpoints
- Linting Issues: 1 (`console.error` in production)

---

## Unresolved Questions

1. Is `org_members` table UNIQUE constraint on `(org_id, user_id)` or just `user_id`? If only on pair, C1 race condition creates multiple orgs.
2. Should `/api/onboarding` eventually be a Server Action per project standards ("Server Actions for data mutations")?
3. Is there a plan to add rate limiting to the onboarding endpoint to prevent abuse?
