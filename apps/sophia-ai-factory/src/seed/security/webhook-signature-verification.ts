/**
 * Webhook Signature Verification
 * Verify webhook signatures để ensure requests come from trusted sources
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Verify Polar.sh webhook signature
 * https://docs.polar.sh/api/webhooks/validation
 */
export function verifyPolarWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Timing-safe comparison để prevent timing attacks
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Polar webhook signature verification failed', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Verify Telegram webhook signature
 * https://core.telegram.org/bots/api#setwebhook
 */
export function verifyTelegramWebhookSignature(
  token: string,
  headerHash: string,
  data: string
): boolean {
  try {
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(token)
      .digest();

    const hmac = createHmac('sha256', secretKey);
    hmac.update(data);
    const expectedHash = hmac.digest('hex');

    return timingSafeEqual(
      Buffer.from(headerHash),
      Buffer.from(expectedHash)
    );
  } catch (error) {
    logger.error('Telegram webhook signature verification failed', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Verify generic HMAC signature
 * Dùng cho custom webhooks
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  try {
    const hmac = createHmac(algorithm, secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Handle signatures with algorithm prefix (e.g., "sha256=...")
    const signatureValue = signature.includes('=')
      ? signature.split('=')[1]
      : signature;

    return timingSafeEqual(
      Buffer.from(signatureValue),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('HMAC signature verification failed', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Verify webhook timestamp để prevent replay attacks
 * Returns true nếu timestamp trong acceptable range
 */
export function verifyWebhookTimestamp(
  timestamp: number,
  maxAgeSeconds: number = 300 // 5 minutes default
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  // Check if timestamp is not too old
  if (age > maxAgeSeconds) {
    logger.warn(`Webhook timestamp too old: ${age}s (max: ${maxAgeSeconds}s)`);
    return false;
  }

  // Check if timestamp is not in the future (allow 1 minute clock skew)
  if (age < -60) {
    logger.warn(`Webhook timestamp in future: ${age}s`);
    return false;
  }

  return true;
}

/**
 * Generate HMAC signature for outgoing webhooks
 */
export function generateHmacSignature(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  const hmac = createHmac(algorithm, secret);
  hmac.update(payload);
  return `${algorithm}=${hmac.digest('hex')}`;
}
