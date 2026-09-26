/**
 * Unit & Adversarial Test Suite: FX Hedging Engine & Buffer Reserves
 *
 * Tests:
 * 1. 10-currency conversions and zero-decimal integer normalization (JPY, VND, IDR)
 * 2. +1.5% buffer reserve escrow math
 * 3. Multi-tier rate fetcher resilience (KV, Live, Bedrock fallback)
 * 4. Settlement slippage reconciliation (realized_gain, absorbed_loss, rebalanced)
 * 5. Monte Carlo FX Invariance Stress Test (1,000 randomized iterations)
 *
 * Layer: tree/fx/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateHedgedQuote,
  normalizeCurrencyAmount,
  reconcileSettlementSlippage,
  fetchMultiTierRates,
  DEFAULT_HEDGING_BUFFER_PERCENT,
  type MinimalKV,
} from '../fx-hedging-engine';
import {
  type SupportedCurrency,
  ALL_SUPPORTED_CURRENCIES,
} from '@/seed/types/enterprise-billing';
import { BEDROCK_RATES_TABLE } from '@/tree/billing/fx-converter';

describe('FX Hedging Engine Unit & Adversarial Suite', () => {
  // =========================================================================
  // 1. Currency Normalization & Precision across 10 Currencies
  // =========================================================================
  describe('1. normalizeCurrencyAmount', () => {
    it('enforces exact integer precision for JPY (no decimal fractions)', () => {
      const { major, subunits } = normalizeCurrencyAmount(15345.67, 'JPY');
      expect(major).toBe(15346);
      expect(subunits).toBe(15346);
      expect(Number.isInteger(major)).toBe(true);
    });

    it('enforces 1,000 VND bank note unit rounding for VND', () => {
      const r1 = normalizeCurrencyAmount(25450123.45, 'VND');
      expect(r1.major).toBe(25450000);
      expect(r1.major % 1000).toBe(0);

      const r2 = normalizeCurrencyAmount(25450600, 'VND');
      expect(r2.major).toBe(25451000);
      expect(r2.major % 1000).toBe(0);
    });

    it('enforces 100 IDR denomination rounding for IDR', () => {
      const r1 = normalizeCurrencyAmount(1625078.9, 'IDR');
      expect(r1.major).toBe(1625100);
      expect(r1.major % 100).toBe(0);
    });

    it('enforces standard 2-decimal precision for standard currencies (EUR, GBP, SGD, AUD, CAD, THB, USD)', () => {
      const standardCurrencies: SupportedCurrency[] = ['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'THB'];
      for (const cur of standardCurrencies) {
        const { major, subunits } = normalizeCurrencyAmount(99.456, cur);
        expect(major).toBe(99.46);
        expect(subunits).toBe(9946);
      }
    });

    it('handles zero cleanly without signed negative zero (-0)', () => {
      for (const cur of ALL_SUPPORTED_CURRENCIES) {
        const { major, subunits } = normalizeCurrencyAmount(0, cur);
        expect(major).toBe(0);
        expect(subunits).toBe(0);
        expect(Object.is(major, -0)).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. Hedged Quote Calculation with +1.5% Buffer Reserve
  // =========================================================================
  describe('2. calculateHedgedQuote', () => {
    it('applies exact +1.5% buffer to market rate for foreign currencies', () => {
      // Base: $100.00 USD (10000 cents) -> EUR (bedrock 0.92)
      // Hedged rate: 0.92 * 1.015 = 0.9338
      const quote = calculateHedgedQuote({
        baseAmountCents: 10000,
        targetCurrency: 'EUR',
      });

      expect(quote.baseCurrency).toBe('USD');
      expect(quote.targetCurrency).toBe('EUR');
      expect(quote.marketRate).toBe(0.92);
      expect(quote.bufferPercent).toBe(0.015);
      expect(quote.hedgedRate).toBeCloseTo(0.92 * 1.015, 6);
      expect(quote.targetAmount).toBe(93.38);
      expect(quote.targetAmountSubunits).toBe(9338);
      expect(quote.bufferReserveCents).toBe(150); // 1.5% of 10000 cents
      expect(quote.bufferReserveTarget).toBeCloseTo(93.38 - 92.00, 2);
    });

    it('returns 1.0 rate and zero reserve for USD -> USD checkout', () => {
      const quote = calculateHedgedQuote({
        baseAmountCents: 29900,
        targetCurrency: 'USD',
      });

      expect(quote.marketRate).toBe(1.0);
      expect(quote.hedgedRate).toBe(1.0);
      expect(quote.bufferPercent).toBe(0);
      expect(quote.bufferReserveCents).toBe(0);
      expect(quote.bufferReserveTarget).toBe(0);
      expect(quote.targetAmount).toBe(299.00);
      expect(quote.targetAmountSubunits).toBe(29900);
    });

    it('correctly calculates quotes across all 10 currencies without NaN or non-finite values', () => {
      for (const cur of ALL_SUPPORTED_CURRENCIES) {
        const quote = calculateHedgedQuote({
          baseAmountCents: 79900,
          targetCurrency: cur,
        });

        expect(Number.isFinite(quote.targetAmount)).toBe(true);
        expect(Number.isFinite(quote.targetAmountSubunits)).toBe(true);
        expect(quote.targetAmount).toBeGreaterThan(0);
        expect(quote.rateValidUntil).toBeGreaterThan(Date.now());
      }
    });

    it('supports custom buffer percent override', () => {
      const quote = calculateHedgedQuote({
        baseAmountCents: 10000,
        targetCurrency: 'EUR',
        customBufferPercent: 0.025, // 2.5% widened buffer
      });

      expect(quote.bufferPercent).toBe(0.025);
      expect(quote.hedgedRate).toBeCloseTo(0.92 * 1.025, 6);
      expect(quote.bufferReserveCents).toBe(250);
    });

    it('rejects negative base amounts', () => {
      expect(() => {
        calculateHedgedQuote({
          baseAmountCents: -500,
          targetCurrency: 'EUR',
        });
      }).toThrow(/negative/i);
    });

    it('rejects invalid or unsupported currencies', () => {
      expect(() => {
        calculateHedgedQuote({
          baseAmountCents: 1000,
          targetCurrency: 'XYZ' as SupportedCurrency,
        });
      }).toThrow(/unsupported currency/i);
    });
  });

  // =========================================================================
  // 3. Multi-Tier Rate Fetcher Resilience
  // =========================================================================
  describe('3. fetchMultiTierRates', () => {
    it('returns KV cache when fresh cached rates exist', async () => {
      const mockRates: Record<SupportedCurrency, number> = {
        ...BEDROCK_RATES_TABLE,
        EUR: 0.95,
      };

      const mockKv: MinimalKV = {
        get: vi.fn().mockResolvedValue(
          JSON.stringify({
            rates: mockRates,
            sourceProvider: 'KV_CACHE',
            fetchedAt: Date.now() - 60000, // 1 min old
            ttlMs: 3600000,
          }),
        ),
        put: vi.fn().mockResolvedValue(undefined),
      };

      const result = await fetchMultiTierRates({ KV_KV: mockKv });
      expect(result.sourceProvider).toBe('KV_CACHE');
      expect(result.rates.EUR).toBe(0.95);
    });

    it('falls back to immutable bedrock rates when KV and live fetch fail', async () => {
      // Mock global fetch to fail
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down'));

      try {
        const result = await fetchMultiTierRates({});
        expect(result.sourceProvider).toBe('BEDROCK_FALLBACK');
        expect(result.rates.USD).toBe(1.0);
        expect(result.rates.VND).toBe(BEDROCK_RATES_TABLE.VND);
        expect(result.rates.JPY).toBe(BEDROCK_RATES_TABLE.JPY);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // 4. Slippage Reconciliation (realized_gain vs absorbed_loss vs rebalanced)
  // =========================================================================
  describe('4. reconcileSettlementSlippage', () => {
    it('marks realized_gain when currency strengthens or holds value at settlement', () => {
      // Customer quoted EUR at market rate 0.92 with hedged rate 0.9338
      // Charged 93.38 EUR for $100.00 USD
      // At settlement, EUR appreciated to 0.90 USD/EUR:
      // Realized USD = 93.38 / 0.90 = $103.75 USD (+3.75 USD profit)
      const res = reconcileSettlementSlippage({
        transactionId: 'txn_01',
        reserveId: 'res_01',
        baseAmountCents: 10000,
        quotedMarketRate: 0.92,
        quotedHedgedRate: 0.9338,
        settlementMarketRate: 0.90,
        targetAmount: 93.38,
        targetCurrency: 'EUR',
      });

      expect(res.finalStatus).toBe('realized_gain');
      expect(res.bufferAbsorbed).toBe(true);
      expect(res.realizedPnlCents).toBeGreaterThan(0);
    });

    it('marks absorbed_loss when currency depreciates within the 1.5% buffer reserve', () => {
      // Customer charged 93.38 EUR. Market rate drops by 1.0% to 0.9292.
      // Realized USD = 93.38 / 0.9380 = $99.55 USD (-0.45 USD loss)
      // Loss of $0.45 is less than the $1.50 buffer reserve -> buffer absorbed!
      const res = reconcileSettlementSlippage({
        transactionId: 'txn_02',
        reserveId: 'res_02',
        baseAmountCents: 10000,
        quotedMarketRate: 0.92,
        quotedHedgedRate: 0.9338,
        settlementMarketRate: 0.9380,
        targetAmount: 93.38,
        targetCurrency: 'EUR',
      });

      expect(res.finalStatus).toBe('absorbed_loss');
      expect(res.bufferAbsorbed).toBe(true);
      expect(res.realizedPnlCents).toBeLessThan(0);
    });

    it('marks rebalanced when currency depreciates beyond the 1.5% buffer capacity', () => {
      // Market crashed by 5%: settlement rate = 0.98
      // Realized USD = 93.38 / 0.98 = $95.28 USD (-$4.72 loss > $1.50 reserve)
      const res = reconcileSettlementSlippage({
        transactionId: 'txn_03',
        reserveId: 'res_03',
        baseAmountCents: 10000,
        quotedMarketRate: 0.92,
        quotedHedgedRate: 0.9338,
        settlementMarketRate: 0.98,
        targetAmount: 93.38,
        targetCurrency: 'EUR',
      });

      expect(res.finalStatus).toBe('rebalanced');
      expect(res.bufferAbsorbed).toBe(false);
      expect(res.realizedPnlCents).toBeLessThan(-150);
    });
  });

  // =========================================================================
  // 5. Adversarial Monte Carlo FX Invariance Stress Test (1,000 Iterations)
  // =========================================================================
  describe('5. Monte Carlo FX Invariance Stress Test', () => {
    it('proves that across 1,000 randomized market volatility paths within 1.5%, business is 100% protected', () => {
      const ITERATIONS = 1000;
      let totalAbsorbedOrGain = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        // Random currency from 10 supported currencies
        const randomCurrency = ALL_SUPPORTED_CURRENCIES[
          Math.floor(Math.random() * ALL_SUPPORTED_CURRENCIES.length)
        ];
        // Random amount between $10 and $10,000 USD
        const baseAmountCents = Math.floor(Math.random() * 999000) + 1000;
        const quote = calculateHedgedQuote({
          baseAmountCents,
          targetCurrency: randomCurrency,
        });

        // Simulate intra-day market movement between -1.5% and +1.5%
        const deltaPercent = (Math.random() * 0.03) - 0.015; // [-0.015, +0.015]
        const settlementRate = quote.marketRate * (1 + deltaPercent);

        const reconciliation = reconcileSettlementSlippage({
          transactionId: `mc_${i}`,
          reserveId: `res_${i}`,
          baseAmountCents,
          quotedMarketRate: quote.marketRate,
          quotedHedgedRate: quote.hedgedRate,
          settlementMarketRate: settlementRate,
          targetAmount: quote.targetAmount,
          targetCurrency: randomCurrency,
        });

        if (reconciliation.bufferAbsorbed) {
          totalAbsorbedOrGain++;
        }
      }

      // Within +/- 1.5% market volatility, buffer must absorb 100% of scenarios
      expect(totalAbsorbedOrGain).toBe(ITERATIONS);
    });
  });
});
