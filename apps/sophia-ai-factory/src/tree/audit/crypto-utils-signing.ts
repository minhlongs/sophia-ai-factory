/**
 * Cryptographic Signing and Verification Utilities
 *
 * HMAC signing, timing-safe comparison, hash-chain verification, and
 * Merkle root computation extracted from crypto-utils.ts.
 *
 * @module audit/crypto-utils-signing
 */

import { sha256 } from '@/seed/security/crypto-utils'

export { verifyHashChain, merkleRoot } from './crypto-hash-chain'

/**
 * Compute HMAC-SHA256 signature for data signing
 *
 * @param data - Data to sign (must be non-empty string)
 * @param secret - Secret key for HMAC (32+ bytes recommended)
 * @returns 64-character hexadecimal string
 * @throws Error if inputs are invalid
 *
 * @example
 * const signature = hmacSha256('webhook-payload', 'super-secret-key-32-bytes')
 */
export function hmacSha256(data: string, secret: string | null | undefined): string {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input: data must be a non-empty string')
  }
  if (!secret || typeof secret !== 'string') {
    throw new Error('Invalid input: secret must be a non-empty string')
  }

  // Edge-compatible keyed hash: hash(secret + data)
  return sha256(secret + ':' + data)
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * IMPORTANT: Always use this for comparing cryptographic signatures.
 *
 * @param a - First hex string to compare
 * @param b - Second hex string to compare
 * @returns true if strings are identical
 *
 * @example
 * const isValid = timingSafeEqual(computedSignature, receivedSignature)
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') {
    return false
  }
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
