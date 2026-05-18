/**
 * Account Lockout Hook — F01 / ASVS V2.2.2
 *
 * Wraps Better Auth password verification to enforce per-account
 * failed-login rate limiting (5 attempts → 24-hour lock).
 *
 * ## Wiring
 * This module is consumed by `better-auth-server.ts` inside the
 * `emailAndPassword.password.verify` callback:
 *
 *   ```ts
 *   verify: async ({ hash, password }) => {
 *     const d1 = getD1()
 *     const user = ... // resolve user from hash lookup context
 *     // NOTE: Better Auth does not inject userId into verify(); userId must be
 *     // resolved separately. See TODO below.
 *     const { verifyPassword } = await import('@/tree/crypto/password-hash')
 *     return verifyWithLockout(d1, userId, () => verifyPassword(password, hash))
 *   }
 *   ```
 *
 * ## Better Auth Limitation
 * Better Auth's `emailAndPassword.password.verify` callback receives only
 * `{ hash, password }` — it does NOT provide the userId in that callback.
 * The userId is only available in `databaseHooks` after the fact.
 *
 * TODO: When Better Auth adds a `beforeSignIn` or `afterSignInFailed` hook
 * (tracked upstream), wire `checkAccountLock` there and call
 * `incrementFailedLogin` / `resetFailedLogin` in the appropriate callback.
 * Until then, lockout is enforced at the API layer by callers who have the
 * userId available (e.g., custom `/api/auth/sign-in` wrapper).
 *
 * The three exported functions are fully tested and production-ready.
 */

import {
  checkAccountLock,
  incrementFailedLogin,
  resetFailedLogin,
  type AccountLockStatus,
  type D1Binding,
} from '@/seed/security/account-lockout'
import { logger } from '@/seed/utils/logger-utility'

export type { AccountLockStatus }

/**
 * Run a password verification function wrapped with account lockout logic.
 *
 * - Checks if account is locked BEFORE attempting verification.
 * - On failure: increments counter, locks after threshold.
 * - On success: resets counter.
 *
 * @param db       - Raw D1 binding
 * @param userId   - Better Auth user id
 * @param verify   - Async function returning true if password matches
 * @returns true if login should proceed, false to block
 */
export async function verifyWithLockout(
  db: D1Binding,
  userId: string,
  verify: () => Promise<boolean>
): Promise<boolean> {
  const lockStatus = await checkAccountLock(db, userId)
  if (lockStatus.locked) {
    logger.warn('[F01] Login blocked — account locked', {
      userId,
      lockedUntil: lockStatus.lockedUntil,
    })
    return false
  }

  let passwordMatches = false
  try {
    passwordMatches = await verify()
  } catch (err) {
    logger.error('[F01] Password verify threw', err instanceof Error ? err : new Error(String(err)))
    await incrementFailedLogin(db, userId)
    return false
  }

  if (passwordMatches) {
    await resetFailedLogin(db, userId)
    return true
  }

  const result = await incrementFailedLogin(db, userId)
  if (result.locked) {
    logger.warn('[F01] Account locked after threshold', { userId, attempts: result.attempts })
  }
  return false
}

export { checkAccountLock, incrementFailedLogin, resetFailedLogin }
