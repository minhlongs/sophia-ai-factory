/**
 * Types and interfaces for Dynamic FX Hedging Engine.
 *
 * Layer: tree/fx/hedging
 * Allowed imports: @/seed/*
 */

import type { SupportedCurrency } from '@/seed/types/enterprise-billing';
import type {
  HedgedQuoteInput,
  HedgedQuoteResult,
  HedgingReconciliationResult,
  FxSourceProvider,
} from '@/seed/types/fx-hedging';

export const DEFAULT_HEDGING_BUFFER_PERCENT = 0.015; // +1.5% default buffer
export const HIGH_VOLATILITY_BUFFER_PERCENT = 0.025; // +2.5% widened buffer on high volatility
export const FX_RATE_QUOTE_TTL_MS = 15 * 60 * 1000; // 15-minute quote validity window
export const KV_FX_CACHE_KEY = 'fx_rates:usd:v2';
export const LIVE_TIMEOUT_MS = 2000;

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

export interface FxRateFetchResult {
  rates: Record<SupportedCurrency, number>;
  sourceProvider: FxSourceProvider;
  fetchedAt: number;
}

export type {
  SupportedCurrency,
  HedgedQuoteInput,
  HedgedQuoteResult,
  HedgingReconciliationResult,
  FxSourceProvider,
};
