/**
 * Audit hash chain types and content hash helper — seed layer.
 *
 * @module seed/security/crypto-audit-hash
 */

import { sha256 } from './crypto-utils'

/**
 * Audit log entry interface for content hashing
 */
export interface AuditLogEntry {
  action: string
  license_nonce: string
  user_id: string
  ip_address: string
  created_at: number
  details?: Record<string, unknown>
}

/**
 * Result of hash chain verification
 */
export interface HashChainVerificationResult {
  /** Whether the entire chain is valid */
  valid: boolean
  /** Index of first invalid entry (undefined if valid) */
  firstInvalidIndex?: number
  /** Reason for invalidity (if applicable) */
  reason?: string
}

/**
 * Compute content hash for an audit log entry
 *
 * Deterministic hash from entry fields + previous hash in chain.
 * Format: action|license_nonce|user_id|ip_address|timestamp|previousHash
 *
 * @param entry - Audit log entry data
 * @param previousHash - Hash of previous log entry (null for first entry)
 * @returns 64-character hexadecimal string
 */
export function computeContentHash(
  entry: AuditLogEntry,
  previousHash: string | null
): string {
  const content = [
    entry.action,
    entry.license_nonce,
    entry.user_id,
    entry.ip_address,
    entry.created_at.toString(),
    previousHash || '',
  ].join('|')

  return sha256(content)
}
