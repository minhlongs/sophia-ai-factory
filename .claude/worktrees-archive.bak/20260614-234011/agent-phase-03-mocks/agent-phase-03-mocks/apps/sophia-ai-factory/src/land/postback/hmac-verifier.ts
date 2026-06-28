/**
 * Postback HMAC Verification — Web Crypto (Cloudflare Workers compatible)
 *
 * All comparisons use Web Crypto's constant-time verify.
 * No Node.js crypto — compatible with Cloudflare Workers.
 */

const enc = new TextEncoder();

/**
 * Verify HMAC-SHA256 where signature is hex-encoded.
 * Used by: binance_link, bybit (X-Signature header)
 */
export async function verifyHmacSha256Hex(
  secret: string,
  body: string,
  signatureHex: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = hexToBytes(signatureHex);
    if (!sigBytes) return false;
    return await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, enc.encode(body).buffer as ArrayBuffer);
  } catch {
    return false;
  }
}

/**
 * Verify HMAC-SHA256 where signature is base64-encoded.
 * Used by: partnerstack (pstack-signature header)
 */
export async function verifyHmacSha256Base64(
  secret: string,
  body: string,
  signatureBase64: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = base64ToBytes(signatureBase64);
    if (!sigBytes) return false;
    return await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, enc.encode(body).buffer as ArrayBuffer);
  } catch {
    return false;
  }
}

/**
 * Compute HMAC-SHA256 and return hex string.
 * Used for constructing expected signatures (e.g. awin query param, clickbank).
 */
export async function computeHmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bytesToHex(new Uint8Array(sig));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (isNaN(byte)) return null;
    arr[i / 2] = byte;
  }
  return arr;
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
