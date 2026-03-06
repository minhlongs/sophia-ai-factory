import { Tier } from '@/types'

/**
 * Stripe webhook event types for SaaS subscription billing
 */

export type StripeEventType =
  // Checkout events
  | 'checkout.session.completed'
  // Customer subscription events
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.paused'
  | 'customer.subscription.resumed'
  // Invoice events
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.upcoming'
  // Payment intent events
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'

export interface StripeWebhookEvent {
  id: string
  type: StripeEventType
  created: number
  data: {
    object: Record<string, unknown>
    previous_attributes?: Record<string, unknown>
  }
}

export interface StripeSubscriptionData {
  id: string
  status: string
  customer: string
  metadata?: Record<string, unknown>
  current_period_start?: number
  current_period_end?: number
  cancel_at_period_end?: boolean
  items?: {
    data: Array<{
      price: {
        id: string
        nickname?: string
        metadata?: Record<string, unknown>
      }
    }>
  }
}

export interface StripeCheckoutData {
  id: string
  status: string
  customer?: string
  metadata?: Record<string, unknown>
  subscription?: string
  mode?: 'payment' | 'subscription'
  amount_total?: number
  currency?: string
}

export interface StripeCustomerData {
  id: string
  email?: string
  name?: string
  metadata?: Record<string, unknown>
}

export interface StripeInvoiceData {
  id: string
  status: string
  customer?: string
  subscription?: string
  amount_paid?: number
  amount_due?: number
  currency?: string
  period_start?: number
  period_end?: number
  metadata?: Record<string, unknown>
}

export interface SubscriptionRecord {
  userId: string
  tier: Tier
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: 'active' | 'cancelled' | 'expired' | 'past_due'
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface PaymentEventRecord {
  event_type: string
  stripe_event_id: string
  polar_event_id?: string
  payload: Record<string, unknown>
  processed: boolean
}

/**
 * Map Stripe tier metadata to internal Tier type
 */
export function mapStripeTierToInternal(metadata: Record<string, unknown>): Tier | null {
  const tierValue = metadata.tier as string | undefined

  if (!tierValue) return null

  const validTiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']
  const upperTier = tierValue.toUpperCase() as Tier

  return validTiers.includes(upperTier) ? upperTier : null
}
