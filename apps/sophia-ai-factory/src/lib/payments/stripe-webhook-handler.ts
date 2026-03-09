import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_DB_MAPPING } from '@/lib/subscription'
import { Tier } from '@/types'
import { StripeWebhookEvent, StripeEventType, mapStripeTierToInternal, PaymentEventRecord } from './stripe-types'
import { logger } from '@/lib/utils/logger-utility'
import { generateLicenseKey } from '@/lib/raas-key-generator'
import { createLicense, logLicenseCreation, revokeLicense, logLicenseRevocation } from '@/lib/raas-audit'
import { createHash } from 'crypto'
import Stripe from 'stripe'
import { handlePaymentFailure, handlePaymentSuccess } from '@/lib/billing/dunning-workflow'
import { sendPaymentFailedEmail, sendPaymentSuccessEmail } from '@/lib/billing/resend-email-service'

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
 * Auto-generate license key on successful Stripe payment
 */
async function generateLicenseOnPayment(params: {
  userId: string
  tier: Tier
  email?: string
  stripeSubscriptionId?: string
  stripeCustomerId?: string
  expiresAt?: number
}): Promise<{ nonce: string; keyHash: string } | null> {
  try {
    const { userId, tier, email, stripeSubscriptionId, stripeCustomerId, expiresAt } = params

    // Calculate expiration timestamp
    let expiresTimestamp: number
    if (tier === 'MASTER') {
      // Master tier = perpetual
      expiresTimestamp = 0
    } else if (expiresAt) {
      expiresTimestamp = expiresAt
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
      createdBy: 'stripe-webhook',
      metadata: {
        customerEmail: email,
        stripeSubscriptionId,
        stripeCustomerId,
        source: 'auto-generated',
        generatedAt: new Date().toISOString()
      }
    })

    // Log audit trail
    await logLicenseCreation({
      nonce,
      tier,
      timestamp: Math.floor(Date.now() / 1000),
      createdBy: 'stripe-webhook',
      ipAddress: 'webhook',
      userAgent: 'Stripe'
    })

    logger.info(`[Stripe] Auto-generated license for user ${userId}, tier: ${tier}, nonce: ${nonce.slice(0, 8)}...`)

    return { nonce, keyHash }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[Stripe] Failed to auto-generate license', err)
    return null
  }
}

/**
 * Check if Stripe event was already processed (idempotency)
 */
async function isEventProcessed(stripeEventId: string): Promise<{
  isProcessed: boolean
  existingRecord?: PaymentEventRecord
}> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('payment_events')
    .select('*')
    .eq('stripe_event_id', stripeEventId)
    .single()

  if (error && error.code !== 'PGRST116') {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[Stripe] Failed to check idempotency', err, {
      stripeEventId,
      errorCode: error.code,
    })
    return { isProcessed: false }
  }

  if (data?.processed) {
    logger.info('[Stripe] Event already processed (idempotency check)', {
      stripeEventId,
      eventType: data.event_type,
      processedAt: data.created_at,
    })
    return { isProcessed: true, existingRecord: data as PaymentEventRecord }
  }

  return { isProcessed: false }
}

/**
 * Record Stripe event in audit trail with retry logic
 */
async function recordStripeEvent(
  event: PaymentEventRecord,
  retryCount = 0
): Promise<void> {
  const supabase = getSupabase()
  const maxRetries = 3

  try {
    const { error } = await supabase.from('payment_events').upsert(
      {
        event_type: event.event_type,
        stripe_event_id: event.stripe_event_id,
        payload: event.payload,
        processed: event.processed,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_event_id' }
    )

    if (error) {
      throw error
    }

    logger.debug('[Stripe] Payment event recorded', {
      stripeEventId: event.stripe_event_id,
      eventType: event.event_type,
      processed: event.processed,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (retryCount < maxRetries) {
      logger.warn('[Stripe] Failed to record payment event, retrying', {
        stripeEventId: event.stripe_event_id,
        eventType: event.event_type,
        retryCount: retryCount + 1,
        maxRetries,
        error: errorMessage,
      })
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)))
      return recordStripeEvent(event, retryCount + 1)
    }

    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[Stripe] Failed to record payment event after retries', err, {
      stripeEventId: event.stripe_event_id,
      eventType: event.event_type,
      retryCount,
      maxRetries,
    })
  }
}

/**
 * Find user by Stripe customer ID
 */
async function findUserByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  if (error || !data) {
    return null
  }

  return data.user_id
}

/**
 * Find user by Stripe subscription ID
 */
async function findUserByStripeSubscriptionId(stripeSubscriptionId: string): Promise<string | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single()

  if (error || !data) {
    return null
  }

  return data.user_id
}

/**
 * Extract user ID and tier from Stripe event metadata
 */
function extractMetadata(data: Record<string, unknown>): {
  userId: string | null
  tier: Tier | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
} {
  const metadata = (data.metadata || {}) as Record<string, unknown>

  return {
    userId: safeString(metadata.userId),
    tier: safeTier(metadata.tier),
    stripeCustomerId: safeString(metadata.stripe_customer_id),
    stripeSubscriptionId: safeString(metadata.stripe_subscription_id),
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(data: Record<string, unknown>): Promise<void> {
  const startTime = Date.now()
  const { userId, tier } = extractMetadata(data)
  const stripeCustomerId = safeString(data.customer as string)
  const stripeSubscriptionId = safeString(data.subscription as string)
  const mode = safeString(data.mode)
  const amountTotal = data.amount_total as number | undefined

  logger.info('[Stripe] Processing checkout.session.completed', {
    userId,
    tier,
    stripeCustomerId,
    stripeSubscriptionId,
    mode,
    amountTotal,
  })

  if (!userId || !tier) {
    logger.warn('[Stripe] Checkout: missing userId or tier in metadata', {
      checkoutId: safeString(data.id),
      userId,
      tier,
    })
    return
  }

  const dbTier = TIER_DB_MAPPING[tier]
  const supabase = getSupabase()

  try {
    // Auto-generate license key for one-time payment or subscription
    const licenseResult = await generateLicenseOnPayment({
      userId,
      tier,
      email: (data.customer_email as string) || userId,
      stripeSubscriptionId: stripeSubscriptionId || undefined,
      stripeCustomerId: stripeCustomerId || undefined,
      expiresAt: undefined, // Will default to 1 year
    })

    if (licenseResult) {
      logger.info('[Stripe] License generated for checkout', {
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
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('user_id', userId)

    if (error) throw error

    logger.info('[Stripe] User profile updated for checkout', {
      userId,
      tier: dbTier,
      stripeCustomerId,
    })

    const duration = Date.now() - startTime
    logger.info('[Stripe] Checkout handling complete', {
      userId,
      checkoutId: safeString(data.id),
      durationMs: duration,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[Stripe] Error handling checkout.session.completed', err, {
      userId,
      tier,
    })
    throw error
  }
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(data: Record<string, unknown>): Promise<void> {
  const startTime = Date.now()
  const { userId, tier } = extractMetadata(data)
  const resolvedTier = tier || 'PREMIUM'
  const stripeSubscriptionId = safeString(data.id)
  const stripeCustomerId = safeString(data.customer as string)
  const periodEnd = (data.current_period_end as number) || null

  logger.info('[Stripe] Processing customer.subscription.created', {
    userId,
    tier: resolvedTier,
    stripeSubscriptionId,
    stripeCustomerId,
    periodEnd,
  })

  if (!stripeSubscriptionId) {
    logger.warn('[Stripe] Subscription created: missing stripeSubscriptionId', {
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
        email: userId,
        stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId || undefined,
        expiresAt: periodEnd || undefined,
      })

      if (licenseResult) {
        logger.info('[Stripe] License generated for subscription', {
          userId,
          tier: resolvedTier,
          noncePrefix: licenseResult.nonce.slice(0, 8),
        })
      }
    }

    // Update user profile
    const supabase = getSupabase()
    const { error } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: TIER_DB_MAPPING[resolvedTier],
        subscription_status: 'active',
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_expires_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('user_id', userId || 'unknown')

    if (error) throw error

    logger.info('[Stripe] Subscription activated', {
      userId,
      stripeSubscriptionId,
      tier: resolvedTier,
    })

    const duration = Date.now() - startTime
    logger.info('[Stripe] Subscription created handling complete', {
      userId,
      stripeSubscriptionId,
      durationMs: duration,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[Stripe] Error handling customer.subscription.created', err, {
      userId,
      stripeSubscriptionId,
      tier: resolvedTier,
    })
    throw error
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(data: Record<string, unknown>): Promise<void> {
  const stripeSubscriptionId = safeString(data.id)
  const stripeCustomerId = safeString(data.customer as string)
  const status = safeString(data.status)

  if (!stripeSubscriptionId) return

  // Find user by subscription ID
  const targetUserId = await findUserByStripeSubscriptionId(stripeSubscriptionId)

  if (!targetUserId) {
    logger.warn('[Stripe] Subscription updated: user not found', {
      stripeSubscriptionId,
    })
    return
  }

  const supabase = getSupabase()
  const metadata = (data.metadata || {}) as Record<string, unknown>
  const newTier = mapStripeTierToInternal(metadata)

  const updateData: Record<string, unknown> = {
    subscription_status: status,
    subscription_expires_at: (data.current_period_end as number)
      ? new Date((data.current_period_end as number) * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }

  // Handle tier change
  if (newTier) {
    updateData.subscription_tier = TIER_DB_MAPPING[newTier]
    logger.info('[Stripe] Tier changed', { userId: targetUserId, newTier })
  }

  // Handle cancellation
  if (status === 'canceled' || status === 'cancelled') {
    updateData.subscription_status = 'cancelled'

    // Revoke license
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('metadata->>stripeSubscriptionId', stripeSubscriptionId)
      .eq('is_revoked', false)
      .single()

    if (license) {
      await revokeLicense(license.nonce, 'stripe-webhook-cancelled')
      await logLicenseRevocation({
        nonce: license.nonce,
        tier: license.tier,
        revokedBy: 'stripe-webhook-cancelled',
        reason: 'Subscription cancelled via Stripe'
      })
      logger.info('[Stripe] Revoked license due to subscription cancellation', {
        userId: targetUserId,
        noncePrefix: license.nonce.slice(0, 8),
      })
    }
  }

  await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('user_id', targetUserId)

  logger.info('[Stripe] Subscription updated', {
    userId: targetUserId,
    stripeSubscriptionId,
    status,
  })
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(data: Record<string, unknown>): Promise<void> {
  const stripeSubscriptionId = safeString(data.id)

  if (!stripeSubscriptionId) return

  const targetUserId = await findUserByStripeSubscriptionId(stripeSubscriptionId)

  if (!targetUserId) {
    logger.warn('[Stripe] Subscription deleted: user not found', {
      stripeSubscriptionId,
    })
    return
  }

  const supabase = getSupabase()

  // Update user profile
  await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'cancelled',
      subscription_expires_at: null,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', targetUserId)

  // Revoke license
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('nonce, tier')
    .eq('metadata->>stripeSubscriptionId', stripeSubscriptionId)
    .eq('is_revoked', false)
    .single()

  if (license) {
    await revokeLicense(license.nonce, 'stripe-webhook-deleted')
    await logLicenseRevocation({
      nonce: license.nonce,
      tier: license.tier,
      revokedBy: 'stripe-webhook-deleted',
      reason: 'Subscription deleted via Stripe'
    })
    logger.info('[Stripe] Revoked license due to subscription deletion', {
      userId: targetUserId,
      noncePrefix: license.nonce.slice(0, 8),
    })
  }

  logger.info('[Stripe] Subscription deleted', {
    userId: targetUserId,
    stripeSubscriptionId,
  })
}

/**
 * Handle invoice.paid event
 *
 * Flow:
 * 1. Lookup user by Stripe customer/subscription ID
 * 2. Get license nonce from raas_licenses table
 * 3. Call handlePaymentSuccess() from dunning-workflow
 * 4. Send payment success email via Resend
 * 5. Log to billing_events table
 */
async function handleInvoicePaid(data: Record<string, unknown>): Promise<void> {
  const stripeSubscriptionId = safeString(data.subscription as string)
  const stripeCustomerId = safeString(data.customer as string)
  const periodEnd = (data.period_end as number) || null
  const amountDue = data.amount_due as number | undefined
  const currency = data.currency as string | undefined

  if (!stripeCustomerId && !stripeSubscriptionId) {
    logger.warn('[Stripe] Invoice paid: no customer or subscription ID')
    return
  }

  const startTime = Date.now()

  try {
    const supabase = getSupabase()

    // Find user by customer ID first, then fallback to subscription ID
    let targetUserId = await findUserByStripeCustomerId(stripeCustomerId!)

    if (!targetUserId && stripeSubscriptionId) {
      targetUserId = await findUserByStripeSubscriptionId(stripeSubscriptionId)
    }

    if (!targetUserId) {
      logger.warn('[Stripe] Invoice paid: user not found', {
        stripeCustomerId,
        stripeSubscriptionId,
      })
      return
    }

    // Get license nonce for this user
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('created_by', targetUserId)
      .eq('is_revoked', false)
      .single()

    if (!license) {
      logger.warn('[Stripe] Invoice paid: no active license found', {
        userId: targetUserId,
        stripeCustomerId,
      })
      // Still update subscription expiry
      await supabase
        .from('user_profiles')
        .update({
          subscription_expires_at: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('user_id', targetUserId)
      return
    }

    const licenseNonce = license.nonce
    const tier = (license.tier || 'BASIC').toUpperCase() as Tier

    // Get charge ID
    const chargeId = typeof data.charge === 'string' ? data.charge : (data.charge as any)?.id

    // Call dunning workflow - handle payment success
    await handlePaymentSuccess({
      userId: targetUserId,
      licenseNonce,
      tier,
      amount: amountDue || 0,
      currency: currency || 'usd',
      paymentProvider: 'stripe',
      providerChargeId: chargeId || safeString(data.id as string) || '',
    })

    // Update subscription expiry
    await supabase
      .from('user_profiles')
      .update({
        subscription_expires_at: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('user_id', targetUserId)

    // Send payment success email
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', targetUserId)
      .single()

    if (userProfile?.email) {
      await sendPaymentSuccessEmail({
        userId: targetUserId,
        userEmail: userProfile.email,
        licenseNonce,
        tier,
        amount: amountDue || 0,
        currency: currency || 'usd',
        paymentProvider: 'stripe',
      })
    }

    // Log to billing_events table
    await supabase.from('billing_events').insert({
      user_id: targetUserId,
      license_nonce: licenseNonce,
      event_type: 'invoice_payment_succeeded',
      event_category: 'payment',
      event_data: {
        stripe_invoice_id: data.id,
        stripe_charge_id: chargeId,
        amount: amountDue,
        currency,
        period_end: periodEnd,
      },
      amount: amountDue,
      currency,
      payment_provider: 'stripe',
      provider_event_id: safeString(data.id),
      provider_charge_id: chargeId,
      processed: true,
      processed_at: new Date().toISOString(),
    } as any)

    const duration = Date.now() - startTime
    logger.info('[Stripe] Invoice paid - subscription extended', {
      userId: targetUserId,
      licenseNonce: licenseNonce.slice(0, 8),
      stripeCustomerId,
      periodEnd,
      durationMs: duration,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[Stripe] Failed to handle invoice paid', err)
    throw error
  }
}

/**
 * Handle invoice.payment_failed event
 *
 * Flow:
 * 1. Lookup user by Stripe customer ID
 * 2. Get license nonce from raas_licenses table
 * 3. Call handlePaymentFailure() from dunning-workflow
 * 4. Send payment failed email via Resend
 * 5. Log to billing_events table
 */
async function handleInvoicePaymentFailed(data: Record<string, unknown>): Promise<void> {
  const stripeCustomerId = safeString(data.customer as string)
  const amountDue = data.amount_due as number | undefined
  const currency = data.currency as string | undefined
  const failureReason = (data.charge as any)?.failure_message || 'Payment failed'

  if (!stripeCustomerId) {
    logger.warn('[Stripe] Invoice payment failed: no customer ID')
    return
  }

  const startTime = Date.now()

  try {
    const supabase = getSupabase()

    // Lookup user by Stripe customer ID
    const targetUserId = await findUserByStripeCustomerId(stripeCustomerId)

    if (!targetUserId) {
      logger.warn('[Stripe] Invoice payment failed: user not found', {
        stripeCustomerId,
      })
      return
    }

    // Get license nonce for this user
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('created_by', targetUserId)
      .eq('is_revoked', false)
      .single()

    if (!license) {
      logger.warn('[Stripe] Invoice payment failed: no active license found', {
        userId: targetUserId,
        stripeCustomerId,
      })
      // Still update user profile metadata
      await supabase
        .from('user_profiles')
        .update({
          metadata: {
            payment_failed: true,
            payment_failed_at: Date.now(),
          },
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('user_id', targetUserId)
      return
    }

    const licenseNonce = license.nonce
    const tier = (license.tier || 'BASIC').toUpperCase() as Tier

    // Call dunning workflow - handle payment failure
    await handlePaymentFailure({
      userId: targetUserId,
      licenseNonce,
      tier,
      amount: amountDue || 0,
      currency: currency || 'usd',
      failureReason,
      paymentProvider: 'stripe',
      stripeInvoiceId: safeString(data.id as string) || undefined,
    })

    // Send payment failed email
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', targetUserId)
      .single()

    if (userProfile?.email) {
      await sendPaymentFailedEmail({
        userId: targetUserId,
        userEmail: userProfile.email,
        licenseNonce,
        tier,
        amount: amountDue || 0,
        currency: currency || 'usd',
        failureReason,
        paymentProvider: 'stripe',
      })
    }

    // Log to billing_events table
    await supabase.from('billing_events').insert({
      user_id: targetUserId,
      license_nonce: licenseNonce,
      event_type: 'invoice_payment_failed',
      event_category: 'payment',
      event_data: {
        stripe_invoice_id: data.id,
        amount: amountDue,
        currency,
        failure_reason: failureReason,
      },
      amount: amountDue,
      currency,
      payment_provider: 'stripe',
      provider_event_id: safeString(data.id),
      processed: true,
      processed_at: new Date().toISOString(),
    } as any)

    const duration = Date.now() - startTime
    logger.info('[Stripe] Invoice payment failed handled', {
      userId: targetUserId,
      licenseNonce: licenseNonce.slice(0, 8),
      amount: amountDue,
      durationMs: duration,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[Stripe] Failed to handle invoice payment failed', err)
    throw error
  }
}

/**
 * Process a Stripe webhook event with idempotency and robust error handling
 */
export async function processStripeWebhookEvent(
  event: Stripe.Event,
  rawBody: string
): Promise<{ success: boolean; message: string }> {
  const startTime = Date.now()
  const eventId = event.id
  const eventType = event.type

  logger.info('[Stripe] Processing webhook event', {
    eventType,
    eventId,
    timestamp: new Date().toISOString(),
  })

  // Idempotency check
  const { isProcessed } = await isEventProcessed(eventId)
  if (isProcessed) {
    return { success: true, message: 'Event already processed' }
  }

  // Record event as pending
  await recordStripeEvent({
    event_type: eventType,
    stripe_event_id: eventId,
    payload: JSON.parse(rawBody),
    processed: false,
  })

  try {
    const data = event.data.object as Record<string, unknown>

    // Route to appropriate handler
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(data)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(data)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(data)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data)
        break

      case 'invoice.paid':
        await handleInvoicePaid(data)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(data)
        break

      default:
        logger.warn('[Stripe] Unhandled event type', {
          eventType,
          eventId,
        })
    }

    // Mark as processed
    await recordStripeEvent({
      event_type: eventType,
      stripe_event_id: eventId,
      payload: JSON.parse(rawBody),
      processed: true,
    })

    const duration = Date.now() - startTime
    logger.info('[Stripe] Webhook event processed successfully', {
      eventType,
      eventId,
      durationMs: duration,
    })

    return { success: true, message: `Processed ${eventType}` }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error('[Stripe] Failed to process webhook event', error instanceof Error ? error : new Error(String(error)), {
      eventType,
      eventId,
      error: errorMessage,
      stack: errorStack,
    })

    // Mark as failed (allows retry)
    await recordStripeEvent({
      event_type: eventType,
      stripe_event_id: eventId,
      payload: JSON.parse(rawBody),
      processed: false,
    })

    return {
      success: false,
      message: errorMessage,
    }
  }
}
