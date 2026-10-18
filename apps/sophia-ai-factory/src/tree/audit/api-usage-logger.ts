/**
 * Generic API Usage Logger for ROIaaS Compliance Audit
 *
 * @module tree/audit/api-usage-logger
 */

import { createServerClient } from '@/seed/db/client'
import { insertTyped } from '@/seed/db/insert-typed'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'

/**
 * Log generic API usage (non-model endpoints)
 *
 * @param endpoint - API endpoint path
 * @param creditsUsed - Credits consumed
 * @param userId - User ID if authenticated
 * @param licenseNonce - License nonce for tracking
 * @returns True if logging succeeded, false otherwise
 */
export async function logApiUsage(
  endpoint: string,
  creditsUsed: number,
  userId: string | undefined,
  licenseNonce: string
): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const logData: Record<string, unknown> = {
    action: 'USAGE',
    license_nonce: licenseNonce,
    user_id: userId ?? null,
    created_at: createdAt,
    details: {
      endpoint,
      credits_used: creditsUsed,
      timestamp: createdAt
    }
  }

  try {
    const result = await insertTyped(db.from('raas_audit_logs'), logData)
      .select()
      .single()

    if (result.error) {
      logger.error('[Usage Tracker] Failed to insert API usage', toError(result.error))
      return false
    }

    return true
  } catch (error) {
    logger.error('[Usage Tracker] API usage logging failed', toError(error))
    return false
  }
}
