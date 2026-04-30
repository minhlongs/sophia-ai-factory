/**
 * Clawback Handler
 *
 * Marks commission_ledger rows as clawed_back on refund.
 * Only affects pending/payable rows — paid rows are NOT reversed (requires admin override).
 *
 * @module payouts/clawback-handler
 */

import { getD1Raw } from '@/lib/db/client'

export type ClawbackResult =
  | { success: true; previousStatus: string }
  | { success: false; reason: string }

/**
 * Handle refund/clawback for a conversion event.
 * Updates commission_ledger status to clawed_back if not already paid.
 * Idempotent: re-calling on already clawed_back row returns success.
 */
export async function handleClawback(
  conversionEventId: string,
  reason: string,
): Promise<ClawbackResult> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  const row = await db
    .prepare(
      `SELECT id, status FROM commission_ledger
       WHERE conversion_event_id = ?`,
    )
    .bind(conversionEventId)
    .first<{ id: string; status: string }>()

  if (!row) {
    return { success: false, reason: 'Ledger row not found for conversion_event_id' }
  }

  if (row.status === 'clawed_back') {
    return { success: true, previousStatus: 'clawed_back' }
  }

  if (row.status === 'paid') {
    return { success: false, reason: 'Cannot clawback already-paid commission without admin override' }
  }

  await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'clawed_back', clawback_reason = ?, updated_at = ?
       WHERE conversion_event_id = ? AND status IN ('pending','payable')`,
    )
    .bind(reason, now, conversionEventId)
    .run()

  return { success: true, previousStatus: row.status }
}
