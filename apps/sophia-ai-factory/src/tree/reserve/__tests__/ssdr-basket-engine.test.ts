import { describe, it, expect } from 'vitest';
import {
  calculateSsdrBasketIndex,
  evaluateGalacticBuffersHealth,
  generateStabilizationAdvice,
} from '../ssdr-basket-engine';
import type {
  SsdrCurrencyBasket,
  SsdrValuationQuote,
  GalacticLiquidityBuffer,
} from '@/seed/types/galactic-reserve';

describe('sSDR Currency Basket & Reserve Stabilization Engine Unit Tests', () => {
  const activeBasket: SsdrCurrencyBasket = {
    id: 'ssdr_basket_2026',
    basketVersion: 'SSDR_2026_Q3',
    usdWeightBps: 4338, // 43.38%
    eurWeightBps: 2931, // 29.31%
    cnyWeightBps: 1228, // 12.28%
    jpyWeightBps: 759,  // 7.59%
    gbpWeightBps: 744,  // 7.44%
    calculatedIndexCents: 135, // $1.35
    totalSsdrSupply: 500_000_000,
    reserveBackingRatioBps: 12500, // 125%
    isActive: true,
    lastRebalancedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const sampleQuotes: SsdrValuationQuote = {
    usdPriceCents: 100, // 1 USD = $1.00
    eurPriceCents: 108, // 1 EUR = $1.08
    cnyPriceCents: 14,  // 1 CNY = $0.14
    jpyPriceCents: 1,   // 1 JPY = $0.01 (approx 1 cent)
    gbpPriceCents: 132, // 1 GBP = $1.32
  };

  it('calculates weighted basket index price and implied market cap', () => {
    const valuation = calculateSsdrBasketIndex(activeBasket, sampleQuotes);
    expect(valuation.calculatedIndexCents).toBeGreaterThan(0);
    expect(valuation.impliedMarketCapCents).toBe(valuation.calculatedIndexCents * activeBasket.totalSsdrSupply);
    expect(valuation.isSolvent).toBe(true);
  });

  it('rejects basket with invalid weight sum != 10000 bps', () => {
    const invalidBasket = { ...activeBasket, usdWeightBps: 4000 }; // sum != 10000
    expect(() => calculateSsdrBasketIndex(invalidBasket, sampleQuotes)).toThrowError(
      /Invalid basket weights: sum is 9662, expected 10000 bps/
    );
  });

  it('evaluates health across 4 global liquidity hubs against $500M target', () => {
    const mockBuffers: GalacticLiquidityBuffer[] = [
      {
        id: 'buf_1',
        vaultIdentifier: 'FED_NY',
        jurisdiction: 'US_FEDERAL_RESERVE_NY',
        allocatedTargetCents: 12_500_000_000,
        availableBalanceCents: 13_000_000_000,
        lockedEscrowCents: 1_000_000_000,
        healthFactor: 1.04,
        lastAuditProofSha256: 'a'.repeat(64),
        updatedAt: '2026-09-27T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'buf_2',
        vaultIdentifier: 'ECB_FRA',
        jurisdiction: 'EURO_SYSTEM_FRANKFURT',
        allocatedTargetCents: 12_500_000_000,
        availableBalanceCents: 12_500_000_000,
        lockedEscrowCents: 500_000_000,
        healthFactor: 1.0,
        lastAuditProofSha256: 'b'.repeat(64),
        updatedAt: '2026-09-27T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'buf_3',
        vaultIdentifier: 'MAS_SIN',
        jurisdiction: 'MONETARY_AUTHORITY_SINGAPORE',
        allocatedTargetCents: 12_500_000_000,
        availableBalanceCents: 12_500_000_000,
        lockedEscrowCents: 500_000_000,
        healthFactor: 1.0,
        lastAuditProofSha256: 'c'.repeat(64),
        updatedAt: '2026-09-27T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'buf_4',
        vaultIdentifier: 'SNB_ZUR',
        jurisdiction: 'SOPHIA_SWISS_VAULT',
        allocatedTargetCents: 12_500_000_000,
        availableBalanceCents: 12_500_000_000,
        lockedEscrowCents: 200_000_000,
        healthFactor: 1.0,
        lastAuditProofSha256: 'd'.repeat(64),
        updatedAt: '2026-09-27T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const result = evaluateGalacticBuffersHealth(mockBuffers);
    expect(result.totalAvailableCents).toBe(50_500_000_000); // $505M > $500M
    expect(result.overallHealthFactor).toBeGreaterThanOrEqual(1.0);
    expect(result.isTargetMet).toBe(true);
    expect(result.deficitCents).toBe(0);
  });

  it('generates stabilization advice when backing drops or buffer is deficient', () => {
    // 1. Backing ratio dropped to 105% (< 110%)
    const burnAdvice = generateStabilizationAdvice(10500, 1.0, 0);
    expect(burnAdvice.requiredOperation).toBe('BURN_SSDR');
    expect(burnAdvice.amountCents).toBeGreaterThan(0);

    // 2. Buffer health low (< 0.95) with deficit
    const injectAdvice = generateStabilizationAdvice(12500, 0.88, 6_000_000_000);
    expect(injectAdvice.requiredOperation).toBe('INJECT_USD_BUFFER');
    expect(injectAdvice.amountCents).toBe(6_000_000_000);

    // 3. Balanced state
    const normalAdvice = generateStabilizationAdvice(12500, 1.02, 0);
    expect(normalAdvice.requiredOperation).toBe('REBALANCE_CORRIDOR');
  });
});
