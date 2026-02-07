import { getUserTier, checkTierAccess } from '@/lib/subscription'
import { redis } from '@/lib/redis'
import { Tier } from '@/types'

/**
 * Auth middleware - verifies Polar.sh subscription before premium commands
 * Caches subscription status in Redis for 1 hour to reduce DB queries
 */

const CACHE_TTL = 3600 // 1 hour

interface AuthResult {
  authorized: boolean
  tier: Tier
  error?: string
}

/**
 * Check if a Telegram user has an active subscription at required tier
 * Links telegram chatId to Supabase userId via user_sessions table
 */
export async function checkSubscriptionAuth(
  chatId: string,
  requiredTier: Tier = 'BASIC'
): Promise<AuthResult> {
  try {
    // Check Redis cache first
    const cacheKey = `auth:telegram:${chatId}`
    const cached = await redis.get<{ tier: Tier; userId: string }>(cacheKey)

    if (cached) {
      const hasAccess = await checkTierAccess(cached.userId, requiredTier)
      return {
        authorized: hasAccess,
        tier: cached.tier,
        error: hasAccess ? undefined : `Requires ${requiredTier} subscription`,
      }
    }

    // Look up userId from telegram chatId mapping
    const mappingKey = `telegram:user:${chatId}`
    const userId = await redis.get<string>(mappingKey)

    if (!userId) {
      return {
        authorized: requiredTier === 'BASIC',
        tier: 'BASIC',
        error: requiredTier !== 'BASIC' ? 'No linked account. Use /subscribe first.' : undefined,
      }
    }

    // Get tier from Supabase
    const tier = await getUserTier(userId)
    const hasAccess = await checkTierAccess(userId, requiredTier)

    // Cache result
    await redis.set(cacheKey, { tier, userId }, { ex: CACHE_TTL })

    return {
      authorized: hasAccess,
      tier,
      error: hasAccess ? undefined : `Requires ${requiredTier} subscription`,
    }
  } catch (error) {
    console.error('[Auth Middleware] Error:', error)
    // Fail open for BASIC, fail closed for premium
    return {
      authorized: requiredTier === 'BASIC',
      tier: 'BASIC',
      error: 'Auth check failed',
    }
  }
}

/**
 * Link a Telegram chatId to a Supabase userId
 */
export async function linkTelegramUser(
  chatId: string,
  userId: string
): Promise<void> {
  const mappingKey = `telegram:user:${chatId}`
  await redis.set(mappingKey, userId)
}

/**
 * Invalidate auth cache for a user (call after subscription changes)
 */
export async function invalidateAuthCache(chatId: string): Promise<void> {
  const cacheKey = `auth:telegram:${chatId}`
  await redis.del(cacheKey)
}
