/**
 * Compliance Receipt - Type Definitions
 *
 * Shared interfaces for compliance receipts and verification results.
 */

/**
 * Compliance Receipt structure
 * Provides cryptographic proof of an audit log entry
 */
export interface ComplianceReceipt {
  /** Unique receipt identifier (UUID) */
  receiptId: string;
  /** Reference to raas_audit_logs.id */
  auditLogId: string;
  /** Audit action (CREATE | VALIDATE | REVOKE | UPDATE) */
  action: string;
  /** License nonce identifier */
  licenseNonce: string;
  /** Original event timestamp (Unix seconds) */
  timestamp: number;
  /** Actor user ID or 'system' */
  actorId: string;
  /** SHA-256 hash of IP address (privacy protection) */
  actorIpHash: string;
  /** Content hash from audit log (hash chain link) */
  contentHash: string;
  /** HMAC-SHA256 signature */
  signature: string;
  /** Receipt generation timestamp (Unix seconds) */
  issuedAt: number;
  /** Receipt expiration timestamp (Unix seconds) */
  expiresAt: number;
}

/**
 * Receipt verification result with detailed error information
 */
export interface ReceiptVerificationResult {
  /** Whether receipt is valid */
  valid: boolean;
  /** Receipt ID being verified */
  receiptId: string;
  /** Human-readable verification message */
  message: string;
  /** Reason for failure (if invalid) */
  reason?: string;
}
