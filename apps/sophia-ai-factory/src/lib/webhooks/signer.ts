/**
 * HMAC-SHA256 signing for outbound webhooks.
 * Uses Web Crypto API — edge runtime safe (no Node crypto module).
 * @module lib/webhooks/signer
 */

/**
 * Sign a request body with an endpoint secret using HMAC-SHA256.
 * Returns lowercase hex digest.
 */
export async function sign(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(body));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify a hex HMAC-SHA256 signature against a body and secret.
 * Uses timing-safe comparison via subtle.verify.
 */
export async function verify(secret: string, body: string, hexSig: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const sigBytes = new Uint8Array(
      hexSig.match(/.{2}/g)?.map(b => parseInt(b, 16)) ?? [],
    );

    return crypto.subtle.verify('HMAC', keyMaterial, sigBytes, enc.encode(body));
  } catch {
    return false;
  }
}
