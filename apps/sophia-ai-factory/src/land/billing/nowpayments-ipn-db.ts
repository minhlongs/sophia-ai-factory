/**
 * D1 helpers for NOWPayments IPN idempotency and event recording
 * @module billing/nowpayments-ipn-db
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { getErrorMessage } from '@/seed/utils/to-error'

export function getDb() {
  return createServerClient()
}

export function parseUserIdFromOrderId(orderId: string): string | null {
  // Format: sophia_{userId}_{timestamp}
  // userId may contain underscores, so we split on first 2 underscores only
  if (!orderId.startsWith('sophia_')) return null
  const rest = orderId.slice('sophia_'.length)
  const firstUnderscore = rest.indexOf('_')
  if (firstUnderscore === -1) return null
  const userId = rest.slice(0, firstUnderscore)
  return userId || null
}

/**
 * Parse agency ID from agency order_id.
 * Format: ag_{agencyId}_{timestamp}
 * Returns agency ID string or null if not an agency order.
 */
const AGENCY_ORDER_PREFIX = 'ag_'

export function parseAgencyIdFromOrderId(orderId: string): string | null {
  if (!orderId.startsWith(AGENCY_ORDER_PREFIX)) return null
  const rest = orderId.slice(AGENCY_ORDER_PREFIX.length)
  const firstUnderscore = rest.indexOf('_')
  if (firstUnderscore === -1) return null
  const agencyId = rest.slice(0, firstUnderscore)
  return agencyId || null
}

export async function isPaymentProcessed(paymentId: string): Promise<boolean> {
  try {
    const db = getDb()
    const { data } = await db
      .from('payment_events')
      .select('processed')
      .eq('event_id', `nowpayments_${paymentId}`)
      .single()
    return data?.processed === 1 || data?.processed === true
  } catch (e) { safeCatch('isPaymentProcessed')(e); return false }
}

export async function recordIpnEvent(paymentId: string, status: string, payload: Record<string, unknown>, processed: boolean): Promise<void> {
  try {
    const db = getDb()
    await db.from('payment_events').upsert(
      { event_id: `nowpayments_${paymentId}`, event_type: `nowpayments.${status}`, payload: JSON.stringify(payload), processed: processed ? 1 : 0, created_at: new Date().toISOString() }
    )
  } catch (err) {
    logger.warn('[NOWPayments] Failed to record IPN event', { paymentId, error: getErrorMessage(err) })
  }
}
