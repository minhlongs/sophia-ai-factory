/**
 * Multilateral Graph Netting Helper Functions
 *
 * @module tree/clearing/hyper-rtgs/graph-netter-helpers
 */

import { createHash } from 'node:crypto';
import type {
  NettingObligation,
  MultilateralNettingConfig,
  MultilateralNettingContext,
  MultilateralNettingResult,
} from './types';

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
