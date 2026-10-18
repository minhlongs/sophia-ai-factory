/**
 * Database operations for ClickBank webhook.
 * Layer: app/api/webhooks/clickbank
 * @module app/api/webhooks/clickbank/clickbank-webhook-db
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export async function checkDuplicateConversion(
  db: D1Database,
  receipt: string,
  transactionType: string
): Promise<boolean> {
  const existing = await db
    .prepare('SELECT 1 FROM affiliate_conversions WHERE receipt = ? AND event_type = ? LIMIT 1')
    .bind(receipt, transactionType)
    .first<{ 1: number }>();
  return !!existing;
}

export async function insertConversionRecord(
  db: D1Database,
  params: {
    id: string;
    receipt: string;
    clickId: string | null;
    campaignId: string | null;
    userId: string | null;
    offerId: string | null;
    transactionType: string;
    grossAmount: number;
    currency: string;
    commissionUser: number;
    commissionSophia: number;
    payoutStatus: string;
    availableAt: number | null;
    rawBody: string;
  }
): Promise<{ success: boolean; isRace?: boolean }> {
  try {
    await db
      .prepare(
        `INSERT INTO affiliate_conversions
           (id, receipt, click_id, campaign_id, user_id, offer_id, network,
            event_type, gross_amount, currency, commission_user, commission_sophia,
            payout_status, available_at, raw_payload)
         VALUES (?,?,?,?,?,?,'clickbank',?,?,?,?,?,?,?,?)`
      )
      .bind(
        params.id,
        params.receipt,
        params.clickId,
        params.campaignId,
        params.userId,
        params.offerId,
        params.transactionType,
        params.grossAmount,
        params.currency,
        params.commissionUser,
        params.commissionSophia,
        params.payoutStatus,
        params.availableAt,
        params.rawBody,
      )
      .run();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      logger.info('[clickbank-webhook] race-detected duplicate (UNIQUE conflict)', {
        receipt: params.receipt,
        event_type: params.transactionType,
      });
      return { success: true, isRace: true };
    }
    logger.error('[clickbank-webhook] insert failed (non-constraint)', toError(err), {
      receipt: params.receipt,
      event_type: params.transactionType,
    });
    return { success: false };
  }
}