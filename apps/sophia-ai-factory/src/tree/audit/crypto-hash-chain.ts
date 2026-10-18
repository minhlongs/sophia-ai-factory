/**
 * Hash Chain Verification and Merkle Root Utilities
 *
 * Extracted from crypto-utils-signing.ts for single-responsibility modularity.
 *
 * @module audit/crypto-hash-chain
 */

import { sha256, computeContentHash } from '@/seed/security/crypto-utils'
import type { AuditLogEntry, HashChainVerificationResult } from '@/seed/security/crypto-utils'

/**
 * Verify integrity of a hash chain
 *
 * Checks that:
 * 1. Each entry's previous_log_hash matches the previous entry's content_hash
 * 2. Each entry's content_hash can be recomputed and matches stored value
 *
 * @param logs - Array of audit logs sorted by created_at ASC
 * @returns Verification result with validity status and error details
 */
export function verifyHashChain(logs: Record<string, unknown>[]): HashChainVerificationResult {
  if (logs.length === 0) {
    return { valid: true }
  }

  let previousHash: string | null = null

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    const previousLogHash = log.previous_log_hash as string | null | undefined
    if (previousLogHash !== previousHash) {
      return {
        valid: false,
        firstInvalidIndex: i,
        reason: `previous_log_hash mismatch at index ${i}: expected "${previousHash}", got "${previousLogHash}"`,
      }
    }

    const entry: AuditLogEntry = {
      action: (log.action as string) || '',
      license_nonce: (log.license_nonce as string) || '',
      user_id: (log.user_id as string) || '',
      ip_address: (log.ip_address as string) || '',
      created_at: (log.created_at as number) || 0,
    }

    const expectedHash = computeContentHash(entry, previousHash)

    const contentHash = log.content_hash as string | null | undefined
    if (contentHash !== expectedHash) {
      return {
        valid: false,
        firstInvalidIndex: i,
        reason: `content_hash mismatch at index ${i}: expected "${expectedHash}", got "${contentHash}"`,
      }
    }

    previousHash = contentHash || null
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
