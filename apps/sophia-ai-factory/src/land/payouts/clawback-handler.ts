/**
 * Clawback Handler — negative-adjustment ledger row pattern
 *
 * Inserts a NEW row with commission_cents = -original.commission_cents.
 * Never silently drops; always succeeds in writing the negative row.
 * Net payout = SUM(positive rows) + SUM(clawback rows) where clawback has negative cents.
 *
 * @module payouts/clawback-handler
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

export type ClawbackResult =
  | { success: true; previousStatus: string; clawbackRowId: string }
  | { success: false; reason: string }

interface OriginalLedgerRow {
  id: string
  status: string
  tenant_id: string
  affiliate_id: string
  offer_id: string
  commission_cents: number
  withheld_cents: number
}

/**
 * Handle refund/clawback for a conversion event.
 *
 * For already-paid rows: inserts a negative-adjustment 'clawback' status row.
 * For pending/payable rows: inserts a negative row (net zeroes out before payout).
 * Idempotent: re-calling when a clawback row already exists returns success.
 */
export async function handleClawback(
  conversionEventId: string,
  reason: string,
): Promise<ClawbackResult> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  const original = await db
    .prepare(
      `SELECT id, status, tenant_id, affiliate_id, offer_id,
              commission_cents, withheld_cents
       FROM commission_ledger
       WHERE conversion_event_id = ? AND (parent_conversion_id IS NULL OR parent_conversion_id = '')
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .bind(conversionEventId)
    .first<OriginalLedgerRow>()

  if (!original) {
    return { success: false, reason: 'Ledger row not found for conversion_event_id' }
  }

  // Check if clawback row already exists (idempotent).
  const existing = await db
    .prepare(
      `SELECT id FROM commission_ledger
       WHERE parent_conversion_id = ? AND status = 'clawback'`,
    )
    .bind(original.id)
    .first<{ id: string }>()

  if (existing) {
    return { success: true, previousStatus: original.status, clawbackRowId: existing.id }
  }

  // Insert negative-adjustment row regardless of original status.
  const clawbackId = `clbk_${original.id}_${now}`

  await db
    .prepare(
      `INSERT OR IGNORE INTO commission_ledger
       (id, tenant_id, affiliate_id, conversion_event_id, offer_id,
        gross_cents, commission_pct, commission_cents, withheld_cents,
        parent_conversion_id, status, payable_at, clawback_reason,
        created_at, updated_at)
       VALUES (?,?,?,?,?,0,0,?,0,?,'clawback',?,?,?,?)`,
    )
    .bind(
      clawbackId,
      original.tenant_id,
      original.affiliate_id,
      `${conversionEventId}_clawback`,
      original.offer_id,
      -original.commission_cents,  // negative to zero out net
      original.id,                 // parent_conversion_id
      now,                         // immediately payable (or subtracted from next batch)
      reason,
      now,
      now,
    )
    .run()

  // If tenant net goes negative after clawback, warn ops.
  const netRow = await db
    .prepare(
      `SELECT SUM(commission_cents - withheld_cents) AS net_cents
       FROM commission_ledger
       WHERE tenant_id = ? AND affiliate_id = ? AND status IN ('payable','clawback')`,
    )
    .bind(original.tenant_id, original.affiliate_id)
    .first<{ net_cents: number | null }>()

  const netCents = netRow?.net_cents ?? 0
  if (netCents < 0) {
    logger.warn('[Clawback] Affiliate net balance went negative after clawback', {
      affiliateId: original.affiliate_id,
      tenantId: original.tenant_id,
      netCents,
      clawbackId,
    })
  }

  return { success: true, previousStatus: original.status, clawbackRowId: clawbackId }
}
