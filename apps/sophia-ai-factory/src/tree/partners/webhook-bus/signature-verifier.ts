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

export { parseSignatureHeader };

/**
 * Computes HMAC-SHA256 hex digest using standard Web Crypto API.
 */
export async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string equality check to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Signs a partner webhook payload with HMAC-SHA256.
 * Header format: X-Sophia-Signature-256: t=<timestamp_seconds>,v1=<hex_signature>
 */
export async function signPartnerWebhookPayload(
  secretKey: string,
  payload: string | Record<string, unknown>,
  timestampSeconds?: number,
): Promise<{ headerValue: string; timestamp: number; signature: string; signedMessage: string }> {
  const ts = timestampSeconds ?? Math.floor(Date.now() / 1000);
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedMessage = `${ts}.${payloadStr}`;
  const signature = await computeHmacSha256(secretKey, signedMessage);
  const headerValue = `t=${ts},v1=${signature}`;

  return {
    headerValue,
    timestamp: ts,
    signature,
    signedMessage,
  };
}

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
