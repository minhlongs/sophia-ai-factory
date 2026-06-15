# Analysis Report — Milestone 2: Authentication & MFA Investigation

## Summary
This report analyzes how to:
1. Enforce live database role lookup for admin privilege verification to bypass the cached session cookie role when demoting.
2. Implement a fail-closed MFA check in the application middleware to deny dashboard access upon D1 database connectivity failures.

---

## 1. Enforcing Live Database Role Lookup (Admin privilege check)

### Direct Observations in `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`
- **User Roles Storage**: The user roles are stored in the `user_profiles` table, mapping `user_id` to a `role` field.
- **Database Query Method**: Queries are executed via the server-side D1 client wrapper `createServerClient()` (from `@/seed/db/client`), using a Supabase-compatible Fluent API structure:
  ```typescript
  const db = createServerClient();
  const { data: rawData } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  ```
- **Caching Bug**: The function `isUserAdminWithRole` has a fast-path optimization that returns early if the cookie session role is already `'admin'`:
  ```typescript
  if (user.role === 'admin') {
    return { isAdmin: true, dbRole: 'admin' };
  }
  ```
  If an admin is demoted (the database `role` value becomes `'user'`), the cached cookie session role (`user.role === 'admin'`) still bypasses the live database check, violating authorization constraints.

### Proposed Solution / Code Changes
To enforce a live database role lookup, the fast-path check must be bypassed or eliminated, forcing the query to the `user_profiles` table on every check.

**Proposed Changes to `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`**:
```typescript
<<<<
export async function isUserAdminWithRole(
  user: User
): Promise<{ isAdmin: boolean; dbRole: string | null }> {
  if (user.role === 'admin') {
    return { isAdmin: true, dbRole: 'admin' };
  }

  const db = createServerClient();
  const { data: rawData } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
====
export async function isUserAdminWithRole(
  user: User
): Promise<{ isAdmin: boolean; dbRole: string | null }> {
  // Always perform a live DB check to bypass Better Auth session cookie cache when demoting
  const db = createServerClient();
  const { data: rawData } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
>>>>
```

**Proposed Changes to `apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts`**:
The test checking for the fast-path bypass must be updated because the DB query is now always made:
```typescript
<<<<
  it('returns true when session role is admin (no DB call)', async () => {
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(true);
    expect(mockSingle).not.toHaveBeenCalled();
  });
====
  it('returns true when session role is admin but verifies via DB call', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'admin' } });
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(true);
    expect(mockSingle).toHaveBeenCalledOnce();
  });
>>>>
```

---

## 2. Implementing Fail-Closed MFA Checks in Middleware

### Direct Observations in `apps/sophia-ai-factory/src/middleware.ts`
- **MFA Pending Check location**: In the dashboard routing gate (`cleanPath.startsWith('/dashboard')`), the check checks if MFA is pending using:
  ```typescript
  const pending = await isSessionMfaPending(session.session.id)
  ```
- **Current Try-Catch Structure**:
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
- **Fail-Open Risk**: If the D1 database connectivity fails, `isSessionMfaPending` throws an error. The `catch (mfaErr)` block catches the exception, logs it, but proceeds *without redirecting*, allowing the user to view the dashboard without completing MFA.

### Proposed Solution / Code Changes
To fail closed, the exception catch block must interrupt the request flow and redirect the user to a secure destination (the login/error page).

**Proposed Changes to `apps/sophia-ai-factory/src/middleware.ts`**:
```typescript
<<<<
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
====
      // Enforce MFA challenge: redirect to MFA page if session is pending
      if (!isMfaChallengePath && session.session?.id) {
        try {
          const pending = await isSessionMfaPending(session.session.id)
          if (pending) {
            return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
          }
        } catch (mfaErr) {
          // Fail closed: redirect to login with error parameter during DB connectivity issues
          logger.error('[Middleware] MFA pending check error — failing closed', toError(mfaErr))
          return NextResponse.redirect(new URL('/login?error=auth_service_unavailable', request.url))
        }
      }
>>>>
```
*(Note: Similar fail-closed patterns already exist in the API portion of the middleware, e.g., line 99, where it returns a HTTP 503 response if the MFA check fails. The dashboard route should similarly redirect).*

---

## 3. Unresolved Questions & Scope Restrictions
- Are there specific environments where D1 database queries are expected to fail during initialization without requiring a full redirect (e.g., localized mock environments)? If so, we may want to conditionally allow fail-open for local test runners, though for production, fail-closed is mandatory.
