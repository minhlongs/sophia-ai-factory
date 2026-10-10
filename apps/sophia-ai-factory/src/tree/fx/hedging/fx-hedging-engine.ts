/**
 * Hedging position executor and D1 transaction auditor.
 *
 * Coordinates rate oracle and hedge calculator for end-to-end hedging operations.
 *
 * Layer: tree/fx/hedging
 * Allowed imports: @/seed/*, @/tree/*
 */

import type { SupportedCurrency } from '@/seed/types/enterprise-billing';
import type {
  HedgedQuoteInput,
  HedgedQuoteResult,
  HedgingReconciliationResult,
} from '@/seed/types/fx-hedging';
import { fetchMultiTierRates } from './rate-oracle';
import {
  calculateHedgedQuote,
  reconcileSettlementSlippage,
  normalizeCurrencyAmount,
} from './hedge-calculator';
import type { MinimalD1 } from './types';

export class FxHedgingEngine {
  private env?: Record<string, unknown>;
  private db?: MinimalD1;

  constructor(options?: { env?: Record<string, unknown>; db?: MinimalD1 }) {
    this.env = options?.env;
    this.db = options?.db;
  }

  /**
   * Generates a hedged quote by fetching multi-tier rates and applying buffer calculations.
   */
  async getHedgedQuote(input: HedgedQuoteInput): Promise<HedgedQuoteResult> {
    const rateData = await fetchMultiTierRates(this.env);
    return calculateHedgedQuote(input, rateData.rates, rateData.sourceProvider);
  }

  /**
   * Reconciles transaction slippage against settlement market rate.
   */
  reconcileSlippage(params: {
    transactionId: string;
    reserveId: string;
    baseAmountCents: number;
    quotedMarketRate: number;
    quotedHedgedRate: number;
    settlementMarketRate: number;
    targetAmount: number;
    targetCurrency: SupportedCurrency;
  }): HedgingReconciliationResult {
    return reconcileSettlementSlippage(params);
  }

  /**
   * Normalizes amount for a specific currency denomination.
   */
  normalize(rawMajorAmount: number, currency: SupportedCurrency) {
    return normalizeCurrencyAmount(rawMajorAmount, currency);
  }
}
