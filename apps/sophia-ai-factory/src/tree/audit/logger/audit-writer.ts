/**
 * Audit Writer - Core event writers with compliance receipt generation
 *
 * Handles validation, creation, and revocation audit events.
 * Usage and update events are in audit-writer-extended.ts.
 */

import { logger } from '@/seed/utils/logger-utility'
import type { ComplianceReceipt } from '@/tree/audit/compliance-receipt'
import type { Json } from '@/seed/types/json'
import type {
  ValidationLogParams,
  CreationLogParams,
  RevocationLogParams,
} from '@/tree/audit/logger/audit-event-builder'
import { writeAuditWithReceipt } from '@/tree/audit/logger/audit-receipt-finalizer'

/**
 * Log license validation with compliance receipt generation
 */
export async function logValidationWithReceipt(
  params: ValidationLogParams,
): Promise<ComplianceReceipt | null> {
  const createdAt = Math.floor(Date.now() / 1000)
  const logData: Record<string, unknown> = {
    action: 'VALIDATE',
    license_nonce: params.nonce,
    user_id: params.userId ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: { isValid: params.isValid, tier: params.tier, timestamp: createdAt } as Json,
  }

  return writeAuditWithReceipt(
    logData,
    '[Audit Logger] Failed to insert audit log',
    '[Audit Logger] Audit logging failed',
    (logId, receipt) => {
      logger.info('[Audit Logger] Validation logged', {
        logId,
        nonce: String(params.nonce).slice(0, 8),
        isValid: params.isValid,
        receiptId: receipt.receiptId,
      })
    },
  )
}

/**
 * Log license creation with compliance receipt generation
 */
export async function logCreationWithReceipt(
  params: CreationLogParams,
): Promise<ComplianceReceipt | null> {
  const createdAt = Math.floor(Date.now() / 1000)
  const logData: Record<string, unknown> = {
    action: 'CREATE',
    license_nonce: params.nonce,
    user_id: params.createdBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: { tier: params.tier, timestamp: createdAt } satisfies Json,
  }

  return writeAuditWithReceipt(
    logData,
    '[Audit Logger] Failed to insert creation audit log',
    '[Audit Logger] Creation audit logging failed',
    (logId, receipt) => {
      logger.info('[Audit Logger] Creation logged', {
        logId,
        nonce: String(params.nonce).slice(0, 8),
        tier: params.tier,
        receiptId: receipt.receiptId,
      })
    },
  )
}

/**
 * Log license revocation with compliance receipt generation
 */
export async function logRevocationWithReceipt(
  params: RevocationLogParams,
): Promise<ComplianceReceipt | null> {
  const createdAt = Math.floor(Date.now() / 1000)
  const logData: Record<string, unknown> = {
    action: 'REVOKE',
    license_nonce: params.nonce,
    user_id: params.revokedBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      revokedBy: params.revokedBy,
      reason: params.reason,
      tier: params.tier,
      timestamp: createdAt,
    } satisfies Json,
  }

  return writeAuditWithReceipt(
    logData,
    '[Audit Logger] Failed to insert revocation audit log',
    '[Audit Logger] Revocation audit logging failed',
    (logId, receipt) => {
      logger.info('[Audit Logger] Revocation logged', {
        logId,
        nonce: String(params.nonce).slice(0, 8),
        reason: params.reason,
        receiptId: receipt.receiptId,
      })
    },
  )
}
