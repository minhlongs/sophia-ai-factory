/**
 * NOWPayments contract `finished` event — correlation, integrity, fulfillment.
 *
 * Returns `null` when the order is not a contract order, so the caller falls
 * through to subscription/one-time routing unchanged.
 *
 * @module billing/ipn-contract-finished
 */

import { checkCryptoPaidAmount } from './ipn-amount-check'
import { fulfillNowPaymentsContractOrder } from '@/land/contracts/workflow/nowpayments-contract-fulfillment'
import {
  findContractOrderByOrderId, findSharedContractBreach, loadContract, loadContractOrder,
  loadEventLock, loadInvoice, type ContractRow, type FinishedContext, type InvoiceRow,
  type LockRow,
} from './ipn-contract-context'
import type { D1Client } from '@/seed/db/d1-client-rpc'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'

/**
 * Fulfill a contract order for a `finished` event.
 * Returns `false` when handled, `null` when the order belongs to another rail.
 */
export async function dispatchContractFinished(
  ipn: NowPaymentsIpnPayload,
  db: D1Client,
): Promise<boolean | null> {
  if (!db || !ipn.order_id) return null

  const order = await loadContractOrder(db, ipn.order_id)
  if (!order) return null

  const eventId = `nowpayments_${ipn.payment_id}_finished`
  const lock = await loadEventLock(db, eventId)
  const contract = await loadContract(db, order.contract_id)
  const invoice = await loadInvoice(db, order.invoice_id, contract?.orgId ?? '')
  const amount = checkCryptoPaidAmount(ipn.actually_paid, ipn.pay_amount, 0.99)

  // Shared terms first, then the two clauses only the finished path requires.
  // The breach check rejects a missing invoice_id, so it is present past this guard.
  const breach = findSharedContractBreach(ipn, { order, lock, contract, invoice })
  if (breach || contract === null || invoice === null || lock === null ||
      contract.lastInvoiceId !== order.invoice_id || amount.status !== 'sufficient') {
    throw new Error('NOWPayments contract payment did not match its persisted invoice and payment amount')
  }
  const providerInvoiceId = ipn.invoice_id ?? ''

  const ctx: FinishedContext = { order, lock, contract, invoice }
  await fulfillNowPaymentsContractOrder(db.unwrap(), {
    contract: ctx.contract, invoiceId: ctx.order.invoice_id, orderId: ctx.order.order_id,
    paidByUserId: ctx.order.user_id, paymentId: ipn.payment_id,
    providerInvoiceId, amountCents: ctx.invoice.total_amount_cents,
    lockCreatedAt: ctx.lock.created_at,
  })
  return false
}

/**
 * A contract order must never fall through to subscription tier fulfillment,
 * even if a stale/terminal state prevented its guarded settlement above.
 */
export async function assertContractFinishedIsSafe(db: D1Client, orderId: string): Promise<void> {
  const isContractOrder = await findContractOrderByOrderId(db, orderId)
  if (isContractOrder) throw new Error('NOWPayments contract order could not be safely fulfilled')
}

export type { ContractRow, InvoiceRow, LockRow }
