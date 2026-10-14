/**
 * Commission Ledger — read-side D1 queries (aggregates, ids, earnings summary).
 */

import { getD1 } from '@/seed/db/client'
import { fromCents } from './commission-cents'
import type { LedgerStatus } from './commission-ledger-types'

/**
 * Aggregate net payable cents by affiliate within a tenant.
 * Includes clawback (negative) rows. HAVING >= 1000 cents = $10 minimum.
 */
export async function getPayableAggregates(
  tenantId: string,
): Promise<{ affiliate_id: string; total_cents: number; row_count: number }[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare(
      `SELECT affiliate_id,
              SUM(commission_cents - withheld_cents) AS total_cents,
              COUNT(*) AS row_count
       FROM commission_ledger
       WHERE tenant_id = ? AND status IN ('payable','clawback')
       GROUP BY affiliate_id
       HAVING SUM(commission_cents - withheld_cents) >= 1000`,
    )
    .bind(tenantId)
    .all<{ affiliate_id: string; total_cents: number; row_count: number }>()
  return result.results ?? []
}

/**
 * Get payable ledger row IDs (positive rows only) for an affiliate.
 */
export async function getPayableLedgerIds(
  tenantId: string,
  affiliateId: string,
): Promise<string[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare(
      `SELECT id FROM commission_ledger
       WHERE tenant_id = ? AND affiliate_id = ? AND status = 'payable'`,
    )
    .bind(tenantId, affiliateId)
    .all<{ id: string }>()
  return (result.results ?? []).map((r: { id: string }) => r.id)
}

/**
 * Earnings summary per status for an affiliate within a date range.
 */
export async function getEarningsSummary(
  tenantId: string,
  affiliateId: string,
  fromTs: number,
  toTs: number,
): Promise<{ status: LedgerStatus; total_usd: number; count: number }[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare(
      `SELECT status,
              SUM(commission_cents - withheld_cents) AS net_cents,
              COUNT(*) AS count
       FROM commission_ledger
       WHERE tenant_id = ? AND affiliate_id = ?
         AND created_at >= ? AND created_at <= ?
       GROUP BY status`,
    )
    .bind(tenantId, affiliateId, fromTs, toTs)
    .all<{ status: LedgerStatus; net_cents: number; count: number }>()
  return (result.results ?? []).map((r) => ({
    status: r.status,
    total_usd: fromCents(r.net_cents),
    count: r.count,
  }))
}
