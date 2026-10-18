/**
 * Notification helpers for ClickBank webhook.
 * Layer: app/api/webhooks/clickbank
 * @module app/api/webhooks/clickbank/clickbank-webhook-notify
 */

import { notifyConversionEarned } from '@/land/affiliates/conversion-notifier';
import { reverseOriginalSaleIfNeeded } from './clickbank-webhook-helpers';
import type { D1Database } from '@cloudflare/workers-types';

export async function handlePostInsertNotifications(
  transactionType: string,
  attributed: boolean,
  attribution: { userId: string; campaignId: string } | null,
  commissionUser: number,
  db: D1Database,
  receipt: string
): Promise<void> {
  // If SALE and attributed — fire-and-forget Telegram notify
  if (transactionType === 'SALE' && attributed && attribution) {
    void notifyConversionEarned(attribution.userId, commissionUser, attribution.campaignId);
  }

  // Also update the original SALE payout_status to 'reversed' if this is a reversal.
  if (attributed && attribution && (transactionType === 'REFUND' || transactionType === 'CHARGEBACK')) {
    await reverseOriginalSaleIfNeeded(db, receipt, transactionType);
  }
}