/**
 * Webhook Web Crypto HMAC-SHA256 Signing & Verification Engine
 *
 * Layer: tree (domain cryptographic primitives)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/webhook-bus/signature-verifier
 */

import {
  DEFAULT_TOLERANCE_SECONDS,
  type WebhookSignatureInput,
  type WebhookVerificationResult,
} from './types';
import {
  parseSignatureHeader,
  extractHeader,
  isHeaderLike,
} from './signature-header-helpers';
import {
  computeHmacSha256,
  timingSafeEqual,
  signPartnerWebhookPayload,
} from './signature-crypto';

export {
  parseSignatureHeader,
  computeHmacSha256,
  timingSafeEqual,
  signPartnerWebhookPayload,
};

/**
 * Verifies an incoming webhook signature using constant-time comparison
 * and anti-replay tolerance window check.
 */
export async function verifyPartnerWebhookSignature(
  secretKey: string,
  arg1: string | Record<string, unknown> | WebhookSignatureInput,
  arg2: string | Record<string, unknown> | WebhookSignatureInput,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  currentTimestampSeconds?: number,
): Promise<WebhookVerificationResult> {
  let signatureHeader = '';
  let rawBody = '';

  if (isHeaderLike(arg1)) {
    signatureHeader = extractHeader(arg1);
    rawBody = typeof arg2 === 'string' ? arg2 : JSON.stringify(arg2);
  } else {
    signatureHeader = extractHeader(arg2);
    rawBody = typeof arg1 === 'string' ? arg1 : JSON.stringify(arg1);
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return {
      valid: false,
      reason: 'Invalid or malformed signature header',
      error: 'INVALID_SIGNATURE_HEADER',
    };
  }

  const nowSeconds = currentTimestampSeconds ?? Math.floor(Date.now() / 1000);
  const age = Math.abs(nowSeconds - parsed.timestamp);

  if (age > toleranceSeconds) {
    return {
      valid: false,
      timestamp: parsed.timestamp,
      reason: `Signature timestamp outside tolerance window (${age}s > ${toleranceSeconds}s)`,
      error: 'TIMESTAMP_EXPIRED',
    };
  }

  const signedMessage = `${parsed.timestamp}.${rawBody}`;
  const expectedSignature = await computeHmacSha256(secretKey, signedMessage);

  if (!timingSafeEqual(expectedSignature, parsed.signature)) {
    return {
      valid: false,
      timestamp: parsed.timestamp,
      reason: 'Signature mismatch',
      error: 'SIGNATURE_MISMATCH',
    };
  }

  return {
    valid: true,
    timestamp: parsed.timestamp,
  };
}
