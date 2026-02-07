import { Tier } from '@/types'

/**
 * Polar.sh payment event types for webhook processing
 */

export type PolarEventType =
  | 'checkout.created'
  | 'checkout.updated'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'order.created'

export interface PolarWebhookEvent {
  type: PolarEventType
  data: Record<string, unknown>
}

export interface PolarSubscriptionData {
  id: string
  status: string
  metadata?: Record<string, unknown>
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end?: boolean
  product_id?: string
}

export interface PolarCheckoutData {
  id: string
  status: string
  metadata?: Record<string, unknown>
  product_id?: string
}

export interface SubscriptionRecord {
  userId: string
  tier: Tier
  polarSubscriptionId: string
  status: 'active' | 'cancelled' | 'expired'
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

/**
 * PPP pricing tiers based on country purchasing power
 */
export type PPPTier = 1 | 2 | 3

export interface PPPPricing {
  tier: PPPTier
  multiplier: number
  prices: {
    starter: number
    growth: number
    premium: number
  }
}

export interface PaymentEventRecord {
  event_type: string
  polar_event_id: string
  payload: Record<string, unknown>
  processed: boolean
}
