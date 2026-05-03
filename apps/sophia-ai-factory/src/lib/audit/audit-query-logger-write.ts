/**
 * Write operations for Audit Query Logger
 * @module audit/audit-query-logger-write
 */

import { createServerClient } from '@/seed/db/client'
import { insertTyped } from '@/seed/db/insert-typed'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { RaasAuditLogInsert, RaasAuditLogRow, Json } from '@/lib/supabase/types'
import type { AuditQueryLogParams } from './audit-query-logger'

export async function logAuditQuery(params: AuditQueryLogParams): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)
  const logData: RaasAuditLogInsert = {
    action: 'AUDIT_QUERY', license_nonce: null, user_id: params.queriedBy, ip_address: params.ipAddress || null, user_agent: params.userAgent || null, created_at: createdAt,
    details: { apiKeyId: params.apiKeyId, filters: params.filters, resultCount: params.resultCount, duration: params.duration, timestamp: createdAt } as Json,
  }
  try {
    const { data, error } = await insertTyped(db.from<RaasAuditLogRow>('raas_audit_logs'), logData).select().single()
    if (error) { logger.error('[Audit Query Logger] Failed to log audit query', toError(error)); return false }
    logger.info('[Audit Query Logger] Query logged successfully', { logId: data?.id, queriedBy: params.queriedBy, resultCount: params.resultCount, duration: params.duration })
    return true
  } catch (error) { logger.error('[Audit Query Logger] Audit query logging failed', toError(error)); return false }
}

export async function logApiKeyCreation(userId: string, apiKeyId: string, permissions: string[], ipAddress?: string): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)
  const logData: RaasAuditLogInsert = {
    action: 'API_KEY_CREATE', license_nonce: null, user_id: userId, ip_address: ipAddress || null, created_at: createdAt,
    details: { apiKeyId, permissions, timestamp: createdAt } as Json,
  }
  try {
    const { error } = await insertTyped(db.from<RaasAuditLogRow>('raas_audit_logs'), logData)
    if (error) { logger.error('[Audit Query Logger] Failed to log API key creation', new Error(error.message)); return false }
    logger.info('[Audit Query Logger] API key creation logged', { userId, apiKeyId })
    return true
  } catch (error) { logger.error('[Audit Query Logger] API key creation logging failed', toError(error)); return false }
}

export async function logApiKeyRevocation(userId: string, apiKeyId: string, reason?: string, ipAddress?: string): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)
  const logData: RaasAuditLogInsert = {
    action: 'API_KEY_REVOKE', license_nonce: null, user_id: userId, ip_address: ipAddress || null, created_at: createdAt,
    details: { apiKeyId, reason: reason || null, timestamp: createdAt } as Json,
  }
  try {
    const { error } = await insertTyped(db.from<RaasAuditLogRow>('raas_audit_logs'), logData)
    if (error) { logger.error('[Audit Query Logger] Failed to log API key revocation', new Error(error.message)); return false }
    logger.info('[Audit Query Logger] API key revocation logged', { userId, apiKeyId, reason })
    return true
  } catch (error) { logger.error('[Audit Query Logger] API key revocation logging failed', toError(error)); return false }
}

export async function logApiKeyValidationFailure(apiKeyId: string, error: string, ipAddress?: string): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)
  const logData: RaasAuditLogInsert = {
    action: 'API_KEY_VALIDATION_FAILURE', license_nonce: null, user_id: null, ip_address: ipAddress || null, created_at: createdAt,
    details: { apiKeyId, error, timestamp: createdAt } as Json,
  }
  try {
    const { error: insertError } = await insertTyped(db.from<RaasAuditLogRow>('raas_audit_logs'), logData)
    if (insertError) { logger.error('[Audit Query Logger] Failed to log validation failure', toError(insertError)); return false }
    logger.warn('[Audit Query Logger] API key validation failure logged', { apiKeyId, error })
    return true
  } catch (err) { logger.error('[Audit Query Logger] Validation failure logging failed', toError(err)); return false }
}
