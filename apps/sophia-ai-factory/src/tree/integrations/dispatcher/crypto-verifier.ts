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

export const DEFAULT_TOLERANCE_SECONDS = 300; // 5 minutes
export const SIGNATURE_HEADER_NAME = 'X-Sophia-Signature-256';

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
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
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
 * Parses `t=<timestamp>,v1=<signature>` header format.
 */
export function parseSignatureHeader(
  header: string
): { timestampSeconds: number; signatureHex: string } | null {
  if (!header || typeof header !== 'string') return null;

  const parts = header.split(',');
  let timestampSeconds: number | null = null;
  let signatureHex: string | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('t=')) {
      const val = parseInt(trimmed.slice(2), 10);
      if (Number.isFinite(val)) timestampSeconds = val;
    } else if (trimmed.startsWith('v1=')) {
      signatureHex = trimmed.slice(3).trim();
    }
  }

  if (timestampSeconds === null || !signatureHex) return null;
  return { timestampSeconds, signatureHex };
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
