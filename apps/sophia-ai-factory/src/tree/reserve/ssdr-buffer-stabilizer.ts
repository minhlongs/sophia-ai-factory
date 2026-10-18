/**
 * @file ssdr-buffer-stabilizer.ts
 * @layer tree/reserve
 * @description Galactic Liquidity Buffer Health & sSDR Stabilization Advisor.
 */

import {
  type GalacticLiquidityBuffer,
  type ReserveOperationType,
  GATE_13_SCALE_TARGETS,
} from '@/seed/types/galactic-reserve';

export interface ReserveRebalanceAdvice {
  requiredOperation: ReserveOperationType;
  amountCents: number;
  reason: string;
  targetHealthFactor: number;
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
