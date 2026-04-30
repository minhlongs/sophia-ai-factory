/**
 * Commission Ledger — D1 persistence layer
 *
 * Manages commission_ledger rows: insert, status transitions, queries.
 * All mutations are idempotent via UNIQUE(conversion_event_id).
 *
 * @module payouts/commission-ledger
 */

import { getD1Raw } from '@/lib/db/client'

export type LedgerStatus = 'pending' | 'payable' | 'paid' | 'clawed_back' | 'rejected'

export interface LedgerRow {
  id: string
  tenant_id: string
  affiliate_id: string
  conversion_event_id: string
  offer_id: string
  gross_amount_usd: number
  commission_pct: number
  commission_usd: number
  status: LedgerStatus
  payable_at: number
  paid_at: number | null
  payout_batch_id: string | null
  clawback_reason: string | null
  created_at: number
  updated_at: number
}

export interface InsertLedgerInput {
  id: string
  tenant_id: string
  affiliate_id: string
  conversion_event_id: string
  offer_id: string
  gross_amount_usd: number
  commission_pct: number
  commission_usd: number
  payable_at: number
}

/**
 * Insert a pending commission ledger row.
 * Idempotent: silently ignores duplicate conversion_event_id via IGNORE.
 */
export async function insertPendingLedger(input: InsertLedgerInput): Promise<void> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT OR IGNORE INTO commission_ledger
       (id, tenant_id, affiliate_id, conversion_event_id, offer_id,
        gross_amount_usd, commission_pct, commission_usd,
        status, payable_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,'pending',?,?,?)`,
    )
    .bind(
      input.id,
      input.tenant_id,
      input.affiliate_id,
      input.conversion_event_id,
      input.offer_id,
      input.gross_amount_usd,
      input.commission_pct,
      input.commission_usd,
      input.payable_at,
      now,
      now,
    )
    .run()
}

/**
 * Flip pending → payable for rows whose payable_at has passed and status = pending.
 * Returns count of updated rows.
 */
export async function flipPendingToPayable(nowTs: number): Promise<number> {
  const db = await getD1Raw()
  const result = await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'payable', updated_at = ?
       WHERE status = 'pending' AND payable_at <= ?`,
    )
    .bind(nowTs, nowTs)
    .run()
  return result.meta?.changes ?? 0
}

/**
 * Aggregate payable rows by affiliate within a tenant.
 */
export async function getPayableAggregates(
  tenantId: string,
): Promise<{ affiliate_id: string; total_usd: number; row_count: number }[]> {
  const db = await getD1Raw()
  const result = await db
    .prepare(
      `SELECT affiliate_id,
              SUM(commission_usd) AS total_usd,
              COUNT(*) AS row_count
       FROM commission_ledger
       WHERE tenant_id = ? AND status = 'payable'
       GROUP BY affiliate_id
       HAVING SUM(commission_usd) >= 10`,
    )
    .bind(tenantId)
    .all<{ affiliate_id: string; total_usd: number; row_count: number }>()
  return result.results ?? []
}

/**
 * Get payable ledger row IDs for an affiliate.
 */
export async function getPayableLedgerIds(
  tenantId: string,
  affiliateId: string,
): Promise<string[]> {
  const db = await getD1Raw()
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
 * Mark ledger rows as paid and link to payout batch.
 */
export async function markLedgerPaid(
  ledgerIds: string[],
  batchId: string,
): Promise<void> {
  if (ledgerIds.length === 0) return
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)
  const placeholders = ledgerIds.map(() => '?').join(',')
  await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'paid', paid_at = ?, payout_batch_id = ?, updated_at = ?
       WHERE id IN (${placeholders})`,
    )
    .bind(now, batchId, now, ...ledgerIds)
    .run()
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
  const db = await getD1Raw()
  const result = await db
    .prepare(
      `SELECT status,
              SUM(commission_usd) AS total_usd,
              COUNT(*) AS count
       FROM commission_ledger
       WHERE tenant_id = ? AND affiliate_id = ?
         AND created_at >= ? AND created_at <= ?
       GROUP BY status`,
    )
    .bind(tenantId, affiliateId, fromTs, toTs)
    .all<{ status: LedgerStatus; total_usd: number; count: number }>()
  return result.results ?? []
}

/**
 * Sum all paid commissions for reconciliation.
 */
export async function sumPaidCommissions(tenantId: string): Promise<number> {
  const db = await getD1Raw()
  const result = await db
    .prepare(
      `SELECT COALESCE(SUM(commission_usd), 0) AS total
       FROM commission_ledger
       WHERE tenant_id = ? AND status = 'paid'`,
    )
    .bind(tenantId)
    .first<{ total: number }>()
  return result?.total ?? 0
}

/**
 * Get paid batch IDs with their totals for reconciliation diff.
 */
export async function getPaidBatchSummary(
  tenantId: string,
): Promise<{ payout_batch_id: string; total_usd: number }[]> {
  const db = await getD1Raw()
  const result = await db
    .prepare(
      `SELECT payout_batch_id, SUM(commission_usd) AS total_usd
       FROM commission_ledger
       WHERE tenant_id = ? AND status = 'paid' AND payout_batch_id IS NOT NULL
       GROUP BY payout_batch_id`,
    )
    .bind(tenantId)
    .all<{ payout_batch_id: string; total_usd: number }>()
  return result.results ?? []
}
