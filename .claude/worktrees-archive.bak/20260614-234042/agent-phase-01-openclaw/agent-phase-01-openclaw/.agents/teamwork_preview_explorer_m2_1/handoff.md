# Handoff Report — Authentication & MFA Investigation

## 1. Observation

Direct observations made from target source files:

* **Observation 1.1: Cached Admin Privilege check in `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`**
  Lines 32-49:
  ```typescript
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
  The table storing user roles is **`user_profiles`** (queried at line 41).
  The database query selects the `role` field filtering by `user_id` equal to `user.id`.

* **Observation 1.2: Admin Fast-path unit test in `apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts`**
  Lines 35-39:
  ```typescript
  it('returns true when session role is admin (no DB call)', async () => {
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(true);
    expect(mockSingle).not.toHaveBeenCalled();
  });
  ```

* **Observation 1.3: Middleware MFA pending check failing open in `apps/sophia-ai-factory/src/middleware.ts`**
  Lines 145-155:
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

* **Observation 1.4: Existing Fail-Closed D1 blocks in `apps/sophia-ai-factory/src/middleware.ts`**
  * **API MFA check (lines 99-106):**
    ```typescript
    } catch (mfaApiErr) {
      // Fail closed for sensitive routes — deny rather than bypass MFA on DB errors
      logger.error('[Middleware] MFA API check error — failing closed', toError(mfaApiErr))
      return NextResponse.json(
        { error: 'Authentication service temporarily unavailable. Please try again.' },
        { status: 503 },
      )
    }
    ```
  * **Admin Tier check (lines 182-188):**
    ```typescript
    } catch (tierErr) {
      // On lookup failure, fail closed → deny admin access rather than
      // leak a partial render. Page-level `requireMasterTier()` then
      // re-checks if the redirect somehow escapes (defense-in-depth).
      logger.error('[Middleware] Admin tier check failed', toError(tierErr))
      return NextResponse.redirect(new URL('/dashboard?error=admin_required', request.url))
    }
    ```

---

## 2. Logic Chain

1. **Vulnerability in Admin Verification:** Better Auth sessions place the user role under `user.role` from cookie caching. Since `isUserAdminWithRole` immediately returns `{ isAdmin: true, dbRole: 'admin' }` if `user.role === 'admin'` without querying the database, a demoted admin whose session cookie has not updated or expired can still pass the privilege check as an admin (**Observation 1.1**).
2. **Mitigation for Admin Privilege Check:** To bypass this cookie cache, the fast-path check `if (user.role === 'admin')` must be completely removed, forcing the function to query the `user_profiles` table directly in every execution (**Observation 1.1**).
3. **Impact on Testing:** The unit test `returns true when session role is admin (no DB call)` (**Observation 1.2**) asserts that the DB is not queried when the session has `role: 'admin'`. By removing the fast path, this test will fail and needs to be revised to expect the live database query and verify that a demoted role from the database takes precedence.
4. **Vulnerability in Middleware MFA Check:** During dashboard route access, if the D1 database experiences connectivity failures, `isSessionMfaPending(session.session.id)` will throw an error. The `catch (mfaErr)` block currently logs the error and does nothing else, allowing the request flow to proceed to the dashboard without verification (**Observation 1.3**).
5. **Mitigation for Middleware MFA Check:** To enforce a fail-closed behavior, the catch block must redirect to a login/error endpoint (similar to how the API MFA check and Admin Tier checks handle database errors as seen in **Observation 1.4**).

---

## 3. Caveats

* We assume the database query in `isUserAdminWithRole` is cheap enough to execute on every admin privilege check without caching, or that caching should be handled explicitly at a different layer (e.g. Redis/KV) with invalidation hooks instead of depending on the browser session cookie.
* Redirecting to `/login?error=service_unavailable` assumes the login page is configured to display a relevant user-friendly message when receiving that query parameter.

---

## 4. Conclusion

1. **Admin privilege check:** Enforce live database role check by removing the early-return block `if (user.role === 'admin')` from `isUserAdminWithRole` in `is-user-admin.ts`, and update the corresponding unit tests in `is-user-admin.test.ts`.
2. **Middleware MFA pending check:** Wrap the `isSessionMfaPending` check in a fail-closed redirection structure in `middleware.ts`. On catch, instead of falling through, return `NextResponse.redirect(new URL('/login?error=service_unavailable', request.url))`.

---

## 5. Verification Method

1. **Admin privilege verification:**
   * Run the test suite: `npx vitest run src/seed/auth/is-user-admin.test.ts`
   * Confirm that the tests are updated to assert live D1 querying when the session is `admin` and that demoted session admins are correctly rejected.
2. **Middleware verification:**
   * After the code edits are made by the implementer, run the main test suite: `npx vitest run` (specifically focusing on security or integration tests checking middleware redirects).
   * Confirm that an error thrown from `isSessionMfaPending` inside the middleware leads to a 307 redirect to the `/login?error=service_unavailable` URL instead of falling through to the dashboard.
