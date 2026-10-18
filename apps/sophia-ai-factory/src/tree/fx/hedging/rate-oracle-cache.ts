/**
 * KV Cache Resolution & Rate Parsing Helpers for FX Hedging Rate Oracle
 *
 * Layer: tree/fx/hedging
 *
 * @module tree/fx/hedging/rate-oracle-cache
 */

import { logger } from '@/seed/utils/logger-utility';
import type { SupportedCurrency } from '@/seed/types/enterprise-billing';
import { BEDROCK_RATES_TABLE } from '@/tree/billing/fx-converter';
import {
  KV_FX_CACHE_KEY,
  type MinimalKV,
  type FxRateFetchResult,
} from './types';

export function resolveKv(env?: Record<string, unknown>): MinimalKV | null {
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

export async function tryReadCachedKvRates(kv: MinimalKV): Promise<FxRateFetchResult | null> {
  try {
    const cached = await kv.get(KV_FX_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as {
      rates: Record<SupportedCurrency, number>;
      sourceProvider: FxRateFetchResult['sourceProvider'];
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
  } catch (kvErr) {
    logger.warn('[FxHedgingEngine] KV cache read failed', { error: String(kvErr) });
  }
  return null;
}

export function parseLiveRates(data: { rates?: Record<string, number> }): Record<SupportedCurrency, number> {
  return {
    USD: 1.0,
    EUR: Number(data.rates?.EUR) || BEDROCK_RATES_TABLE.EUR,
    GBP: Number(data.rates?.GBP) || BEDROCK_RATES_TABLE.GBP,
    JPY: Number(data.rates?.JPY) || BEDROCK_RATES_TABLE.JPY,
    SGD: Number(data.rates?.SGD) || BEDROCK_RATES_TABLE.SGD,
    AUD: Number(data.rates?.AUD) || BEDROCK_RATES_TABLE.AUD,
    CAD: Number(data.rates?.CAD) || BEDROCK_RATES_TABLE.CAD,
    VND: Number(data.rates?.VND) || BEDROCK_RATES_TABLE.VND,
    THB: Number(data.rates?.THB) || BEDROCK_RATES_TABLE.THB,
    IDR: Number(data.rates?.IDR) || BEDROCK_RATES_TABLE.IDR,
  };
}
