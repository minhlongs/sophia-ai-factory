/**
 * GDPR Right-to-Erasure Handler (Article 17)
 * Anonymizes audit logs without deleting — preserves audit trail for SOC 2.
 * @module audit/right-to-erasure
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError, getErrorMessage } from '@/seed/utils/to-error'
import { generateUserPseudonym, hashIpAddress } from './gdpr-redaction'
import type { RaasAuditLogRow, AuditGdprErasureRow } from './types'
import { canDeleteUserData } from './right-to-erasure-legal-hold'

export type { LegalHoldCheck } from './right-to-erasure-legal-hold'
export { canDeleteUserData } from './right-to-erasure-legal-hold'

export interface ErasureResult {
  anonymizedCount: number
  error?: string
}

export async function handleRightToErasure(userId: string): Promise<ErasureResult> {
  logger.info('Right-to-erasure request initiated', { userId })

  const legalHoldCheck = await canDeleteUserData(userId)
  if (!legalHoldCheck.canDelete) {
    logger.warn('Right-to-erasure blocked by legal hold', { userId, reason: legalHoldCheck.reason, legalHoldUntil: legalHoldCheck.legalHoldUntil })
    return { anonymizedCount: 0, error: `Erasure blocked: ${legalHoldCheck.reason}` }
  }

  try {
    const db = createServerClient()
    const { data: existingLogs, error: fetchError } = await db.from<RaasAuditLogRow>('raas_audit_logs')
      .select('id, user_id, ip_address').eq('user_id', userId)

    if (fetchError) {
      logger.error('Failed to fetch audit logs for erasure', toError(fetchError), { userId })
      return { anonymizedCount: 0, error: `Failed to fetch logs: ${fetchError.message}` }
    }

    if (!existingLogs || existingLogs.length === 0) {
      logger.info('No audit logs found for user', { userId })
      return { anonymizedCount: 0 }
    }

    logger.info('Found logs to anonymize', { userId, count: existingLogs.length })

    let anonymizedCount = 0
    const errors: string[] = []

    for (const log of existingLogs) {
      const { error: updateError } = await db.from<RaasAuditLogRow>('raas_audit_logs')
        .update({
          user_id: 'ANONYMIZED_' + generateUserPseudonym(userId).slice(0, 8),
          ip_address: log.ip_address ? 'ANONYMIZED_' + hashIpAddress(log.ip_address).slice(0, 8) : null,
          user_pseudonym: generateUserPseudonym(userId),
          ip_address_hash: log.ip_address ? hashIpAddress(log.ip_address) : null,
        })
        .eq('id', log.id)

      if (updateError) {
        logger.error('Failed to anonymize log entry', toError(updateError), { logId: log.id })
        errors.push(`Log ${log.id}: ${updateError.message}`)
      } else {
        anonymizedCount++
      }
    }

    logger.info('Right-to-erasure completed', { userId, anonymizedCount, errorCount: errors.length })
    if (errors.length > 0) return { anonymizedCount, error: `Partial success: ${errors.length} errors - ${errors.slice(0, 3).join(', ')}` }
    return { anonymizedCount }
  } catch (error) {
    logger.error('Unexpected error during right-to-erasure', toError(error), { userId })
    return { anonymizedCount: 0, error: getErrorMessage(error) }
  }
}

export async function getErasureStatus(userId: string): Promise<{
  hasErasureRequest: boolean; erasureRequestedAt?: number; completedAt?: number; anonymizedCount?: number
}> {
  try {
    const db = createServerClient()
    const { data: request } = await db.from<AuditGdprErasureRow>('gdpr_erasure_requests')
      .select('created_at, completed_at, anonymized_count').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).single()

    if (!request) return { hasErasureRequest: false }
    return {
      hasErasureRequest: true,
      erasureRequestedAt: new Date(request.created_at).getTime(),
      completedAt: request.completed_at ? new Date(request.completed_at).getTime() : undefined,
      anonymizedCount: request.anonymized_count || 0,
    }
  } catch (error) {
    logger.warn('Failed to fetch erasure status', { userId, errorMessage: getErrorMessage(error) })
    return { hasErasureRequest: false }
  }
}
