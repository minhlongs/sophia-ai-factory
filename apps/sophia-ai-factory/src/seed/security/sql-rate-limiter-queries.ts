/**
 * SQL-based Rate Limiter — D1 Query Helpers & Types
 *
 * Extracted from sql-rate-limiter.ts to keep rate limit evaluation concise.
 */

import { tryCreateServerClientSync } from '@/seed/db/client'
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
export interface RateLimitRpcRow {
  current_count: number
}

/**
 * Increment rate limit counter using D1 RPC shim
 * Returns current count after increment
 */
export async function incrementRateLimit(
  db: NonNullable<ReturnType<typeof tryCreateServerClientSync>>,
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
  const db = tryCreateServerClientSync()
  if (!db) {
    logger.error('Rate limit cleanup: D1 client unavailable')
    return 0
  }
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
