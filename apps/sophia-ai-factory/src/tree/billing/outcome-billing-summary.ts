/**
 * Outcome Billing Summary Aggregator
 *
 * Queries D1 outcome_billing_events to produce creator billing summaries.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CreatorBillingSummary } from '@/seed/types/outcome-pricing';

export async function getCreatorBillingSummary(
  userId: string,
  opts?: { fromDate?: number; toDate?: number },
): Promise<CreatorBillingSummary> {
  const conditions: string[] = ['user_id = ?'];
  const bindings: (string | number)[] = [userId];

  if (opts?.fromDate !== undefined) {
    conditions.push('created_at >= ?');
    bindings.push(opts.fromDate);
  }
  if (opts?.toDate !== undefined) {
    conditions.push('created_at <= ?');
    bindings.push(opts.toDate);
  }

  const where = conditions.join(' AND ');
  const period =
    opts?.fromDate || opts?.toDate
      ? `${opts?.fromDate ?? 0}-${opts?.toDate ?? 'now'}`
      : 'all-time';

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const row = await db
      .prepare(
        `SELECT
           COALESCE(SUM(gross_revenue_cents), 0) AS total_gross,
           COALESCE(SUM(fee_cents), 0)           AS total_fees,
           COALESCE(SUM(CASE WHEN status = 'settled' THEN fee_cents ELSE 0 END), 0) AS total_settled,
           COALESCE(SUM(CASE WHEN status = 'pending'  THEN fee_cents ELSE 0 END), 0) AS pending_fees
         FROM outcome_billing_events
         WHERE ${where}`,
      )
      .bind(...bindings)
      .first<{
        total_gross: number;
        total_fees: number;
        total_settled: number;
        pending_fees: number;
      }>();

    return {
      userId,
      totalGrossRevenueCents: row?.total_gross ?? 0,
      totalFeesCents: row?.total_fees ?? 0,
      totalSettledCents: row?.total_settled ?? 0,
      pendingFeesCents: row?.pending_fees ?? 0,
      period,
    };
  } catch (err) {
    logger.warn('billing_summary_fetch_failed', { userId, error: getErrorMessage(err) });
    throw new Error(`Failed to fetch billing summary: ${getErrorMessage(err)}`);
  }
}
