/**
 * PayOS subscription batch commit operations.
 * Layer: app/api/payos/ipn/modules
 * @module app/api/payos/ipn/modules/payroll-subscription
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { markOrderCompleted } from '@/land/orders/pending-order-repo';
import type { Tier } from '@/seed/types';
import type { D1Client } from '@/seed/db/client';

export async function commitPayOsSubscriptionBatch(params: {
  db: D1Client;
  d1: D1Database;
  orgId: string | undefined;
  tier: Tier;
  periodEnd: string;
  now: string;
  orderCode: string | number;
  orderId: string;
}): Promise<void> {
  const { db, d1, orgId, tier, periodEnd, now, orderCode, orderId } = params;
  try {
    const { data: existingSub } = await db.from('subscriptions').select('id').eq('org_id', orgId ?? '').single();
    const stmts = orgId
      ? existingSub
        ? [
            d1.prepare('UPDATE subscriptions SET plan=?, status=?, current_period_end=?, updated_at=? WHERE org_id=?')
              .bind(tier.toLowerCase(), 'active', periodEnd, now, orgId),
            d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
              .bind(tier.toLowerCase(), now, orgId),
            d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
              .bind('completed', `payos_${orderCode}`, now, orderId),
          ]
        : [
            d1.prepare('INSERT INTO subscriptions (org_id, plan, status, current_period_start, current_period_end) VALUES (?,?,?,?,?)')
              .bind(orgId, tier.toLowerCase(), 'active', now, periodEnd),
            d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
              .bind(tier.toLowerCase(), now, orgId),
            d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
              .bind('completed', `payos_${orderCode}`, now, orderId),
          ]
      : [];

    if (stmts.length > 0) await d1.batch(stmts);
  } catch (batchErr) {
    logger.warn('[PayOS IPN] Batch failed, verifying state before fallback', { error: String(batchErr) });
    if (orgId) {
      await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now }).eq('org_id', orgId);
      await db.from('organizations').update({ plan: tier.toLowerCase(), updated_at: now }).eq('id', orgId);
    }
    await markOrderCompleted(orderId, `payos_${orderCode}`);
    throw batchErr;
  }
}