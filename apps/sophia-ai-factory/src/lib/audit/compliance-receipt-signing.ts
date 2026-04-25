/**
 * Compliance Receipt - Signing and Verification Primitives
 *
 * Low-level HMAC signing helpers for compliance receipts.
 * Builds deterministic signature payloads and verifies them.
 */

import { hmacSha256, sha256, timingSafeEqual } from './crypto-utils';
import type { ComplianceReceipt } from './compliance-receipt-types';

/**
 * Receipt secret key from environment
 * Must be 32+ bytes entropy for security
 */
export function getReceiptSecret(): string {
  return process.env.AUDIT_RECEIPT_SECRET || '';
}

/**
 * Build deterministic signature payload from receipt fields
 * Keys are sorted for consistency across serialization
 */
export function buildSignaturePayload(receipt: Omit<ComplianceReceipt, 'signature' | 'issuedAt' | 'expiresAt'>): string {
  return JSON.stringify({
    action: receipt.action,
    actorId: receipt.actorId,
    actorIpHash: receipt.actorIpHash,
    auditLogId: receipt.auditLogId,
    contentHash: receipt.contentHash,
    licenseNonce: receipt.licenseNonce,
    receiptId: receipt.receiptId,
    timestamp: receipt.timestamp,
  });
}

/**
 * Sign receipt fields with HMAC-SHA256
 *
 * @returns HMAC-SHA256 hex string
 */
export function signReceipt(payload: string, secret: string): string {
  return hmacSha256(payload, secret);
}

/**
 * Hash an IP address for privacy-preserving storage
 */
export function hashIpAddress(ipAddress: string): string {
  return sha256(ipAddress);
}

/**
 * Verify a receipt signature using timing-safe comparison
 *
 * @returns true if signature matches
 */
export function verifyReceiptSignature(
  receipt: ComplianceReceipt,
  secret: string
): boolean {
  const payload = buildSignaturePayload(receipt);
  const expectedSignature = hmacSha256(payload, secret);
  return timingSafeEqual(receipt.signature, expectedSignature);
}
