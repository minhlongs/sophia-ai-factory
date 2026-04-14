/**
 * Audit Query Logger - Self-Auditing for RaaS Gateway
 *
 * Logs all audit log queries to raas_audit_logs table.
 * This creates a self-auditing trail: every time someone queries
 * the audit logs, that query itself is logged.
 *
 * Prevents silent data exfiltration and provides accountability.
 *
 * @module audit/audit-query-logger
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import type { RaasAuditLogInsert, Json } from '@/lib/supabase/types'

/**
 * Parameters for audit query logging
 */
export interface AuditQueryLogParams {
  /** User ID who made the query */
  queriedBy: string
  /** API key ID used for the query */
  apiKeyId: string
  /** Query filters applied */
  filters: {
    dateFrom?: number
    dateTo?: number
    model?: string
    license?: string
    action?: string
    includePII?: boolean
    [key: string]: string | number | boolean | undefined
  }
  /** Number of results returned */
  resultCount: number
  /** Query duration in milliseconds */
  duration: number
  /** Client IP address (optional, will be hashed) */
  ipAddress?: string
  /** User agent string (optional) */
  userAgent?: string
}

/**
 * Log an audit query to the audit logs (self-auditing)
 *
 * Every query to /api/audit is itself logged to prevent
 * silent data exfiltration and maintain accountability.
 *
 * @param params - Query log parameters
 * @returns true if logging succeeded
 */
export async function logAuditQuery(params: AuditQueryLogParams): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log entry
  const logData: RaasAuditLogInsert = {
    action: 'AUDIT_QUERY',
    license_nonce: null, // Not associated with a specific license
    user_id: params.queriedBy,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
    created_at: createdAt,
    details: {
      apiKeyId: params.apiKeyId,
      filters: params.filters,
      resultCount: params.resultCount,
      duration: params.duration,
      timestamp: createdAt,
    } as Json,
  }

  try {
    // Insert audit log (database trigger auto-computes hash chain)
    const { data, error } = await (db as any)
      .from('raas_audit_logs')
      .insert(logData)
      .select()
      .single()

    if (error) {
      logger.error('[Audit Query Logger] Failed to log audit query', error as Error)
      return false
    }

    logger.info('[Audit Query Logger] Query logged successfully', {
      logId: data?.id,
      queriedBy: params.queriedBy,
      resultCount: params.resultCount,
      duration: params.duration,
    })

    return true
  } catch (error) {
    logger.error('[Audit Query Logger] Audit query logging failed', error as Error)
    // Non-fatal: don't block the original query response
    return false
  }
}

/**
 * Log API key creation event
 *
 * @param userId - User who created the key
 * @param apiKeyId - New API key ID
 * @param permissions - Permissions granted
 * @param ipAddress - Client IP
 * @returns true if logging succeeded
 */
export async function logApiKeyCreation(
  userId: string,
  apiKeyId: string,
  permissions: string[],
  ipAddress?: string
): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'API_KEY_CREATE',
    license_nonce: null,
    user_id: userId,
    ip_address: ipAddress || null,
    created_at: createdAt,
    details: {
      apiKeyId,
      permissions,
      timestamp: createdAt,
    } as Json,
  }

  try {
    const { error } = await (db as any)
      .from('raas_audit_logs')
      .insert(logData)

    if (error) {
      logger.error('[Audit Query Logger] Failed to log API key creation', error as Error)
      return false
    }

    logger.info('[Audit Query Logger] API key creation logged', {
      userId,
      apiKeyId,
    })

    return true
  } catch (error) {
    logger.error('[Audit Query Logger] API key creation logging failed', error as Error)
    return false
  }
}

/**
 * Log API key revocation event
 *
 * @param userId - User who revoked the key
 * @param apiKeyId - Revoked API key ID
 * @param reason - Reason for revocation (optional)
 * @param ipAddress - Client IP
 * @returns true if logging succeeded
 */
export async function logApiKeyRevocation(
  userId: string,
  apiKeyId: string,
  reason?: string,
  ipAddress?: string
): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'API_KEY_REVOKE',
    license_nonce: null,
    user_id: userId,
    ip_address: ipAddress || null,
    created_at: createdAt,
    details: {
      apiKeyId,
      reason: reason || null,
      timestamp: createdAt,
    } as Json,
  }

  try {
    const { error } = await (db as any)
      .from('raas_audit_logs')
      .insert(logData)

    if (error) {
      logger.error('[Audit Query Logger] Failed to log API key revocation', error as Error)
      return false
    }

    logger.info('[Audit Query Logger] API key revocation logged', {
      userId,
      apiKeyId,
      reason,
    })

    return true
  } catch (error) {
    logger.error('[Audit Query Logger] API key revocation logging failed', error as Error)
    return false
  }
}

/**
 * Log API key validation failure (security monitoring)
 *
 * @param apiKeyId - Key ID that failed validation
 * @param error - Validation error type
 * @param ipAddress - Client IP
 * @returns true if logging succeeded
 */
export async function logApiKeyValidationFailure(
  apiKeyId: string,
  error: string,
  ipAddress?: string
): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: RaasAuditLogInsert = {
    action: 'API_KEY_VALIDATION_FAILURE',
    license_nonce: null,
    user_id: null,
    ip_address: ipAddress || null,
    created_at: createdAt,
    details: {
      apiKeyId,
      error,
      timestamp: createdAt,
    } as Json,
  }

  try {
    const { error: insertError } = await (db as any)
      .from('raas_audit_logs')
      .insert(logData)

    if (insertError) {
      logger.error('[Audit Query Logger] Failed to log validation failure', insertError as Error)
      return false
    }

    logger.warn('[Audit Query Logger] API key validation failure logged', {
      apiKeyId,
      error,
    })

    return true
  } catch (err) {
    logger.error('[Audit Query Logger] Validation failure logging failed', err as Error)
    return false
  }
}

/**
 * Query audit logs with optional GDPR redaction
 *
 * @param filters - Query filters
 * @param includePII - Whether to include personally identifiable information
 * @returns Array of audit log entries
 */
export async function queryAuditLogs(
  filters: {
    dateFrom?: number
    dateTo?: number
    model?: string
    license?: string
    action?: string
    userId?: string
    limit?: number
    offset?: number
  },
  includePII: boolean = false
): Promise<any[]> {
  const db = createServerClient()
  const startTime = Date.now()

  // Build query
  let query = (db as any)
    .from('raas_audit_logs')
    .select('*', { count: 'exact' })

  // Apply filters
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo)
  }

  if (filters.action) {
    query = query.eq('action', filters.action)
  }

  if (filters.license) {
    query = query.eq('license_nonce', filters.license)
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId)
  }

  // Apply model filter if stored in details
  if (filters.model) {
    query = query.contains('details', { model_name: filters.model })
  }

  // Pagination
  const limit = filters.limit || 100
  const offset = filters.offset || 0
  query = query.range(offset, offset + limit - 1)

  // Order by created_at DESC (newest first)
  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    logger.error('[Audit Query Logger] Failed to query audit logs', error as Error)
    return []
  }

  const duration = Date.now() - startTime

  logger.info('[Audit Query Logger] Query completed', {
    resultCount: data?.length || 0,
    duration,
    filters,
  })

  // Apply GDPR redaction if requested
  if (!includePII && data) {
    interface AuditLogWithRedaction {
      ip_address: string | null;
      user_id: string;
      ip_address_hash?: string;
      user_pseudonym?: string;
      [key: string]: unknown;
    }

    return data.map((log: AuditLogWithRedaction) => ({
      ...log,
      ip_address: log.ip_address_hash || null,
      user_id: log.user_pseudonym || log.user_id,
    }))
  }

  return data || []
}
