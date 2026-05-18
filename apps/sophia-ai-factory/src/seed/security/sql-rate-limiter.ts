/**
 * SQL-based Rate Limiter
 * Replaces Redis-based rate limiting with Supabase PostgreSQL
 *
 * Also provides per-account failed-login lockout (F01 / ASVS V2.2.2):
 *   - 5 failed attempts → locked for 24h
 *   - Lock is per userId, independent of IP
 *   - Counter resets on successful login
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number // Unix timestamp when limit resets
}

export interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
  identifier: string
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  api: { maxRequests: 100, windowSeconds: 60, identifier: 'api' },
  webhook: { maxRequests: 1000, windowSeconds: 60, identifier: 'webhook' },
  auth: { maxRequests: 10, windowSeconds: 60, identifier: 'auth' },
  admin: { maxRequests: 50, windowSeconds: 60, identifier: 'admin' },
  // discovery: stricter than api (100/min) — OpenRouter cost exposure
  discovery: { maxRequests: 30, windowSeconds: 60, identifier: 'discovery' },
} as const

/**
 * RPC response shape from increment_rate_limit
 */
interface RateLimitRpcRow {
  current_count: number
}

/**
 * Increment rate limit counter using D1 RPC shim
 * Returns current count after increment
 */
async function incrementRateLimit(
  db: ReturnType<typeof createServerClient>,
  identifier: string,
  windowSeconds: number
): Promise<number> {
  const { data, error } = await db.rpc('increment_rate_limit', {
    p_identifier: identifier,
    p_window_seconds: windowSeconds,
  }) as { data: RateLimitRpcRow[] | null; error: unknown }

  if (error || !data) {
    logger.error('increment_rate_limit RPC error', error instanceof Error ? error : new Error(String(error)))
    return Number.MAX_SAFE_INTEGER // Fail closed
  }

  return data?.[0]?.current_count ?? Number.MAX_SAFE_INTEGER
}

/**
 * Check rate limit using SQL-based sliding window
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const db = createServerClient()
  const fullIdentifier = `${config.identifier}:${identifier}`
  const now = Date.now()

  try {
    const currentCount = await incrementRateLimit(
      db,
      fullIdentifier,
      config.windowSeconds
    )

    if (currentCount > config.maxRequests) {
      return {
        success: false,
        remaining: 0,
        reset: now + config.windowSeconds * 1000,
      }
    }

    return {
      success: true,
      remaining: Math.max(0, config.maxRequests - currentCount),
      reset: now + config.windowSeconds * 1000,
    }
  } catch (error) {
    logger.error('SQL rate limit check failed', error instanceof Error ? error : new Error(String(error)))
    return {
      success: false,
      remaining: 0,
      reset: now + config.windowSeconds * 1000,
    }
  }
}

/**
 * Get client identifier from request (IP address or user ID)
 */
export function getClientIdentifier(
  request: Request,
  userId?: string
): string {
  if (userId) {
    return `user:${userId}`
  }
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] || 'unknown'
  return `ip:${ip}`
}

/**
 * Clean up expired rate limit entries (periodic maintenance)
 */
export async function cleanupExpiredRateLimits(
  retentionHours: number = 24
): Promise<number> {
  const db = createServerClient()
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString()

  try {
    const { error } = await db.from('rate_limits').delete().lt('window_start', cutoff)
    if (error) throw error

    await db.from('telegram_rate_limits').delete().lt('command_timestamp', cutoff)
    return 1
  } catch (error) {
    logger.error('Rate limit cleanup failed', error instanceof Error ? error : new Error(String(error)))
    return 0
  }
}

// ── Per-account failed-login lockout (F01 / ASVS V2.2.2) ────────────────────

/** Maximum failed attempts before account lock */
export const ACCOUNT_LOCK_THRESHOLD = 5
/** Lock duration in milliseconds (24 hours) */
export const ACCOUNT_LOCK_DURATION_MS = 24 * 3600 * 1000

export interface AccountLockStatus {
  locked: boolean
  lockedUntil?: number
  attempts: number
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
    // Fail open on read error to avoid blocking legitimate users
    return { locked: false, attempts: 0 }
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
