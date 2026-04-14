import { createServerClient } from '@/lib/db/client'
import { UserContext, BotState } from './telegram-fsm-state-manager'

/**
 * State backup service - syncs critical FSM state from Redis to Postgres
 * Ensures conversation state survives Redis TTL expiry or failures
 */

type CriticalEvent =
  | 'subscription_activated'
  | 'campaign_created'
  | 'export_completed'
  | 'email_set'

/**
 * Backup user session state to Postgres on critical events
 */
export async function backupSessionState(
  chatId: string,
  context: UserContext,
  event: CriticalEvent
): Promise<void> {
  try {
    const db = createServerClient() as any

    const { error } = await db
      .from('user_sessions')
      .upsert(
        {
          telegram_chat_id: chatId,
          state: context.state,
          context_data: context,
          last_event: event,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_chat_id' }
      )

    if (error) {
    }
  } catch {
    // Non-critical - log but don't throw
  }
}

/**
 * Restore session state from Postgres backup
 * Used when Redis state has expired (TTL) or been lost
 */
export async function restoreSessionState(
  chatId: string
): Promise<UserContext | null> {
  try {
    const db = createServerClient() as any

    const { data, error } = await db
      .from('user_sessions')
      .select('context_data, updated_at')
      .eq('telegram_chat_id', chatId)
      .single()

    if (error || !data) return null

    // Check if backup is less than 7 days old
    const backupAge = Date.now() - new Date(data.updated_at).getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000

    if (backupAge > sevenDays) {
      return null
    }

    return data.context_data as UserContext
  } catch {
    return null
  }
}

/**
 * Enhanced getContext that falls back to Postgres if Redis is empty
 */
export async function getContextWithFallback(
  chatId: string,
  redisContext: UserContext | null
): Promise<UserContext | null> {
  if (redisContext) return redisContext

  // Try restoring from Postgres backup
  const restored = await restoreSessionState(chatId)
  if (restored) {
  }
  return restored
}

/**
 * Determine if an event is critical enough to trigger backup
 */
export function isCriticalEvent(
  previousState: BotState | undefined,
  newState: BotState,
  context: UserContext
): CriticalEvent | null {
  if (newState === BotState.AWAITING_SUBSCRIPTION) return 'subscription_activated'
  if (newState === BotState.CREATING_CAMPAIGN && context.campaignTopic) return 'campaign_created'
  if (newState === BotState.EXPORTING_CAMPAIGN) return 'export_completed'
  if (context.email && previousState === BotState.AWAITING_EMAIL) return 'email_set'
  return null
}
