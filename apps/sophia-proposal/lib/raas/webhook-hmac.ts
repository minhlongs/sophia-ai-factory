/**
 * RaaS Webhook HMAC Signing
 *
 * Signs webhook payloads with HMAC-SHA256 so consumers can verify authenticity.
 * Uses per-org signing secret stored in raas_api_keys or a global fallback.
 */

import crypto from 'crypto';

const ALGORITHM = 'sha256';
const HEADER_NAME = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Format: t={timestamp},v1={hmac(timestamp.payload)}
 * This prevents replay attacks by binding signature to timestamp.
 */
export function signPayload(payload: string, secret: string): {
  signature: string;
  timestamp: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedContent = `${timestamp}.${payload}`;
  const hmac = crypto
    .createHmac(ALGORITHM, secret)
    .update(signedContent)
    .digest('hex');

  return {
    signature: `t=${timestamp},v1=${hmac}`,
    timestamp,
  };
}

/**
 * Verify an incoming webhook signature.
 * Tolerance: 5 minutes to account for clock skew.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSec = 300
): boolean {
  const parts = signature.split(',');
  const tsPart = parts.find((p) => p.startsWith('t='));
  const sigPart = parts.find((p) => p.startsWith('v1='));

  if (!tsPart || !sigPart) return false;

  const timestamp = tsPart.slice(2);
  const receivedHmac = sigPart.slice(3);

  // Validate hex format (prevent crash on invalid input)
  if (!/^[0-9a-f]{64}$/i.test(receivedHmac)) return false;

  // Check timestamp tolerance (prevent replay)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > toleranceSec) return false;

  // Recompute HMAC
  const signedContent = `${timestamp}.${payload}`;
  const expectedHmac = crypto
    .createHmac(ALGORITHM, secret)
    .update(signedContent)
    .digest('hex');

  // Constant-time comparison (safe — both buffers are 32 bytes)
  return crypto.timingSafeEqual(
    Buffer.from(receivedHmac, 'hex'),
    Buffer.from(expectedHmac, 'hex')
  );
}

/** Header names for webhook signing */
export const WEBHOOK_HEADERS = {
  signature: HEADER_NAME,
  timestamp: TIMESTAMP_HEADER,
} as const;
