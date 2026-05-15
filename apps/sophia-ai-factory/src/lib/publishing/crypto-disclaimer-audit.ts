/**
 * crypto-disclaimer-audit.ts — Audit utilities for crypto disclaimer compliance
 *
 * Creates stable hashes of disclaimer text for legal traceability.
 * Hash stored in audit log per publish event.
 *
 * @module lib/publishing/crypto-disclaimer-audit
 */

import { createHash } from 'node:crypto';

/**
 * Create a short SHA-256 hash (first 16 hex chars) of disclaimer text.
 * Used as a stable identifier in audit logs to prove which exact
 * disclaimer version was used at time of publish.
 */
export function createDisclaimerHash(disclaimerText: string): string {
  return createHash('sha256').update(disclaimerText, 'utf8').digest('hex').slice(0, 16);
}

export interface CryptoPublishAuditEntry {
  publishedAt: string;       // ISO timestamp
  channelId: string;
  jurisdiction: string;
  disclaimerHash: string;    // hash of disclaimer text used
  offerId: string;
  tenantId: string;
  blocked: boolean;
  blockReason?: string;
}

/**
 * Build a structured audit log entry for a crypto publish event.
 * Caller persists this to audit_log table or structured logger.
 */
export function buildCryptoAuditEntry(params: {
  channelId: string;
  jurisdiction: string;
  disclaimerHash: string;
  offerId: string;
  tenantId: string;
  blocked: boolean;
  blockReason?: string;
}): CryptoPublishAuditEntry {
  return {
    publishedAt: new Date().toISOString(),
    channelId: params.channelId,
    jurisdiction: params.jurisdiction,
    disclaimerHash: params.disclaimerHash,
    offerId: params.offerId,
    tenantId: params.tenantId,
    blocked: params.blocked,
    blockReason: params.blockReason,
  };
}
