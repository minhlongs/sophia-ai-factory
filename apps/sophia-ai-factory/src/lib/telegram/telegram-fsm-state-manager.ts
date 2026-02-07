import { redis } from '@/lib/redis'

/**
 * FSM State Types
 */
export enum BotState {
  IDLE = 'idle',
  AWAITING_EMAIL = 'awaiting_email',
  AWAITING_CAMPAIGN_TOPIC = 'awaiting_campaign_topic',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
}

/**
 * User Context stored in Redis
 */
export interface UserContext {
  state: BotState
  email?: string
  campaignTopic?: string
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
    } catch (error) {
      console.error('Error getting context:', error)
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
    } catch (error) {
      console.error('Error setting context:', error)
      throw error
    }
  }

  /**
   * Clear user context from Redis
   */
  static async clearContext(chatId: string): Promise<void> {
    try {
      await redis.del(this.getKey(chatId))
    } catch (error) {
      console.error('Error clearing context:', error)
      throw error
    }
  }

  /**
   * Update state only
   */
  static async setState(chatId: string, state: BotState): Promise<void> {
    await this.setContext(chatId, { state })
  }
}
