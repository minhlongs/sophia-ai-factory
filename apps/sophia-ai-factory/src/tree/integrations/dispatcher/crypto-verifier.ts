/**
 * Cryptographic Webhook Verifier & Signer
 *
 * Implements:
 * - Web Crypto HMAC-SHA256 signature signing and constant-time verification.
 * - Anti-replay attack tolerance window (default 300 seconds).
 * - Header parser for `t=<timestamp>,v1=<signature>`.
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/dispatcher/crypto-verifier
 */

import type {
  WebhookSignResult,
  WebhookVerificationResult,
} from '../types';
import {
  computeHmacSha256,
  timingSafeEqual,
  parseSignatureHeader,
} from './hmac-primitives';

export { computeHmacSha256, timingSafeEqual, parseSignatureHeader };

export const DEFAULT_TOLERANCE_SECONDS = 300; // 5 minutes
export const SIGNATURE_HEADER_NAME = 'X-Sophia-Signature-256';

/**
 * Signs a payload with HMAC-SHA256 using the standard format:
 * Header: `X-Sophia-Signature-256: t=<timestamp_seconds>,v1=<hex_signature>`
 * Signed Message: `${timestamp_seconds}.${payload_json}`
 */
export async function signWebhookPayload(
  secretKey: string,
  payloadJson: string,
  timestampSeconds?: number
): Promise<WebhookSignResult> {
  if (!secretKey || secretKey.trim().length === 0) {
    throw new Error('WEBHOOK_SECRET_REQUIRED: Cannot sign payload without a secret key');
  }

  const t = timestampSeconds ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${t}.${payloadJson}`;
  const signatureHex = await computeHmacSha256(secretKey, signedPayload);
  const signatureHeader = `t=${t},v1=${signatureHex}`;

  return {
    signatureHeader,
    timestampSeconds: t,
    signatureHex,
    signedPayload,
  };
}

/**
 * Verifies a webhook signature against payload and secret key.
 * Enforces replay attack tolerance window (default 300s).
 */
export async function verifyWebhookSignature(
  secretKey: string,
  payloadJson: string,
  signatureHeader: string,
  options: {
    toleranceSeconds?: number;
    currentTimestampSeconds?: number;
  } = {}
): Promise<WebhookVerificationResult> {
  if (!secretKey) {
    return { valid: false, reason: 'MISSING_SECRET_KEY' };
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return { valid: false, reason: 'MALFORMED_SIGNATURE_HEADER' };
  }

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSec = options.currentTimestampSeconds ?? Math.floor(Date.now() / 1000);

  // Check 5-minute replay window
  const delta = Math.abs(nowSec - parsed.timestampSeconds);
  if (delta > tolerance) {
    return {
      valid: false,
      reason: `REPLAY_ATTACK_DETECTED: Timestamp delta ${delta}s exceeds tolerance ${tolerance}s`,
      timestampSeconds: parsed.timestampSeconds,
    };
  }

  const signedPayload = `${parsed.timestampSeconds}.${payloadJson}`;
  const expectedHex = await computeHmacSha256(secretKey, signedPayload);

  if (!timingSafeEqual(expectedHex, parsed.signatureHex)) {
    return {
      valid: false,
      reason: 'INVALID_SIGNATURE: Signature mismatch',
      timestampSeconds: parsed.timestampSeconds,
    };
  }

  return {
    valid: true,
    timestampSeconds: parsed.timestampSeconds,
  };
}
