/**
 * Telegram User Mappings Service
 * CRUD operations for telegram_user_mappings table
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'

export interface TelegramUserMapping {
  id: string
  telegram_chat_id: string
  user_id: string
  subscription_tier?: string | null
  created_at: string
  updated_at: string
}

export async function linkTelegramUser(
  chatId: string,
  userId: string
): Promise<string | null> {
  const db = createServerClient()

  try {
    const { data, error } = await db.rpc('link_telegram_user', {
      p_chat_id: chatId,
      p_user_id: userId,
    })

    if (error || !data) {
      logger.error('link_telegram_user RPC error', { code: error?.code, message: error?.message })
      return null
    }

    const rows = data as Array<Record<string, unknown>>
    return (rows[0]?.link_telegram_user as string | null) ?? null
  } catch (error) {
    logger.error('Link Telegram user failed', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

export async function getUserByChatId(chatId: string): Promise<string | null> {
  const db = createServerClient()

  try {
    const { data, error } = await db.rpc('get_user_by_telegram_chat_id', {
      p_chat_id: chatId,
    })

    if (error || !data) {
      logger.error('get_user_by_telegram_chat_id RPC error', { code: error?.code, message: error?.message })
      return null
    }

    const rows = data as Array<Record<string, unknown>>
    return (rows[0]?.get_user_by_telegram_chat_id as string | null) ?? null
  } catch (error) {
    logger.error('Get user by chatId failed', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

export async function getChatIdByUserId(userId: string): Promise<string | null> {
  const db = createServerClient()

  try {
    const { data, error } = await db
      .from('telegram_user_mappings')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .single()

    if (error || !data) return null
    return (data as Record<string, unknown>).telegram_chat_id as string | null
  } catch (error) {
    logger.error('Get chatId by userId failed', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

export async function updateSubscriptionTier(
  chatId: string,
  tier: string
): Promise<boolean> {
  const db = createServerClient()

  try {
    const { error } = await db.rpc('update_session_subscription_tier', {
      p_chat_id: chatId,
      p_tier: tier,
    })
    return !error
  } catch (error) {
    logger.error('Update subscription tier failed', error instanceof Error ? error : new Error(String(error)))
    return false
  }
}

export async function unlinkTelegramUser(chatId: string): Promise<boolean> {
  const db = createServerClient()

  try {
    const { error } = await db
      .from('telegram_user_mappings')
      .delete()
      .eq('telegram_chat_id', chatId)
    return !error
  } catch (error) {
    logger.error('Unlink Telegram user failed', error instanceof Error ? error : new Error(String(error)))
    return false
  }
}

export async function getMappingByChatId(
  chatId: string
): Promise<TelegramUserMapping | null> {
  const db = createServerClient()

  try {
    const { data, error } = await db
      .from('telegram_user_mappings')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .single()

    if (error || !data) return null
    return data as unknown as TelegramUserMapping
  } catch (error) {
    logger.error('Get mapping by chatId failed', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}
