/**
 * Balance and Status Aggregation Queries
 *
 * @module tree/affiliate/ledger/balance-aggregator
 */

import type { NetBalanceResult } from './types';

/**
 * Promotes all mature pending rows to payable status.
 * Evaluates: status = 'pending' AND payable_at <= nowTimestampMs
 *
 * @param db D1 database instance
 * @param nowTimestampMs Millisecond timestamp (defaults to Date.now())
 * @returns Number of rows promoted
 */
export async function flipPendingToPayable(
  db: D1Database,
  nowTimestampMs = Date.now(),
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'payable'
       WHERE status = 'pending' AND payable_at <= ?`,
    )
    .bind(nowTimestampMs)
    .run();

  return result.meta?.changes ?? 0;
}

/**
 * Computes the net balance in cents for a given affiliate across all ledger rows.
 * Because clawbacks are stored as negative numbers, SUM(commission_cents) is exact.
 */
export async function getNetAffiliateBalance(
  db: D1Database,
  affiliateId: string,
): Promise<number> {
  const res = await db
    .prepare(
      `SELECT SUM(commission_cents) AS net_cents
       FROM commission_ledger
       WHERE affiliate_id = ?`,
    )
    .bind(affiliateId)
    .first<{ net_cents: number | null }>();

  return res?.net_cents ?? 0;
}

/**
 * Computes an itemized breakdown of affiliate earnings by status.
 */
export async function getAffiliateBalanceBreakdown(
  db: D1Database,
  affiliateId: string,
): Promise<NetBalanceResult> {
  const rows = await db
    .prepare(
      `SELECT status, SUM(commission_cents) AS sum_cents
       FROM commission_ledger
       WHERE affiliate_id = ?
       GROUP BY status`,
    )
    .bind(affiliateId)
    .all<{ status: string; sum_cents: number }>();

  let totalCommissionsCents = 0;
  let totalClawbacksCents = 0;
  let pendingCents = 0;
  let payableCents = 0;
  let paidCents = 0;

  for (const r of rows.results ?? []) {
    const amount = r.sum_cents ?? 0;
    if (r.status === 'clawback' || r.status === 'clawed_back') {
      totalClawbacksCents += Math.abs(amount);
    } else {
      totalCommissionsCents += amount;
      if (r.status === 'pending') pendingCents += amount;
      else if (r.status === 'payable') payableCents += amount;
      else if (r.status === 'paid') paidCents += amount;
    }
  }

  const netCents = totalCommissionsCents - totalClawbacksCents;

  return {
    affiliateId,
    totalCommissionsCents,
    totalClawbacksCents,
    netCents,
    pendingCents,
    payableCents,
    paidCents,
  };
}
