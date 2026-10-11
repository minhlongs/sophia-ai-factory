/**
 * HMAC-SHA256 Signer & Edge-Safe Base64 Utilities
 *
 * Designed for Cloudflare Workers edge runtime and V8 isolates:
 * - Pure Web Crypto API (crypto.subtle)
 * - Zero Node.js built-ins
 * - Constant-time XOR comparison against timing attacks
 *
 * Layer: seed/security
 *
 * @module seed/security/signed-url/hmac-signer
 */

const ENC = new TextEncoder();
const DEC = new TextDecoder();

/**
 * Resolves SubtleCrypto across Cloudflare Workers, Node.js 18+, and browser environments.
 */
export function getSubtle(): SubtleCrypto {
  const c = typeof crypto !== 'undefined' ? crypto : (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in current runtime');
  }
  return c.subtle;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Iterates through all characters using bitwise XOR without early termination.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Encodes string to URL-safe Base64 without padding (RFC 4648 §5).
 * Edge-safe: zero Buffer dependency.
 */
export function stringToBase64Url(input: string): string {
  const bytes = ENC.encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes URL-safe Base64 string to original UTF-8 string.
 * Edge-safe: zero Buffer dependency.
 */
export function base64UrlToString(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return DEC.decode(bytes);
}

/**
 * Computes HMAC-SHA256 hex digest for given data and secret.
 */
export async function computeHmacSha256Hex(secret: string, data: string): Promise<string> {
  const subtle = getSubtle();
  const keyData = ENC.encode(secret);

  const cryptoKey = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await subtle.sign('HMAC', cryptoKey, ENC.encode(data));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
