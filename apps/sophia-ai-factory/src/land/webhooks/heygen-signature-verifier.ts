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

    // HeyGen format: `t=<unix>.<body>` — try timestamp-prefixed signature first
    const ts = Math.floor(Date.now() / 1000)
    const toSign = `${ts}.${rawBody}`
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(toSign))
    const tsHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const expected = enc.encode(tsHex)
    const provided = enc.encode(providedSignature.toLowerCase())

    if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
      return true
    }

    // Fallback: legacy bare-hex over raw body (no timestamp prefix)
    const legacyBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
    const legacyHex = Array.from(new Uint8Array(legacyBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const legacyExpected = enc.encode(legacyHex)
    return legacyExpected.length === provided.length && timingSafeEqual(legacyExpected, provided)
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
