/**
 * SOP Webhook HMAC — sign + verify
 *
 * Stripe-style signature format: `t=<unix>,v1=<hex>`
 * Header name: X-Sophia-Signature
 *
 * Each SOP installation gets a 32-byte random secret stored encrypted
 * in customizations.webhookSecret. Phase 3 generates it at install time.
 *
 * For Phase 2: sign/verify helpers only — secret management in Phase 3.
 *
 * Migrated (Wave 13 G-I3): inline HMAC replaced with unified verifyWebhook
 * from lib/webhooks/signature. acceptLegacy=true for 1 release cycle (~14 days).
 */

import { signWebhook, verifyWebhook } from '@/land/webhooks/signature';
import { logger } from '@/seed/utils/logger-utility';

/** Generate a random 32-byte webhook secret (hex-encoded) */
export function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign a request body with HMAC-SHA256.
 * Returns header value: `t=<unix>,v1=<hex>`
 */
export async function signPayload(
  body: string,
  secret: string,
  timestamp?: number,
): Promise<string> {
  return signWebhook(body, secret, timestamp);
}

/**
 * Verify a webhook signature header.
 * Returns true if valid, false otherwise.
 * Rejects signatures older than toleranceSec (default 300s = 5 min).
 *
 * acceptLegacy=true: bare-hex format still accepted for backwards compat
 * (deprecation timeline: 1 release cycle ~14 days from Wave 13).
 */
export async function verifySignature(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  // Legacy bare-hex format detected — emit monitoring event
  if (/^[0-9a-f]{64}$/i.test(signatureHeader)) {
    logger.warn('webhook_legacy_signature_used', {
      event: 'webhook_legacy_signature_used',
      sender: 'sop/webhook-hmac',
    });
  }
  return verifyWebhook(body, signatureHeader, secret, {
    toleranceSec,
    acceptLegacy: true,
  });
}
