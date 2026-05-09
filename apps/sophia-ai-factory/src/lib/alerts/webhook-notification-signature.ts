/**
 * HMAC-SHA256 signature helpers for Webhook Notification Service
 * @module alerts/webhook-notification-signature
 *
 * Migrated (Wave 13 G-I3): inbound verify now delegates to unified
 * verifyWebhook from lib/webhooks/signature. acceptLegacy=true for
 * backwards compat during 1 release cycle (~14 days from Wave 13).
 * Outbound generate uses signWebhook and returns the `t=<ts>,v1=<hex>` header.
 */

import { signWebhook, verifyWebhook } from '@/lib/webhooks/signature'
import { logger } from '@/seed/utils/logger-utility'
import type { WebhookPayload } from './webhook-notification-types'

/**
 * Generate outbound signature header.
 * Returns { signature: "t=<ts>,v1=<hex>", timestamp: ts }
 */
export async function generateWebhookSignature(
  payload: WebhookPayload,
  secret: string,
  timestamp?: number
): Promise<{ signature: string; timestamp: number }> {
  const ts = timestamp || Math.floor(Date.now() / 1000)
  const body = JSON.stringify(payload)
  const signature = await signWebhook(body, secret, ts)
  return { signature, timestamp: ts }
}

/**
 * Verify inbound webhook signature.
 *
 * Accepts either:
 *   - New unified header: `t=<ts>,v1=<hex>` (signature param)
 *   - Legacy split header: `v1=<hex>` + separate timestamp param
 *
 * For the legacy split case, reconstructs the unified header so that
 * verifyWebhook can handle it transparently.
 *
 * acceptLegacy=true: bare-hex format also accepted.
 */
export async function verifyWebhookSignature(
  signature: string,
  payload: string,
  timestamp: number,
  secret: string,
  tolerance = 300
): Promise<boolean> {
  // If caller already passes unified `t=...,v1=...` header, delegate directly
  if (signature.includes('t=') && signature.includes('v1=')) {
    return verifyWebhook(payload, signature, secret, {
      toleranceSec: tolerance,
      acceptLegacy: true,
    })
  }

  // Legacy bare-hex format detected — emit monitoring event
  if (/^[0-9a-f]{64}$/i.test(signature)) {
    logger.warn('webhook_legacy_signature_used', {
      event: 'webhook_legacy_signature_used',
      sender: 'alerts/webhook-notification',
      timestamp,
    })
    return verifyWebhook(payload, signature, secret, {
      toleranceSec: tolerance,
      acceptLegacy: true,
    })
  }

  // Legacy split header: reconstruct unified format for verifyWebhook
  const unifiedHeader = `t=${timestamp},${signature}`
  return verifyWebhook(payload, unifiedHeader, secret, {
    toleranceSec: tolerance,
    acceptLegacy: true,
  })
}
