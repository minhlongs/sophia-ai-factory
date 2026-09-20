/**
 * Timing-Safe HMAC Verification Engine
 * Cloudflare Workers Edge-native using Web Crypto API (crypto.subtle).
 *
 * @module tree/affiliate/hmac-verifier
 */

export type HmacAlgorithm = 'SHA-256' | 'SHA-1' | 'SHA-512';

/**
 * Strips prefixes like 'sha256=', 'sha1=', 'sha512=' and trims/lowercases signature.
 */
function normalizeSignature(sig: string): string {
  let s = sig.trim().toLowerCase();
  if (s.startsWith('sha256=')) {
    s = s.slice(7);
  } else if (s.startsWith('sha1=')) {
    s = s.slice(5);
  } else if (s.startsWith('sha512=')) {
    s = s.slice(7);
  } else if (s.startsWith('v1=')) {
    s = s.slice(3);
  }
  return s;
}

/**
 * Computes an HMAC digest in hexadecimal format.
 */
export async function generateAffiliateHmac(
  rawBody: string,
  secret: string,
  algorithm: HmacAlgorithm = 'SHA-256',
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies that a webhook payload signature matches the expected HMAC digest.
 * Operates in constant-time using bitwise XOR over every byte to defeat timing attacks.
 */
export async function verifyAffiliateHmac(
  rawBody: string,
  signature: string,
  secret: string,
  algorithm: HmacAlgorithm = 'SHA-256',
): Promise<boolean> {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const cleanSig = normalizeSignature(signature);
    if (!cleanSig) {
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign', 'verify'],
    );

    const signedBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const computedHex = Array.from(new Uint8Array(signedBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Unequal length check
    if (computedHex.length !== cleanSig.length) {
      return false;
    }

    // Constant-time bitwise XOR comparison across all characters
    let mismatch = 0;
    for (let i = 0; i < computedHex.length; i++) {
      mismatch |= computedHex.charCodeAt(i) ^ cleanSig.charCodeAt(i);
    }

    return mismatch === 0;
  } catch {
    return false;
  }
}
