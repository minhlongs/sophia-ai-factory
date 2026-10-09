/**
 * Multilateral Graph Netting Engine across debt matrices
 *
 * @module tree/clearing/hyper-rtgs/graph-netter
 */

import { createHash } from 'node:crypto';
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

export function computeNetObligationTotals(obligations: NettingObligation[]): {
  grossVolumeCents: number;
  netPositions: Record<string, number>;
} {
  let grossVolumeCents = 0;
  const netPositions: Record<string, number> = {};
  for (const ob of obligations) {
    grossVolumeCents += ob.amountCents;
    netPositions[ob.fromParticipantId] = (netPositions[ob.fromParticipantId] || 0) - ob.amountCents;
    netPositions[ob.toParticipantId] = (netPositions[ob.toParticipantId] || 0) + ob.amountCents;
  }
  return { grossVolumeCents, netPositions };
}

export function createEmptyNettingResult(
  config: MultilateralNettingConfig,
  batchRef: string,
  shardCount: number,
  currency: string,
): MultilateralNettingResult {
  const emptyContext: MultilateralNettingContext = {
    batchRef,
    grossFlowCount: 0,
    grossVolumeCents: 0,
    netSettlementVolumeCents: 0,
    compressionRatioPct: 100.0,
    hyperShardCount: shardCount,
    currency,
    netPositions: {},
    netTransfersCount: 0,
  };
  const emptyHash = config.emptyHashFn
    ? config.emptyHashFn(emptyContext)
    : createHash('sha256').update(config.hashPrefix ? `${config.hashPrefix}_EMPTY` : 'EMPTY_NETTING').digest('hex');

  return {
    status: 'NET_EXECUTED',
    nettingStatus: 'NET_EXECUTED',
    batchRef,
    hyperShardCount: shardCount,
    grossFlowCount: 0,
    grossVolumeCents: 0,
    netSettlementVolumeCents: 0,
    compressionRatioPct: 100.0,
    netPositions: {},
    netTransfers: [],
    graphSolutionHash: emptyHash,
    transCosmicSolutionHash: emptyHash,
    omniverseSolutionHash: emptyHash,
  };
}

export function createAbortedNettingResult(
  batchRef: string,
  shardCount: number,
  grossFlowCount: number,
  grossVolumeCents: number,
  netPositions: Record<string, number>,
  sumNet: number,
): MultilateralNettingResult {
  const abortedHash = createHash('sha256').update(`ABORTED:${sumNet}`).digest('hex');
  return {
    status: 'NET_ABORTED',
    nettingStatus: 'FAILED',
    batchRef,
    hyperShardCount: shardCount,
    grossFlowCount,
    grossVolumeCents,
    netSettlementVolumeCents: grossVolumeCents,
    compressionRatioPct: 0.0,
    netPositions,
    netTransfers: [],
    graphSolutionHash: abortedHash,
    transCosmicSolutionHash: abortedHash,
    omniverseSolutionHash: abortedHash,
  };
}

export function computeNettingSolutionHash(
  solutionContext: MultilateralNettingContext,
  config: MultilateralNettingConfig,
): string {
  if (config.solutionHashFn) {
    return config.solutionHashFn(solutionContext);
  }
  const prefix = config.hashPrefix ?? 'NET_GRAPH';
  return createHash('sha256')
    .update(
      `${prefix}:${solutionContext.hyperShardCount}:${solutionContext.grossVolumeCents}:${solutionContext.netSettlementVolumeCents}:${solutionContext.compressionRatioPct}:${solutionContext.netTransfersCount}`,
    )
    .digest('hex');
}

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
