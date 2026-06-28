/**
 * HeyGen webhook HMAC signature verification.
 * Uses Web Crypto API (compatible with Cloudflare Workers).
 * Constant-time comparison to prevent timing attacks.
 *
 * @module lib/webhooks/heygen-signature-verifier
 */

/**
 * Verify a HeyGen webhook HMAC-SHA256 signature.
 *
 * HeyGen sends the HMAC hex digest in the `signature` header.
 * The signature is computed over the raw request body string.
 */
export async function verifyHeyGenSignature(
  rawBody: string,
  providedSignature: string,
  secret: string,
): Promise<boolean> {
  const enc = new TextEncoder()

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
    const expectedHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const expected = enc.encode(expectedHex)
    const provided = enc.encode(providedSignature.toLowerCase())

    if (expected.length !== provided.length) return false

    // Constant-time comparison
    return timingSafeEqual(expected, provided)
  } catch {
    return false
  }
}

/**
 * Timing-safe byte-by-byte comparison of two Uint8Arrays.
 * Equivalent to Node.js crypto.timingSafeEqual for Web Crypto environments.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}
