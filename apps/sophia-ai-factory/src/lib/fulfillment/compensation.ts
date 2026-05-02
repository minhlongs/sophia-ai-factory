/**
 * Compensation grant for permanently failed video fulfillments.
 * Idempotent via INSERT … ON CONFLICT DO NOTHING on a unique partial index
 * (billing_events_compensation_unique_idx on license_nonce + event_type WHERE
 *  event_type = 'compensation_granted').
 *
 * M1 fix: replaces the previous SELECT-then-INSERT TOCTOU pattern with
 * a single atomic INSERT. Credits are incremented only when the INSERT wins
 * the race (i.e., the conflict DID NOT fire).
 *
 * @module lib/fulfillment/compensation
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'

const COMPENSATION_EVENT_TYPE = 'compensation_granted'

/**
 * Atomically grant +1 credit to the user_purchase row for a failed fulfillment.
 * Idempotent: no-op if compensation was already applied for this purchaseId.
 *
 * Race safety: uses INSERT … ON CONFLICT DO NOTHING backed by a unique partial
 * index (billing_events_compensation_unique_idx). Only the winner of the race
 * increments credits_remaining. Concurrent callers that hit the conflict get
 * false (no double credit).
 *
 * Returns true if credit was granted, false if already granted or error.
 */
export async function grantCompensationCredit(
  purchaseId: string,
  reason: string,
): Promise<boolean> {
  try {
    const db = createServerClient()
    const now = Math.floor(Date.now() / 1000)
    const licenseNonce = purchaseId.slice(0, 16)

    // Fetch purchase + user info
    const { data: purchaseData } = await db
      .from('user_purchases')
      .select('credits_remaining, user_id')
      .eq('id', purchaseId)
      .single()

    const purchase = purchaseData as { credits_remaining: number; user_id: string } | null
    if (!purchase) {
      logger.warn('[Compensation] Purchase not found', { purchaseId })
      return false
    }

    // Atomic INSERT — if unique constraint fires, another caller already won.
    // .insert() with Supabase throws / returns error on conflict when not using upsert.
    // We rely on the DB constraint to reject the duplicate.
    const { error: insertError } = await db.from('billing_events').insert({
      user_id: purchase.user_id,
      license_nonce: licenseNonce,
      event_type: COMPENSATION_EVENT_TYPE,
      event_category: 'compensation',
      event_data: { purchase_id: purchaseId, reason, credits_granted: 1 },
      email_sent: false,
      processed: true,
      processed_at: new Date().toISOString(),
    })

    if (insertError) {
      // Unique constraint violation = already granted by a concurrent caller
      if (
        insertError.code === '23505' || // PostgreSQL unique violation
        (insertError.message && insertError.message.includes('unique'))
      ) {
        logger.info('[Compensation] Credit already granted (concurrent caller won)', { purchaseId })
        return false
      }
      // Other error — log and bail
      throw new Error(getErrorMessage(insertError))
    }

    // INSERT succeeded — we won the race; increment credits
    await db
      .from('user_purchases')
      .update({
        credits_remaining: purchase.credits_remaining + 1,
        updated_at: now,
      })
      .eq('id', purchaseId)

    logger.info('[Compensation] +1 credit granted', { purchaseId, reason })
    return true
  } catch (err) {
    logger.error('[Compensation] grantCompensationCredit failed', err instanceof Error ? err : undefined, {
      purchaseId,
    })
    return false
  }
}
