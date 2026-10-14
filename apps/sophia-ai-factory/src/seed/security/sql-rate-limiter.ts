/**
 * SQL-based Rate Limiter
 * Replaces Redis-based rate limiting with Supabase PostgreSQL / Cloudflare D1
 *
 * Per-account lockout logic lives in ./account-lockout.ts (extracted 2026-05-18).
 * D1 query helpers & types live in ./sql-rate-limiter-queries.ts.
 */

import { tryCreateServerClientSync } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import {
  incrementRateLimit,
  getClientIdentifier,
  cleanupExpiredRateLimits,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitRpcRow,
} from './sql-rate-limiter-queries'

export {
  incrementRateLimit,
  getClientIdentifier,
  cleanupExpiredRateLimits,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitRpcRow,
}

/**
 * Check rate limit using SQL-based sliding window
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now()

  // Skip rate limit only when explicitly disabled (test environments).
  // NEXT_PUBLIC_MOCK_AI_SERVICES no longer bypasses rate limiting (C3 fix 2026-07-01).
  if (globalThis.process?.env?.DISABLE_RATE_LIMIT === 'true') {
    return {
      success: true,
      remaining: config.maxRequests,
      reset: Math.floor(now / 1000) + config.windowSeconds,
    }
  }

  // Use the non-throwing sync client: createServerClient() calls getD1Sync()
  // which throws when the D1 binding is unavailable (local dev edge runtime),
  // and a thrown rate-limit check becomes a fail-closed 429 for every request.
  // tryCreateServerClientSync() returns null instead, so we can distinguish
  // "no D1 binding" (fail closed) from "D1 error" (also fail closed) without
  // an exception propagating through the middleware.
  const db = tryCreateServerClientSync()
  if (!db) {
    logger.error('SQL rate limit: D1 client unavailable, denying request')
    return {
      success: false,
      remaining: 0,
      reset: now + config.windowSeconds * 1000,
    }
  }

  try {
    const fullIdentifier = `${config.identifier}:${identifier}`
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

// ── Per-account lockout re-exports (back-compat) ────────────────────────────
export {
  ACCOUNT_LOCK_THRESHOLD,
  ACCOUNT_LOCK_DURATION_MS,
  checkAccountLock,
  incrementFailedLogin,
  resetFailedLogin,
  checkAccountLockByUserId,
  type AccountLockStatus,
  type D1Binding,
} from './account-lockout'
