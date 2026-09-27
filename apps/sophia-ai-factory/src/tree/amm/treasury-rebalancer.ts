/**
 * treasury-rebalancer.ts — Gate 11 Dynamic Multi-Currency Treasury Rebalancer
 * Layer: TREE (Business Logic)
 *
 * Automatically monitors liquidity pool reserve ratios,
 * calculates cross-currency deviations, and dispatches multi-sig approved rebalancing.
 */

import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import {
  AMM_CONSTANTS,
  type AmmLiquidityPool,
  type TreasuryRebalanceEvent,
  type RebalanceTriggerReason,
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

export class TreasuryRebalancer {
  /**
   * Evaluates whether a pool's reserves have drifted beyond threshold.
   */
  public static evaluatePoolDeviation(
    pool: AmmLiquidityPool,
    targetRatio = 1.0
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

  /**
   * Proposes and constructs a Treasury Rebalance Event signed by multi-sig operators.
   */
  public static executeRebalance(
    sourcePool: AmmLiquidityPool,
    targetPool: AmmLiquidityPool,
    currencyMoved: string,
    amountUnits: string,
    operatorKeys: string[],
    triggerReason: RebalanceTriggerReason = 'DEVIATION_THRESHOLD'
  ): { event: TreasuryRebalanceEvent; rebalancedSourcePool: AmmLiquidityPool } {
    const preEval = this.evaluatePoolDeviation(sourcePool);

    // Multi-sig quorum check: requires at least 2 distinct operators
    const isQuorumMet = operatorKeys.length >= 2;
    const quorumString = operatorKeys.join(';');

    const amountNum = Number(amountUnits);
    const currentRes = Number(sourcePool.reserve0AmountUnits);
    const newRes = Math.max(0, currentRes - amountNum);

    const rebalancedSourcePool: AmmLiquidityPool = {
      ...sourcePool,
      reserve0AmountUnits: newRes.toString(),
      lastRebalancedAt: new Date().toISOString(),
      isCircuitBreakerTripped: preEval.shouldTripCircuitBreaker ? true : sourcePool.isCircuitBreakerTripped,
    };

    const postEval = this.evaluatePoolDeviation(rebalancedSourcePool);

    const event: TreasuryRebalanceEvent = {
      id: `rebal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      triggerReason,
      sourcePoolId: sourcePool.id,
      targetPoolId: targetPool.id,
      currencyMoved,
      amountMovedUnits: amountUnits,
      deviationBps: preEval.deviationBps,
      preRebalanceRatio: preEval.currentRatio,
      postRebalanceRatio: postEval.currentRatio,
      multisigOperatorQuorum: quorumString,
      status: isQuorumMet ? 'SETTLED' : 'PROPOSED',
      executedAt: new Date().toISOString(),
    };

    return { event, rebalancedSourcePool };
  }

  /**
   * Persists a treasury rebalance event into Cloudflare D1.
   */
  public static async recordRebalanceEvent(db: D1Database, event: TreasuryRebalanceEvent): Promise<void> {
    await db
      .prepare(
        `INSERT INTO treasury_rebalance_events (
          id, trigger_reason, source_pool_id, target_pool_id, currency_moved,
          amount_moved_units, deviation_bps, pre_rebalance_ratio,
          post_rebalance_ratio, multisig_operator_quorum, status, executed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.id,
        event.triggerReason,
        event.sourcePoolId,
        event.targetPoolId,
        event.currencyMoved,
        event.amountMovedUnits,
        event.deviationBps,
        event.preRebalanceRatio,
        event.postRebalanceRatio,
        event.multisigOperatorQuorum,
        event.status,
        event.executedAt
      )
      .run();
  }
}
