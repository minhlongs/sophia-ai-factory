/**
 * Refund requests data access layer.
 * All queries scoped by userId for customer ops, unscoped for admin.
 *
 * @module lib/refunds/refund-repo
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'

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
  const db = await getD1();
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
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const result = await db
    .prepare(`SELECT * FROM refund_requests ORDER BY created_at DESC LIMIT 200`)
    .all<RefundRequest>()
  return result.results ?? []
}

export async function getRefundById(id: string): Promise<RefundRequest | null> {
  const db = await getD1();
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
}): Promise<boolean> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  // H9 fix (2026-07-01): AND status = 'pending' prevents TOCTOU race
  // where two concurrent PATCH requests could both pass the status check
  // in the route handler and overwrite each other's decision.
  const result = await db
    .prepare(
      `UPDATE refund_requests
       SET status = ?1,
           reviewed_at = strftime('%s','now'),
           reviewed_by_user_id = ?2,
           admin_notes = COALESCE(?3, admin_notes),
           refund_tx_hash = COALESCE(?4, refund_tx_hash)
       WHERE id = ?5 AND status = 'pending'`,
    )
    .bind(
      params.status,
      params.reviewedByUserId,
      params.adminNotes ?? null,
      params.refundTxHash ?? null,
      params.id,
    )
    .run()
  const updated = (result.meta?.changes ?? 0) > 0
  if (updated) {
    logger.info('[RefundRepo] Status updated', { id: params.id, status: params.status })
  } else {
    logger.warn('[RefundRepo] Status update skipped — already reviewed', { id: params.id })
  }
  return updated
}

export async function getRefundByPurchaseAndUser(
  purchaseId: string,
  userId: string,
): Promise<RefundRequest | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare(
      `SELECT * FROM refund_requests WHERE purchase_id = ?1 AND user_id = ?2 LIMIT 1`,
    )
    .bind(purchaseId, userId)
    .first<RefundRequest>()
  return row ?? null
}

// ── Process refund status (atomic transition from approved to refunded) ──────

/**
 * Atomically transition a refund request from 'approved' to 'refunded' status.
 * Uses WHERE status='approved' as a conditional guard — if the status was
 * already changed (e.g. by a concurrent IPN handler), the update is a no-op.
 * Returns the number of rows affected (0 if already transitioned).
 */
export async function processRefundStatus(params: {
  id: string
  reviewedByUserId: string
  adminNotes?: string
  refundTxHash: string
}): Promise<number> {
  const db = await getD1()
  if (!db) throw new Error('D1 database binding not available')

  const result = await db
    .prepare(
      `UPDATE refund_requests
       SET status = 'refunded',
           reviewed_at = strftime('%s','now'),
           reviewed_by_user_id = ?1,
           admin_notes = COALESCE(?2, admin_notes),
           refund_tx_hash = ?3
       WHERE id = ?4 AND status = 'approved'`,
    )
    .bind(params.reviewedByUserId, params.adminNotes ?? null, params.refundTxHash, params.id)
    .run()

  if (result.meta?.changes === 0) {
    logger.warn('[RefundRepo] processRefundStatus: no rows updated — status may already be refunded', {
      id: params.id,
      refundTxHash: params.refundTxHash,
    })
  } else {
    logger.info('[RefundRepo] processRefundStatus: transitioned approved to refunded', {
      id: params.id,
      refundTxHash: params.refundTxHash,
    })
  }

  return result.meta?.changes ?? 0
}

// ── Refund ledger entry ──────────────────────────────────────────────────────

/**
 * Insert a refund_ledger entry for audit trail.
 * The refund_ledger table captures: who was refunded, how much, tier before/after,
 * MCU clawback amount, and the blockchain transaction hash.
 * Returns the generated ledger entry id.
 */
export async function createRefundLedgerEntry(params: {
  refundRequestId: string
  userId: string
  purchaseId: string
  paymentId: string
  amountCents: number
  tierBefore: Tier
  tierAfter: Tier
  mcuClawedBack: number
  txHash: string
}): Promise<string> {
  const db = await getD1()
  if (!db) throw new Error('D1 database binding not available')

  const id = crypto.randomUUID().replace(/-/g, '')

  await db
    .prepare(
      `INSERT INTO refund_ledger
         (id, refund_request_id, user_id, purchase_id, payment_id, amount_cents,
          tier_before, tier_after, mcu_clawed_back, tx_hash, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, strftime('%s','now'))`,
    )
    .bind(
      id,
      params.refundRequestId,
      params.userId,
      params.purchaseId,
      params.paymentId,
      params.amountCents,
      params.tierBefore,
      params.tierAfter,
      params.mcuClawedBack,
      params.txHash,
    )
    .run()

  logger.info('[RefundRepo] Ledger entry created', {
    id,
    refundRequestId: params.refundRequestId,
    amountCents: params.amountCents,
    tierBefore: params.tierBefore,
    tierAfter: params.tierAfter,
    mcuClawedBack: params.mcuClawedBack,
  })

  return id
}

export type { RefundProcessInput, RefundProcessResult, RefundError } from './refund-processor'
