/**
 * Dynamic FX Hedging, Buffer Reserves, and Slippage Reconciliation Types
 *
 * Layer: seed/types (Foundational — zero dependencies on upper layers)
 *
 * @module seed/types/fx-hedging
 */

import type { SupportedCurrency } from './enterprise-billing';

export type FxSourceProvider =
  | 'ECB'
  | 'OPEN_EXCHANGE'
  | 'KV_CACHE'
  | 'BEDROCK_FALLBACK';

export const ALL_FX_SOURCE_PROVIDERS: readonly FxSourceProvider[] = [
  'ECB',
  'OPEN_EXCHANGE',
  'KV_CACHE',
  'BEDROCK_FALLBACK',
] as const;

export interface FxRateRecord {
  id: string;
  baseCurrency: 'USD';
  targetCurrency: SupportedCurrency;
  rate: number;
  inverseRate: number;
  bufferPercentage: number;
  hedgedRate: number;
  sourceProvider: FxSourceProvider;
  isActive: boolean;
  validFrom: number;
  validUntil: number;
  createdAt: number;
}

export interface HedgedQuoteInput {
  baseAmountCents: number;
  targetCurrency: SupportedCurrency;
  customBufferPercent?: number; // Default 0.015 (+1.5%)
}

export interface HedgedQuoteResult {
  baseCurrency: 'USD';
  targetCurrency: SupportedCurrency;
  baseAmountCents: number;
  marketRate: number;
  hedgedRate: number;
  bufferPercent: number;
  targetAmount: number;         // Major units or zero-decimal integer
  targetAmountSubunits: number; // Subunits (cents, pence, satang, or JPY/VND/IDR integer)
  bufferReserveCents: number;   // In USD cents escrowed
  bufferReserveTarget: number;  // In target currency
  rateValidUntil: number;       // Epoch ms
  fxRateId: string;
  sourceProvider: FxSourceProvider;
}

export type ReserveStatus =
  | 'escrowed'
  | 'realized_gain'
  | 'absorbed_loss'
  | 'rebalanced'
  | 'released';

export const ALL_RESERVE_STATUSES: readonly ReserveStatus[] = [
  'escrowed',
  'realized_gain',
  'absorbed_loss',
  'rebalanced',
  'released',
] as const;

export interface HedgingReserveRecord {
  id: string;
  transactionId: string;
  baseCurrency: 'USD';
  targetCurrency: SupportedCurrency;
  baseAmountCents: number;
  marketRateAtQuote: number;
  hedgedRateAtQuote: number;
  bufferPercent: number;
  reserveAmountCents: number;
  reserveAmountTarget: number;
  marketRateAtSettlement?: number | null;
  variancePercent?: number | null;
  realizedPnlCents?: number | null;
  reserveStatus: ReserveStatus;
  settledAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface HedgingReconciliationResult {
  transactionId: string;
  reserveId: string;
  originalQuoteRate: number;
  settlementRate: number;
  slippagePercent: number;
  bufferAbsorbed: boolean;
  realizedPnlCents: number;
  finalStatus: 'realized_gain' | 'absorbed_loss' | 'rebalanced';
}
