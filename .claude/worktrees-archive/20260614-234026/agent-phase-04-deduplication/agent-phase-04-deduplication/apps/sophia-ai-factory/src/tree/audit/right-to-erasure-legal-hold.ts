/**
 * Legal hold checks for GDPR right-to-erasure (Article 17)
 * @module audit/right-to-erasure-legal-hold
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { RaasAuditLogRow, AuditUserMetadataRow } from '@/tree/audit/types'

export interface LegalHoldCheck {
  canDelete: boolean
  reason?: string
  legalHoldUntil?: number
}

const MIN_RETENTION_DAYS = 90
const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function canDeleteUserData(userId: string): Promise<LegalHoldCheck> {
  logger.info('Checking legal hold status', { userId })
  try {
    const db = createServerClient()

    const { data: user, error: userError } = await db.from<AuditUserMetadataRow>('auth.users')
      .select('raw_user_meta_data').eq('id', userId).single()

    if (userError) {
      logger.warn('Failed to fetch user metadata for legal hold check', { userId, errorMessage: userError.message })
      return { canDelete: false, reason: 'Unable to verify legal hold status' }
    }

    const rawMetaData = user?.raw_user_meta_data as Record<string, unknown> | undefined
    const legalHold = rawMetaData?.legalHold as Record<string, unknown> | undefined

    if (legalHold?.active === true) {
      return { canDelete: false, reason: 'Active legal hold', legalHoldUntil: legalHold.until as number | undefined }
    }

    const { data: firstLog } = await db.from<RaasAuditLogRow>('raas_audit_logs')
      .select('created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(1).single()

    if (firstLog && 'created_at' in firstLog && firstLog.created_at) {
      const minDeletionDate = firstLog.created_at + MIN_RETENTION_DAYS * MS_PER_DAY
      if (Date.now() < minDeletionDate) {
        return { canDelete: false, reason: `SOC 2 retention period active (minimum ${MIN_RETENTION_DAYS} days)`, legalHoldUntil: minDeletionDate }
      }
    }

    const subscriptionStatus = rawMetaData?.subscription_status as string | undefined
    if (subscriptionStatus === 'active') {
      logger.info('Active subscription - data retention required', { userId })
      return { canDelete: false, reason: 'Active subscription requires data retention' }
    }

    logger.info('No legal holds found - erasure permitted', { userId })
    return { canDelete: true }
  } catch (error) {
    logger.error('Error checking legal hold status', toError(error), { userId })
    return { canDelete: false, reason: 'Error verifying legal hold status' }
  }
}
