/**
 * Net currency exposure calculator and hedge ratio rebalancing.
 *
 * Layer: tree/fx/hedging
 * Allowed imports: @/seed/*, @/tree/*
 */

import {
  type SupportedCurrency,
  isSupportedCurrency,
  ALL_SUPPORTED_CURRENCIES,
} from '@/seed/types/enterprise-billing';
import type {
  HedgedQuoteInput,
  HedgedQuoteResult,
  FxSourceProvider,
} from '@/seed/types/fx-hedging';
import { BEDROCK_RATES_TABLE } from '@/tree/billing/fx-converter';
import {
  DEFAULT_HEDGING_BUFFER_PERCENT,
  FX_RATE_QUOTE_TTL_MS,
} from './types';
import { reconcileSettlementSlippage } from './settlement-reconciler';

/**
 * Normalizes amount into currency-specific integer / decimal units.
 * Zero-decimal rules:
 * - JPY: Exact integer round
 * - VND: Rounded to nearest 1,000 VND bank note denomination
 * - IDR: Rounded to nearest 100 IDR unit
 * Two-decimal currencies: Rounded to 2 decimal places
 */
export function normalizeCurrencyAmount(
  rawMajorAmount: number,
  currency: SupportedCurrency,
): { major: number; subunits: number } {
  if (currency === 'JPY') {
    const major = Math.max(0, Math.round(rawMajorAmount));
    return { major, subunits: major };
  }

  if (currency === 'VND') {
    // Round to nearest 1,000 VND bank note unit
    const roundedTo1000 = Math.max(0, Math.round(rawMajorAmount / 1000) * 1000);
    return { major: roundedTo1000, subunits: roundedTo1000 };
  }

  if (currency === 'IDR') {
    // Round to nearest 100 IDR denomination
    const roundedTo100 = Math.max(0, Math.round(rawMajorAmount / 100) * 100);
    return { major: roundedTo100, subunits: roundedTo100 };
  }

  // 2-decimal standard (USD, EUR, GBP, SGD, AUD, CAD, THB)
  const subunits = Math.max(0, Math.round(rawMajorAmount * 100));
  const major = subunits / 100;
  return { major, subunits };
}

/**
 * Calculates a dynamic hedged quote with the +1.5% buffer reserve escrow.
 *
 * Mathematical model:
 * R_hedged = R_market * (1 + bufferPercent)
 * targetAmount = normalize(baseAmountUSD * R_hedged)
 * bufferReserveCents = round(baseAmountCents * bufferPercent)
 */
export function calculateHedgedQuote(
  input: HedgedQuoteInput,
  marketRates: Record<SupportedCurrency, number> = BEDROCK_RATES_TABLE,
  sourceProvider: FxSourceProvider = 'BEDROCK_FALLBACK',
): HedgedQuoteResult {
  const { baseAmountCents, targetCurrency } = input;

  if (!isSupportedCurrency(targetCurrency)) {
    throw new Error(`Unsupported currency: "${String(targetCurrency)}". Valid: ${ALL_SUPPORTED_CURRENCIES.join(', ')}`);
  }

  if (baseAmountCents < 0) {
    throw new Error(`Base amount cannot be negative: ${baseAmountCents}`);
  }

  const bufferPercent = input.customBufferPercent !== undefined
    ? input.customBufferPercent
    : DEFAULT_HEDGING_BUFFER_PERCENT;

  const marketRate = marketRates[targetCurrency];
  if (typeof marketRate !== 'number' || !Number.isFinite(marketRate) || marketRate <= 0) {
    throw new Error(`Invalid market exchange rate for ${targetCurrency}: ${marketRate}`);
  }

  // Same currency (USD -> USD) has no buffer or FX exposure
  if (targetCurrency === 'USD') {
    const subunits = Math.round(baseAmountCents);
    return {
      baseCurrency: 'USD',
      targetCurrency: 'USD',
      baseAmountCents,
      marketRate: 1.0,
      hedgedRate: 1.0,
      bufferPercent: 0,
      targetAmount: subunits / 100,
      targetAmountSubunits: subunits,
      bufferReserveCents: 0,
      bufferReserveTarget: 0,
      rateValidUntil: Date.now() + FX_RATE_QUOTE_TTL_MS,
      fxRateId: `fx_usd_${Date.now()}`,
      sourceProvider,
    };
  }

  // Quoted Hedging Exchange Rate: R_hedged = R_market * (1 + buffer)
  const hedgedRate = marketRate * (1 + bufferPercent);
  const baseUsd = baseAmountCents / 100;

  // Raw amounts
  const rawHedgedAmount = baseUsd * hedgedRate;
  const rawBaseTargetAmount = baseUsd * marketRate;

  // Normalized target amounts per currency standard
  const { major: targetAmount, subunits: targetAmountSubunits } = normalizeCurrencyAmount(
    rawHedgedAmount,
    targetCurrency,
  );

  const { major: baseTargetAmount } = normalizeCurrencyAmount(
    rawBaseTargetAmount,
    targetCurrency,
  );

  // Buffer reserve escrow in target currency and in USD cents
  const bufferReserveTarget = Math.max(0, targetAmount - baseTargetAmount);
  const bufferReserveCents = Math.round(baseAmountCents * bufferPercent);

  return {
    baseCurrency: 'USD',
    targetCurrency,
    baseAmountCents,
    marketRate,
    hedgedRate,
    bufferPercent,
    targetAmount,
    targetAmountSubunits,
    bufferReserveCents,
    bufferReserveTarget,
    rateValidUntil: Date.now() + FX_RATE_QUOTE_TTL_MS,
    fxRateId: `fx_${targetCurrency.toLowerCase()}_${Date.now()}`,
    sourceProvider,
  };
}

export { reconcileSettlementSlippage };
