/**
 * Audit Log Types - Hash Chain Compliance
 *
 * Types for cryptographic hash chain audit logging (SOC 2 compliance)
 *
 * @module @/types/audit-log
 */

export * from './audit-compliance';

/**
 * Hash chain entry for audit log integrity verification
 */
export interface HashChainEntry {
  /** SHA-256 hash of current log content */
  contentHash: string;
  /** SHA-256 hash of previous log (null for genesis) */
  previousHash: string | null;
  /** Unix timestamp of log entry */
  timestamp: number;
}

/**
 * Hash chain verification result
 */
export interface HashChainVerificationResult {
  /** Overall chain validity */
  isValid: boolean;
  /** Total logs verified */
  totalLogs: number;
  /** First invalid log index (if any) */
  firstInvalidIndex?: number;
  /** Error message if verification failed */
  errorMessage?: string;
  /** Details of each log verification */
  logResults: Array<{
    logId: string;
    isValid: boolean;
    errorMessage?: string;
  }>;
}

/**
 * Audit log with computed hash chain fields
 * Extends base RaasAuditLogRow with hash chain properties
 */
export interface AuditLogWithHash extends Record<string, unknown> {
  content_hash: string;
  previous_log_hash: string | null;
  hash_chain_valid: boolean;
}

/**
 * Audit action types
 */
export type AuditAction = 'CREATE' | 'VALIDATE' | 'REVOKE' | 'UPDATE' | 'USAGE';

/**
 * Base interface for audit actions with common fields
 */
export interface AuditActionBase {
  /** Action timestamp (Unix epoch) */
  timestamp: number;
  /** Actor user ID or 'system' */
  actorId?: string;
  /** Client IP address (raw, before hashing) */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** License tier at time of action */
  tier?: string;
}

/**
 * Usage audit action for model invocation tracking
 */
export interface UsageAuditAction extends AuditActionBase {
  action: 'USAGE';
  /** AI model name (e.g., gpt-4, claude-3) */
  model_name?: string;
  /** Total token count */
  token_count?: number;
  /** Input tokens (breakdown) */
  tokens_input?: number;
  /** Output tokens (breakdown) */
  tokens_output?: number;
  /** API endpoint called */
  endpoint?: string;
}

/**
 * Combined audit action type union
 */
export type AuditActionType =
  | { action: 'CREATE'; tier: string }
  | { action: 'VALIDATE'; isValid: boolean }
  | { action: 'REVOKE'; reason?: string }
  | { action: 'UPDATE'; changes?: Record<string, unknown> }
  | UsageAuditAction;

/**
 * Audit log query filters
 */
export interface AuditLogFilters {
  action?: AuditAction;
  licenseNonce?: string;
  userId?: string;
  startDate?: number;
  endDate?: number;
  hashChainValid?: boolean;
}

/**
 * Merkle tree node for multi-log verification
 * Used for efficient partial verification (future enhancement)
 */
export interface MerkleTreeNode {
  /** Node hash */
  hash: string;
  /** Left child (null for leaf nodes) */
  left: MerkleTreeNode | null;
  /** Right child (null for leaf nodes) */
  right: MerkleTreeNode | null;
  /** Log IDs covered by this node */
  logIds: string[];
}

/**
 * Environment variables required for audit logging
 */
export interface AuditEnvConfig {
  /** Salt for hash computation (prevent rainbow tables) */
  AUDIT_HASH_SALT: string;
  /** Secret for HMAC signing receipts */
  AUDIT_RECEIPT_SECRET: string;
  /** Signing key for manifest attestation */
  AUDIT_SIGNING_KEY: string;
}
