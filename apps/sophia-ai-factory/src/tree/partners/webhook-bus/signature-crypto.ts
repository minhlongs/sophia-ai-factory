/**
 * Webhook Web Crypto HMAC-SHA256 Signing Primitives
 *
 * Layer: tree (domain cryptographic primitives)
 *
 * @module tree/partners/webhook-bus/signature-crypto
 */

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
