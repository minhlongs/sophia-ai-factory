/**
 * Per-account failed-login lockout (ASVS V2.2.2).
 *
 * Extracted from sql-rate-limiter.ts on 2026-05-18 to honor 200-LOC guideline.
 * Public API unchanged — sql-rate-limiter re-exports for back-compat.
 */

import { logger } from '@/seed/utils/logger-utility'

/** Maximum failed attempts before account lock */
export const ACCOUNT_LOCK_THRESHOLD = 5
/** Lock duration in milliseconds (24 hours) */
export const ACCOUNT_LOCK_DURATION_MS = 24 * 3600 * 1000

export interface AccountLockStatus {
  locked: boolean
  lockedUntil?: number
  attempts: number
  /** L3: true when the DB lookup failed — caller should treat as temporarily locked */
  degraded?: boolean
}

interface UserLockRow {
  failed_login_attempts: number
  locked_until: number | null
}

/**
 * Minimal D1 interface needed for raw prepared statements.
 * Avoids importing D1Client wrapper to keep this layer-pure.
 * Exported so test files can cast mocks to this type.
 */
export interface D1Binding {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>
      first<T>(): Promise<T | null>
    }
  }
}

/**
 * Resolve D1 binding from globalThis (same strategy as better-auth-server).
 */
function getD1(): D1Binding {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
  if (env?.DB) return env.DB as D1Binding

  const ctxSymbol = Symbol.for('__cloudflare-context__')
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
  if (ctx?.env?.DB) return ctx.env.DB as D1Binding

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Binding | undefined
  if (globalDb) return globalDb

  throw new Error('D1 database binding not available for account lockout')
}

/**
 * Check whether a user account is currently locked.
 * Call BEFORE password verification on every login attempt.
 */
export async function checkAccountLock(
  db: D1Binding,
  userId: string
): Promise<AccountLockStatus> {
  try {
    const row = await db
      .prepare('SELECT failed_login_attempts, locked_until FROM "user" WHERE id = ?1')
      .bind(userId)
      .first<UserLockRow>()

    if (!row) {
      return { locked: false, attempts: 0 }
    }

    const now = Date.now()
    if (row.locked_until !== null && row.locked_until > now) {
      return { locked: true, lockedUntil: row.locked_until, attempts: row.failed_login_attempts }
    }

    return { locked: false, attempts: row.failed_login_attempts }
  } catch (err) {
    logger.error('checkAccountLock failed', err instanceof Error ? err : new Error(String(err)))
    // L3: degrade to locked state on DB error — fail-closed is safer than fail-open
    return { locked: true, attempts: -1, degraded: true }
  }
}

/**
 * Increment failed login counter. Locks account after ACCOUNT_LOCK_THRESHOLD attempts.
 * Call AFTER a failed password check.
 */
export async function incrementFailedLogin(
  db: D1Binding,
  userId: string
): Promise<{ locked: boolean; attempts: number }> {
  try {
    const now = Date.now()
    const row = await db
      .prepare('SELECT failed_login_attempts FROM "user" WHERE id = ?1')
      .bind(userId)
      .first<{ failed_login_attempts: number }>()

    const current = row?.failed_login_attempts ?? 0
    const next = current + 1
    const shouldLock = next >= ACCOUNT_LOCK_THRESHOLD
    const lockedUntil = shouldLock ? now + ACCOUNT_LOCK_DURATION_MS : null

    await db
      .prepare(
        'UPDATE "user" SET failed_login_attempts = ?1, locked_until = ?2 WHERE id = ?3'
      )
      .bind(next, lockedUntil, userId)
      .run()

    return { locked: shouldLock, attempts: next }
  } catch (err) {
    logger.error('incrementFailedLogin failed', err instanceof Error ? err : new Error(String(err)))
    return { locked: false, attempts: 0 }
  }
}

/**
 * Reset failed login counter and remove lock on successful authentication.
 * Call AFTER a successful password check.
 */
export async function resetFailedLogin(
  db: D1Binding,
  userId: string
): Promise<void> {
  try {
    await db
      .prepare(
        'UPDATE "user" SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?1'
      )
      .bind(userId)
      .run()
  } catch (err) {
    logger.error('resetFailedLogin failed', err instanceof Error ? err : new Error(String(err)))
  }
}

/**
 * Convenience export: get D1 binding and call checkAccountLock.
 * For use outside of better-auth-server where D1 is not injected.
 */
export async function checkAccountLockByUserId(userId: string): Promise<AccountLockStatus> {
  try {
    const db = getD1()
    return checkAccountLock(db, userId)
  } catch (err) {
    logger.error('checkAccountLockByUserId binding error', err instanceof Error ? err : new Error(String(err)))
    return { locked: false, attempts: 0 }
  }
}
