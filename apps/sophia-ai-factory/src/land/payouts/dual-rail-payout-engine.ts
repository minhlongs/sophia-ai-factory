/**
 * Dual-Rail Affiliate Payout Engine
 *
 * Coordinates multi-currency affiliate partner disbursements across two rails:
 * 1. Global / Web3 Rail: Automated TRC-20 USDT mass-payouts via NOWPayments API
 * 2. Vietnam Domestic Rail: VietQR / NAPAS 247 banking batch CSV exports with dynamic USD-to-VND exchange
 *
 * @module land/payouts/dual-rail-payout-engine
 */

import { logger } from '@/seed/utils/logger-utility';
import { fromCents, sanitizeErrorText } from './commission-cents';
import {
  executeMultiPayoutBatch,
  MultiPayoutBatchResult,
} from './nowpayments-mass-payout';
import {
  PayoutRail,
  PayoutBatchItem,
  DualRailPayoutBatch,
} from '@/seed/types/affiliate-expansion-types';

/** Standard default conversion rate: 1 USD = 25,450 VND */
export const DEFAULT_USD_TO_VND_RATE = 25450;

/** Minimum payout threshold in cents ($50.00 USD = 5,000 cents) */
export const DEFAULT_MIN_PAYOUT_CENTS = 5000;

/**
 * Retrieve current USD to VND exchange rate.
 * Checks environment variable or uses standard fallback.
 */
export function getExchangeRateVnd(): number {
  const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
  const envRate = envDouble?.USD_TO_VND || process.env.USD_TO_VND;
  const parsed = Number(envRate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_VND_RATE;
}

/**
 * Generate RFC 4180 escaped CSV field.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Construct an instant VietQR payment link for quick-scan mobile banking (VietQR / NAPAS 247).
 * Standard format: https://img.vietqr.io/image/<BIN>-<ACCOUNT_NUMBER>-compact2.png?amount=<VND>&addInfo=<MEMO>&accountName=<NAME>
 */
export function buildVietQrPaymentUrl(
  bin: string,
  accountNumber: string,
  amountVnd: number,
  memo: string,
  accountName: string
): string {
  const cleanBin = bin.trim().replace(/\D/g, '');
  const cleanAcc = accountNumber.trim().replace(/\s+/g, '');
  const encodedMemo = encodeURIComponent(memo.trim());
  const encodedName = encodeURIComponent(accountName.trim());
  const safeAmount = Math.max(0, Math.round(amountVnd));

  return `https://img.vietqr.io/image/${cleanBin}-${cleanAcc}-compact2.png?amount=${safeAmount}&addInfo=${encodedMemo}&accountName=${encodedName}`;
}

/**
 * Generate standard RFC 4180 CSV export for Vietnamese domestic banking batches (NAPAS 247).
 * Compatible with ACB, Vietcombank, Techcombank, MBBank, and VPBank bulk transfer uploaders.
 */
export function generateVietQrCsv(
  items: PayoutBatchItem[],
  options?: { exchangeRateVnd?: number; batchId?: string }
): string {
  const rate = options?.exchangeRateVnd && options.exchangeRateVnd > 0
    ? options.exchangeRateVnd
    : getExchangeRateVnd();
  const batchId = options?.batchId || `BATCH_${Date.now()}`;

  const headers = [
    'STT',
    'Ma_Lo',
    'Ma_Doi_Tac',
    'Ma_Ngan_Hang_BIN',
    'So_Tai_Khoan',
    'Ten_Chu_Tai_Khoan',
    'So_Tien_VND',
    'So_Tien_USD',
    'Noi_Dung_Chuyen_Khoan',
    'Trang_Thai',
  ];

  const rows: string[] = [];

  let idx = 1;
  for (const item of items) {
    if (item.rail !== 'VIETQR' || !item.bankDetails) {
      continue;
    }

    const { bin, accountNumber, accountName } = item.bankDetails;
    const amountUsd = fromCents(item.amountCents);
    const amountVnd = item.bankDetails.amountVnd > 0
      ? item.bankDetails.amountVnd
      : Math.round(amountUsd * rate);
    const memo = item.memo || `SOPHIA AFF ${item.partnerCode}`;

    const csvRow = [
      escapeCsvField(idx++),
      escapeCsvField(batchId),
      escapeCsvField(item.partnerCode),
      escapeCsvField(bin),
      escapeCsvField(accountNumber),
      escapeCsvField(accountName),
      escapeCsvField(amountVnd),
      escapeCsvField(amountUsd.toFixed(2)),
      escapeCsvField(memo),
      escapeCsvField('PENDING_TRANSFER'),
    ].join(',');

    rows.push(csvRow);
  }

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Create a Dual-Rail Payout Batch by inspecting eligible affiliate partners in D1.
 * Filters by pending payout balances exceeding the minimum threshold.
 */
export async function createDualRailPayoutBatch(
  d1: D1Database,
  options?: {
    partnerIds?: string[];
    minPayoutCents?: number;
    rail?: PayoutRail | 'COMBINED';
  }
): Promise<DualRailPayoutBatch> {
  const minCents = options?.minPayoutCents ?? DEFAULT_MIN_PAYOUT_CENTS;
  const targetRail = options?.rail ?? 'COMBINED';
  const exchangeRate = getExchangeRateVnd();

  let query = `
    SELECT 
      id,
      partner_code,
      payout_rail,
      pending_payout_cents,
      usdt_trc20_address_encrypted,
      bank_bin,
      bank_account_number,
      bank_account_name
    FROM affiliate_partners
    WHERE status = 'active'
      AND pending_payout_cents >= ?
  `;
  const binds: (string | number)[] = [minCents];

  if (options?.partnerIds && options.partnerIds.length > 0) {
    const placeholders = options.partnerIds.map(() => '?').join(',');
    query += ` AND id IN (${placeholders})`;
    binds.push(...options.partnerIds);
  }

  if (targetRail !== 'COMBINED') {
    query += ` AND payout_rail = ?`;
    binds.push(targetRail);
  }

  query += ` ORDER BY pending_payout_cents DESC`;

  const { results } = await d1.prepare(query).bind(...binds).all<{
    id: string;
    partner_code: string;
    payout_rail: string;
    pending_payout_cents: number;
    usdt_trc20_address_encrypted: string | null;
    bank_bin: string | null;
    bank_account_number: string | null;
    bank_account_name: string | null;
  }>();

  const rows = results ?? [];
  const items: PayoutBatchItem[] = [];
  let totalUsdtAmount = 0;
  let totalVndAmount = 0;

  for (const row of rows) {
    const amountCents = row.pending_payout_cents;
    const amountUsd = fromCents(amountCents);
    const rail: PayoutRail = row.payout_rail === 'VIETQR' ? 'VIETQR' : 'USDT';

    if (rail === 'VIETQR') {
      const amountVnd = Math.round(amountUsd * exchangeRate);
      totalVndAmount += amountVnd;

      items.push({
        affiliateId: row.id,
        partnerCode: row.partner_code,
        amountUsd,
        amountCents,
        rail: 'VIETQR',
        bankDetails: {
          bin: row.bank_bin || '970422', // Default MBBank if unspecified
          accountNumber: row.bank_account_number || '',
          accountName: row.bank_account_name || row.partner_code,
          amountVnd,
        },
        memo: `SOPHIA AFF ${row.partner_code}`,
      });
    } else {
      totalUsdtAmount += amountUsd;
      items.push({
        affiliateId: row.id,
        partnerCode: row.partner_code,
        amountUsd,
        amountCents,
        rail: 'USDT',
        usdtAddress: row.usdt_trc20_address_encrypted || undefined,
        memo: `SOPHIA USDT ${row.partner_code}`,
      });
    }
  }

  const batchId = `BATCH_DUAL_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    batchId,
    createdAt: new Date().toISOString(),
    rail: targetRail,
    totalUsdtAmount: Math.round(totalUsdtAmount * 100) / 100,
    totalVndAmount,
    itemCount: items.length,
    status: 'QUEUED',
    items,
  };
}

/**
 * Execute or finalize a Dual-Rail Payout Batch:
 * - Dispatches USDT items via NOWPayments multi-payout engine
 * - Generates and persists VietQR CSV batch export for accounting execution
 * - Records audit trail in affiliate_payout_exports
 */
export async function executeDualRailBatch(
  d1: D1Database,
  batch: DualRailPayoutBatch,
  options?: {
    nowpaymentsApiKey?: string;
    exchangeRateVnd?: number;
  }
): Promise<{
  batchId: string;
  usdtResult?: MultiPayoutBatchResult;
  vietQrCsv?: string;
  vietQrItemCount: number;
  usdtItemCount: number;
  exportedCount: number;
}> {
  const usdtItems = batch.items.filter((i) => i.rail === 'USDT');
  const vietQrItems = batch.items.filter((i) => i.rail === 'VIETQR');
  const nowMs = Date.now();

  let usdtResult: MultiPayoutBatchResult | undefined;
  let vietQrCsv: string | undefined;

  // 1. Process USDT payouts
  if (usdtItems.length > 0) {
    try {
      usdtResult = await executeMultiPayoutBatch({
        batchId: `${batch.batchId}_USDT`,
        items: usdtItems.map((item) => ({
          partnerId: item.affiliateId,
          totalCents: item.amountCents,
          recipientAddrEncrypted: item.usdtAddress || '',
          network: 'TRC20',
        })),
      });

      // Update pending balances for succeeded partners in D1
      if (usdtResult.successCount > 0) {
        for (const [partnerId] of Object.entries(usdtResult.externalPaymentIds)) {
          const item = usdtItems.find((i) => i.affiliateId === partnerId);
          if (item) {
            await d1
              .prepare(
                `UPDATE affiliate_partners
                 SET pending_payout_cents = MAX(0, pending_payout_cents - ?),
                     updated_at = ?
                 WHERE id = ?`
              )
              .bind(item.amountCents, nowMs, partnerId)
              .run();
          }
        }
      }
    } catch (err) {
      logger.error('[dual-rail-payout-engine] USDT batch execution failed', {
        batchId: batch.batchId,
        error: sanitizeErrorText(String(err)),
      });
    }
  }

  // 2. Process VietQR export
  if (vietQrItems.length > 0) {
    vietQrCsv = generateVietQrCsv(vietQrItems, {
      exchangeRateVnd: options?.exchangeRateVnd,
      batchId: `${batch.batchId}_VIETQR`,
    });

    const exportId = `export_${batch.batchId}_VIETQR`;
    const exportFilename = `vietqr_payout_${batch.batchId}_${new Date().toISOString().slice(0, 10)}.csv`;

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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        exportId,
        batch.batchId,
        'VIETQR',
        vietQrItems.reduce((acc, i) => acc + i.amountUsd, 0),
        vietQrItems.reduce((acc, i) => acc + (i.bankDetails?.amountVnd || 0), 0),
        vietQrItems.length,
        exportFilename,
        JSON.stringify(vietQrItems),
        nowMs
      )
      .run();

    // Deduct pending balance upon generating verified export batch
    for (const item of vietQrItems) {
      await d1
        .prepare(
          `UPDATE affiliate_partners
           SET pending_payout_cents = MAX(0, pending_payout_cents - ?),
               updated_at = ?
           WHERE id = ?`
        )
        .bind(item.amountCents, nowMs, item.affiliateId)
        .run();
    }

    logger.info('[dual-rail-payout-engine] VietQR export generated', {
      batchId: batch.batchId,
      itemCount: vietQrItems.length,
      exportFilename,
    });
  }

  return {
    batchId: batch.batchId,
    usdtResult,
    vietQrCsv,
    vietQrItemCount: vietQrItems.length,
    usdtItemCount: usdtItems.length,
    exportedCount: batch.items.length,
  };
}
