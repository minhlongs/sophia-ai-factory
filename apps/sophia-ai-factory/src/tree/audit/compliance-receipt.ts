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

import {
  getReceiptSecret,
  buildSignaturePayload,
  signReceipt,
  hashIpAddress,
} from '@/tree/audit/compliance-receipt-signing';

// Re-export types and verification helpers for consumers
export type { ComplianceReceipt, ReceiptVerificationResult } from './compliance-receipt-types';
export {
  verifyReceipt,
  serializeReceipt,
  parseReceipt,
  verifyReceiptDetailed,
} from './compliance-receipt-verifier';

/**
 * Receipt time-to-live (1 hour in seconds)
 * Prevents indefinite receipt reuse
 */
const RECEIPT_TTL = 60 * 60;

/**
 * Generate a signed compliance receipt from an audit log entry
 *
 * @throws Error if RECEIPT_SECRET is not configured
 */
export function generateReceipt(log: Record<string, unknown>): import('./compliance-receipt-types').ComplianceReceipt {
  const receiptSecret = getReceiptSecret();
  if (!receiptSecret) {
    throw new Error(
      'AUDIT_RECEIPT_SECRET environment variable is required. ' +
      'Generate a secure random 32+ byte hex string.'
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const logData = log as Record<string, unknown>;
  const ipAddress = logData.ip_address as string | undefined;
  const receipt: import('./compliance-receipt-types').ComplianceReceipt = {
    receiptId: globalThis.crypto.randomUUID(),
    auditLogId: String(logData.id || ''),
    action: String(logData.action || ''),
    licenseNonce: String(logData.license_nonce || '') || '',
    timestamp: Number(logData.created_at || 0),
    actorId: String(logData.user_id || 'system') || 'system',
    actorIpHash: ipAddress ? hashIpAddress(ipAddress) : '',
    contentHash: String(logData.content_hash || ''),
    signature: '',
    issuedAt: now,
    expiresAt: now + RECEIPT_TTL,
  };

  const payload = buildSignaturePayload(receipt);
  receipt.signature = signReceipt(payload, receiptSecret);

  return receipt;
}
