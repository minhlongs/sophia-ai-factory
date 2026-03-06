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
import { generateLicenseKey } from '@/lib/raas-key-generator'
import { createLicense, logLicenseCreation, revokeLicense, logLicenseRevocation } from '@/lib/raas-audit'
import { createHash } from 'crypto'

const VALID_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']

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
  return createAdminClient() as any
}

/**
 * Auto-generate license key on successful payment
 * Called from checkout.updated, subscription.created, order.created handlers
 */
async function generateLicenseOnPayment(params: {
  userId: string
  tier: Tier
  email?: string
  polarSubscriptionId?: string
  expiresAt?: string
}): Promise<{ nonce: string; keyHash: string } | null> {
  try {
    const { userId, tier, email, polarSubscriptionId, expiresAt } = params

    // Calculate expiration timestamp
    let expiresTimestamp: number
    if (tier === 'MASTER') {
      // Master tier = perpetual
      expiresTimestamp = 0
    } else if (expiresAt) {
      expiresTimestamp = Math.floor(new Date(expiresAt).getTime() / 1000)
    } else {
      // Default: 1 year from now
      expiresTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
    }

    // Get secret from env
    const secret = process.env.RAAS_LICENSE_SECRET
    if (!secret) {
      logger.error('RAAS_LICENSE_SECRET not configured')
      return null
    }

    // Generate license key
    const expiresDate = expiresTimestamp === 0
      ? new Date(0)
      : new Date(expiresTimestamp * 1000)

    const tierLowercase = tier.toLowerCase() as 'basic' | 'premium' | 'enterprise' | 'master'
    const licenseKey = generateLicenseKey(tierLowercase, expiresDate, secret)

    // Parse key to get components
    const parts = licenseKey.split('_')
    if (parts.length !== 5) {
      logger.error('Invalid license key format')
      return null
    }
    const nonce = parts[3]

    // Hash the full key for storage
    const keyHash = createHash('sha256').update(licenseKey).digest('hex')

    // Store in database
    await createLicense({
      tier,
      nonce,
      keyHash,
      expiresAt: expiresTimestamp,
      createdBy: 'polar-webhook',
      metadata: {
        customerEmail: email,
        polarSubscriptionId,
        source: 'auto-generated',
        generatedAt: new Date().toISOString()
      }
    })

    // Log audit trail
    await logLicenseCreation({
      nonce,
      tier,
      timestamp: Math.floor(Date.now() / 1000),
      createdBy: 'polar-webhook',
      ipAddress: 'webhook',
      userAgent: 'Polar.sh'
    })

    logger.info(`Auto-generated license for user ${userId}, tier: ${tier}, nonce: ${nonce.slice(0, 8)}...`)

    return { nonce, keyHash }
  } catch (error) {
    logger.error('Failed to auto-generate license', error instanceof Error ? error : undefined)
    return null
  }
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
 * Handle subscription cancellation - deactivate associated license
 */
async function handleSubscriptionCancelled(
  data: Record<string, unknown>
): Promise<void> {
  const polarSubId = safeString(data.id)
  const periodEnd = safeString(data.current_period_end)

  if (!polarSubId) return

  // Cancel subscription in DB
  await cancelSubscription(polarSubId)

  // Find user by polar subscription ID
  const targetUserId = await findUserByPolarSubId(polarSubId)

  // Revoke license associated with this subscription
  if (targetUserId) {
    const supabase = getSupabase()

    // Find license by polarSubscriptionId in metadata
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('metadata->>polarSubscriptionId', polarSubId)
      .eq('is_revoked', false)
      .single()

    if (license) {
      await revokeLicense(license.nonce, 'polar-webhook-cancelled')
      await logLicenseRevocation({
        nonce: license.nonce,
        tier: license.tier,
        revokedBy: 'polar-webhook-cancelled',
        reason: 'Subscription cancelled via Polar.sh'
      })
      logger.info(`Revoked license ${license.nonce.slice(0, 8)}... due to subscription cancellation`)
    }
  }

  // Send notification
  if (periodEnd) {
    // Telegram notification would go here if chat_id was available
    logger.info(`Subscription ${polarSubId.slice(0, 8)}... cancelled, ends at ${periodEnd}`)
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

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event.data)
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
  const customerEmail = (data.customer as Record<string, unknown> | undefined)?.email as string | undefined

  // Auto-generate license key
  await generateLicenseOnPayment({
    userId,
    tier,
    email: customerEmail || userId,
    polarSubscriptionId: polarSubId || undefined,
    expiresAt: undefined // Will default to 1 year
  })

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
  const resolvedTier = tier || 'PREMIUM'
  const periodEnd = safeString(data.current_period_end)
  const polarSubId = safeString(data.id)
  const customerEmail = (data.customer as Record<string, unknown> | undefined)?.email as string | undefined

  if (!polarSubId) return

  // Auto-generate license key on subscription creation
  if (userId) {
    await generateLicenseOnPayment({
      userId,
      tier: resolvedTier,
      email: customerEmail || userId,
      polarSubscriptionId: polarSubId,
      expiresAt: periodEnd || undefined
    })
  }

  await activateSubscription(
    userId || 'unknown',
    polarSubId,
    resolvedTier,
    periodEnd
  )

  if (telegramChatId && userId) {
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
  const customerEmail = (data.customer as Record<string, unknown> | undefined)?.email as string | undefined

  // Auto-generate license key for one-time order
  await generateLicenseOnPayment({
    userId,
    tier,
    email: customerEmail || userId,
    polarSubscriptionId: polarSubId || undefined,
    expiresAt: undefined // Will default to 1 year
  })

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
