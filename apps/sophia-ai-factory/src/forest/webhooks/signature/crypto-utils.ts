export const ENC = new TextEncoder();

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Timing-safe string comparison. Returns true iff a === b.
 * Resilient against length-based timing leaks by executing constant-time
 * bitwise accumulation across maxLen without early exit on length discrepancy.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = ENC.encode(a);
  const bb = ENC.encode(b);
  const maxLen = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < maxLen; i++) {
    const byteA = i < ab.length ? ab[i]! : 0;
    const byteB = i < bb.length ? bb[i]! : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

export async function importHmacKey(
  secret: string,
  usage: 'sign' | 'verify',
  hash: 'SHA-256' | 'SHA-512' = 'SHA-256',
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash },
    false,
    [usage],
  );
}

/**
 * Compute HMAC hex for a given algorithm + message string.
 * Used by inbound provider wrappers.
 */
export async function computeHmacHex(
  message: string,
  secret: string,
  hash: 'SHA-256' | 'SHA-512',
): Promise<string> {
  const key = await importHmacKey(secret, 'sign', hash);
  const buf = await crypto.subtle.sign('HMAC', key, ENC.encode(message));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
