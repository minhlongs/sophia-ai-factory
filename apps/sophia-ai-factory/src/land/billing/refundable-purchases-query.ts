/**
 * Refundable Purchases Query Adapter
 *
 * Encapsulates purchase history and refund eligibility queries for billing adapters.
 *
 * @module land/billing/refundable-purchases-query
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface RefundablePurchase {
  id: string;
  sku: string;
  amount_cents: number;
  status: string;
  created_at: number;
  paid_at: number | null;
  days_remaining: number;
}

const REFUND_WINDOW_DAYS = 30;
const SECONDS_PER_DAY = 86_400;

export async function queryRefundablePurchases(
  userId: string,
): Promise<RefundablePurchase[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');

    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - REFUND_WINDOW_DAYS * SECONDS_PER_DAY;

    const result = await db
      .prepare(
        `SELECT p.id, p.sku, p.amount_cents, p.status, p.created_at, p.paid_at
         FROM user_purchases p
         WHERE p.user_id = ?1
           AND p.kind = 'one_time'
           AND p.status = 'paid'
           AND COALESCE(p.paid_at, p.created_at) >= ?2
           AND NOT EXISTS (
             SELECT 1 FROM refund_requests r
             WHERE r.purchase_id = p.id AND r.user_id = p.user_id
           )
         ORDER BY p.created_at DESC
         LIMIT 50`,
      )
      .bind(userId, cutoff)
      .all<{
        id: string;
        sku: string;
        amount_cents: number;
        status: string;
        created_at: number;
        paid_at: number | null;
      }>();

    const purchases = (result.results ?? []).map((row) => {
      const purchaseEpoch = row.paid_at ?? row.created_at;
      const daysSince = (nowSec - purchaseEpoch) / SECONDS_PER_DAY;
      return {
        ...row,
        days_remaining: Math.max(0, Math.ceil(REFUND_WINDOW_DAYS - daysSince)),
      };
    });

    return purchases;
  } catch (err) {
    logger.error('[queryRefundablePurchases] Query failed', err instanceof Error ? err : undefined);
    return [];
  }
}
