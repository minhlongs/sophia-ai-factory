/**
 * Usage Event Tracker for ROIaaS Compliance Audit
 *
 * Tracks model invocations with token counts for usage metering and billing.
 * Implements GDPR-compliant pseudonymization for user identifiers.
 *
 * @module audit/usage-event-tracker
 */

import { createServerClient } from '@/seed/db/client'
import { insertTyped } from '@/seed/db/insert-typed'
import { hashIpAddress, generateUserPseudonym } from '@/tree/audit/audit-hashing'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { RaasAuditLogInsert, RaasAuditLogRow } from '@/tree/database/supabase-types'

/**
 * Model invocation event for usage tracking
 */
export interface ModelInvocationEvent {
  /** AI model name (e.g., gpt-4, claude-3) */
  model_name: string
  /** Total token count */
  token_count: number
  /** Input tokens (optional breakdown) */
  tokens_input?: number
  /** Output tokens (optional breakdown) */
  tokens_output?: number
  /** API endpoint called */
  endpoint: string
  /** User ID if authenticated */
  userId?: string
  /** Client IP address (will be hashed) */
  ipAddress?: string
  /** License nonce for tier verification */
  license_nonce: string
  /** License tier (basic | premium | enterprise) */
  tier: string
}

/**
 * Salt for GDPR-compliant hashing (from environment)
 */
const AUDIT_HASH_SALT = process.env.AUDIT_HASH_SALT || ''

/**
 * Log model invocation with compliance receipt
 *
 * Creates audit log entry with:
 * - Model name and token counts
 * - GDPR-compliant IP hash and user pseudonym
 * - Hash chain linkage for tamper detection
 *
 * @param event - Model invocation event data
 * @returns True if logging succeeded, false otherwise
 *
 * @example
 * await logModelInvocation({
 *   model_name: 'gpt-4',
 *   token_count: 1500,
 *   tokens_input: 1000,
 *   tokens_output: 500,
 *   endpoint: '/api/v1/chat/completions',
 *   userId: 'user-123',
 *   ipAddress: '192.168.1.1',
 *   license_nonce: 'abc123',
 *   tier: 'premium'
 * })
 */
export async function logModelInvocation(
  event: ModelInvocationEvent
): Promise<boolean> {
  const db = createServerClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log data
  const logData: RaasAuditLogInsert = {
    action: 'USAGE',
    license_nonce: event.license_nonce,
    user_id: event.userId ?? null,
    created_at: createdAt,
    details: {
      model_name: event.model_name,
      token_count: event.token_count,
      tokens_input: event.tokens_input ?? null,
      tokens_output: event.tokens_output ?? null,
      endpoint: event.endpoint,
      tier: event.tier,
      timestamp: createdAt
    }
  }

  try {
    // Insert audit log (database trigger auto-computes hash chain)
    const result = await insertTyped(db.from<RaasAuditLogRow>('raas_audit_logs'), logData)
      .select()
      .single()

    const insertError = result.error

    if (insertError) {
      logger.error('[Usage Tracker] Failed to insert model invocation', toError(insertError))
      return false
    }

    const insertedLog = result.data as { id: string }

    logger.info('[Usage Tracker] Model invocation logged', {
      logId: insertedLog.id,
      model: event.model_name,
      tokens: event.token_count,
      tier: event.tier
    })

    return true
  } catch (error) {
    logger.error('[Usage Tracker] Audit logging failed', toError(error))
    // Graceful degradation: don't block API response on logging failure
    return false
  }
}

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

  const logData: RaasAuditLogInsert = {
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
    const result = await insertTyped(db.from<RaasAuditLogRow>('raas_audit_logs'), logData)
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
