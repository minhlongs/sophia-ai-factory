/**
 * Audit Writer Extended - Update and Usage event writers
 *
 * Handles UPDATE and USAGE audit events with compliance receipt generation.
 * Core events (validate, create, revoke) are in audit-writer.ts.
 */

import { createServerClient } from '@/seed/db/client'
import { generateReceipt } from '@/tree/audit/compliance-receipt'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { RaasAuditLogInsert, RaasAuditLogRow, Json } from '@/lib/supabase/types'
import type { ComplianceReceipt } from '@/tree/audit/compliance-receipt'
import { insertAuditLog, updateReceiptSignature } from '@/tree/audit/logger/audit-event-builder'
import type { UsageLogParams } from '@/tree/audit/logger/audit-event-builder'

/**
 * Shared helper: generate receipt and store signature back in DB
 */
async function finalizeReceipt(
  db: ReturnType<typeof createServerClient>,
  logId: string,
  log: RaasAuditLogRow
): Promise<ComplianceReceipt> {
  const receipt = generateReceipt(log)
  const updateError = await updateReceiptSignature(db, logId, receipt.signature)
  if (updateError) {
    logger.error('[Audit Logger] Failed to store receipt signature', toError(updateError))
  }
  return receipt
}

/**
 * Log license update (extension) with compliance receipt generation
 *
 * @param params - Update log parameters
 * @returns Generated compliance receipt or null if logging failed
 */
export async function logUpdateWithReceipt(
  params: {
    nonce: string
    updatedBy?: string
    changes: Record<string, unknown>
    tier?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<ComplianceReceipt | null> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'UPDATE',
    license_nonce: params.nonce,
    user_id: params.updatedBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      updatedBy: params.updatedBy,
      changes: params.changes as Json,
      tier: params.tier,
      timestamp: createdAt,
    } satisfies Json,
  }

  try {
    const { data: insertedLog, error } = await insertAuditLog(db, logData)
    if (error || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert update audit log', toError(error))
      return null
    }
    const receipt = await finalizeReceipt(db, insertedLog.id, insertedLog)
    logger.info('[Audit Logger] Update logged', { logId: insertedLog.id, nonce: params.nonce.slice(0, 8), changes: params.changes, receiptId: receipt.receiptId })
    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Update audit logging failed', toError(error))
    return null
  }
}

/**
 * Log API/model usage with compliance receipt generation
 *
 * Extends audit logging with granular usage tracking:
 * - Model invocation details (name, tokens)
 * - GDPR-compliant IP hashing and user pseudonymization
 * - Full hash chain linkage for tamper detection
 *
 * @param params - Usage log parameters
 * @returns Generated compliance receipt or null if logging failed
 */
export async function logUsageWithReceipt(
  params: UsageLogParams
): Promise<ComplianceReceipt | null> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'USAGE',
    license_nonce: params.nonce,
    user_id: params.userId ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      model_name: params.model_name ?? null,
      token_count: params.token_count ?? null,
      tokens_input: params.tokens_input ?? null,
      tokens_output: params.tokens_output ?? null,
      endpoint: params.endpoint ?? null,
      tier: params.tier,
      timestamp: createdAt,
    },
  }

  try {
    const { data: insertedLog, error } = await insertAuditLog(db, logData)
    if (error || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert usage audit log', toError(error))
      return null
    }
    const receipt = await finalizeReceipt(db, insertedLog.id, insertedLog)
    logger.info('[Audit Logger] Usage logged', {
      logId: insertedLog.id,
      nonce: params.nonce.slice(0, 8),
      model: params.model_name,
      tokens: params.token_count,
      tier: params.tier,
      receiptId: receipt.receiptId,
    })
    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Usage audit logging failed', toError(error))
    return null
  }
}
