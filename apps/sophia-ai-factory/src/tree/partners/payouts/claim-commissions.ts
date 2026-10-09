/**
 * OCC CAS Commission Claiming
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/claim-commissions
 */

import type { D1Database } from '@cloudflare/workers-types';

export async function claimPendingCommissions(
  db: D1Database,
  batchId: string,
  partnerId: string | null,
  commissionIds?: string[],
): Promise<{ count: number; sumCents: number }> {
  if (commissionIds && commissionIds.length > 0) {
    for (const cid of commissionIds) {
      await db
        .prepare(`
          UPDATE partner_commissions
          SET status = 'approved', payout_batch_id = ?1
          WHERE id = ?2 AND status = 'pending' AND payout_batch_id IS NULL
        `)
        .bind(batchId, cid)
        .run();
    }
  } else if (partnerId) {
    await db
      .prepare(`
        UPDATE partner_commissions
        SET status = 'approved', payout_batch_id = ?1
        WHERE partner_id = ?2 AND status = 'pending' AND payout_batch_id IS NULL
      `)
      .bind(batchId, partnerId)
      .run();
  } else {
    await db
      .prepare(`
        UPDATE partner_commissions
        SET status = 'approved', payout_batch_id = ?1
        WHERE status = 'pending' AND payout_batch_id IS NULL
      `)
      .bind(batchId)
      .run();
  }

  const claimed = await db
    .prepare('SELECT id, commission_cents FROM partner_commissions WHERE payout_batch_id = ?')
    .bind(batchId)
    .all<{ id: string; commission_cents: number }>();

  const rows = claimed.results ?? [];
  return {
    count: rows.length,
    sumCents: rows.reduce((sum, c) => sum + Math.max(0, c.commission_cents), 0),
  };
}
