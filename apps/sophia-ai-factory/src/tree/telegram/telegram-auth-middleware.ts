import { getUserTier } from '@/seed/db/get-user-tier'
import { createServerClient } from '@/seed/db/client'
import { Tier } from '@/seed/types'
import { logger } from '@/seed/utils/logger-utility'

/**
 * Auth middleware - verifies subscription tier before premium commands
 * Uses D1 PostgreSQL - replaces Redis-based implementation
 */

const TIER_RANK: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
}

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
  const db = createServerClient()

  try {
    // Look up userId from telegram chatId mapping
    const { data, error } = await db.rpc('get_user_by_telegram_chat_id', {
      p_chat_id: chatId,
    })

    if (error || !data) {
      logger.error('get_user_by_telegram_chat_id RPC error', { code: error?.code, message: error?.message })
      return {
        authorized: requiredTier === 'BASIC',
        tier: 'BASIC',
        error: 'Auth check failed',
      }
    }

    const rows = data as Array<Record<string, unknown>>
    const userId = (rows[0]?.get_user_by_telegram_chat_id as string | null) ?? null

    if (!userId) {
      return {
        authorized: requiredTier === 'BASIC',
        tier: 'BASIC',
        error: requiredTier !== 'BASIC' ? 'No linked account. Use /subscribe first.' : undefined,
      }
    }

    const tier = await getUserTier(userId)
    const hasAccess = TIER_RANK[tier] >= TIER_RANK[requiredTier]

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
  const db = createServerClient()

  try {
    await db.rpc('link_telegram_user', {
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
export async function invalidateAuthCache(_chatId: string): Promise<void> {
  // No-op: SQL storage is always current
}
