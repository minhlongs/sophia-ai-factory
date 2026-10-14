/**
 * Fiat / Vietnam Domestic Rail (VietQR / NAPAS 247) batch CSV export & link builder.
 *
 * Layer: land/payouts/dual-rail
 * Allowed imports: @/seed/*, @/land/payouts/*
 */

import { logger } from '@/seed/utils/logger-utility';
import type { PayoutBatchItem } from './types';
import {
  getExchangeRateVnd,
  escapeCsvField,
  buildVietQrPaymentUrl,
  generateVietQrCsv,
} from './fiat-csv-formatter';

export {
  getExchangeRateVnd,
  escapeCsvField,
  buildVietQrPaymentUrl,
  generateVietQrCsv,
};

/**
 * Process VietQR export items in D1: record batch audit and deduct pending partner balances.
 */
export async function executeFiatRailExport(
  d1: D1Database,
  vietQrItems: PayoutBatchItem[],
  batchId: string,
  options?: { exchangeRateVnd?: number },
): Promise<string> {
  const vietQrCsv = generateVietQrCsv(vietQrItems, {
    exchangeRateVnd: options?.exchangeRateVnd,
    batchId: `${batchId}_VIETQR`,
  });

  const nowMs = Date.now();
  const exportId = `export_${batchId}_VIETQR`;
  const exportFilename = `vietqr_payout_${batchId}_${new Date().toISOString().slice(0, 10)}.csv`;

  await d1
    .prepare(
      `INSERT INTO affiliate_payout_exports (
        id,
        batch_id,
        rail,
        total_amount_usd,
        total_amount_vnd,
        item_count,
        export_filename,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      exportId,
      batchId,
      'VIETQR',
      vietQrItems.reduce((acc, i) => acc + i.amountUsd, 0),
      vietQrItems.reduce((acc, i) => acc + (i.bankDetails?.amountVnd || 0), 0),
      vietQrItems.length,
      exportFilename,
      JSON.stringify(vietQrItems),
      nowMs,
    )
    .run();

  for (const item of vietQrItems) {
    await d1
      .prepare(
        `UPDATE affiliate_partners
         SET pending_payout_cents = MAX(0, pending_payout_cents - ?),
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(item.amountCents, nowMs, item.affiliateId)
      .run();
  }

  logger.info('[dual-rail-payout-engine] VietQR export generated', {
    batchId,
    itemCount: vietQrItems.length,
    exportFilename,
  });

  return vietQrCsv;
}
