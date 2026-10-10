/**
 * Settlement slippage reconciliation.
 *
 * Layer: tree/fx/hedging
 * Allowed imports: @/seed/*, @/tree/*
 */

import type { SupportedCurrency } from '@/seed/types/enterprise-billing';
import type { HedgingReconciliationResult } from '@/seed/types/fx-hedging';
import { DEFAULT_HEDGING_BUFFER_PERCENT } from './types';

/**
 * Reconciles market slippage at settlement timestamp.
 * Determines whether buffer generated surplus (realized_gain), absorbed currency
 * depreciation (absorbed_loss), or dropped beyond buffer capacity (rebalanced).
 */
export function reconcileSettlementSlippage(params: {
  transactionId: string;
  reserveId: string;
  baseAmountCents: number;
  quotedMarketRate: number;
  quotedHedgedRate: number;
  settlementMarketRate: number;
  targetAmount: number;
  targetCurrency: SupportedCurrency;
}): HedgingReconciliationResult {
  const {
    transactionId,
    reserveId,
    baseAmountCents,
    quotedMarketRate,
    settlementMarketRate,
    targetAmount,
  } = params;

  if (settlementMarketRate <= 0) {
    throw new Error(`Invalid settlement rate: ${settlementMarketRate}`);
  }

  // Realized USD value from target currency at settlement rate
  const realizedUsd = targetAmount / settlementMarketRate;
  const expectedUsd = baseAmountCents / 100;

  // Realized PnL in USD cents: (realized - expected) * 100
  const realizedPnlCents = Math.round((realizedUsd - expectedUsd) * 100);

  // Slippage percentage of target currency vs quoted market rate
  const slippagePercent = (settlementMarketRate - quotedMarketRate) / quotedMarketRate;

  let finalStatus: 'realized_gain' | 'absorbed_loss' | 'rebalanced';
  let bufferAbsorbed: boolean;

  if (realizedPnlCents >= 0) {
    finalStatus = 'realized_gain';
    bufferAbsorbed = true;
  } else if (realizedPnlCents >= -Math.round(baseAmountCents * DEFAULT_HEDGING_BUFFER_PERCENT)) {
    // Within buffer absorption capacity (1.5%)
    finalStatus = 'absorbed_loss';
    bufferAbsorbed = true;
  } else {
    // Market moved beyond the 1.5% buffer reserve
    finalStatus = 'rebalanced';
    bufferAbsorbed = false;
  }

  return {
    transactionId,
    reserveId,
    originalQuoteRate: quotedMarketRate,
    settlementRate: settlementMarketRate,
    slippagePercent,
    bufferAbsorbed,
    realizedPnlCents,
    finalStatus,
  };
}
