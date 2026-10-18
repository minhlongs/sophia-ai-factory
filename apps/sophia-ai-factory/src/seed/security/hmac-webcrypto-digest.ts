/**
 * Web Crypto HMAC-SHA256 Hex Digest Computation
 *
 * Layer: seed/security (Foundational primitive)
 *
 * @module seed/security/hmac-webcrypto-digest
 */

const ENC = new TextEncoder();

/**
 * Resolves the SubtleCrypto interface across edge runtimes and Node.js environments.
 */
function getSubtle(): SubtleCrypto {
  const c = typeof crypto !== 'undefined' ? crypto : (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in the current runtime environment');
  }
  return c.subtle;
}

/**
 * Computes raw HMAC-SHA256 hex digest for an input string using Web Crypto API.
 *
 * @param secret - Signing secret key
 * @param data - Content string to hash
 * @returns 64-character lowercase hexadecimal string
 */
export async function computeHmacSha256Hex(secret: string, data: string): Promise<string> {
  const subtle = getSubtle();
  const keyData = ENC.encode(secret);

  const cryptoKey = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await subtle.sign('HMAC', cryptoKey, ENC.encode(data));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
