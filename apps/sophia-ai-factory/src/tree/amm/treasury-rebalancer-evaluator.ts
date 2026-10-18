/**
 * treasury-rebalancer-evaluator.ts — Pool Reserve Deviation Evaluator
 * Layer: TREE (Business Logic)
 */

import {
  AMM_CONSTANTS,
  type AmmLiquidityPool,
} from '@/seed/types/amm-clearing';

export interface RebalanceEvaluationResult {
  poolId: string;
  currentRatio: number;
  targetRatio: number;
  deviationBps: number;
  isRebalanceNeeded: boolean;
  shouldTripCircuitBreaker: boolean;
  recommendedAction: 'NONE' | 'REBALANCE' | 'HALT_TRADING';
}

/**
 * Evaluates whether a pool's reserves have drifted beyond threshold.
 */
export function evaluateAmmPoolDeviation(
  pool: AmmLiquidityPool,
  targetRatio = 1.0,
): RebalanceEvaluationResult {
  const res0 = Number(pool.reserve0AmountUnits);
  const res1 = Number(pool.reserve1AmountUnits);

  if (res0 <= 0 || res1 <= 0) {
    return {
      poolId: pool.id,
      currentRatio: 0,
      targetRatio,
      deviationBps: 10_000,
      isRebalanceNeeded: true,
      shouldTripCircuitBreaker: true,
      recommendedAction: 'HALT_TRADING',
    };
  }

  const currentRatio = res0 / res1;
  const deviationFraction = Math.abs(currentRatio - targetRatio) / targetRatio;
  const deviationBps = Math.round(deviationFraction * 10_000);

  const isRebalanceNeeded = deviationBps >= AMM_CONSTANTS.CIRCUIT_BREAKER_DEVIATION_BPS;
  const shouldTripCircuitBreaker = deviationBps >= AMM_CONSTANTS.CIRCUIT_BREAKER_DEVIATION_BPS * 3; // >30% drift

  let recommendedAction: 'NONE' | 'REBALANCE' | 'HALT_TRADING' = 'NONE';
  if (shouldTripCircuitBreaker) {
    recommendedAction = 'HALT_TRADING';
  } else if (isRebalanceNeeded) {
    recommendedAction = 'REBALANCE';
  }

  return {
    poolId: pool.id,
    currentRatio: Number(currentRatio.toFixed(6)),
    targetRatio,
    deviationBps,
    isRebalanceNeeded,
    shouldTripCircuitBreaker,
    recommendedAction,
  };
}
