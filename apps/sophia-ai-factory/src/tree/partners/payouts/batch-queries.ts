/**
 * Payout Batch Query Utilities
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/batch-queries
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerPayoutBatch } from '@/tree/partners/types';

/**
 * Retrieves a payout batch by ID.
 */
export async function getPayoutBatchById(
  db: D1Database,
  batchId: string,
): Promise<PartnerPayoutBatch | null> {
  const batch = await db
    .prepare('SELECT * FROM partner_payout_batches WHERE id = ?')
    .bind(batchId)
    .first<PartnerPayoutBatch>();

  return batch ?? null;
}

/**
 * Retrieves payout batches for a partner.
 */
export async function getPartnerPayoutBatches(
  db: D1Database,
  partnerId: string,
): Promise<PartnerPayoutBatch[]> {
  const batches = await db
    .prepare('SELECT * FROM partner_payout_batches WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<PartnerPayoutBatch>();

  return batches.results ?? [];
}
