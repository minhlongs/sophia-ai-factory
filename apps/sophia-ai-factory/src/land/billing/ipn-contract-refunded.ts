/**
 * NOWPayments contract `refunded` event — correlation, integrity, reversal.
 *
 * Returns `null` when the event does not resolve to a contract order, so the
 * caller falls through to subscription/one-time routing unchanged.
 *
 * @module billing/ipn-contract-refunded
 */

import { refundNowPaymentsContractOrder } from '@/land/contracts/workflow/nowpayments-contract-refund'
import {
  correlateContractOrders, findContractOrderByOrderId, findSharedContractBreach,
  loadContract, loadContractOrder, loadEventLock, loadInvoice, loadMcUGrant,
  type ContractRow, type GrantRow, type InvoiceRow, type LockRow, type RefundedContext,
} from './ipn-contract-context'
import type { D1Client } from '@/seed/db/d1-client-rpc'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'

/**
 * Resolve the order_id for a refund that arrived without one. Throws when the
 * persisted payment identity is ambiguous, matching the retryable contract.
 * Returns an empty string when no correlation could be established.
 */
export async function resolveContractOrderId(
  ipn: NowPaymentsIpnPayload,
  db: D1Client,
): Promise<string> {
  if (ipn.order_id) return ipn.order_id
  if (!db || (!ipn.payment_id && !ipn.invoice_id)) return ipn.order_id ?? ''

  const matches = await correlateContractOrders(db, ipn.payment_id ?? '', ipn.invoice_id ?? '')
  if (matches && matches.length > 1) {
    throw new Error('NOWPayments contract refund correlation is ambiguous; retry after reconciliation')
  }
  if (matches && matches.length === 1) return matches[0].order_id
  return ipn.order_id ?? ''
}

/**
 * Reverse a contract order for a `refunded` event.
 * Returns `false` when handled, `null` when the event belongs to another rail.
 */
export async function dispatchContractRefunded(
  ipn: NowPaymentsIpnPayload,
  db: D1Client,
  contractOrderId?: string,
): Promise<boolean | null> {
  const orderId = contractOrderId ?? ipn.order_id
  if (!db || !orderId || !ipn.invoice_id) return null

  const order = await loadContractOrder(db, orderId)
  if (!order) return null

  const eventId = `nowpayments_${ipn.payment_id}_refunded`
  const lock = await loadEventLock(db, eventId)
  const contract = await loadContract(db, order.contract_id)
  const invoice = await loadInvoice(db, order.invoice_id, contract?.orgId ?? '')
  const grant = await loadMcUGrant(db, ipn.payment_id, order.user_id, contract?.mcuCapacityMonthly ?? -1)

  // A refund is only "already completed" when both the invoice was paid and the
  // capacity grant exists; either one alone is an inconsistent state.
  const wasCompleted = invoice?.status === 'paid' && Boolean(grant)

  // Shared terms first, then the four clauses only the refunded path requires.
  const breach = findSharedContractBreach(ipn, { order, lock, contract, invoice })
  if (breach || contract === null || invoice === null || lock === null ||
      (order.payment_id && order.payment_id !== ipn.payment_id) ||
      (invoice.status === 'paid' && !wasCompleted) ||
      (Boolean(grant) && !wasCompleted) ||
      (order.status === 'completed' && !wasCompleted)) {
    throw new Error('NOWPayments contract refund did not match its persisted invoice and payment')
  }

  const ctx: RefundedContext = { order, lock, contract, invoice, grant, wasCompleted }
  await refundNowPaymentsContractOrder(db.unwrap(), {
    contract: ctx.contract, invoiceId: ctx.order.invoice_id, orderId: ctx.order.order_id,
    paidByUserId: ctx.order.user_id, paymentId: ipn.payment_id,
    providerInvoiceId: ipn.invoice_id, amountCents: ctx.invoice.total_amount_cents,
    lockCreatedAt: ctx.lock.created_at, orderStatus: ctx.order.status,
    wasCompleted,
  })
  return false
}

/**
 * A contract refund must never fall through to the subscription handler, and one
 * that carries no provider invoice ID must be retried after reconciliation.
 */
export async function assertContractRefundIsCorrelatable(
  ipn: NowPaymentsIpnPayload,
  db: D1Client,
): Promise<void> {
  if (ipn.order_id) {
    const isContractOrder = await findContractOrderByOrderId(db, ipn.order_id)
    if (isContractOrder) {
      throw new Error('NOWPayments contract refund could not be safely correlated; retry after reconciliation')
    }
  }
}

export type { ContractRow, GrantRow, InvoiceRow, LockRow }
