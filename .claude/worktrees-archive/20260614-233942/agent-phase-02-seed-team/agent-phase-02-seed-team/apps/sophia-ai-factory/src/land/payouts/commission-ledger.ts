/**
 * Commission Ledger — D1 persistence layer (insert + query)
 *
 * All money values are INTEGER cents (multiply USD × 100, C1).
 * Status mutations (claim/markPaid/rollback) in commission-ledger-mutations.ts.
 *
 * @module payouts/commission-ledger
 */

import { getD1Raw } from '@/seed/db/client'
import { toCents, fromCents } from './commission-cents'

export type LedgerStatus =
  | 'pending'
  | 'payable'
  | 'paying'
  | 'paid'
  | 'clawed_back'
  | 'clawback'
  | 'rejected'

export interface LedgerRow {
  id: string
  tenant_id: string
  affiliate_id: string
  conversion_event_id: string
  offer_id: string
  gross_cents: number
  commission_pct: number
  commission_cents: number
  withheld_cents: number
  parent_conversion_id: string | null
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
  /** USD float — converted to cents internally (C1) */
  gross_amount_usd: number
  commission_pct: number
  /** USD float — converted to cents internally (C1) */
  commission_usd: number
  payable_at: number
  /** Optional: VN PIT withheld in cents (H1) */
  withheld_cents?: number
}

/**
 * Insert a pending commission ledger row.
 * Converts USD → cents. Idempotent via IGNORE on UNIQUE(conversion_event_id).
 */
export async function insertPendingLedger(input: InsertLedgerInput): Promise<void> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT OR IGNORE INTO commission_ledger
       (id, tenant_id, affiliate_id, conversion_event_id, offer_id,
        gross_cents, commission_pct, commission_cents, withheld_cents,
        status, payable_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?)`,
    )
    .bind(
      input.id, input.tenant_id, input.affiliate_id,
      input.conversion_event_id, input.offer_id,
      toCents(input.gross_amount_usd), input.commission_pct,
      toCents(input.commission_usd), input.withheld_cents ?? 0,
      input.payable_at, now, now,
    )
    .run()
}

/**
 * Flip pending → payable for rows whose payable_at has passed.
 */
export async function flipPendingToPayable(nowTs: number): Promise<number> {
  const db = await getD1Raw()
  const result = await db
    .prepare(
      `UPDATE commission_ledger SET status = 'payable', updated_at = ?
       WHERE status = 'pending' AND payable_at <= ?`,
    )
    .bind(nowTs, nowTs)
    .run()
  return result.meta?.changes ?? 0
}

/**
 * Aggregate net payable cents by affiliate within a tenant.
 * Includes clawback (negative) rows. HAVING >= 1000 cents = $10 minimum.
 */
export async function getPayableAggregates(
  tenantId: string,
): Promise<{ affiliate_id: string; total_cents: number; row_count: number }[]> {
  const db = await getD1Raw()
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

// Re-export mutations for convenience (single import point)
export {
  claimLedgerRows,
  markLedgerPaid,
  rollbackPayingRows,
  sumPaidCommissionsCents,
  getPaidBatchSummary,
} from './commission-ledger-mutations'
