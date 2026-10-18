/**
 * Timing-Safe Web Crypto HMAC-SHA256 Webhook Signer & Verifier
 *
 * Designed for Cloudflare Workers edge runtime and V8 isolates:
 * - Pure Web Crypto API (`crypto.subtle` / `globalThis.crypto.subtle`)
 * - Zero Node.js built-ins (`crypto`, `node:crypto`, `Buffer`)
 * - Header format: `t=${timestamp},v1=${hexSignature}`
 * - Signed payload: `${timestamp}.${payload}`
 * - Clock drift protection: default +/- 300s window
 * - Constant-time XOR comparison against timing attacks
 *
 * Layer: seed/security (Foundational primitive)
 * Dependencies: None (0 upper-layer imports)
 *
 * @module seed/security/hmac-signer
 */

import {
  type ParsedSignatureHeader,
  timingSafeEqual,
  parseSignatureHeader,
} from './hmac-header-parser';
import { computeHmacSha256Hex } from './hmac-webcrypto-digest';

export type { ParsedSignatureHeader };
export { timingSafeEqual, parseSignatureHeader, computeHmacSha256Hex };

export const DEFAULT_TOLERANCE_SECONDS = 300;
export const WEBHOOK_SIGNATURE_HEADER = 'X-Sophia-Signature';

/**
 * Generates an outbound webhook signature header formatted as:
 * `t=${timestamp},v1=${hexSignature}`
 *
 * Signed payload is constructed as `${timestamp}.${payload}`.
 *
 * @param secret - Webhook endpoint signing secret (e.g. `whsec_...`)
 * @param payload - Request body string (JSON payload)
 * @param timestamp - Unix epoch timestamp in seconds (defaults to current time)
 * @returns Header string formatted as `t=<timestamp>,v1=<hex>`
 */
export async function generateWebhookSignature(
  secret: string,
  payload: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  if (!secret || typeof secret !== 'string') {
    throw new Error('INVALID_SIGNING_SECRET: secret must be a non-empty string');
  }
  if (payload === undefined || payload === null || typeof payload !== 'string') {
    throw new Error('INVALID_SIGNING_PAYLOAD: payload must be a string');
  }

  const toSign = `${timestamp}.${payload}`;
  const hex = await computeHmacSha256Hex(secret, toSign);

  return `t=${timestamp},v1=${hex}`;
}

/**
 * Verifies an incoming or outgoing webhook signature header.
 *
 * Defenses applied:
 * 1. Robust header syntax parsing (`t=...`, `v1=...`).
 * 2. Clock drift and replay attack defense (rejects timestamps outside +/- toleranceSeconds).
 * 3. Constant-time XOR comparison preventing timing side-channel attacks.
 *
 * @param secret - Webhook endpoint signing secret
 * @param payload - Webhook payload string (raw request body)
 * @param header - Value of the signature header (e.g. `X-Sophia-Signature`)
 * @param toleranceSeconds - Acceptable clock drift window in seconds (default: 300)
 * @returns true if signature is valid and within tolerance window, false otherwise
 */
export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  header: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS
): Promise<boolean> {
  if (!header || !secret || payload === undefined || payload === null || typeof payload !== 'string') {
    return false;
  }

  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return false;
  }

  // Clock drift & replay attack protection (rejects both stale replays and future clock drift > tolerance)
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsed.timestamp) > toleranceSeconds) {
    return false;
  }

  try {
    const expectedHeader = await generateWebhookSignature(secret, payload, parsed.timestamp);
    const expectedSig = expectedHeader.split(',v1=')[1];

    // Constant-time comparison
    return timingSafeEqual(parsed.v1.toLowerCase(), expectedSig.toLowerCase());
  } catch {
    return false;
  }
}
