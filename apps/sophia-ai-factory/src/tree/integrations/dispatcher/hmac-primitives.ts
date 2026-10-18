/**
 * Web Crypto HMAC-SHA256 & Constant-Time Signature Header Primitives
 *
 * Layer: tree/integrations
 *
 * @module tree/integrations/dispatcher/hmac-primitives
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
