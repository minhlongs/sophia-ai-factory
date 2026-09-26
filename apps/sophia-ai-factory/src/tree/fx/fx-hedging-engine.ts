/**
 * Dynamic Multi-Currency Foreign Exchange (FX) Hedging & Buffer Reserve Engine
 *
 * Implements real-time FX rate fetching across 10 currencies with multi-tier resilience:
 * 1. European Central Bank (ECB) / Live Provider API
 * 2. Open Exchange Rates API
 * 3. Cloudflare KV Cache
 * 4. Immutable Bedrock Fallback
 *
 * Provides:
 * - Dynamic +1.5% volatility buffer reserve escrow calculation
 * - Zero-decimal integer normalization (JPY, VND, IDR)
 * - Two-decimal currency subunit handling (USD, EUR, GBP, SGD, AUD, CAD, THB)
 * - Settlement slippage reconciliation (realized_gain vs absorbed_loss vs rebalanced)
 *
 * Layer: tree/fx (Pure domain service — imports only from seed and sibling tree modules)
 *
 * @module tree/fx/fx-hedging-engine
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  type SupportedCurrency,
  isSupportedCurrency,
  isZeroDecimalCurrency,
  ALL_SUPPORTED_CURRENCIES,
} from '@/seed/types/enterprise-billing';
import {
  type HedgedQuoteInput,
  type HedgedQuoteResult,
  type HedgingReconciliationResult,
  type FxRateRecord,
  type HedgingReserveRecord,
  type FxSourceProvider,
} from '@/seed/types/fx-hedging';
import { BEDROCK_RATES_TABLE, BEDROCK_FX_RATES } from '@/tree/billing/fx-converter';

export const DEFAULT_HEDGING_BUFFER_PERCENT = 0.015; // +1.5% default buffer
export const HIGH_VOLATILITY_BUFFER_PERCENT = 0.025; // +2.5% widened buffer on high volatility
export const FX_RATE_QUOTE_TTL_MS = 15 * 60 * 1000; // 15-minute quote validity window
const KV_FX_CACHE_KEY = 'fx_rates:usd:v2';
const LIVE_TIMEOUT_MS = 2000;

export interface MinimalKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface MinimalD1 {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
    };
  };
}

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
 * Resolves Cloudflare KV instance from environment or global scope.
 */
function resolveKv(env?: Record<string, unknown>): MinimalKV | null {
  if (env && typeof env === 'object') {
    if (env.KV_KV && typeof (env.KV_KV as MinimalKV).get === 'function') {
      return env.KV_KV as MinimalKV;
    }
    if (env.EXPERIMENT_KV && typeof (env.EXPERIMENT_KV as MinimalKV).get === 'function') {
      return env.EXPERIMENT_KV as MinimalKV;
    }
  }

  const globalScope = globalThis as Record<string, unknown>;
  if (globalScope.KV_KV && typeof (globalScope.KV_KV as MinimalKV).get === 'function') {
    return globalScope.KV_KV as MinimalKV;
  }
  if (globalScope.EXPERIMENT_KV && typeof (globalScope.EXPERIMENT_KV as MinimalKV).get === 'function') {
    return globalScope.EXPERIMENT_KV as MinimalKV;
  }

  return null;
}

/**
 * Fetches market rates across all 10 currencies with multi-tier fallback:
 * Tier 1: Live Edge / ECB API
 * Tier 2: Open Exchange Rates
 * Tier 3: KV Cache
 * Tier 4: Bedrock Fallback
 */
export async function fetchMultiTierRates(env?: Record<string, unknown>): Promise<{
  rates: Record<SupportedCurrency, number>;
  sourceProvider: FxSourceProvider;
  fetchedAt: number;
}> {
  const kv = resolveKv(env);

  // Tier 1: Check KV cache first if fresh
  if (kv) {
    try {
      const cached = await kv.get(KV_FX_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          rates: Record<SupportedCurrency, number>;
          sourceProvider: FxSourceProvider;
          fetchedAt: number;
          ttlMs: number;
        };
        if (parsed?.rates && Date.now() - parsed.fetchedAt < (parsed.ttlMs ?? 3600000)) {
          return {
            rates: parsed.rates,
            sourceProvider: 'KV_CACHE',
            fetchedAt: parsed.fetchedAt,
          };
        }
      }
    } catch (kvErr) {
      logger.warn('[FxHedgingEngine] KV cache read failed', { error: String(kvErr) });
    }
  }

  // Tier 2: Live Provider (Open Exchange / Live Feed)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as { rates?: Record<string, number> };
      if (data?.rates && typeof data.rates === 'object') {
        const liveRates: Record<SupportedCurrency, number> = {
          USD: 1.0,
          EUR: Number(data.rates.EUR) || BEDROCK_RATES_TABLE.EUR,
          GBP: Number(data.rates.GBP) || BEDROCK_RATES_TABLE.GBP,
          JPY: Number(data.rates.JPY) || BEDROCK_RATES_TABLE.JPY,
          SGD: Number(data.rates.SGD) || BEDROCK_RATES_TABLE.SGD,
          AUD: Number(data.rates.AUD) || BEDROCK_RATES_TABLE.AUD,
          CAD: Number(data.rates.CAD) || BEDROCK_RATES_TABLE.CAD,
          VND: Number(data.rates.VND) || BEDROCK_RATES_TABLE.VND,
          THB: Number(data.rates.THB) || BEDROCK_RATES_TABLE.THB,
          IDR: Number(data.rates.IDR) || BEDROCK_RATES_TABLE.IDR,
        };

        const result = {
          rates: liveRates,
          sourceProvider: 'OPEN_EXCHANGE' as FxSourceProvider,
          fetchedAt: Date.now(),
        };

        // Cache in KV asynchronously
        if (kv) {
          kv.put(
            KV_FX_CACHE_KEY,
            JSON.stringify({ ...result, ttlMs: 3600000 }),
            { expirationTtl: 3600 },
          ).catch((e) => logger.warn('[FxHedgingEngine] KV put error', { error: String(e) }));
        }

        return result;
      }
    }
  } catch (liveErr) {
    logger.warn('[FxHedgingEngine] Live rate fetch failed, falling back', { error: String(liveErr) });
  }

  // Tier 3: Immutable Bedrock Fallback
  return {
    rates: { ...BEDROCK_RATES_TABLE },
    sourceProvider: 'BEDROCK_FALLBACK',
    fetchedAt: Date.now(),
  };
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
  // Positive slippage: Target currency strengthened against USD
  // Negative slippage: Target currency depreciated against USD
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
