/**
 * Shared loaders and integrity predicate for NOWPayments contract events.
 *
 * The finished and refunded contract guards share most terms but are NOT the same
 * guard: each path adds its own invariants on top of the terms asserted here.
 * Callers must apply their extra clauses after this predicate passes.
 *
 * @module billing/ipn-contract-context
 */

import { lookupInvoice } from '@/tree/clients/nowpayments-client'
import { getContractById } from '@/land/contracts/workflow/contract-converter'
import type { D1Client } from '@/seed/db/d1-client-rpc'
import type { EnterpriseContract } from '@/seed/types/enterprise/contracts'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'

export type ContractOrderRow = {
  order_id: string; user_id: string; contract_id: string; invoice_id: string;
  amount_usd_cents: number; provider_payment_id: string | null;
  status: 'pending' | 'expired' | 'failed' | 'completed'; payment_id: string | null;
}

export type InvoiceRow = { total_amount_cents: number; currency: string; status: string }
export type ContractRow = EnterpriseContract
export type LockRow = { created_at: string }
export type GrantRow = { payment_reference: string }

export type FinishedContext = {
  order: ContractOrderRow; lock: LockRow; invoice: InvoiceRow; contract: ContractRow
}
export type RefundedContext = FinishedContext & { grant: GrantRow | null; wasCompleted: boolean }

const ORDER_COLUMNS = `order_id, user_id, contract_id, invoice_id,
        amount_usd_cents, provider_payment_id, status, payment_id`

/** Load the persisted contract order for an order_id, or null when unrelated. */
export async function loadContractOrder(db: D1Client, orderId: string): Promise<ContractOrderRow | null> {
  return (await db.prepare(`SELECT ${ORDER_COLUMNS}
      FROM pending_orders WHERE order_id = ?1 AND purpose = 'contract'
        AND payment_method = 'nowpayments' AND status IN ('pending', 'expired', 'failed', 'completed')`)
    .bind(orderId).first<ContractOrderRow>()) ?? null
}

/** Load the event lock that makes this payment event idempotent. */
export async function loadEventLock(db: D1Client, eventId: string): Promise<LockRow | null> {
  return (await db.prepare('SELECT created_at FROM payment_events WHERE event_id = ?1 AND processed = 0')
    .bind(eventId).first<LockRow>()) ?? null
}

/**
 * Load the persisted contract linked to the order. Delegates to the contracts
 * workflow so the row keeps its full mapped shape.
 */
export async function loadContract(db: D1Client, contractId: string): Promise<ContractRow | null> {
  return await getContractById(db.unwrap(), contractId)
}

/**
 * Load the USD invoice the order was issued against. org_id is bound even when the
 * contract is missing so the lookup stays scoped instead of matching any org's row.
 */
export async function loadInvoice(db: D1Client, invoiceId: string, orgId: string): Promise<InvoiceRow | null> {
  return (await db.prepare(`SELECT total_amount_cents, currency, status FROM invoices
        WHERE id = ?1 AND org_id = ?2`).bind(invoiceId, orgId).first<InvoiceRow>()) ?? null
}

/** Load an MCU grant row proving capacity was provisioned for this payment. */
export async function loadMcUGrant(db: D1Client, paymentId: string, userId: string, delta: number): Promise<GrantRow | null> {
  return (await db.prepare(`SELECT payment_reference FROM mcu_transactions
      WHERE payment_reference = ?1 AND user_id = ?2 AND delta = ?3`)
    .bind(paymentId, userId, delta).first<GrantRow>()) ?? null
}

/** Correlation for a refund that arrived without an order_id. */
export async function correlateContractOrders(db: D1Client, paymentId: string, invoiceId: string): Promise<ContractOrderRow[] | null> {
  const matches = await db.prepare(`SELECT order_id FROM pending_orders
      WHERE purpose = 'contract' AND payment_method = 'nowpayments'
        AND status IN ('pending', 'expired', 'failed', 'completed')
        AND ((?1 != '' AND payment_id = ?1) OR (?2 != '' AND provider_payment_id = ?2))
      LIMIT 2`).bind(paymentId, invoiceId).all<ContractOrderRow>();
  return matches.results ?? null
}

/** True when a bare order_id still identifies a contract order of any status. */
export async function findContractOrderByOrderId(db: D1Client, orderId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT order_id FROM pending_orders
      WHERE order_id = ?1 AND purpose = 'contract' AND payment_method = 'nowpayments'`)
    .bind(orderId).first<{ order_id: string }>();
  return row !== null
}

/** Resolve the invoice kind used to route non-contract events. */
export function resolveInvoiceKind(invoiceId: string) {
  return lookupInvoice(invoiceId)
}

/**
 * Terms that BOTH contract paths require. Returns the failed clause, or null when
 * the event is consistent. Path-specific clauses are asserted by the caller.
 */
export type Breach = 'lock' | 'contract' | 'invoice' | 'invoice-id' | 'provider-invoice' | 'currency' | 'order-amount' | 'price-currency' | 'price-amount'

export function findSharedContractBreach(
  ipn: NowPaymentsIpnPayload,
  ctx: { order: ContractOrderRow; lock: LockRow | null; contract: ContractRow | null; invoice: InvoiceRow | null },
): Breach | null {
  if (!ctx.lock) return 'lock'
  if (!ctx.contract) return 'contract'
  if (!ctx.invoice) return 'invoice'
  if (!ipn.invoice_id) return 'invoice-id'
  if (ctx.order.provider_payment_id && ctx.order.provider_payment_id !== ipn.invoice_id) return 'provider-invoice'
  if (ctx.invoice.currency !== 'USD') return 'currency'
  if (ctx.invoice.total_amount_cents !== ctx.order.amount_usd_cents) return 'order-amount'
  if (ipn.price_currency.toUpperCase() !== 'USD') return 'price-currency'
  if (Math.round(ipn.price_amount * 100) !== ctx.invoice.total_amount_cents) return 'price-amount'
  return null
}
