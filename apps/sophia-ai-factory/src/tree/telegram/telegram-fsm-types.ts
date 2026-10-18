/**
 * Telegram Bot FSM State Types & User Session Context
 *
 * Layer: tree/telegram
 * @module tree/telegram/telegram-fsm-types
 */

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
