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
import { createLicense, logLicenseCreation, revokeLicense, logLicenseRevocation, reactivateLicenseBySubscription, revokeLicenseBySubscription } from '@/lib/raas-audit'
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
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Failed to auto-generate license', err)
    return null
  }
}

/**
 * Check if event was already processed (idempotency)
 * Uses database-level uniqueness of polar_event_id to prevent duplicates
 */
async function isEventProcessed(polarEventId: string): Promise<{
  isProcessed: boolean
  existingRecord?: PaymentEventRecord
}> {
  const supabase = getSupabase()

  // Check for existing processed event
  const { data, error } = await supabase
    .from('payment_events')
    .select('*')
    .eq('polar_event_id', polarEventId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Failed to check idempotency', err, {
      polarEventId,
      errorCode: error.code,
    })
    // On DB error, assume not processed to avoid silent failures
    return { isProcessed: false }
  }

  if (data?.processed) {
    logger.info('Event already processed (idempotency check)', {
      polarEventId,
      eventType: data.event_type,
      processedAt: data.created_at,
    })
    return { isProcessed: true, existingRecord: data as PaymentEventRecord }
  }

  // Event exists but not processed yet - could be in-progress or failed
  if (data && !data.processed) {
    logger.warn('Event exists but not marked processed - possible retry or in-progress', {
      polarEventId,
      eventType: data.event_type,
      createdAt: data.created_at,
    })
  }

  return { isProcessed: false }
}

/**
 * Record payment event in audit trail with retry logic
 */
async function recordPaymentEvent(
  event: PaymentEventRecord,
  retryCount = 0
): Promise<void> {
  const supabase = getSupabase()
  const maxRetries = 3

  try {
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
      throw error
    }

    logger.debug('Payment event recorded', {
      polarEventId: event.polar_event_id,
      eventType: event.event_type,
      processed: event.processed,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (retryCount < maxRetries) {
      logger.warn('Failed to record payment event, retrying', {
        polarEventId: event.polar_event_id,
        eventType: event.event_type,
        retryCount: retryCount + 1,
        maxRetries,
        error: errorMessage,
      })
      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)))
      return recordPaymentEvent(event, retryCount + 1)
    }

    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Failed to record payment event after retries', err, {
      polarEventId: event.polar_event_id,
      eventType: event.event_type,
      retryCount,
      maxRetries,
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
 * Process a Polar.sh webhook event with idempotency and robust error handling
 */
export async function processWebhookEvent(
  event: PolarWebhookEvent,
  webhookId: string
): Promise<{ success: boolean; message: string }> {
  const startTime = Date.now()

  logger.info('Processing webhook event', {
    eventType: event.type,
    webhookId,
    timestamp: new Date().toISOString(),
  })

  // Idempotency check - return early if already processed
  const { isProcessed } = await isEventProcessed(webhookId)
  if (isProcessed) {
    return { success: true, message: 'Event already processed' }
  }

  // Record event as pending (atomic operation - creates or updates)
  await recordPaymentEvent({
    event_type: event.type,
    polar_event_id: webhookId,
    payload: event.data,
    processed: false,
  })

  try {
    // Route to appropriate handler based on event type
    await handleEventByType(event)

    // Mark as processed after successful handling
    await recordPaymentEvent({
      event_type: event.type,
      polar_event_id: webhookId,
      payload: event.data,
      processed: true,
    })

    const duration = Date.now() - startTime
    logger.info('Webhook event processed successfully', {
      eventType: event.type,
      webhookId,
      durationMs: duration,
    })

    return { success: true, message: `Processed ${event.type}` }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Failed to process webhook event', err, {
      eventType: event.type,
      webhookId,
      error: errorMessage,
      stack: errorStack,
    })

    // Mark as failed (still false, allows retry)
    await recordPaymentEvent({
      event_type: event.type,
      polar_event_id: webhookId,
      payload: event.data,
      processed: false,
    })

    return {
      success: false,
      message: errorMessage,
    }
  }
}

async function handleCheckoutSuccess(
  data: Record<string, unknown>
): Promise<void> {
  const startTime = Date.now()
  const { userId, tier, telegramChatId } = extractMetadata(data)

  logger.info('Processing checkout.success event', {
    userId,
    tier,
    checkoutId: safeString(data.id),
  })

  if (!userId || !tier) {
    logger.warn('Checkout success: missing userId or tier in metadata', {
      checkoutId: safeString(data.id),
      userId,
      tier,
    })
    return
  }

  const dbTier = TIER_DB_MAPPING[tier]
  const supabase = getSupabase()
  const polarSubId = safeString(data.id)
  const customerEmail = (data.customer as Record<string, unknown> | undefined)?.email as string | undefined

  try {
    // Auto-generate license key
    const licenseResult = await generateLicenseOnPayment({
      userId,
      tier,
      email: customerEmail || userId,
      polarSubscriptionId: polarSubId || undefined,
      expiresAt: undefined, // Will default to 1 year
    })

    if (licenseResult) {
      logger.info('License generated for checkout', {
        userId,
        tier,
        noncePrefix: licenseResult.nonce.slice(0, 8),
      })
    }

    // Update user profile
    const { error } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: dbTier,
        subscription_status: 'active',
        polar_subscription_id: polarSubId,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('user_id', userId)

    if (error) {
      logger.error('Failed to update user profile after checkout', error instanceof Error ? error : new Error(String(error)), {
        userId,
        tier,
        polarSubId,
      })
      throw error
    }

    logger.info('User profile updated successfully', {
      userId,
      tier: dbTier,
      polarSubId,
    })

    // Send Telegram notification if chat_id available
    if (telegramChatId) {
      try {
        await notifySubscriptionActivated(telegramChatId, tier)
        logger.info('Telegram notification sent', {
          userId,
          telegramChatId,
        })
      } catch (notifError) {
        // Non-fatal: don't fail the whole operation
        logger.warn('Failed to send Telegram notification', {
          userId,
          telegramChatId,
          error: notifError instanceof Error ? notifError.message : String(notifError),
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Checkout success handling complete', {
      userId,
      checkoutId: polarSubId,
      durationMs: duration,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error handling checkout success', err, {
      userId,
      tier,
      checkoutId: polarSubId,
    })
    throw error
  }
}

async function handleSubscriptionCreated(
  data: Record<string, unknown>
): Promise<void> {
  const startTime = Date.now()
  const { userId, tier, telegramChatId } = extractMetadata(data)
  const resolvedTier = tier || 'PREMIUM'
  const periodEnd = safeString(data.current_period_end)
  const polarSubId = safeString(data.id)
  const customerEmail = (data.customer as Record<string, unknown> | undefined)?.email as string | undefined

  logger.info('Processing subscription.created event', {
    userId,
    tier: resolvedTier,
    polarSubId,
    periodEnd,
  })

  if (!polarSubId) {
    logger.warn('Subscription created: missing polarSubId', {
      userId,
      tier: resolvedTier,
    })
    return
  }

  try {
    // Auto-generate license key on subscription creation
    if (userId) {
      const licenseResult = await generateLicenseOnPayment({
        userId,
        tier: resolvedTier,
        email: customerEmail || userId,
        polarSubscriptionId: polarSubId,
        expiresAt: periodEnd || undefined,
      })

      if (licenseResult) {
        logger.info('License generated for subscription', {
          userId,
          tier: resolvedTier,
          noncePrefix: licenseResult.nonce.slice(0, 8),
        })
      }
    }

    // Activate subscription in DB
    await activateSubscription(
      userId || 'unknown',
      polarSubId,
      resolvedTier,
      periodEnd
    )

    logger.info('Subscription activated', {
      userId,
      polarSubId,
      tier: resolvedTier,
    })

    // Send Telegram notification if chat_id available
    if (telegramChatId && userId) {
      try {
        await notifySubscriptionActivated(telegramChatId, resolvedTier)
        logger.info('Telegram notification sent', {
          userId,
          telegramChatId,
        })
      } catch (notifError) {
        logger.warn('Failed to send Telegram notification', {
          userId,
          telegramChatId,
          error: notifError instanceof Error ? notifError.message : String(notifError),
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Subscription created handling complete', {
      userId,
      polarSubId,
      durationMs: duration,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error handling subscription created', err, {
      userId,
      polarSubId,
      tier: resolvedTier,
    })
    throw error
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
    // Handle renewal, tier upgrade/downgrade, or other updates
    const supabase = getSupabase()
    const metadata = (data.metadata || {}) as Record<string, unknown>
    const newTier = safeTier(metadata.tier)

    const updateData: Record<string, unknown> = {
      subscription_status: status,
      subscription_expires_at: safeString(data.current_period_end),
      updated_at: new Date().toISOString(),
    }

    // Handle tier change (upgrade/downgrade)
    if (newTier) {
      const dbTier = TIER_DB_MAPPING[newTier]
      updateData.subscription_tier = dbTier

      logger.info(`Tier changed for user ${targetUserId}: ${newTier}`)
    }

    await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', targetUserId)
  }
}

async function handleOrderCreated(
  data: Record<string, unknown>
): Promise<void> {
  const startTime = Date.now()
  const { userId, tier, telegramChatId } = extractMetadata(data)

  logger.info('Processing order.created event', {
    userId,
    tier,
    orderId: safeString(data.id),
  })

  if (!userId || !tier) {
    logger.warn('Order created: missing userId or tier in metadata', {
      orderId: safeString(data.id),
      userId,
      tier,
    })
    return
  }

  const dbTier = TIER_DB_MAPPING[tier]
  const supabase = getSupabase()
  const polarSubId = safeString(data.id)
  const customerEmail = (data.customer as Record<string, unknown> | undefined)?.email as string | undefined

  try {
    // Auto-generate license key for one-time order
    const licenseResult = await generateLicenseOnPayment({
      userId,
      tier,
      email: customerEmail || userId,
      polarSubscriptionId: polarSubId || undefined,
      expiresAt: undefined, // Will default to 1 year
    })

    if (licenseResult) {
      logger.info('License generated for order', {
        userId,
        tier,
        noncePrefix: licenseResult.nonce.slice(0, 8),
      })
    }

    // Update user profile
    const { error } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: dbTier,
        subscription_status: 'active',
        polar_subscription_id: polarSubId,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('user_id', userId)

    if (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to update user profile after order', err, {
        userId,
        tier,
        polarSubId,
      })
      throw error
    }

    logger.info('User profile updated for order', {
      userId,
      tier: dbTier,
      polarSubId,
    })

    // Send Telegram notification if chat_id available
    if (telegramChatId) {
      try {
        await notifySubscriptionActivated(telegramChatId, tier)
        logger.info('Telegram notification sent for order', {
          userId,
          telegramChatId,
        })
      } catch (notifError) {
        logger.warn('Failed to send Telegram notification for order', {
          userId,
          telegramChatId,
          error: notifError instanceof Error ? notifError.message : String(notifError),
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Order created handling complete', {
      userId,
      orderId: polarSubId,
      durationMs: duration,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error handling order created', err, {
      userId,
      tier,
      orderId: polarSubId,
    })
    throw error
  }
}

/**
 * Handle subscription.active event - Reactivate license after past_due
 */
async function handleSubscriptionActive(data: Record<string, unknown>): Promise<void> {
  const polarSubId = safeString(data.id)
  if (!polarSubId) return

  // Reactivate license associated with this subscription
  await reactivateLicenseBySubscription(polarSubId)

  logger.info('[Polar] Subscription active - license reactivated', { polarSubId })
}

/**
 * Handle subscription.past_due event - Add warning metadata (grace period)
 */
async function handleSubscriptionPastDue(data: Record<string, unknown>): Promise<void> {
  const polarSubId = safeString(data.id)
  const { userId } = extractMetadata(data)

  if (!polarSubId) return

  // Add warning to license metadata (don't revoke yet - 7 day grace period)
  const supabase = getSupabase()
  await supabase
    .from('raas_licenses')
    .update({
      metadata: {
        past_due: true,
        past_due_at: Date.now(),
        warning_sent: true,
      },
    })
    .eq('metadata->>polarSubscriptionId', polarSubId)

  logger.warn('[Polar] Subscription past due - warning added', {
    userId,
    polarSubId,
  })
}

/**
 * Handle subscription.expired event - Full license revoke
 */
async function handleSubscriptionExpired(data: Record<string, unknown>): Promise<void> {
  const polarSubId = safeString(data.id)
  if (!polarSubId) return

  // Full revoke (not soft - grace period expired)
  await revokeLicenseBySubscription(polarSubId, {
    soft: false,
    provider: 'polar',
  })

  logger.info('[Polar] Subscription expired - license revoked', { polarSubId })
}

/**
 * Route event to appropriate handler based on type
 */
async function handleEventByType(event: PolarWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'checkout.updated':
      if (event.data.status === 'succeeded') {
        await handleCheckoutSuccess(event.data)
      } else {
        logger.debug('Checkout not succeeded, skipping', {
          webhookId: event.data.id,
          status: event.data.status,
        })
      }
      break

    case 'subscription.created':
      await handleSubscriptionCreated(event.data)
      break

    case 'subscription.updated':
      await handleSubscriptionUpdated(event.data)
      break

    case 'subscription.cancelled':
      await handleSubscriptionCancelled(event.data)
      break

    // NEW: Phase 2-5 lifecycle events
    case 'subscription.active':
      await handleSubscriptionActive(event.data)
      break

    case 'subscription.past_due':
      await handleSubscriptionPastDue(event.data)
      break

    case 'subscription.expired':
      await handleSubscriptionExpired(event.data)
      break

    case 'order.created':
      await handleOrderCreated(event.data)
      break

    default:
      logger.warn('Unhandled webhook event type', {
        eventType: event.type,
        webhookId: event.data.id,
      })
  }
}
