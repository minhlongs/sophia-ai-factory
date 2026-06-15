/**
 * Reconciliation query functions for fulfillment drift detection.
 * Pure query functions — no side effects — for easy unit testing.
 *
 * Logic: paid one-time purchases in last 24h (with 2h lag buffer for in-flight)
 * that have no associated completed videos are "orphans" — revenue leakage.
 *
 * @module lib/monitoring/reconcile-query
 */

/** A paid purchase that has no completed video = revenue leaked. */
export interface OrphanPurchase {
  id: string
  sku: string
  paidAt: number | null
}

export interface ReconcileResult {
  /** Paid purchases in the 24h window (excluding SYNTHETIC_*) */
  paidCount: number
  /** Of those paid, how many have a completed video */
  deliveredCount: number
  /** Of those paid, how many have no completed video */
  orphanCount: number
  /** IDs + SKUs of orphan purchases (for structured logging) */
  orphans: OrphanPurchase[]
  /** Videos in permanent failure state (count) */
  permanentFailCount: number
}

interface PurchaseRow {
  id: string
  sku: string
  paid_at: number | null
}

interface DeliveredRow {
  purchase_id: string
}

/**
 * Run reconciliation queries against D1.
 *
 * @param db        - D1Database binding
 * @param since     - Unix timestamp: start of 24h window
 * @param before    - Unix timestamp: end of window (now - 2h lag buffer for in-flight)
 */
export async function runReconcileQueries(
  db: D1Database,
  since: number,
  before: number,
): Promise<ReconcileResult> {
  // Q1: paid purchases in window, excluding synthetic
  const paidResult = await db
    .prepare(
      `SELECT id, sku, paid_at
       FROM user_purchases
       WHERE kind = 'one_time'
         AND status = 'paid'
         AND paid_at BETWEEN ?1 AND ?2
         AND payment_id NOT LIKE 'SYNTHETIC_%'`,
    )
    .bind(since, before)
    .all<PurchaseRow>()

  const paidRows = paidResult.results ?? []
  if (paidRows.length === 0) {
    return { paidCount: 0, deliveredCount: 0, orphanCount: 0, orphans: [], permanentFailCount: 0 }
  }

  const paidIds = paidRows.map((r) => r.id)

  // Q2: videos with status=completed for those purchase ids
  const placeholders = paidIds.map((_, i) => `?${i + 1}`).join(', ')
  const deliveredResult = await db
    .prepare(
      `SELECT purchase_id
       FROM videos
       WHERE status = 'completed'
         AND purchase_id IN (${placeholders})`,
    )
    .bind(...paidIds)
    .all<DeliveredRow>()

  const deliveredSet = new Set((deliveredResult.results ?? []).map((r) => r.purchase_id))

  const orphans: OrphanPurchase[] = paidRows
    .filter((r) => !deliveredSet.has(r.id))
    .map((r) => ({ id: r.id, sku: r.sku, paidAt: r.paid_at }))

  // Q3: permanent failures in the same window (revenue lost)
  const failResult = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM videos
       WHERE status = 'failed_permanent'
         AND purchase_id IN (${placeholders})`,
    )
    .bind(...paidIds)
    .first<{ cnt: number }>()

  const permanentFailCount = failResult?.cnt ?? 0

  return {
    paidCount: paidRows.length,
    deliveredCount: deliveredSet.size,
    orphanCount: orphans.length,
    orphans,
    permanentFailCount,
  }
}
