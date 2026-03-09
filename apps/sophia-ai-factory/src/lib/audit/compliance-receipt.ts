/**
 * Compliance Receipt Generator for ROIaaS Audit Trail
 *
 * Generates signed receipts for audit log entries using HMAC-SHA256.
 * Receipts provide cryptographic proof of audit events for:
 * - Customer self-verification of license validations
 * - External auditor compliance checks without DB access
 * - Legal evidence (signed, timestamped proof)
 *
 * @module audit/compliance-receipt
 */

import { randomUUID } from 'node:crypto'
import { hmacSha256, sha256, timingSafeEqual } from './crypto-utils'
import type { RaasAuditLogRow } from '@/lib/supabase/types'

/**
 * Receipt secret key from environment
 * Must be 32+ bytes entropy for security
 * Read dynamically at function call time for testability
 */
function getReceiptSecret(): string {
  return process.env.AUDIT_RECEIPT_SECRET || ''
}

/**
 * Receipt time-to-live (1 hour in seconds)
 * Prevents indefinite receipt reuse
 */
const RECEIPT_TTL = 60 * 60

/**
 * Compliance Receipt structure
 * Provides cryptographic proof of an audit log entry
 */
export interface ComplianceReceipt {
  /** Unique receipt identifier (UUID) */
  receiptId: string
  /** Reference to raas_audit_logs.id */
  auditLogId: string
  /** Audit action (CREATE | VALIDATE | REVOKE | UPDATE) */
  action: string
  /** License nonce identifier */
  licenseNonce: string
  /** Original event timestamp (Unix seconds) */
  timestamp: number
  /** Actor user ID or 'system' */
  actorId: string
  /** SHA-256 hash of IP address (privacy protection) */
  actorIpHash: string
  /** Content hash from audit log (hash chain link) */
  contentHash: string
  /** HMAC-SHA256 signature */
  signature: string
  /** Receipt generation timestamp (Unix seconds) */
  issuedAt: number
  /** Receipt expiration timestamp (Unix seconds) */
  expiresAt: number
}

/**
 * Generate a signed compliance receipt from an audit log entry
 *
 * @param log - Audit log row from raas_audit_logs table
 * @returns Signed compliance receipt with all fields populated
 * @throws Error if RECEIPT_SECRET is not configured
 *
 * @example
 * const receipt = generateReceipt(auditLog)
 * // receipt.signature contains HMAC-SHA256 signature
 */
export function generateReceipt(log: RaasAuditLogRow): ComplianceReceipt {
  // Validate secret is configured
  const receiptSecret = getReceiptSecret()
  if (!receiptSecret) {
    throw new Error(
      'AUDIT_RECEIPT_SECRET environment variable is required. ' +
      'Generate a secure random 32+ byte hex string.'
    )
  }

  const now = Math.floor(Date.now() / 1000)

  // Build receipt structure
  const receipt: ComplianceReceipt = {
    receiptId: randomUUID(),
    auditLogId: log.id,
    action: log.action,
    licenseNonce: log.license_nonce || '',
    timestamp: log.created_at,
    actorId: log.user_id || 'system',
    actorIpHash: log.ip_address ? sha256(log.ip_address) : '',
    contentHash: log.content_hash,
    signature: '',
    issuedAt: now,
    expiresAt: now + RECEIPT_TTL
  }

  // Compute deterministic signature payload (sorted keys for consistency)
  const signaturePayload = JSON.stringify({
    action: receipt.action,
    actorId: receipt.actorId,
    actorIpHash: receipt.actorIpHash,
    auditLogId: receipt.auditLogId,
    contentHash: receipt.contentHash,
    licenseNonce: receipt.licenseNonce,
    receiptId: receipt.receiptId,
    timestamp: receipt.timestamp
  })

  // Sign with HMAC-SHA256
  receipt.signature = hmacSha256(signaturePayload, receiptSecret)

  return receipt
}

/**
 * Verify a compliance receipt's signature and expiration
 *
 * @param receipt - Compliance receipt to verify
 * @returns true if receipt is valid and not expired, false otherwise
 *
 * @example
 * const isValid = verifyReceipt(receipt)
 * if (isValid) {
 *   console.log('Receipt verified - audit log is authentic')
 * }
 */
export function verifyReceipt(receipt: ComplianceReceipt): boolean {
  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (now > receipt.expiresAt) {
    return false
  }

  // Recompute signature payload (same deterministic format as generate)
  const signaturePayload = JSON.stringify({
    action: receipt.action,
    actorId: receipt.actorId,
    actorIpHash: receipt.actorIpHash,
    auditLogId: receipt.auditLogId,
    contentHash: receipt.contentHash,
    licenseNonce: receipt.licenseNonce,
    receiptId: receipt.receiptId,
    timestamp: receipt.timestamp
  })

  const expectedSignature = hmacSha256(signaturePayload, getReceiptSecret())

  // Constant-time comparison prevents timing attacks
  return timingSafeEqual(receipt.signature, expectedSignature)
}

/**
 * Serialize receipt to JSON string for transmission/storage
 *
 * @param receipt - Compliance receipt to serialize
 * @returns Pretty-printed JSON string (2-space indent)
 *
 * @example
 * const jsonStr = serializeReceipt(receipt)
 * // Send to client or store in database
 */
export function serializeReceipt(receipt: ComplianceReceipt): string {
  return JSON.stringify(receipt, null, 2)
}

/**
 * Parse JSON string back to ComplianceReceipt
 *
 * @param json - JSON string containing receipt data
 * @returns Parsed receipt object or null if invalid
 *
 * @example
 * const receipt = parseReceipt(jsonString)
 * if (receipt) {
 *   const valid = verifyReceipt(receipt)
 * }
 */
export function parseReceipt(json: string): ComplianceReceipt | null {
  try {
    const parsed = JSON.parse(json)

    // Basic validation - check required fields exist
    if (
      !parsed.receiptId ||
      !parsed.auditLogId ||
      !parsed.action ||
      !parsed.signature
    ) {
      return null
    }

    // Type validation for critical fields
    if (
      typeof parsed.receiptId !== 'string' ||
      typeof parsed.auditLogId !== 'string' ||
      typeof parsed.action !== 'string' ||
      typeof parsed.signature !== 'string'
    ) {
      return null
    }

    return parsed as ComplianceReceipt
  } catch {
    return null
  }
}

/**
 * Receipt verification result with detailed error information
 */
export interface ReceiptVerificationResult {
  /** Whether receipt is valid */
  valid: boolean
  /** Receipt ID being verified */
  receiptId: string
  /** Human-readable verification message */
  message: string
  /** Reason for failure (if invalid) */
  reason?: string
}

/**
 * Full receipt verification with detailed error reporting
 *
 * @param receipt - Compliance receipt to verify
 * @returns Verification result with detailed error information
 *
 * @example
 * const result = verifyReceiptDetailed(receipt)
 * if (!result.valid) {
 *   console.error(`Verification failed: ${result.reason}`)
 * }
 */
export function verifyReceiptDetailed(
  receipt: ComplianceReceipt
): ReceiptVerificationResult {
  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (now > receipt.expiresAt) {
    return {
      valid: false,
      receiptId: receipt.receiptId,
      message: 'Receipt verification failed',
      reason: `Receipt expired at ${new Date(receipt.expiresAt * 1000).toISOString()}`
    }
  }

  // Recompute signature
  const signaturePayload = JSON.stringify({
    action: receipt.action,
    actorId: receipt.actorId,
    actorIpHash: receipt.actorIpHash,
    auditLogId: receipt.auditLogId,
    contentHash: receipt.contentHash,
    licenseNonce: receipt.licenseNonce,
    receiptId: receipt.receiptId,
    timestamp: receipt.timestamp
  })

  const expectedSignature = hmacSha256(signaturePayload, getReceiptSecret())

  const signatureMatch = timingSafeEqual(receipt.signature, expectedSignature)

  if (!signatureMatch) {
    return {
      valid: false,
      receiptId: receipt.receiptId,
      message: 'Receipt verification failed',
      reason: 'Signature mismatch - receipt may have been tampered with'
    }
  }

  return {
    valid: true,
    receiptId: receipt.receiptId,
    message: 'Receipt verified successfully'
  }
}
