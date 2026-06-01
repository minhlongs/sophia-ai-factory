/**
 * Audit Query Logger — self-auditing trail for RaaS Gateway queries
 * @module audit/audit-query-logger
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { RaasAuditLogRow } from '@/land/supabase/types'

export interface AuditQueryLogParams {
  queriedBy: string
  apiKeyId: string
  filters: { dateFrom?: number; dateTo?: number; model?: string; license?: string; action?: string; includePII?: boolean; [key: string]: string | number | boolean | undefined }
  resultCount: number
  duration: number
  ipAddress?: string
  userAgent?: string
}

export { logAuditQuery, logApiKeyCreation, logApiKeyRevocation, logApiKeyValidationFailure } from './audit-query-logger-write'

export async function queryAuditLogs(
  filters: { dateFrom?: number; dateTo?: number; model?: string; license?: string; action?: string; userId?: string; limit?: number; offset?: number },
  includePII = false
): Promise<RaasAuditLogRow[] | Record<string, unknown>[]> {
  const db = createServerClient()
  const startTime = Date.now()

  let query = db.from<RaasAuditLogRow>('raas_audit_logs').select('*', { count: 'exact' })
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.license) query = query.eq('license_nonce', filters.license)
  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.model) query = query.like('details', `%"model_name":"${filters.model}"%`)

  const limit = filters.limit || 100
  const offset = filters.offset || 0
  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) { logger.error('[Audit Query Logger] Failed to query audit logs', toError(error)); return [] }

  logger.info('[Audit Query Logger] Query completed', { resultCount: data?.length || 0, duration: Date.now() - startTime, filters })

  if (!includePII && data) {
    return data.map((log: RaasAuditLogRow) => ({ ...log, ip_address: log.ip_address_hash || null, user_id: log.user_pseudonym || log.user_id || '' }))
  }
  return data || []
}
