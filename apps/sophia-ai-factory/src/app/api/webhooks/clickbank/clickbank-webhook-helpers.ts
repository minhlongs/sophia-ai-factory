/**
 * Payout resolution, D1 binding, and reversal update helpers for ClickBank INS Webhook.
 * @module app/api/webhooks/clickbank/clickbank-webhook-helpers
 */

import { logger } from '@/seed/utils/logger-utility';

/** Map canonical event type to payout status */
export function resolvePayout(
  eventType: string,
  attributed: boolean,
): { payout_status: string; available_at: number | null } {
  if (!attributed) {
    return { payout_status: 'unattributed', available_at: null };
  }
  if (eventType === 'TEST') {
    return { payout_status: 'pending_clearance', available_at: null };
  }
  if (eventType === 'SALE') {
    const available_at = Math.floor(Date.now() / 1000) + 60 * 86400; // +60 days
    return { payout_status: 'pending_clearance', available_at };
  }
  return { payout_status: 'reversed', available_at: null };
}

/** Get raw D1Database binding */
export function getD1Binding(): D1Database | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  return globalDb ?? null;
}

export async function reverseOriginalSaleIfNeeded(
  db: D1Database,
  receipt: string,
  transactionType: string,
): Promise<void> {
  try {
    const result = await db
      .prepare(
        `UPDATE affiliate_conversions
           SET payout_status = 'reversed'
         WHERE receipt = ?
           AND event_type = 'SALE'
           AND payout_status IN ('pending_clearance','available')`,
      )
      .bind(receipt)
      .run();

    const changes = (result.meta as { changes?: number } | undefined)?.changes ?? 0;
    if (changes === 0) {
      logger.warn('[clickbank-webhook] reversal had no matching SALE', {
        receipt,
        event_type: transactionType,
      });
    }
  } catch (err) {
    logger.warn('[clickbank-webhook] reversal update failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
