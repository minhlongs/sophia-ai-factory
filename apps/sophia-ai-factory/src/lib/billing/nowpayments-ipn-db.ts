/**
 * D1 helpers for NOWPayments IPN idempotency and event recording
 * @module billing/nowpayments-ipn-db
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'

export function getDb() {
  return createServerClient()
}

export function parseUserIdFromOrderId(orderId: string): string | null {
  const parts = orderId.split('_')
  if (parts.length >= 3 && parts[0] === 'sophia') return parts[1]
  return null
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
  } catch { return false }
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
