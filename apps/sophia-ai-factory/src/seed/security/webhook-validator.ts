/**
 * Webhook Signature Validator
 *
 * Utility for verifying webhook signatures from external services.
 * Supports HMAC-SHA256 signature verification.
 *
 * Migrated (Wave 13 G-I3): inline HMAC replaced with unified verifyWebhook
 * and signWebhook from lib/webhooks/signature. acceptLegacy=true for 1 release
 * cycle (~14 days from Wave 13) to allow bare-hex callers to migrate.
 *
 * Wave 14 J4: body parameter added — callers MUST pass raw request body.
 * Legacy bare-hex path emits webhook_legacy_signature_used warning.
 *
 * NOTE: Both functions are now async (Web Crypto API, edge-runtime safe).
 */

import { signWebhook, verifyWebhook } from '@/land/webhooks/signature';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Verify HMAC-SHA256 webhook signature.
 *
 * Accepts:
 *   - Unified header: `t=<unix>,v1=<hex>` (body required for HMAC verification)
 *   - Legacy split: `v1=<hex>` + separate timestamp param (reconstructed internally)
 *   - Legacy bare-hex: 64-char hex (acceptLegacy=true)
 *
 * @param body - Raw request body string (required — HMAC is computed over `${ts}.${body}`)
 * @param signature - Webhook signature from header (`v1=<hex>` or `t=<ts>,v1=<hex>`)
 * @param timestamp - Timestamp string from header (used when signature is `v1=<hex>`)
 * @param secret - Webhook secret key
 * @param tolerance - Tolerance in seconds (default: 5 minutes)
 * @returns true if signature is valid
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string,
  tolerance: number = 300
): Promise<boolean> {
  // Unified header path — delegate directly with full body
  if (signature.includes('t=') && signature.includes('v1=')) {
    return verifyWebhook(body, signature, secret, {
      toleranceSec: tolerance,
      acceptLegacy: true,
    });
  }

  // Legacy split-header path: reconstruct unified header
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Legacy bare-hex format detected — emit monitoring event
  if (/^[0-9a-f]{64}$/i.test(signature)) {
    logger.warn('webhook_legacy_signature_used', {
      event: 'webhook_legacy_signature_used',
      timestamp: ts,
    });
    return verifyWebhook(body, signature, secret, {
      toleranceSec: tolerance,
      acceptLegacy: true,
    });
  }

  const unifiedHeader = `t=${ts},${signature}`;
  return verifyWebhook(body, unifiedHeader, secret, {
    toleranceSec: tolerance,
    acceptLegacy: true,
  });
}

/**
 * Generate HMAC signature for outbound webhook.
 * Returns unified `t=<unix>,v1=<hex>` header string.
 *
 * @param payload - Webhook payload string (body)
 * @param secret - Webhook secret key
 * @param timestamp - Unix seconds (defaults to now)
 * @returns Unified signature header string
 */
export async function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  return signWebhook(payload, secret, timestamp);
}
