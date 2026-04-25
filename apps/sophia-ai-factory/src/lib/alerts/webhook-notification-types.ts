/**
 * Types for Webhook Notification Service
 * @module alerts/webhook-notification-types
 */

export type WebhookEventType =
  | 'quota.threshold'
  | 'quota.exceeded'
  | 'overage.detected'
  | 'subscription.expiring'
  | 'payment.failed'

export interface WebhookPayload {
  eventId: string
  event: WebhookEventType
  userId: string
  licenseNonce: string
  threshold?: number
  percentage: number
  limit: number
  currentUsage: number
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  exceededType?: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'
  timestamp: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
}

export interface WebhookDeliveryResult {
  success: boolean
  attempts: number
  responseStatus?: number
  error?: string
  deliveryTimeMs?: number
}
