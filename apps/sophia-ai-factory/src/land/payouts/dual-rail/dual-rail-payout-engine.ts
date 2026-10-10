/**
 * Dual-Rail Affiliate Payout Engine Coordinator
 *
 * Coordinates multi-currency affiliate partner disbursements across:
 * 1. Global / Web3 Rail: TRC-20 USDT mass-payouts
 * 2. Vietnam Domestic Rail: VietQR / NAPAS 247 banking batch CSV exports
 *
 * Layer: land/payouts/dual-rail
 * Allowed imports: @/seed/*, @/land/payouts/*
 */

import { fromCents } from '../commission-cents';
import {
  DEFAULT_MIN_PAYOUT_CENTS,
  type PayoutRail,
  type PayoutBatchItem,
  type DualRailPayoutBatch,
  type DualRailBatchExecutionResult,
} from './types';
import { getExchangeRateVnd, executeFiatRailExport } from './fiat-rail-executor';
import { executeCryptoRailBatch } from './crypto-rail-executor';

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
): Promise<DualRailBatchExecutionResult> {
  const usdtItems = batch.items.filter((i) => i.rail === 'USDT');
  const vietQrItems = batch.items.filter((i) => i.rail === 'VIETQR');

  // 1. Process USDT payouts
  const usdtResult = await executeCryptoRailBatch(d1, usdtItems, batch.batchId);

  // 2. Process VietQR export
  let vietQrCsv: string | undefined;
  if (vietQrItems.length > 0) {
    vietQrCsv = await executeFiatRailExport(d1, vietQrItems, batch.batchId, {
      exchangeRateVnd: options?.exchangeRateVnd,
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
