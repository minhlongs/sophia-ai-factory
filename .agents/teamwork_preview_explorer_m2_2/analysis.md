# Analysis — Milestone 2: Authentication & MFA

This report details the findings and implementation recommendations for Milestone 2: Authentication & MFA, specifically addressing admin role validation cache bypassing and fail-closed MFA checks in middleware.

---

## 1. Enforcing Live Database Role Lookup for Admins

### Direct Database Lookup Target
* **Target Table**: `user_profiles`
* **Column**: `role`
* **File Location**: `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`

### Current Query Implementation
In `is-user-admin.ts`, the database connection is retrieved synchronously or asynchronously (via Proxy) by calling `createServerClient()` from `@/seed/db/client`. The query uses a Supabase-compatible builder pattern to interact with the Cloudflare D1 database:

```typescript
const db = createServerClient();
const { data: rawData } = await db
  .from('user_profiles')
  .select('role')
  .eq('user_id', user.id)
  .single();
```

### Cookie Caching Vulnerability
The helper function `isUserAdminWithRole` currently implements a fast-path shortcut (lines 35-37):
```typescript
if (user.role === 'admin') {
  return { isAdmin: true, dbRole: 'admin' };
}
```

Since the `user` object is populated directly from the Better Auth session cookie, this role check relies entirely on the client's cookie state. If an admin is demoted (e.g. their role is changed to `'user'` in the database), this check will continue to return `isAdmin: true` for the duration of the session validity because it skips the database lookup.

### Recommended Change (Bypass Cache)
To bypass the cached session cookie and enforce a live database role lookup (especially critical when demoting), we must remove the fast-path `user.role === 'admin'` check. 

```typescript
// Proposed modification in apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts

export async function isUserAdminWithRole(
  user: User
): Promise<{ isAdmin: boolean; dbRole: string | null }> {
  // REMOVE:
  // if (user.role === 'admin') {
  //   return { isAdmin: true, dbRole: 'admin' };
  // }

  // Enforce unconditional live database query
  const db = createServerClient();
  const { data: rawData } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  const userData = rawData as UserProfileRoleRow | null;
  const dbRole = userData?.role ?? null;

  return { isAdmin: dbRole === 'admin', dbRole };
}
```

### Impact on Test Suite
Removing this fast-path will break the unit test `'returns true when session role is admin (no DB call)'` in `apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts` (lines 35-39), which explicitly asserts:
```typescript
it('returns true when session role is admin (no DB call)', async () => {
  const result = await isUserAdmin({ ...baseUser, role: 'admin' });
  expect(result).toBe(true);
  expect(mockSingle).not.toHaveBeenCalled(); // This assertion will fail
});
```
This test case should be modified to assert that the database lookup is indeed executed.

---

## 2. Fail-Closed MFA Checks in Middleware

### Current Try-Catch Structure
In `apps/sophia-ai-factory/src/middleware.ts` (lines 145-155), the MFA pending verification for dashboard routes is enclosed in a try-catch block:

```typescript
// Enforce MFA challenge: redirect to MFA page if session is pending
if (!isMfaChallengePath && session.session?.id) {
  try {
    const pending = await isSessionMfaPending(session.session.id)
    if (pending) {
      return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
    }
  } catch (mfaErr) {
    // Non-fatal — log and allow through to avoid locking out users on DB errors
    logger.error('[Middleware] MFA pending check error', toError(mfaErr))
  }
}
```

This implementation **fails open**. If the Cloudflare D1 database is down, experiences connectivity latency, or fails for any reason, `isSessionMfaPending` throws an error. The catch block logs the error but does nothing else, allowing the user to bypass the MFA gate and view the dashboard.

### Recommended Change (Fail Closed)
To enforce a fail-closed policy, the catch block must redirect the user to a secure destination, such as the login page or an error page, rather than falling through. 

```typescript
// Proposed modification in apps/sophia-ai-factory/src/middleware.ts

// Enforce MFA challenge: redirect to MFA page if session is pending
if (!isMfaChallengePath && session.session?.id) {
  try {
    const pending = await isSessionMfaPending(session.session.id)
    if (pending) {
      return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
    }
  } catch (mfaErr) {
    // Fail closed — log and redirect to login page with error param to prevent bypass
    logger.error('[Middleware] MFA pending check error — failing closed', toError(mfaErr))
    return NextResponse.redirect(new URL('/login?error=auth_service_error', request.url))
  }
}
```

This aligns with the sensitive API MFA check (lines 80-108), which already fails closed on database errors by returning a 503 status code.

---

## Unresolved Questions / Notes
* No unresolved questions have been identified at this stage. The code layout and paths are well-defined and matching the PROJECT.md interface contracts.
