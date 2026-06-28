/**
 * Refund requests data access layer.
 * All queries scoped by userId for customer ops, unscoped for admin.
 *
 * @module lib/refunds/refund-repo
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

export interface RefundRequest {
  id: string
  user_id: string
  purchase_id: string
  payment_id: string
  amount_cents: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'refunded'
  created_at: number
  reviewed_at: number | null
  reviewed_by_user_id: string | null
  admin_notes: string | null
  refund_tx_hash: string | null
  customer_wallet_address: string | null
}

export async function createRefundRequest(params: {
  userId: string
  purchaseId: string
  paymentId: string
  amountCents: number
  reason: string
  customerWalletAddress: string
}): Promise<string> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = crypto.randomUUID().replace(/-/g, '')
  await db
    .prepare(
      `INSERT INTO refund_requests
         (id, user_id, purchase_id, payment_id, amount_cents, reason, customer_wallet_address)
       VALUES (?1,?2,?3,?4,?5,?6,?7)`,
    )
    .bind(id, params.userId, params.purchaseId, params.paymentId, params.amountCents, params.reason, params.customerWalletAddress)
    .run()
  return id
}

export async function listPendingRefunds(): Promise<RefundRequest[]> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const result = await db
    .prepare(`SELECT * FROM refund_requests ORDER BY created_at DESC LIMIT 200`)
    .all<RefundRequest>()
  return result.results ?? []
}

export async function getRefundById(id: string): Promise<RefundRequest | null> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare(`SELECT * FROM refund_requests WHERE id = ?1`)
    .bind(id)
    .first<RefundRequest>()
  return row ?? null
}

export async function updateRefundStatus(params: {
  id: string
  status: 'approved' | 'rejected' | 'refunded'
  reviewedByUserId: string
  adminNotes?: string
  refundTxHash?: string
}): Promise<void> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  await db
    .prepare(
      `UPDATE refund_requests
       SET status = ?1,
           reviewed_at = strftime('%s','now'),
           reviewed_by_user_id = ?2,
           admin_notes = COALESCE(?3, admin_notes),
           refund_tx_hash = COALESCE(?4, refund_tx_hash)
       WHERE id = ?5`,
    )
    .bind(
      params.status,
      params.reviewedByUserId,
      params.adminNotes ?? null,
      params.refundTxHash ?? null,
      params.id,
    )
    .run()
  logger.info('[RefundRepo] Status updated', { id: params.id, status: params.status })
}

export async function getRefundByPurchaseAndUser(
  purchaseId: string,
  userId: string,
): Promise<RefundRequest | null> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare(
      `SELECT * FROM refund_requests WHERE purchase_id = ?1 AND user_id = ?2 LIMIT 1`,
    )
    .bind(purchaseId, userId)
    .first<RefundRequest>()
  return row ?? null
}
