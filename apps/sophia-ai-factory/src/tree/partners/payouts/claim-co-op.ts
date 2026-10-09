/**
 * OCC CAS Co-Op Claiming
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/claim-co-op
 */

import type { D1Database } from '@cloudflare/workers-types';

export async function claimApprovedCoOpClaims(
  db: D1Database,
  batchId: string,
  partnerId: string | null,
  claimIds?: string[],
): Promise<{ count: number; sumCents: number }> {
  if (claimIds && claimIds.length > 0) {
    for (const cid of claimIds) {
      await db
        .prepare(`
          UPDATE partner_co_op_claims
          SET status = 'processing', payout_batch_id = ?1
          WHERE id = ?2 AND (status = 'approved' OR status = 'submitted') AND payout_batch_id IS NULL
        `)
        .bind(batchId, cid)
        .run();
    }
  } else if (partnerId) {
    await db
      .prepare(`
        UPDATE partner_co_op_claims
        SET status = 'processing', payout_batch_id = ?1
        WHERE partner_id = ?2 AND status = 'approved' AND payout_batch_id IS NULL
      `)
      .bind(batchId, partnerId)
      .run();
  } else {
    await db
      .prepare(`
        UPDATE partner_co_op_claims
        SET status = 'processing', payout_batch_id = ?1
        WHERE status = 'approved' AND payout_batch_id IS NULL
      `)
      .bind(batchId)
      .run();
  }

  const claimed = await db
    .prepare('SELECT id, approved_amount_cents FROM partner_co_op_claims WHERE payout_batch_id = ?')
    .bind(batchId)
    .all<{ id: string; approved_amount_cents: number }>();

  const rows = claimed.results ?? [];
  return {
    count: rows.length,
    sumCents: rows.reduce((sum, c) => sum + Math.max(0, c.approved_amount_cents), 0),
  };
}
