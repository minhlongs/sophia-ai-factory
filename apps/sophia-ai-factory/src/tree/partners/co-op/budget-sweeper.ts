/**
 * Co-Op Marketing Budget Sweeper & Partner Summary Engine
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/budget-sweeper
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { SweepExpiredBudgetsResult } from './types';

export {
  getPartnerCoOpSummary,
  getPartnerCoOpAllocations,
  getPartnerCoOpClaims,
} from './partner-coop-queries';

/**
 * Sweeps and reclaims expired unspent Co-Op budget allocations after 90 days.
 *
 * @param db - D1Database instance.
 * @param currentTimestampMs - Current timestamp in milliseconds (defaults to Date.now()).
 */
export async function sweepExpiredCoOpBudgets(
  db: D1Database,
  currentTimestampMs?: number,
): Promise<SweepExpiredBudgetsResult> {
  const cutoff = currentTimestampMs ?? Date.now();

  const expiredAllocations = await db
    .prepare(`
      SELECT id, remaining_cents
      FROM co_op_budget_allocations
      WHERE status = 'active' AND expires_at <= ?
    `)
    .bind(cutoff)
    .all<{ id: string; remaining_cents: number }>();

  const items = expiredAllocations.results ?? [];
  if (items.length === 0) {
    return { expiredCount: 0, reclaimedCents: 0 };
  }

  const reclaimedCents = items.reduce((sum, item) => sum + Math.max(0, item.remaining_cents), 0);

  await db
    .prepare(`
      UPDATE co_op_budget_allocations
      SET status = 'expired', updated_at = ?1
      WHERE status = 'active' AND expires_at <= ?2
    `)
    .bind(cutoff, cutoff)
    .run();

  return {
    expiredCount: items.length,
    reclaimedCents,
  };
}
