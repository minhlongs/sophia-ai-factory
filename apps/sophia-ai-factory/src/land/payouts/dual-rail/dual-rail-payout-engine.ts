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

import {
  DEFAULT_MIN_PAYOUT_CENTS,
  type PayoutRail,
  type DualRailPayoutBatch,
  type DualRailBatchExecutionResult,
} from './types';
import { getExchangeRateVnd, executeFiatRailExport } from './fiat-rail-executor';
import { executeCryptoRailBatch } from './crypto-rail-executor';
import {
  buildEligibleAffiliatePartnersQuery,
  mapAffiliateRowsToBatchItems,
  type AffiliatePartnerPayoutRow,
} from './dual-rail-batch-builder';

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

  const { query, binds } = buildEligibleAffiliatePartnersQuery(
    minCents,
    targetRail,
    options?.partnerIds
  );

  const { results } = await d1
    .prepare(query)
    .bind(...binds)
    .all<AffiliatePartnerPayoutRow>();

  const { items, totalUsdtAmount, totalVndAmount } = mapAffiliateRowsToBatchItems(
    results ?? [],
    exchangeRate
  );

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

  const usdtResult = await executeCryptoRailBatch(d1, usdtItems, batch.batchId);

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
