/**
 * Multilateral Graph Netting Engine across debt matrices
 *
 * @module tree/clearing/hyper-rtgs/graph-netter
 */

import type {
  NettingObligation,
  MultilateralNettingConfig,
  MultilateralNettingContext,
  MultilateralNettingResult,
} from './types';
import {
  solveDirectionalNetTransfers,
  solveBilateralNetTransfers,
} from './transfer-solvers';
import {
  computeNetObligationTotals,
  createEmptyNettingResult,
  createAbortedNettingResult,
  computeNettingSolutionHash,
} from './graph-netter-helpers';

export {
  computeNetObligationTotals,
  createEmptyNettingResult,
  createAbortedNettingResult,
  computeNettingSolutionHash,
};

/**
 * Parameterized solver for Multilateral Netting across debt matrices.
 */
export function executeParameterizedMultilateralNetting(
  obligations: NettingObligation[],
  config: MultilateralNettingConfig,
): MultilateralNettingResult {
  const currency = config.currency ?? 'USDT';
  const shardCount = config.hyperShardCount ?? 1;
  const precision = config.precision ?? 2;
  const batchRef =
    config.batchRef ??
    `${config.batchRefPrefix ?? 'NET-BATCH'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const grossFlowCount = obligations.length;
  const { grossVolumeCents, netPositions } = computeNetObligationTotals(obligations);

  if (grossVolumeCents === 0 || grossFlowCount === 0) {
    return createEmptyNettingResult(config, batchRef, shardCount, currency);
  }

  // Value conservation invariant check: sum of net positions must sum to 0
  const sumNet = Object.values(netPositions).reduce((acc, val) => acc + val, 0);
  if (Math.abs(sumNet) > 0.0001) {
    return createAbortedNettingResult(batchRef, shardCount, grossFlowCount, grossVolumeCents, netPositions, sumNet);
  }

  const { netSettlementVolumeCents, netTransfers } =
    config.transferFormat === 'directional'
      ? solveDirectionalNetTransfers(netPositions)
      : solveBilateralNetTransfers(netPositions, currency);

  const compressionRatioPct =
    grossVolumeCents > 0
      ? Number((((grossVolumeCents - netSettlementVolumeCents) / grossVolumeCents) * 100).toFixed(precision))
      : 100.0;

  const solutionContext: MultilateralNettingContext = {
    batchRef,
    grossFlowCount,
    grossVolumeCents,
    netSettlementVolumeCents,
    compressionRatioPct,
    hyperShardCount: shardCount,
    currency,
    netPositions,
    netTransfersCount: netTransfers.length,
  };

  const solutionHash = computeNettingSolutionHash(solutionContext, config);

  return {
    status: 'NET_EXECUTED',
    nettingStatus: 'NET_EXECUTED',
    batchRef,
    hyperShardCount: shardCount,
    grossFlowCount,
    grossVolumeCents,
    netSettlementVolumeCents,
    compressionRatioPct,
    netPositions,
    netTransfers,
    graphSolutionHash: solutionHash,
    transCosmicSolutionHash: solutionHash,
    omniverseSolutionHash: solutionHash,
  };
}
