/**
 * Webhook Notification Service — delivery + payload builders + barrel
 * @module alerts/webhook-notification-service
 */

import crypto from 'crypto'
import { logger } from '@/seed/utils/logger-utility'
import { toError, getErrorMessage } from '@/seed/utils/to-error'
import { triggerWebhookFailedAlert } from './realtime-alert-triggers'
import { generateWebhookSignature } from './webhook-notification-signature'
import type { WebhookPayload, WebhookDeliveryResult, WebhookMetadata } from './webhook-notification-types'

export type { WebhookEventType, WebhookPayload, WebhookDeliveryResult, WebhookMetadata } from './webhook-notification-types'
export { generateWebhookSignature, verifyWebhookSignature } from './webhook-notification-signature'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function sendWebhookAlert(
  webhookUrl: string,
  payload: WebhookPayload,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const maxRetries = 3
  const timeoutMs = 10000
  let lastError: string | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now()
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Sophia-AI-Factory-Webhook/1.0' }
      if (secret) {
        const { signature, timestamp } = await generateWebhookSignature(payload, secret)
        headers['X-Signature'] = signature
        headers['X-Timestamp'] = timestamp.toString()
      }

      const response = await fetch(webhookUrl, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs) })
      const deliveryTime = Date.now() - startTime

      if (response.ok) {
        logger.info('[Webhook Alert] Delivered successfully', { url: webhookUrl, eventId: payload.eventId, attempt, deliveryTimeMs: deliveryTime })
        return { success: true, attempts: attempt, responseStatus: response.status, deliveryTimeMs: deliveryTime }
      }

      lastError = `HTTP ${response.status}: ${response.statusText}`
      logger.warn('[Webhook Alert] Non-OK response', { url: webhookUrl, status: response.status, attempt })
    } catch (error) {
      const deliveryTime = Date.now() - startTime
      lastError = getErrorMessage(error)
      logger.warn('[Webhook Alert] Delivery failed', { url: webhookUrl, error: lastError, attempt, deliveryTimeMs: deliveryTime })
      if (attempt < maxRetries) await sleep(Math.pow(2, attempt - 1) * 1000)
    }
  }

  logger.error('[Webhook Alert] All retries failed', { url: webhookUrl, eventId: payload.eventId, attempts: maxRetries, lastError })
  await triggerWebhookFailedAlert({ userId: payload.userId, licenseNonce: payload.licenseNonce, webhookUrl, attempts: maxRetries, error: lastError || 'Unknown error' })
    .catch(err => logger.error('[Webhook Alert] Failed to trigger real-time alert', toError(err)))

  return { success: false, attempts: maxRetries, error: lastError }
}

export function createQuotaThresholdPayload(params: { userId: string; licenseNonce: string; threshold: number; percentage: number; limit: number; currentUsage: number; tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'; exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'; metadata?: WebhookMetadata }): WebhookPayload {
  return { eventId: crypto.randomUUID(), event: 'quota.threshold', userId: params.userId, licenseNonce: params.licenseNonce, threshold: params.threshold, percentage: params.percentage, limit: params.limit, currentUsage: params.currentUsage, tier: params.tier, exceededType: params.exceededType, timestamp: new Date().toISOString(), metadata: params.metadata }
}

export function createOverageDetectedPayload(params: { userId: string; licenseNonce: string; percentage: number; limit: number; currentUsage: number; overageAmount: number; overageFee: number; tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'; exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'; metadata?: WebhookMetadata }): WebhookPayload {
  return { eventId: crypto.randomUUID(), event: 'overage.detected', userId: params.userId, licenseNonce: params.licenseNonce, percentage: params.percentage, limit: params.limit, currentUsage: params.currentUsage, tier: params.tier, exceededType: params.exceededType, timestamp: new Date().toISOString(), metadata: { overageAmount: params.overageAmount, overageFee: params.overageFee, ...params.metadata } }
}
