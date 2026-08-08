/**
 * Cryptographic Hashing Utilities for ROIaaS Compliance Audit
 *
 * Back-compat re-export from seed/security/crypto-utils (canonical).
 * Primitives (sha256, hmacSha256, timingSafeEqual, computeContentHash,
 * AuditLogEntry, HashChainVerificationResult) now live in seed layer.
 *
 * Domain-specific utilities (verifyHashChain, merkleRoot) remain here
 * since audit log shapes were removed (RaaS cutoff).
 *
 * @module audit/crypto-utils
 */

// Primitives from seed (canonical) — re-exported for back-compat
export {
  sha256,
  hmacSha256,
  timingSafeEqual,
  computeContentHash,
} from '@/seed/security/crypto-utils'
export type { AuditLogEntry, HashChainVerificationResult } from '@/seed/security/crypto-utils'

// Domain utilities — remain in tree/audit (use Record<string, unknown>)
export { verifyHashChain, merkleRoot } from './crypto-utils-signing'
