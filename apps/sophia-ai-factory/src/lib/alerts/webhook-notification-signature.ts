/**
 * HMAC-SHA256 signature helpers for Webhook Notification Service
 * @module alerts/webhook-notification-signature
 */

import crypto from 'crypto'
import type { WebhookPayload } from './webhook-notification-types'

export function generateWebhookSignature(
  payload: WebhookPayload,
  secret: string,
  timestamp?: number
): { signature: string; timestamp: number } {
  const ts = timestamp || Math.floor(Date.now() / 1000)
  const signedPayload = `${ts}.${JSON.stringify(payload)}`
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  return { signature: `v1=${signature}`, timestamp: ts }
}

export function verifyWebhookSignature(
  signature: string,
  payload: string,
  timestamp: number,
  secret: string,
  tolerance = 300
): boolean {
  try {
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > tolerance) return false

    const [version, sig] = signature.split('=')
    if (version !== 'v1' || !sig) return false

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSignature, 'hex'))
  } catch {
    return false
  }
}
