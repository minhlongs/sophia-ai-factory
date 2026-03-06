import { getUserTier, checkTierAccess } from '@/lib/subscription'
import { createAdminClient } from '@/lib/supabase/admin'
import { Tier } from '@/types'
import { logger } from '@/lib/utils/logger-utility'

/**
 * Auth middleware - verifies Polar.sh subscription before premium commands
 * Uses Supabase PostgreSQL - replaces Redis-based implementation
 */

interface AuthResult {
  authorized: boolean
  tier: Tier
  error?: string
}

/**
 * Check if a Telegram user has an active subscription at required tier
 */
export async function checkSubscriptionAuth(
  chatId: string,
  requiredTier: Tier = 'BASIC'
): Promise<AuthResult> {
  const supabase = createAdminClient()

  try {
    // Look up userId from telegram chatId mapping
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_user_by_telegram_chat_id', {
      p_chat_id: chatId,
    })

    if (error || !data) {
      logger.error('get_user_by_telegram_chat_id RPC error', error)
      return {
        authorized: requiredTier === 'BASIC',
        tier: 'BASIC',
        error: 'Auth check failed',
      }
    }

    const userId = data?.[0]?.get_user_by_telegram_chat_id as string | null

    if (!userId) {
      return {
        authorized: requiredTier === 'BASIC',
        tier: 'BASIC',
        error: requiredTier !== 'BASIC' ? 'No linked account. Use /subscribe first.' : undefined,
      }
    }

    const tier = await getUserTier(userId)
    const hasAccess = await checkTierAccess(userId, requiredTier)

    return {
      authorized: hasAccess,
      tier,
      error: hasAccess ? undefined : `Requires ${requiredTier} subscription`,
    }
  } catch (error) {
    logger.error('Subscription auth check failed', error instanceof Error ? error : new Error(String(error)))
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
  const supabase = createAdminClient()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('link_telegram_user', {
      p_chat_id: chatId,
      p_user_id: userId,
    })
  } catch (error) {
    logger.error('Link Telegram user failed', error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

/**
 * Invalidate auth cache (no-op for SQL-based storage)
 */
export async function invalidateAuthCache(chatId: string): Promise<void> {
  // No-op: SQL storage is always current
}
