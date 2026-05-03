/**
 * Write operations for Violation Audit Logger
 * @module audit/violation-logger-write
 */

import { createServerClient } from '@/seed/db/client'
import { insertTyped } from '@/seed/db/insert-typed'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { ViolationEvent, ViolationAuditRow, ViolationAuditInsert } from './violation-logger-types'

export async function logViolation(event: ViolationEvent): Promise<string | null> {
  try {
    const db = createServerClient()
    const insertPayload: ViolationAuditInsert = {
      event_type: `violation:${event.type}`,
      user_id: event.userId,
      license_nonce: event.licenseNonce,
      receipt: JSON.stringify({
        type: event.type, tier: event.tier,
        exceeded_type: event.exceededType, exceeded_limit: event.exceededLimit,
        exceeded_current: event.exceededCurrent, exceeded_by: event.exceededBy,
        requested_credits: event.requestedCredits, endpoint: event.endpoint,
        ip_address: event.ipAddress, user_agent: event.userAgent,
        billable: event.billable, price_per_credit: event.pricePerCredit,
        total_charge: event.totalCharge, audit_receipt_id: event.auditReceiptId,
        overage_event_id: event.overageEventId, ...event.metadata,
      }),
      tier: event.tier,
    }
    const { data, error } = await insertTyped(db.from<ViolationAuditRow>('audit_logs'), insertPayload).select('id').single()
    if (error) throw error
    logger.warn('[Violation Logger] Violation logged', {
      violationId: data?.id, type: event.type, userId: event.userId,
      licenseNonce: event.licenseNonce.slice(0, 8) + '...', tier: event.tier, billable: event.billable,
    })
    return data?.id ?? null
  } catch (error) {
    logger.error('[Violation Logger] Failed to log violation', toError(error))
    return null
  }
}

export async function logQuotaViolation(event: {
  userId: string; licenseNonce: string; tier: string
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'
  exceededLimit: number; exceededCurrent: number; exceededBy: number; requestedCredits: number
  endpoint?: string; ipAddress?: string; userAgent?: string; auditReceiptId?: string
}): Promise<string | null> {
  return logViolation({ type: 'QUOTA_EXCEEDED', ...event, billable: true })
}

export async function logThrottlingEvent(event: {
  userId: string; licenseNonce: string; tier: string
  endpoint: string; ipAddress?: string; userAgent?: string; auditReceiptId?: string
}): Promise<string | null> {
  return logViolation({ type: 'REQUEST_THROTTLED', ...event })
}

export async function logBillingEvent(event: {
  userId: string; licenseNonce: string; tier: string
  billable: boolean; pricePerCredit?: number; totalCharge?: number
  overageEventId?: string; metadata?: Record<string, unknown>
}): Promise<string | null> {
  return logViolation({ type: 'OVERAGE_BILLED', ...event })
}
