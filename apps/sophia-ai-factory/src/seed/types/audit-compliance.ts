/**
 * Compliance receipt and manifest types for audit log verification.
 * @module @/types/audit-compliance
 */

/**
 * Compliance receipt for audit log verification
 * JWT-based signed receipt for external audit proof
 */
export interface ComplianceReceipt {
  /** Unique receipt identifier (UUID) */
  receiptId: string;
  /** Reference to audit log ID */
  auditLogId: string;
  /** Action type: CREATE | VALIDATE | REVOKE | UPDATE */
  action: string;
  /** License nonce identifier */
  licenseNonce: string;
  /** Unix timestamp of action */
  timestamp: number;
  /** Actor user ID or 'system' */
  actorId: string;
  /** SHA-256 hash of actor IP (privacy-preserving) */
  actorIpHash: string;
  /** Content hash from audit log */
  contentHash: string;
  /** HMAC-SHA256 signature of receipt data */
  signature: string;
  /** Receipt issuance timestamp */
  issuedAt: number;
  /** Receipt expiration timestamp (1 hour from issuance) */
  expiresAt: number;
}

/**
 * Hash chain manifest for compliance export
 * Generated for external audits (SOC 2, GDPR)
 */
export interface ComplianceManifest {
  /** Unique manifest identifier */
  manifestId: string;
  /** Generation timestamp */
  generatedAt: string;
  /** Admin user who generated */
  generatedBy: string;
  /** Time period covered */
  period: {
    start: number; // Unix timestamp
    end: number;   // Unix timestamp
  };
  /** Summary statistics */
  summary: {
    totalLogs: number;
    hashChainValid: boolean;
    firstHash: string;
    lastHash: string;
  };
  /** License-specific breakdown */
  licenses: Array<{
    nonce: string;
    tier: string;
    validationCount: number;
    receiptIds: string[];
  }>;
  /** Digital attestation */
  attestation: {
    statement: string;
    signedBy: string;
    signedAt: number;
    signature: string;
  };
}
