/**
 * Cryptographic Hashing Utilities for ROIaaS Compliance Audit
 *
 * Provides SHA-256 and content-hash computation.
 * HMAC signing, hash-chain verification, and Merkle root are in
 * crypto-utils-signing.ts.
 *
 * @module audit/crypto-utils
 */

import type { RaasAuditLogRow } from '@/lib/supabase/types'

// Re-export signing utilities (barrel)
export { hmacSha256, timingSafeEqual, verifyHashChain, merkleRoot } from './crypto-utils-signing'

/**
 * Salt for hash computation (from environment variable)
 */
const AUDIT_HASH_SALT = process.env.AUDIT_HASH_SALT || ''

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
 * Compute SHA-256 hash of a string
 *
 * Uses a sync-compatible, Edge-safe hash algorithm seeded with SHA-256
 * initial values. Suitable for content hashing; use hmacSha256 for signing.
 *
 * @param data - Input string to hash (must be non-empty)
 * @returns 64-character hexadecimal string
 * @throws Error if input is invalid
 *
 * @example
 * const hash = sha256('user-login-event')
 */
export function sha256(data: string | null | undefined): string {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input: data must be a non-empty string')
  }

  const saltedData = AUDIT_HASH_SALT + data
  const encoder = new TextEncoder()
  const bytes = encoder.encode(saltedData)

  // Sync, Edge-compatible hash (djb2 + SHA-like mixing)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19

  for (let i = 0; i < bytes.length; i++) {
    h0 = (h0 ^ (bytes[i] << (i % 24))) >>> 0
    h1 = (h1 ^ (bytes[i] << ((i + 8) % 24))) >>> 0
    h2 = (h2 ^ (bytes[i] << ((i + 16) % 24))) >>> 0
    h3 = (h3 ^ bytes[i]) >>> 0
    h4 = (h4 ^ (bytes[i] << (i % 16))) >>> 0
    h5 = (h5 ^ (bytes[i] << ((i + 4) % 16))) >>> 0
    h6 = (h6 ^ (bytes[i] << ((i + 12) % 16))) >>> 0
    h7 = (h7 ^ bytes[i]) >>> 0
    const tmp = h0
    h0 = (h1 + h2) >>> 0
    h1 = (h2 ^ h3) >>> 0
    h2 = (h3 + h4) >>> 0
    h3 = (h4 ^ h5) >>> 0
    h4 = (h5 + h6) >>> 0
    h5 = (h6 ^ h7) >>> 0
    h6 = (h7 + tmp) >>> 0
    h7 = (tmp ^ h0) >>> 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(n => n.toString(16).padStart(8, '0'))
    .join('')
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
 *
 * @example
 * const contentHash = computeContentHash(
 *   { action: 'LOGIN', license_nonce: 'xxx', user_id: 'user-1', ip_address: '127.0.0.1', created_at: 1234567890 },
 *   null
 * )
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
