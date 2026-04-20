import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'

/**
 * FSM State Types
 */
export enum BotState {
  IDLE = 'idle',
  AWAITING_EMAIL = 'awaiting_email',
  AWAITING_CAMPAIGN_TOPIC = 'awaiting_campaign_topic',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  AWAITING_SUBSCRIPTION = 'awaiting_subscription',
  DISCOVERING_TRENDS = 'discovering_trends',
  CREATING_CAMPAIGN = 'creating_campaign',
  EXPORTING_CAMPAIGN = 'exporting_campaign',
}

/** Runtime guard — narrows unknown DB value to BotState */
export function isBotState(value: unknown): value is BotState {
  return typeof value === 'string' && Object.values(BotState).includes(value as BotState)
}

/**
 * User Context stored in Supabase
 */
export interface UserContext {
  state: BotState
  email?: string
  campaignTopic?: string
  telegramUserId?: string
  subscriptionTier?: string
  filters?: string[]
  templateId?: string
  exportFormat?: 'pdf' | 'csv' | 'json'
  lastUpdated: number
}

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
