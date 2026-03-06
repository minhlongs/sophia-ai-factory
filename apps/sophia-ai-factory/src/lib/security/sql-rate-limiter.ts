/**
 * SQL-based Rate Limiter
 * Replaces Redis-based rate limiting with Supabase PostgreSQL
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger-utility'

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
} as const

/**
 * Increment rate limit counter using PostgreSQL function
 * Returns current count after increment
 */
async function incrementRateLimit(
  supabase: ReturnType<typeof createAdminClient>,
  identifier: string,
  windowSeconds: number
): Promise<number> {
  // Use postgres function via RPC - types are defined in src/lib/supabase/types.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('increment_rate_limit', {
    p_identifier: identifier,
    p_window_seconds: windowSeconds,
  })

  if (error || !data) {
    logger.error('increment_rate_limit RPC error', error)
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
  const supabase = createAdminClient()
  const fullIdentifier = `${config.identifier}:${identifier}`
  const now = Date.now()

  try {
    const currentCount = await incrementRateLimit(
      supabase,
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
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString()

  try {
    const { error } = await supabase.from('rate_limits').delete().lt('window_start', cutoff)
    if (error) throw error

    await supabase.from('telegram_rate_limits').delete().lt('command_timestamp', cutoff)
    return 1
  } catch (error) {
    logger.error('Rate limit cleanup failed', error instanceof Error ? error : new Error(String(error)))
    return 0
  }
}
