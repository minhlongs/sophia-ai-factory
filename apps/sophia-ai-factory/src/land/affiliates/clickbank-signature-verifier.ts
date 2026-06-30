/**
 * ClickBank INS Signature Verifier
 *
 * Verifies HMAC-SHA1 signatures from ClickBank Instant Notification Service (INS).
 * Uses Web Crypto API (compatible with Cloudflare Workers — NOT node:crypto).
 * Timing-safe comparison via constant-time XOR accumulator.
 * Audit logs verification failures for security monitoring.
 *
 * @module affiliates/clickbank-signature-verifier
 */

import { logger } from '@/seed/utils/logger-utility'

/**
 * Encode a string to Uint8Array with a guaranteed plain ArrayBuffer backing.
 * Required to satisfy Web Crypto API overloads that expect ArrayBuffer (not SharedArrayBuffer).
 */
function encode(str: string): Uint8Array<ArrayBuffer> {
  const src = new TextEncoder().encode(str)
  // Allocate a fresh ArrayBuffer to strip any SharedArrayBuffer possibility
  const buf = new ArrayBuffer(src.length)
  new Uint8Array(buf).set(src)
  return new Uint8Array(buf) as Uint8Array<ArrayBuffer>
}

/**
 * Constant-time byte comparison. Returns true if both arrays are equal.
 * XOR accumulates differences — never short-circuits.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

/**
 * Convert ArrayBuffer to lowercase hex string.
 */
function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify a ClickBank INS HMAC-SHA1 signature.
 *
 * @param body - Raw request body string (URL-encoded)
 * @param signature - Value from X-ClickBank-Signature header
 * @param secret - CLICKBANK_INS_SECRET env var
 * @returns true if signature is valid
 */
export async function verifyClickBankSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!body || !signature || !secret) {
    logger.warn('[clickbank-signature] Missing required parameters', {
      hasBody: !!body,
      hasSignature: !!signature,
      hasSecret: !!secret,
    })
    return false
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )

  const signatureBuf = await crypto.subtle.sign('HMAC', keyMaterial, encode(body))
  const computed = bufferToHex(signatureBuf)

  const sigClean = signature.trim().toLowerCase()
  // Reject malformed signatures (SHA-1 = 40 hex chars) before timing-safe compare
  if (!/^[0-9a-f]{40}$/.test(sigClean)) {
    logger.warn('[clickbank-signature] Malformed signature format rejected', {
      sigLength: sigClean.length,
      hasNonHex: !/^[0-9a-f]+$/.test(sigClean),
    })
    return false
  }

  const isValid = timingSafeEqual(encode(computed), encode(sigClean))

  if (!isValid) {
    logger.warn('[clickbank-signature] Signature verification failed', {
      bodyPreview: body.slice(0, 64),
      sigPrefix: sigClean.slice(0, 8),
    })
  }

  return isValid
}
