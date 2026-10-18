/**
 * Compliance Receipt Verification & Serialization Helpers
 *
 * @module audit/compliance-receipt-verifier
 */

import {
  getReceiptSecret,
  verifyReceiptSignature,
} from '@/tree/audit/compliance-receipt-signing';
import type {
  ComplianceReceipt,
  ReceiptVerificationResult,
} from './compliance-receipt-types';

/**
 * Verify a compliance receipt's signature and expiration
 *
 * @returns true if receipt is valid and not expired, false otherwise
 */
export function verifyReceipt(receipt: ComplianceReceipt): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (now > receipt.expiresAt) {
    return false;
  }

  return verifyReceiptSignature(receipt, getReceiptSecret());
}

/**
 * Serialize receipt to JSON string for transmission/storage
 */
export function serializeReceipt(receipt: ComplianceReceipt): string {
  return JSON.stringify(receipt, null, 2);
}

/**
 * Parse JSON string back to ComplianceReceipt
 *
 * @returns Parsed receipt object or null if invalid
 */
export function parseReceipt(json: string): ComplianceReceipt | null {
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

    return parsed as ComplianceReceipt;
  } catch {
    return null;
  }
}

/**
 * Full receipt verification with detailed error reporting
 */
export function verifyReceiptDetailed(
  receipt: ComplianceReceipt
): ReceiptVerificationResult {
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
