/**
 * Telegram user notification utilities
 * @module tree/telegram/user-notifier
 */

import { sendMessage } from './handlers/utils'
import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

/**
 * Notify a user via Telegram by their user ID.
 * Looks up the user's telegram_chat_id and settings, then sends the message
 * if Telegram notifications are enabled.
 *
 * @param userId - User identifier
 * @param message - Message text to send (Markdown parse mode)
 */
export async function notifyUserByTelegram(userId: string, message: string): Promise<void> {
  const db = createServerClient()
  const { data, error } = await db
    .from('user_profiles')
    .select('telegram_chat_id, settings')
    .eq('user_id', userId)
    .single()

  const profile = data as {
    telegram_chat_id: string | null
    settings: { notifications?: { telegram?: { enabled?: boolean } } } | null
  } | null

  if (error || !profile?.telegram_chat_id) {
    logger.debug('[notifyUserByTelegram] No telegram_chat_id for user', { userId })
    return
  }

  if (profile.settings?.notifications?.telegram?.enabled !== true) {
    logger.debug('[notifyUserByTelegram] Telegram notifications disabled for user', { userId })
    return
  }

  try {
    await sendMessage(profile.telegram_chat_id, message)
  } catch (err) {
    logger.warn('[notifyUserByTelegram] Failed to send message', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
