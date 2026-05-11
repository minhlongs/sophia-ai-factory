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

/**
 * Arbitrary JSON-shaped payload attached to a webhook event. Use `unknown`
 * (not `any`) so consumers must narrow before reading — caller-defined keys
 * carry meaning per integration, not per static contract.
 */
export type WebhookMetadata = Record<string, unknown>

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
  metadata?: WebhookMetadata
}

export interface WebhookDeliveryResult {
  success: boolean
  attempts: number
  responseStatus?: number
  error?: string
  deliveryTimeMs?: number
}
