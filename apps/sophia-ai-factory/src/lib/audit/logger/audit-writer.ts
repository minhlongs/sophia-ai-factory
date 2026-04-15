/**
 * Audit Writer - Core event writers with compliance receipt generation
 *
 * Handles validation, creation, and revocation audit events.
 * Usage and update events are in audit-writer-extended.ts.
 */

import { createServerClient } from '@/lib/db/client'
import { generateReceipt } from '../compliance-receipt'
import { logger } from '@/lib/utils/logger-utility'
import type { RaasAuditLogInsert, Json } from '@/lib/supabase/types'
import type { ComplianceReceipt } from '../compliance-receipt'
import { insertAuditLog, updateReceiptSignature } from './audit-event-builder'
import type { ValidationLogParams, CreationLogParams, RevocationLogParams } from './audit-event-builder'

/**
 * Shared helper: generate receipt and store signature back in DB
 */
async function finalizeReceipt(
  db: ReturnType<typeof createServerClient>,
  logId: string,
  log: any
): Promise<ComplianceReceipt> {
  const receipt = generateReceipt(log)
  const updateError = await updateReceiptSignature(db, logId, receipt.signature)
  if (updateError) {
    logger.error('[Audit Logger] Failed to store receipt signature', updateError as Error)
  }
  return receipt
}

/**
 * Log license validation with compliance receipt generation
 */
export async function logValidationWithReceipt(
  params: ValidationLogParams
): Promise<ComplianceReceipt | null> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'VALIDATE',
    license_nonce: params.nonce,
    user_id: params.userId ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: { isValid: params.isValid, tier: params.tier, timestamp: createdAt } as Json,
  }

  try {
    const { data: insertedLog, error } = await insertAuditLog(db, logData)
    if (error || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert audit log', error as Error)
      return null
    }
    const receipt = await finalizeReceipt(db, insertedLog.id, insertedLog)
    logger.info('[Audit Logger] Validation logged', { logId: insertedLog.id, nonce: params.nonce.slice(0, 8), isValid: params.isValid, receiptId: receipt.receiptId })
    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Audit logging failed', error as Error)
    return null
  }
}

/**
 * Log license creation with compliance receipt generation
 */
export async function logCreationWithReceipt(
  params: CreationLogParams
): Promise<ComplianceReceipt | null> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'CREATE',
    license_nonce: params.nonce,
    user_id: params.createdBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: { tier: params.tier, timestamp: createdAt } satisfies Json,
  }

  try {
    const { data: insertedLog, error } = await insertAuditLog(db, logData)
    if (error || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert creation audit log', error as Error)
      return null
    }
    const receipt = await finalizeReceipt(db, insertedLog.id, insertedLog)
    logger.info('[Audit Logger] Creation logged', { logId: insertedLog.id, nonce: params.nonce.slice(0, 8), tier: params.tier, receiptId: receipt.receiptId })
    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Creation audit logging failed', error as Error)
    return null
  }
}

/**
 * Log license revocation with compliance receipt generation
 */
export async function logRevocationWithReceipt(
  params: RevocationLogParams
): Promise<ComplianceReceipt | null> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'REVOKE',
    license_nonce: params.nonce,
    user_id: params.revokedBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: { revokedBy: params.revokedBy, reason: params.reason, tier: params.tier, timestamp: createdAt } satisfies Json,
  }

  try {
    const { data: insertedLog, error } = await insertAuditLog(db, logData)
    if (error || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert revocation audit log', error as Error)
      return null
    }
    const receipt = await finalizeReceipt(db, insertedLog.id, insertedLog)
    logger.info('[Audit Logger] Revocation logged', { logId: insertedLog.id, nonce: params.nonce.slice(0, 8), reason: params.reason, receiptId: receipt.receiptId })
    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Revocation audit logging failed', error as Error)
    return null
  }
}
