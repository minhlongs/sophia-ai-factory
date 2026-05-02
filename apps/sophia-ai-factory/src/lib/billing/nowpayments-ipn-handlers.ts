/**
 * NOWPayments IPN (Instant Payment Notification) main dispatcher
 * Statuses: finished | partially_paid | expired | refunded | failed
 * @module billing/nowpayments-ipn-handlers
 */

import { logger } from '@/lib/utils/logger-utility'
import { isPaymentProcessed, recordIpnEvent } from './nowpayments-ipn-db'
import { handleFailed } from './nowpayments-ipn-subscription'
import { dispatchFinished, dispatchRefunded } from './nowpayments-ipn-dispatch'

export interface NowPaymentsIpnPayload {
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired'
  pay_address?: string
  price_amount: number
  price_currency: string
  pay_amount?: number
  pay_currency?: string
  order_id?: string
  order_description?: string
  invoice_id?: string
  actually_paid?: number
  outcome_amount?: number
  outcome_currency?: string
}

export async function processNowPaymentsIpn(
  ipn: NowPaymentsIpnPayload
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn

  if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }

  await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, false)

  try {
    switch (payment_status) {
      case 'finished':      await dispatchFinished(ipn); break
      case 'refunded':      await dispatchRefunded(ipn); break
      case 'failed':        await handleFailed(ipn); break
      case 'partially_paid': logger.info('[NOWPayments] Partial payment received — holding', { payment_id }); break
      case 'expired':        logger.info('[NOWPayments] Payment expired — no action', { payment_id }); break
      default:               logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id })
    }
    await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, true)
    return { success: true, message: `Processed ${payment_status}` }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status })
    return { success: false, message: err.message }
  }
}
