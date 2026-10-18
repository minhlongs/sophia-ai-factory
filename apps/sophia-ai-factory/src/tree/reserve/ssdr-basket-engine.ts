/**
 * @file ssdr-basket-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Sophia Synthetic SDR (sSDR) basket valuation and reserve stabilization.
 */

import type {
  SsdrCurrencyBasket,
  SsdrValuationQuote,
} from '@/seed/types/galactic-reserve';

export {
  evaluateGalacticBuffersHealth,
  generateStabilizationAdvice,
  type ReserveRebalanceAdvice,
} from './ssdr-buffer-stabilizer';

export interface BasketValuationResult {
  basketVersion: string;
  calculatedIndexCents: number;
  impliedMarketCapCents: number;
  reserveBackingRatioBps: number;
  isSolvent: boolean;
  variancePct: number;
}

/**
 * Calculates the current price index of 1 sSDR in USD cents from underlying currency weights
 */
export function calculateSsdrBasketIndex(
  basket: SsdrCurrencyBasket,
  quotes: SsdrValuationQuote
): BasketValuationResult {
  // Total weight bps must equal 10,000 (100%)
  const totalWeight =
    basket.usdWeightBps +
    basket.eurWeightBps +
    basket.cnyWeightBps +
    basket.jpyWeightBps +
    basket.gbpWeightBps;

  if (totalWeight !== 10000) {
    throw new Error(`Invalid basket weights: sum is ${totalWeight}, expected 10000 bps`);
  }

  // Weighted sum in cents
  const weightedPrice =
    (basket.usdWeightBps * quotes.usdPriceCents +
      basket.eurWeightBps * quotes.eurPriceCents +
      basket.cnyWeightBps * quotes.cnyPriceCents +
      basket.jpyWeightBps * quotes.jpyPriceCents +
      basket.gbpWeightBps * quotes.gbpPriceCents) /
    10000;

  const calculatedIndexCents = Math.max(1, Math.round(weightedPrice));
  const impliedMarketCapCents = Math.round(calculatedIndexCents * basket.totalSsdrSupply);

  // Variance from baseline basket calculatedIndexCents
  const variancePct =
    basket.calculatedIndexCents > 0
      ? Number((((calculatedIndexCents - basket.calculatedIndexCents) / basket.calculatedIndexCents) * 100).toFixed(4))
      : 0;

  // Solvency check: reserve backing must be >= 100% (10,000 bps)
  const isSolvent = basket.reserveBackingRatioBps >= 10000;

  return {
    basketVersion: basket.basketVersion,
    calculatedIndexCents,
    impliedMarketCapCents,
    reserveBackingRatioBps: basket.reserveBackingRatioBps,
    isSolvent,
    variancePct,
  };
}
