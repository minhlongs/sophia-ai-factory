import Stripe from 'stripe'
import { logger } from '@/lib/utils/logger-utility'

const STRIPE_API_VERSION = '2023-10-16' as const

/**
 * Stripe webhook signature verification
 *
 * Stripe signs webhooks using HMAC-SHA256 with the webhook secret.
 * Signature header format: "Stripe-Signature: t=<timestamp>,v1=<signature>"
 *
 * @see https://docs.stripe.com/webhooks#verify-official-libraries
 */

/**
 * Verify Stripe webhook signature using official SDK
 *
 * @param rawBody - Raw request body as string
 * @param signature - Stripe-Signature header value
 * @param secret - Stripe webhook secret from environment
 * @param tolerance - Timestamp tolerance in seconds (default: 300 = 5 minutes)
 * @returns Constructed Stripe.Event if valid, null otherwise
 */
export function verifyStripeWebhook(
  rawBody: string,
  signature: string,
  secret: string,
  tolerance: number = 300
): Stripe.Event | null {
  try {
    const stripe = new Stripe(secret, {
      apiVersion: STRIPE_API_VERSION,
    })

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
      tolerance
    )

    logger.debug('Stripe webhook signature verified', {
      eventId: event.id,
      eventType: event.type,
    })

    return event
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Stripe webhook signature verification failed', err, {
      errorMessage: err.message,
      errorStack: err.stack,
    })
    return null
  }
}

/**
 * Get Stripe webhook secret from environment
 */
export function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured in environment')
    return null
  }

  // Remove "whsec_" prefix if present (not standard for Stripe, but handle it)
  return secret.startsWith('whsec_') ? secret.substring(6) : secret
}

/**
 * Get Stripe API key from environment
 */
export function getStripeApiKey(): string | null {
  const apiKey = process.env.STRIPE_SECRET_KEY

  if (!apiKey) {
    logger.error('STRIPE_SECRET_KEY not configured in environment')
    return null
  }

  return apiKey
}

/**
 * Create Stripe client instance
 */
export function createStripeClient(): Stripe {
  const apiKey = getStripeApiKey()

  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }

  return new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}

/**
 * Extract event type safely
 */
export function getEventType(event: Stripe.Event): string {
  return event.type || 'unknown'
}

/**
 * Extract event ID safely
 */
export function getEventId(event: Stripe.Event): string {
  return event.id || 'unknown'
}

/**
 * Check if event is from test mode
 */
export function isTestMode(event: Stripe.Event): boolean {
  const data = event.data?.object as Record<string, unknown> | undefined
  return data?.['livemode'] === false
}
