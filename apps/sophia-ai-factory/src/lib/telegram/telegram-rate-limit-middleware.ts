import { redis } from '@/lib/redis'

/**
 * Rate limit middleware using Redis sliding window
 * Prevents abuse by limiting commands per user per minute
 */

const MAX_COMMANDS_PER_MINUTE = 10
const WINDOW_SECONDS = 60

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Check if user is within rate limits
 * Uses Redis sorted set with timestamp scores for sliding window
 */
export async function checkRateLimit(chatId: string): Promise<RateLimitResult> {
  const key = `ratelimit:telegram:${chatId}`
  const now = Date.now()
  const windowStart = now - WINDOW_SECONDS * 1000

  try {
    // Remove expired entries
    await redis.zremrangebyscore(key, 0, windowStart)

    // Count current entries
    const count = await redis.zcard(key)

    if (count >= MAX_COMMANDS_PER_MINUTE) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, { withScores: true })
      const resetIn = oldest.length > 1
        ? Math.ceil((Number(oldest[1]) + WINDOW_SECONDS * 1000 - now) / 1000)
        : WINDOW_SECONDS

      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.max(1, resetIn),
      }
    }

    // Add current request
    await redis.zadd(key, { score: now, member: `${now}:${Math.random()}` })
    await redis.expire(key, WINDOW_SECONDS + 1)

    return {
      allowed: true,
      remaining: MAX_COMMANDS_PER_MINUTE - count - 1,
      resetInSeconds: WINDOW_SECONDS,
    }
  } catch (error) {
    // Fail open - allow request if Redis is down
    return { allowed: true, remaining: MAX_COMMANDS_PER_MINUTE, resetInSeconds: WINDOW_SECONDS }
  }
}
