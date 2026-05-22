/**
 * CRUD repository for pending_orders D1 table.
 * All functions use createServerClient() (synchronous, no await on client).
 * @module orders/pending-order-repo
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import type { PendingOrder, PendingOrderInput } from './pending-order-types'

function getDb() {
  return createServerClient()
}

/**
 * Insert a new pending order row.
 * Returns the created row (re-select after insert for consistency).
 * Throws if order_id already exists (PK constraint).
 */
export async function writeOrder(input: PendingOrderInput): Promise<PendingOrder> {
  const db = getDb()
  const row = {
    order_id: input.order_id,
    user_id: input.user_id,
    tier: input.tier,
    period: input.period ?? 'monthly',
    payment_method: input.payment_method ?? 'nowpayments',
    amount_usd_cents: input.amount_usd_cents,
    promo_code: input.promo_code ?? null,
    customer_email: input.customer_email ?? null,
    invoice_url: input.invoice_url ?? null,
    status: 'pending',
    payment_id: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  }
  await db.from('pending_orders').insert(row)
  logger.info('[PendingOrder] Created', { order_id: input.order_id, tier: input.tier })
  return row as PendingOrder
}

/**
 * Fetch a single order by its ID.
 * Returns null if not found.
 */
export async function getOrderById(orderId: string): Promise<PendingOrder | null> {
  const db = getDb()
  const { data } = await db
    .from('pending_orders')
    .select('*')
    .eq('order_id', orderId)
    .single()
  return (data as PendingOrder | null) ?? null
}

/**
 * Flip status to completed and record payment_id.
 * Called from IPN handleFinished after D1 batch.
 */
export async function markOrderCompleted(orderId: string, paymentId: string): Promise<void> {
  const db = getDb()
  await db
    .from('pending_orders')
    .update({ status: 'completed', payment_id: paymentId, completed_at: new Date().toISOString() })
    .eq('order_id', orderId)
  logger.info('[PendingOrder] Completed', { order_id: orderId, payment_id: paymentId })
}

/**
 * Flip status to failed.
 * Called from IPN handleFailed / expired flows.
 */
export async function markOrderFailed(orderId: string, reason?: string): Promise<void> {
  const db = getDb()
  await db
    .from('pending_orders')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('order_id', orderId)
  logger.info('[PendingOrder] Failed', { order_id: orderId, reason })
}

/**
 * Find an existing pending order for (user, tier, period, payment_method)
 * created within `sinceMs` ago. Used to dedupe rapid double-clicks on
 * the checkout button before the first invoice is paid or expired.
 *
 * Why: prevents the user from being charged twice for the same SKU during
 * the NOWPayments invoice TTL window.
 */
export async function findActivePendingOrder(args: {
  userId: string
  tier: string
  period: string
  paymentMethod: string
  sinceMs: number
}): Promise<PendingOrder | null> {
  const db = getDb()
  const cutoffIso = new Date(Date.now() - args.sinceMs).toISOString()
  const { data } = await db
    .from('pending_orders')
    .select('*')
    .eq('user_id', args.userId)
    .eq('tier', args.tier)
    .eq('period', args.period)
    .eq('payment_method', args.paymentMethod)
    .eq('status', 'pending')
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: false })
    .limit(1)
  const rows = (data as PendingOrder[] | null) ?? []
  return rows[0] ?? null
}

/**
 * List recent orders for a user (for audit / dashboard history link).
 * Default limit 10, sorted by created_at desc.
 */
export async function listOrdersByUser(userId: string, limit = 10): Promise<PendingOrder[]> {
  const db = getDb()
  const { data } = await db
    .from('pending_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as PendingOrder[] | null) ?? []
}
