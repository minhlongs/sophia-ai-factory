# Handoff Report — Milestone 2: Authentication & MFA

This report summarizes the findings of the investigation into authentication caching and fail-closed MFA middleware checks.

---

## 1. Observation

### Admin Privilege Verification Caching
In `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`:
* Line 22: `export async function isUserAdmin(user: User): Promise<boolean>`
* Line 32: `export async function isUserAdminWithRole(user: User): Promise<{ isAdmin: boolean; dbRole: string | null }>`
* Lines 35-37 (Fast-path):
  ```typescript
  if (user.role === 'admin') {
    return { isAdmin: true, dbRole: 'admin' };
  }
  ```
* Lines 39-44 (D1 query):
  ```typescript
  const db = createServerClient();
  const { data: rawData } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  ```
In `apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts`:
* Lines 35-39:
  ```typescript
  it('returns true when session role is admin (no DB call)', async () => {
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(true);
    expect(mockSingle).not.toHaveBeenCalled();
  });
  ```

### MFA Middleware Verification Fail-Open
In `apps/sophia-ai-factory/src/middleware.ts`:
* Lines 144-155:
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

---

## 2. Logic Chain

1. **Admin Verification Caching**:
   * The `isUserAdminWithRole` function checks `user.role === 'admin'` before making any database query.
   * `user` comes from the Better Auth session context, which is populated from the cached session cookie.
   * If an admin is demoted in the database (`user_profiles` role updated to `'user'`), the cached session cookie will still have `role: 'admin'`, causing the fast-path check to return `isAdmin: true` without performing a database query.
   * Removing the fast-path check `if (user.role === 'admin')` from `isUserAdminWithRole` will force the query to target the `user_profiles` table directly, ensuring live, up-to-date validation of admin privileges.

2. **MFA Fail-Closed Middleware**:
   * The middleware checks `isSessionMfaPending` inside a try-catch block for dashboard requests.
   * When a D1 database connectivity error occurs, `isSessionMfaPending` will throw.
   * The current catch block logs the exception but does not disrupt the request lifecycle, which allows the request to fall through.
   * Modifying the catch block to return a redirect response to a secure page (e.g. `/login?error=auth_service_error`) blocks users from accessing the dashboard on database failures (failing closed).

---

## 3. Caveats

* Modifying the `isUserAdminWithRole` helper to bypass the cache will increase the database read load slightly for admin route hits because a live lookup is always executed. However, admin traffic is low-volume, so this is minimal.
* Removing the fast-path in `is-user-admin.ts` will break the unit test `'returns true when session role is admin (no DB call)'` in `is-user-admin.test.ts`. This test case must be updated accordingly when implementing.

---

## 4. Conclusion

1. To bypass the Better Auth cookie cache, remove the fast-path lines 35-37 in `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`. The roles are stored in the `user_profiles` table and queried using the query builder returned by `createServerClient()`.
2. To fail closed on MFA checks in the middleware, replace the empty catch block at lines 151-154 in `apps/sophia-ai-factory/src/middleware.ts` with a redirect to `/login?error=auth_service_error`.

---

## 5. Verification Method

### Test Suite Execution
Run the following vitest suite to verify functionality:
```bash
npm run test apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts
```

### Visual/Manual Verification
* Inspect `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts` to ensure the fast-path check is removed.
* Inspect `apps/sophia-ai-factory/src/middleware.ts` to verify the try-catch block around `isSessionMfaPending` redirects to `/login?error=auth_service_error` on database exception.
* Run compilation check:
  ```bash
  npm run ci:typecheck
  ```
