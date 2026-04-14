/**
 * GDPR Right-to-Erasure Handler (Article 17)
 *
 * Handles data subject erasure requests by anonymizing audit logs
 * while preserving the audit trail integrity for legal compliance.
 *
 * IMPORTANT: Right-to-erasure = anonymization, NOT deletion
 * Audit trail must remain intact for SOC 2 and legal obligations.
 *
 * @module audit/right-to-erasure
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { generateUserPseudonym, hashIpAddress } from './gdpr-redaction'

/**
 * Result of right-to-erasure operation
 */
export interface ErasureResult {
  /** Number of logs anonymized */
  anonymizedCount: number
  /** Error message if operation failed */
  error?: string
}

/**
 * Legal hold check result
 */
export interface LegalHoldCheck {
  /** Whether user data can be deleted */
  canDelete: boolean
  /** Reason if deletion is blocked */
  reason?: string
  /** Legal hold expiration timestamp (Unix epoch) */
  legalHoldUntil?: number
}

/**
 * Minimum retention period for SOC 2 compliance (90 days)
 * GDPR allows retention for legal obligations
 */
const MIN_RETENTION_DAYS = 90
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Handle GDPR right-to-erasure requests
 * Anonymizes all audit logs for a specific user without deleting them
 *
 * @param userId - User ID requesting erasure
 * @returns Erasure result with count of anonymized logs
 *
 * @example
 * const result = await handleRightToErasure('user-123')
 * if (result.error) {
 *   console.error('Erasure failed:', result.error)
 * } else {
 *   console.log(`Anonymized ${result.anonymizedCount} logs`)
 * }
 */
export async function handleRightToErasure(
  userId: string
): Promise<ErasureResult> {
  logger.info('Right-to-erasure request initiated', { userId })

  // Check for legal holds first
  const legalHoldCheck = await canDeleteUserData(userId)
  if (!legalHoldCheck.canDelete) {
    logger.warn('Right-to-erasure blocked by legal hold', {
      userId,
      reason: legalHoldCheck.reason,
      legalHoldUntil: legalHoldCheck.legalHoldUntil,
    })
    return {
      anonymizedCount: 0,
      error: `Erasure blocked: ${legalHoldCheck.reason}`,
    }
  }

  try {
    const db = createServerClient()

    // Query all audit logs for this user
    // Using type assertion to bypass Supabase type inference issues
    const { data: existingLogs, error: fetchError } = await (db as any)
      .from('raas_audit_logs')
      .select('id, user_id, ip_address')
      .eq('user_id', userId)

    if (fetchError) {
      logger.error('Failed to fetch audit logs for erasure', fetchError as unknown as Error, {
        userId,
      })
      return {
        anonymizedCount: 0,
        error: `Failed to fetch logs: ${fetchError.message}`,
      }
    }

    if (!existingLogs || existingLogs.length === 0) {
      logger.info('No audit logs found for user', { userId })
      return { anonymizedCount: 0 }
    }

    logger.info('Found logs to anonymize', {
      userId,
      count: existingLogs.length,
    })

    // Anonymize each log entry (NOT delete - preserve audit trail)
    let anonymizedCount = 0
    const errors: string[] = []

    for (const log of existingLogs) {
      // Update with pseudonymized values
      // Using type assertion to bypass Supabase type inference issues
      const { error: updateError } = await (db as any)
        .from('raas_audit_logs')
        .update({
          user_id: 'ANONYMIZED_' + generateUserPseudonym(userId).slice(0, 8),
          ip_address: log.ip_address
            ? 'ANONYMIZED_' + hashIpAddress(log.ip_address).slice(0, 8)
            : null,
          user_pseudonym: generateUserPseudonym(userId),
          ip_address_hash: log.ip_address
            ? hashIpAddress(log.ip_address)
            : null,
        })
        .eq('id', log.id)

      if (updateError) {
        logger.error('Failed to anonymize log entry', updateError as unknown as Error, {
          logId: log.id,
        })
        errors.push(`Log ${log.id}: ${updateError.message}`)
      } else {
        anonymizedCount++
      }
    }

    logger.info('Right-to-erasure completed', {
      userId,
      anonymizedCount,
      errorCount: errors.length,
    })

    if (errors.length > 0) {
      return {
        anonymizedCount,
        error: `Partial success: ${errors.length} errors - ${errors.slice(0, 3).join(', ')}`,
      }
    }

    return { anonymizedCount }
  } catch (error) {
    logger.error('Unexpected error during right-to-erasure', error as unknown as Error, {
      userId,
    })
    return {
      anonymizedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if user data can be deleted (no legal hold active)
 *
 * Legal holds may exist for:
 * - Active litigation or investigation
 * - SOC 2 retention requirements (< 90 days)
 * - Tax/financial record requirements
 *
 * Note: Uses Supabase Auth user metadata instead of user_profiles table
 * to avoid dependency on non-existent table.
 *
 * @param userId - User ID to check
 * @returns Legal hold check result
 *
 * @example
 * const check = await canDeleteUserData('user-123')
 * if (check.canDelete) {
 *   console.log('Data can be deleted')
 * } else {
 *   console.log('Blocked:', check.reason)
 * }
 */
export async function canDeleteUserData(
  userId: string
): Promise<LegalHoldCheck> {
  logger.info('Checking legal hold status', { userId })

  try {
    const db = createServerClient()

    // Check for active legal holds in user metadata via Auth admin API
    // Note: This uses the admin client to fetch user metadata
    const { data: user, error: userError } = await (db as any)
      .from('auth.users')
      .select('raw_user_meta_data')
      .eq('id', userId)
      .single()

    if (userError) {
      logger.warn('Failed to fetch user metadata for legal hold check', {
        userId,
        errorMessage: userError.message,
      })
      // If we can't check, err on the side of caution
      return {
        canDelete: false,
        reason: 'Unable to verify legal hold status',
      }
    }

    // Check for explicit legal hold flag in user metadata
    const rawMetaData = user?.raw_user_meta_data as Record<string, unknown> | undefined
    const legalHold = rawMetaData?.legalHold as Record<string, unknown> | undefined

    if (legalHold?.active === true) {
      const holdUntil = legalHold.until as number | undefined
      return {
        canDelete: false,
        reason: 'Active legal hold',
        legalHoldUntil: holdUntil,
      }
    }

    // Check SOC 2 retention (90 days minimum)
    const { data: firstLog } = await (db as any)
      .from('raas_audit_logs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (firstLog && 'created_at' in firstLog && firstLog.created_at) {
      const now = Date.now()
      const minDeletionDate =
        firstLog.created_at + MIN_RETENTION_DAYS * MS_PER_DAY

      if (now < minDeletionDate) {
        return {
          canDelete: false,
          reason: `SOC 2 retention period active (minimum ${MIN_RETENTION_DAYS} days)`,
          legalHoldUntil: minDeletionDate,
        }
      }
    }

    // Check for active subscription via Auth metadata
    // Note: Subscription status should be stored in user_metadata
    const subscriptionStatus = rawMetaData?.subscription_status as string | undefined

    if (subscriptionStatus === 'active') {
      logger.info('Active subscription - data retention required', { userId })
      return {
        canDelete: false,
        reason: 'Active subscription requires data retention',
      }
    }

    logger.info('No legal holds found - erasure permitted', { userId })
    return { canDelete: true }
  } catch (error) {
    logger.error('Error checking legal hold status', error as unknown as Error, { userId })
    // Default to blocking deletion on error
    return {
      canDelete: false,
      reason: 'Error verifying legal hold status',
    }
  }
}

/**
 * Get erasure request status for auditing
 *
 * @param userId - User ID to check
 * @returns Erasure status information
 */
export async function getErasureStatus(userId: string): Promise<{
  hasErasureRequest: boolean
  erasureRequestedAt?: number
  completedAt?: number
  anonymizedCount?: number
}> {
  try {
    const db = createServerClient()

    // Check for pending erasure requests
    // Using type assertion to bypass Supabase type inference issues
    const { data: request } = await (db as any)
      .from('gdpr_erasure_requests')
      .select('created_at, completed_at, anonymized_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!request) {
      return { hasErasureRequest: false }
    }

    return {
      hasErasureRequest: true,
      erasureRequestedAt: new Date(request.created_at).getTime(),
      completedAt: request.completed_at
        ? new Date(request.completed_at).getTime()
        : undefined,
      anonymizedCount: request.anonymized_count || 0,
    }
  } catch (error) {
    logger.warn('Failed to fetch erasure status', {
      userId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })
    return { hasErasureRequest: false }
  }
}
