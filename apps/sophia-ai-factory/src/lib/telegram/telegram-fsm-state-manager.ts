import { redis } from '@/lib/redis'

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

/**
 * User Context stored in Redis
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
 * FSM Helper for managing user state in Redis
 */
export class TelegramFSM {
  private static getKey(chatId: string): string {
    return `telegram:fsm:${chatId}`
  }

  /**
   * Get user context from Redis
   */
  static async getContext(chatId: string): Promise<UserContext | null> {
    try {
      const data = await redis.get<UserContext>(this.getKey(chatId))
      return data
    } catch {
      return null
    }
  }

  /**
   * Set user context in Redis
   */
  static async setContext(
    chatId: string,
    context: Partial<UserContext>
  ): Promise<void> {
    try {
      const current = await this.getContext(chatId)
      const updated: UserContext = {
        state: BotState.IDLE,
        ...current,
        ...context,
        lastUpdated: Date.now(),
      }
      // Set with 24 hour expiry
      await redis.set(this.getKey(chatId), updated, { ex: 86400 })
    } catch (err) {
      throw err
    }
  }

  /**
   * Clear user context from Redis
   */
  static async clearContext(chatId: string): Promise<void> {
    try {
      await redis.del(this.getKey(chatId))
    } catch (err) {
      throw err
    }
  }

  /**
   * Update state only
   */
  static async setState(chatId: string, state: BotState): Promise<void> {
    await this.setContext(chatId, { state })
  }
}
