# Milestone 2 Investigation: Authentication & MFA Analysis

This document details the findings and proposals for the two core security issues under Milestone 2:
1. Bypassing the Better Auth session cookie cache to enforce live database checks for demoted admins.
2. Implementing a fail-closed behavior for MFA checks in the Edge middleware during D1 database connectivity failures.

---

## 1. Enforcing Live Database Role Lookup for Admins

### Current Behavior & Vulnerability
In `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`, the functions `isUserAdmin` and `isUserAdminWithRole` are structured as follows:

```typescript
export async function isUserAdmin(user: User): Promise<boolean> {
  const { isAdmin } = await isUserAdminWithRole(user);
  return isAdmin;
}

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
  const userData = rawData as UserProfileRoleRow | null;
  const dbRole = userData?.role ?? null;

  return { isAdmin: dbRole === 'admin', dbRole };
}
```

* **The Problem:** Better Auth stores the authenticated user's metadata, including their role, in the session cookie (`user.role`). If an administrator is demoted (role changed to `'user'` in the database), the session cookie may continue to state `user.role === 'admin'` until the cookie is re-issued or session expired. The current early-return fast path (`if (user.role === 'admin')`) relies entirely on the cached cookie, thereby bypassing the database check and allowing a demoted admin to retain administrator access.
* **Database Details:**
  * **Table:** The user profiles are stored in the `user_profiles` table.
  * **Query Mechanics:** Queries are executed via a Supabase-like query interface initialized by calling `createServerClient()`. The query filters by `user_id` and retrieves the `role` column:
    ```typescript
    const db = createServerClient();
    const { data: rawData } = await db
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    ```

### Proposed Fix
To bypass the cached role completely and enforce a live lookup, the early-return fast path check for `'admin'` must be removed. 

#### Proposed `is-user-admin.ts` Change:
```typescript
export async function isUserAdminWithRole(
  user: User
): Promise<{ isAdmin: boolean; dbRole: string | null }> {
  // Enforce a live database lookup unconditionally to handle admin demotions correctly.
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

#### Necessary Test Adjustments in `is-user-admin.test.ts`:
The unit tests in `apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts` assert the fast path:
```typescript
  it('returns true when session role is admin (no DB call)', async () => {
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(true);
    expect(mockSingle).not.toHaveBeenCalled();
  });
```
When implementing the fix, this test must be updated to expect a database call and verify that the database role overrides the session cookie:
```typescript
  it('returns true when DB role is admin (even if session role is admin)', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'admin' } });
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(true);
    expect(mockSingle).toHaveBeenCalledOnce();
  });

  it('returns false when DB role is user and session role is admin (demoted case)', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'user' } });
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(false);
    expect(mockSingle).toHaveBeenCalledOnce();
  });
```

---

## 2. Failing Closed on MFA Check D1 Connectivity Failures

### Current Behavior & Vulnerability
In `apps/sophia-ai-factory/src/middleware.ts`, the MFA validation check during dashboard access is structured as follows:

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

* **The Problem:** The `catch (mfaErr)` block catches any errors thrown by `isSessionMfaPending` (which queries the D1 database to verify pending challenge state). In the event of a database connectivity failure, the exception is caught, logged, and then ignored (execution falls through). This **fails open**, allowing users with pending MFA challenges to access the dashboard without completing MFA verification.

### Proposed Fix
To implement a **fail-closed** strategy, any exception thrown during database lookup must block access by redirecting the user to `/login` or `/auth/mfa-challenge` with an error query parameter.

#### Proposed `middleware.ts` Change:
```typescript
      // Enforce MFA challenge: redirect to MFA page if session is pending
      if (!isMfaChallengePath && session.session?.id) {
        try {
          const pending = await isSessionMfaPending(session.session.id)
          if (pending) {
            return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
          }
        } catch (mfaErr) {
          // Fail closed — log error and redirect to login with service unavailable status
          logger.error('[Middleware] MFA pending check error — failing closed', toError(mfaErr))
          return NextResponse.redirect(
            new URL('/login?error=service_unavailable', request.url)
          );
        }
      }
```

### Alignment with Existing Fail-Closed Patterns
This is consistent with the fail-closed patterns already present in `middleware.ts`:
1. **API MFA Gate (lines 88-106):**
   ```typescript
   } catch (mfaApiErr) {
     logger.error('[Middleware] MFA API check error — failing closed', toError(mfaApiErr))
     return NextResponse.json(
       { error: 'Authentication service temporarily unavailable. Please try again.' },
       { status: 503 },
     )
   }
   ```
2. **Admin Tier Gate (lines 182-188):**
   ```typescript
   } catch (tierErr) {
     logger.error('[Middleware] Admin tier check failed', toError(tierErr))
     return NextResponse.redirect(new URL('/dashboard?error=admin_required', request.url))
   }
   ```
