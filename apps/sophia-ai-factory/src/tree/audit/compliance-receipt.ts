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

import type { RaasAuditLogRow } from '@/land/supabase/types';
import {
  getReceiptSecret,
  buildSignaturePayload,
  signReceipt,
  hashIpAddress,
  verifyReceiptSignature,
} from '@/tree/audit/compliance-receipt-signing';

// Re-export types for consumers
export type { ComplianceReceipt, ReceiptVerificationResult } from './compliance-receipt-types';

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
export function generateReceipt(log: RaasAuditLogRow): import('./compliance-receipt-types').ComplianceReceipt {
  const receiptSecret = getReceiptSecret();
  if (!receiptSecret) {
    throw new Error(
      'AUDIT_RECEIPT_SECRET environment variable is required. ' +
      'Generate a secure random 32+ byte hex string.'
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const receipt: import('./compliance-receipt-types').ComplianceReceipt = {
    receiptId: globalThis.crypto.randomUUID(),
    auditLogId: log.id,
    action: log.action,
    licenseNonce: log.license_nonce || '',
    timestamp: log.created_at,
    actorId: log.user_id || 'system',
    actorIpHash: log.ip_address ? hashIpAddress(log.ip_address) : '',
    contentHash: log.content_hash,
    signature: '',
    issuedAt: now,
    expiresAt: now + RECEIPT_TTL,
  };

  const payload = buildSignaturePayload(receipt);
  receipt.signature = signReceipt(payload, receiptSecret);

  return receipt;
}

/**
 * Verify a compliance receipt's signature and expiration
 *
 * @returns true if receipt is valid and not expired, false otherwise
 */
export function verifyReceipt(receipt: import('./compliance-receipt-types').ComplianceReceipt): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (now > receipt.expiresAt) {
    return false;
  }

  return verifyReceiptSignature(receipt, getReceiptSecret());
}

/**
 * Serialize receipt to JSON string for transmission/storage
 */
export function serializeReceipt(receipt: import('./compliance-receipt-types').ComplianceReceipt): string {
  return JSON.stringify(receipt, null, 2);
}

/**
 * Parse JSON string back to ComplianceReceipt
 *
 * @returns Parsed receipt object or null if invalid
 */
export function parseReceipt(json: string): import('./compliance-receipt-types').ComplianceReceipt | null {
  try {
    const parsed = JSON.parse(json);

    if (
      !parsed.receiptId ||
      !parsed.auditLogId ||
      !parsed.action ||
      !parsed.signature
    ) {
      return null;
    }

    if (
      typeof parsed.receiptId !== 'string' ||
      typeof parsed.auditLogId !== 'string' ||
      typeof parsed.action !== 'string' ||
      typeof parsed.signature !== 'string'
    ) {
      return null;
    }

    return parsed as import('./compliance-receipt-types').ComplianceReceipt;
  } catch {
    return null;
  }
}

/**
 * Full receipt verification with detailed error reporting
 */
export function verifyReceiptDetailed(
  receipt: import('./compliance-receipt-types').ComplianceReceipt
): import('./compliance-receipt-types').ReceiptVerificationResult {
  const now = Math.floor(Date.now() / 1000);

  if (now > receipt.expiresAt) {
    return {
      valid: false,
      receiptId: receipt.receiptId,
      message: 'Receipt verification failed',
      reason: `Receipt expired at ${new Date(receipt.expiresAt * 1000).toISOString()}`,
    };
  }

  const signatureMatch = verifyReceiptSignature(receipt, getReceiptSecret());

  if (!signatureMatch) {
    return {
      valid: false,
      receiptId: receipt.receiptId,
      message: 'Receipt verification failed',
      reason: 'Signature mismatch - receipt may have been tampered with',
    };
  }

  return {
    valid: true,
    receiptId: receipt.receiptId,
    message: 'Receipt verified successfully',
  };
}
