/**
 * Post-grant overage settlement helpers for Overage Top-Up IPN processing
 * @module land/billing/topup/overage-post-grant
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { markEventsAsBillable } from '@/seed/db/overage-billing-ops';
import { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops';
import { TOPUP_PRICE_PER_MCU } from './types';
import { getUnbilledOverageEventIds } from './topup-calculator';
import type { NowPaymentsIpnPayload } from '../ipn-handlers/types';

export async function finalizeOverageEventsAndCache(userId: string): Promise<void> {
  try {
    const overageEventIds = await getUnbilledOverageEventIds(userId);
    if (overageEventIds.length > 0) {
      await markEventsAsBillable(overageEventIds, TOPUP_PRICE_PER_MCU);
      logger.info('[OverageTopup] Overage events marked as billable', {
        userId,
        count: overageEventIds.length,
      });
    }
  } catch (err) {
    logger.warn('[OverageTopup] Failed to mark events billable (non-fatal)', toError(err));
  }

  try {
    await invalidateQuotaCache(userId, userId);
  } catch {
    // Non-fatal — cache refreshed on next check
  }
}

/** Apply a top-up refund with the event finalization in one D1 transaction. */
export async function refundTopupCredits(
  userId: string,
  mcuAmount: number,
  eventId: string,
  pendingTopupId?: string,
  creditsWereGranted = false,
  terminalIpn?: NowPaymentsIpnPayload,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const statements = [];
  if (creditsWereGranted) {
    statements.push(
      db.prepare(
        `UPDATE user_credits
         SET credits_remaining = MAX(0, COALESCE(credits_remaining, 0) - ?2)
         WHERE user_id = ?1`,
      ).bind(userId, mcuAmount),
    );
  }
  if (pendingTopupId) {
    statements.push(
      db.prepare("UPDATE pending_topups SET status = 'refunded' WHERE id = ?1 AND status IN ('pending', 'completed')")
        .bind(pendingTopupId),
    );
  }
  statements.push(db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId));
  if (terminalIpn) {
    statements.push(
      db.prepare(
        `UPDATE payment_events
         SET event_type = ?1, payload = ?2, processed = 1
         WHERE event_id = ?3 AND processed = 0`,
      ).bind(
        `nowpayments.terminal.${terminalIpn.payment_status}`,
        JSON.stringify(terminalIpn),
        `nowpayments_terminal_${terminalIpn.payment_id}`,
      ),
    );
  }
  const results = await db.batch(statements);
  if (terminalIpn && results.at(-1)?.meta?.changes !== 1) {
    throw new Error(`Failed to finalize NOWPayments terminal lock for ${terminalIpn.payment_id}`);
  }
}