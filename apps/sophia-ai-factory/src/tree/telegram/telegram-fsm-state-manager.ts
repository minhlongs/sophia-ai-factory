import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { BotState, isBotState, type UserContext } from './telegram-fsm-types'

export { BotState, isBotState, type UserContext }

/**
 * FSM Helper for managing user state in Supabase PostgreSQL
 * Replaces Redis-based implementation for persistent sessions
 */
export class TelegramFSM {
  static async getContext(chatId: string): Promise<UserContext | null> {
    const db = createServerClient()

    try {
      const { data, error } = await db.rpc('get_telegram_user_session', {
        p_chat_id: chatId,
      })

      if (error || !data) {
        logger.error('get_telegram_user_session RPC error', { code: error?.code, message: error?.message })
        return null
      }

      const rows = data as Array<Record<string, unknown>>
      const row = rows[0]
      if (!row) return null

      const contextData = (row.context_data as Record<string, unknown>) || {}

      let resolvedState: BotState
      if (isBotState(row.state)) {
        resolvedState = row.state
      } else {
        logger.warn('telegram_fsm_invalid_state', {
          metric: 'telegram_fsm_invalid_state',
          chatId,
          rawState: row.state,
        })
        resolvedState = BotState.IDLE
      }

      return {
        state: resolvedState,
        ...contextData,
        subscriptionTier: row.subscription_tier as string | undefined,
        lastUpdated: Date.now(),
      } as UserContext
    } catch (error) {
      logger.error('Get Telegram session failed', error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  static async setContext(
    chatId: string,
    context: Partial<UserContext>
  ): Promise<void> {
    const db = createServerClient()

    try {
      const { state = BotState.IDLE, ...data } = context
      const contextData: Record<string, unknown> = { ...data }

      await db.rpc('set_telegram_user_state', {
        p_chat_id: chatId,
        p_state: state,
        p_context_data: contextData,
      })
    } catch (error) {
      logger.error('Set Telegram context failed', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  static async clearContext(chatId: string): Promise<void> {
    const db = createServerClient()

    try {
      await db.rpc('clear_telegram_session', { p_chat_id: chatId })
    } catch (error) {
      logger.error('Clear Telegram session failed', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Merge partial context into existing session — prevents overwriting prior fields.
   * Use instead of setContext when only updating some keys (e.g., per FSM step).
   */
  static async mergeContext(chatId: string, partial: Partial<UserContext>): Promise<void> {
    const prev = await this.getContext(chatId)
    await this.setContext(chatId, { ...prev, ...partial })
  }

  static async setState(chatId: string, state: BotState): Promise<void> {
    await this.setContext(chatId, { state })
  }

  static async setSubscriptionTier(chatId: string, tier: string): Promise<void> {
    const db = createServerClient()

    try {
      await db.rpc('update_session_subscription_tier', {
        p_chat_id: chatId,
        p_tier: tier,
      })
    } catch (error) {
      logger.error('Update subscription tier failed', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
}
