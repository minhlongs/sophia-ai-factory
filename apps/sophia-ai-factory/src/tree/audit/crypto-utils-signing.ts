/**
 * Cryptographic Signing and Verification Utilities
 *
 * HMAC signing, timing-safe comparison, hash-chain verification, and
 * Merkle root computation extracted from crypto-utils.ts.
 *
 * @module audit/crypto-utils-signing
 */

import type { RaasAuditLogRow } from '@/tree/database/supabase-types'
import { sha256, computeContentHash } from '@/seed/security/crypto-utils'
import type { AuditLogEntry, HashChainVerificationResult } from '@/seed/security/crypto-utils'

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

/**
 * Verify integrity of a hash chain
 *
 * Checks that:
 * 1. Each entry's previous_log_hash matches the previous entry's content_hash
 * 2. Each entry's content_hash can be recomputed and matches stored value
 *
 * @param logs - Array of audit logs sorted by created_at ASC
 * @returns Verification result with validity status and error details
 *
 * @example
 * const result = verifyHashChain(auditLogs)
 * if (!result.valid) {
 *   console.log(`Chain broken at index ${result.firstInvalidIndex}: ${result.reason}`)
 * }
 */
export function verifyHashChain(logs: RaasAuditLogRow[]): HashChainVerificationResult {
  if (logs.length === 0) {
    return { valid: true }
  }

  let previousHash: string | null = null

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // Check 1: previous_hash links correctly
    if (log.previous_log_hash !== previousHash) {
      return {
        valid: false,
        firstInvalidIndex: i,
        reason: `previous_log_hash mismatch at index ${i}: expected "${previousHash}", got "${log.previous_log_hash}"`,
      }
    }

    // Check 2: content_hash matches recomputed value
    const entry: AuditLogEntry = {
      action: log.action,
      license_nonce: log.license_nonce || '',
      user_id: log.user_id || '',
      ip_address: log.ip_address || '',
      created_at: log.created_at,
    }

    const expectedHash = computeContentHash(entry, previousHash)

    if (log.content_hash !== expectedHash) {
      return {
        valid: false,
        firstInvalidIndex: i,
        reason: `content_hash mismatch at index ${i}: expected "${expectedHash}", got "${log.content_hash}"`,
      }
    }

    previousHash = log.content_hash
  }

  return { valid: true }
}

/**
 * Generate a Merkle root from an array of hashes
 *
 * Used for efficient verification of large audit log batches.
 * If odd number of hashes, the last hash is duplicated.
 *
 * @param hashes - Array of 64-char hex hashes
 * @returns Single 64-char hex Merkle root hash
 * @throws Error if hashes array is empty
 *
 * @example
 * const root = merkleRoot(['hash1', 'hash2', 'hash3', 'hash4'])
 */
export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    throw new Error('Cannot compute Merkle root of empty hash array')
  }
  if (hashes.length === 1) {
    return hashes[0]
  }

  const nextLevel: string[] = []
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i]
    const right = hashes[i + 1] || hashes[i]
    nextLevel.push(sha256(left + right))
  }

  return merkleRoot(nextLevel)
}
