import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_DB_MAPPING } from '@/lib/subscription'
import { Tier } from '@/types'
import { PaymentEventRecord, PolarWebhookEvent } from './polar-types'
import {
  activateSubscription,
  cancelSubscription,
  findUserByPolarSubId,
} from './polar-subscription-service'
import {
  notifySubscriptionActivated,
  notifySubscriptionCancelled,
} from '@/lib/services/notification-service'
import { logger } from '@/lib/utils/logger-utility'

const VALID_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE']

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function safeTier(value: unknown): Tier | null {
  if (typeof value === 'string' && VALID_TIERS.includes(value as Tier)) {
    return value as Tier
  }
  return null
}

function getSupabase() {
  return createAdminClient()
}

/**
 * Check if event was already processed (idempotency)
 */
async function isEventProcessed(polarEventId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('payment_events')
    .select('id')
    .eq('polar_event_id', polarEventId)
    .eq('processed', true)
    .single()

  return !!data
}

/**
 * Record payment event in audit trail
 */
async function recordPaymentEvent(
  event: PaymentEventRecord
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('payment_events').upsert(
    {
      event_type: event.event_type,
      polar_event_id: event.polar_event_id,
      payload: event.payload,
      processed: event.processed,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'polar_event_id' }
  )

  if (error) {
    logger.error('Failed to record payment event', error instanceof Error ? error : undefined, {
      polarEventId: event.polar_event_id,
      eventType: event.event_type,
    })
  }
}

/**
 * Extract user ID and tier from event metadata or DB lookup
 */
function extractMetadata(data: Record<string, unknown>): {
  userId: string | null
  tier: Tier | null
  telegramChatId: string | null
} {
  const metadata = (data.metadata || {}) as Record<string, unknown>
  return {
    userId: safeString(metadata.userId),
    tier: safeTier(metadata.tier),
    telegramChatId: safeString(metadata.telegram_chat_id),
  }
}

/**
 * Process a Polar.sh webhook event with idempotency
 */
export async function processWebhookEvent(
  event: PolarWebhookEvent,
  webhookId: string
): Promise<{ success: boolean; message: string }> {
  // Idempotency check
  if (await isEventProcessed(webhookId)) {
    return { success: true, message: 'Event already processed' }
  }

  // Record event as pending
  await recordPaymentEvent({
    event_type: event.type,
    polar_event_id: webhookId,
    payload: event.data,
    processed: false,
  })

  try {
    switch (event.type) {
      case 'checkout.updated':
        if (event.data.status === 'succeeded') {
          await handleCheckoutSuccess(event.data)
        }
        break

      case 'subscription.created':
        await handleSubscriptionCreated(event.data)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data)
        break

      case 'order.created':
        await handleOrderCreated(event.data)
        break

      default:
    }

    // Mark as processed
    await recordPaymentEvent({
      event_type: event.type,
      polar_event_id: webhookId,
      payload: event.data,
      processed: true,
    })

    return { success: true, message: `Processed ${event.type}` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function handleCheckoutSuccess(
  data: Record<string, unknown>
): Promise<void> {
  const { userId, tier, telegramChatId } = extractMetadata(data)
  if (!userId || !tier) {
    return
  }

  const dbTier = TIER_DB_MAPPING[tier]
  const supabase = getSupabase()
  const polarSubId = safeString(data.id)

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: dbTier,
      subscription_status: 'active',
      polar_subscription_id: polarSubId,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', userId)

  if (error) throw error

  if (telegramChatId) {
    await notifySubscriptionActivated(telegramChatId, tier)
  }
}

async function handleSubscriptionCreated(
  data: Record<string, unknown>
): Promise<void> {
  const { userId, tier, telegramChatId } = extractMetadata(data)
  if (!userId) {
    return
  }

  const resolvedTier = tier || 'PREMIUM'
  const periodEnd = safeString(data.current_period_end)
  const polarSubId = safeString(data.id)

  if (!polarSubId) return

  await activateSubscription(
    userId,
    polarSubId,
    resolvedTier,
    periodEnd
  )

  if (telegramChatId) {
    await notifySubscriptionActivated(telegramChatId, resolvedTier)
  }
}

async function handleSubscriptionUpdated(
  data: Record<string, unknown>
): Promise<void> {
  const { userId, telegramChatId } = extractMetadata(data)
  let targetUserId = userId
  const polarSubId = safeString(data.id)

  // Fallback: find user by polar subscription ID
  if (!targetUserId && polarSubId) {
    targetUserId = await findUserByPolarSubId(polarSubId)
  }

  if (!targetUserId) {
    return
  }

  const status = safeString(data.status)

  if (status === 'canceled' || status === 'cancelled') {
    if (polarSubId) {
      await cancelSubscription(polarSubId)
    }

    if (telegramChatId) {
      const periodEnd = safeString(data.current_period_end)
      await notifySubscriptionCancelled(telegramChatId, periodEnd)
    }
  } else {
    // Handle renewal or other updates
    const supabase = getSupabase()
    await supabase
      .from('user_profiles')
      .update({
        subscription_status: status,
        subscription_expires_at: safeString(data.current_period_end),
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('user_id', targetUserId)
  }
}

async function handleOrderCreated(
  data: Record<string, unknown>
): Promise<void> {
  const { userId, tier, telegramChatId } = extractMetadata(data)
  if (!userId || !tier) return

  const dbTier = TIER_DB_MAPPING[tier]
  const supabase = getSupabase()
  const polarSubId = safeString(data.id)

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: dbTier,
      subscription_status: 'active',
      polar_subscription_id: polarSubId,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', userId)

  if (error) throw error

  if (telegramChatId) {
    await notifySubscriptionActivated(telegramChatId, tier)
  }
}
