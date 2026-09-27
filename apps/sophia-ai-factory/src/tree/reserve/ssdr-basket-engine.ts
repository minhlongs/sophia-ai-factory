/**
 * @file ssdr-basket-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Sophia Synthetic SDR (sSDR) basket valuation and reserve stabilization.
 */

import {
  SsdrCurrencyBasket,
  SsdrValuationQuote,
  GalacticLiquidityBuffer,
  ReserveOperationType,
  GATE_13_SCALE_TARGETS,
} from '@/seed/types/galactic-reserve';

export interface BasketValuationResult {
  basketVersion: string;
  calculatedIndexCents: number;
  impliedMarketCapCents: number;
  reserveBackingRatioBps: number;
  isSolvent: boolean;
  variancePct: number;
}

export interface ReserveRebalanceAdvice {
  requiredOperation: ReserveOperationType;
  amountCents: number;
  reason: string;
  targetHealthFactor: number;
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

/**
 * Evaluates the health of the 4 Galactic Liquidity Buffers against the $500M target
 */
export function evaluateGalacticBuffersHealth(
  buffers: GalacticLiquidityBuffer[]
): {
  totalAvailableCents: number;
  targetCents: number;
  overallHealthFactor: number;
  isTargetMet: boolean;
  deficitCents: number;
} {
  const targetCents = GATE_13_SCALE_TARGETS.RESERVE_BUFFER_TARGET_USD * 100; // $500M in cents
  const totalAvailableCents = buffers.reduce((sum, b) => sum + b.availableBalanceCents, 0);

  const overallHealthFactor =
    targetCents > 0 ? Number(Math.min(1.5, totalAvailableCents / targetCents).toFixed(4)) : 1.0;

  const deficitCents = Math.max(0, targetCents - totalAvailableCents);
  const isTargetMet = deficitCents === 0 && overallHealthFactor >= 1.0;

  return {
    totalAvailableCents,
    targetCents,
    overallHealthFactor,
    isTargetMet,
    deficitCents,
  };
}

/**
 * Generates automated stabilization advice when reserve backing or liquidity drops
 */
export function generateStabilizationAdvice(
  backingRatioBps: number,
  bufferHealthFactor: number,
  targetBufferDeficitCents: number
): ReserveRebalanceAdvice {
  if (backingRatioBps < 11000) {
    // Backing dropped below 110%: Burn sSDR to restore over-collateralization
    const excessSupplyCents = Math.round((12500 - backingRatioBps) * 1000000);
    return {
      requiredOperation: 'BURN_SSDR',
      amountCents: excessSupplyCents,
      reason: `Backing ratio ${backingRatioBps / 100}% is below 110% safety margin; burning sSDR`,
      targetHealthFactor: 1.15,
    };
  }

  if (bufferHealthFactor < 0.95 && targetBufferDeficitCents > 0) {
    // Liquidity buffer below target
    return {
      requiredOperation: 'INJECT_USD_BUFFER',
      amountCents: targetBufferDeficitCents,
      reason: `Liquidity buffer health factor ${bufferHealthFactor} is below 0.95; injecting USD reserve`,
      targetHealthFactor: 1.0,
    };
  }

  if (backingRatioBps > 14000) {
    // Excessive backing > 140%: mint sSDR to capture seigniorage & optimize capital
    return {
      requiredOperation: 'MINT_SSDR',
      amountCents: 5000000000, // $50M mint
      reason: `Backing ratio ${backingRatioBps / 100}% exceeds 140%; expanding sSDR liquidity`,
      targetHealthFactor: 1.25,
    };
  }

  return {
    requiredOperation: 'REBALANCE_CORRIDOR',
    amountCents: 0,
    reason: 'Reserve backing and liquidity buffer are balanced and healthy',
    targetHealthFactor: bufferHealthFactor,
  };
}
