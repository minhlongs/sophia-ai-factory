/**
 * Multilateral Zero-Sum Netting Matrix Engine
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/multilateral-netting-engine
 */

import type {
  BilateralTransferLeg,
  MultilateralNettingMatrix,
  NettingParticipantSummary,
} from '@/seed/types/multi-asset-clearing';
import { normalizeAssetAmount } from './currency-precision';

/**
 * Computes multilateral zero-sum netting matrix from bilateral payment legs.
 * Conserves total balances and verifies zero-sum equilibrium.
 */
export function computeMultilateralNetting(
  legs: BilateralTransferLeg[],
  cycleId?: string
): MultilateralNettingMatrix {
  const resolvedCycleId = cycleId ?? `NET-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  if (legs.length === 0) {
    return {
      cycleId: resolvedCycleId,
      asset: 'USD',
      totalGrossVolume: 0,
      totalNetVolume: 0,
      compressionRatioPct: 0,
      zeroSumBalanced: true,
      participantSummaries: [],
      settlementBatchIds: [],
    };
  }

  const asset = legs[0].asset;
  let totalGrossVolume = 0;
  const participantMap: Map<string, { grossPayable: number; grossReceivable: number }> = new Map();

  for (const leg of legs) {
    totalGrossVolume += leg.amount;

    const sender = participantMap.get(leg.fromParticipantId) ?? { grossPayable: 0, grossReceivable: 0 };
    sender.grossPayable += leg.amount;
    participantMap.set(leg.fromParticipantId, sender);

    const receiver = participantMap.get(leg.toParticipantId) ?? { grossPayable: 0, grossReceivable: 0 };
    receiver.grossReceivable += leg.amount;
    participantMap.set(leg.toParticipantId, receiver);
  }

  const participantSummaries: NettingParticipantSummary[] = [];
  let sumNetBalances = 0;
  let totalNetVolume = 0;

  for (const [participantId, data] of participantMap.entries()) {
    const netSettlementAmount = normalizeAssetAmount(data.grossReceivable - data.grossPayable, asset);
    sumNetBalances += netSettlementAmount;
    if (netSettlementAmount > 0) {
      totalNetVolume += netSettlementAmount;
    }

    participantSummaries.push({
      participantId,
      asset,
      grossPayable: normalizeAssetAmount(data.grossPayable, asset),
      grossReceivable: normalizeAssetAmount(data.grossReceivable, asset),
      netSettlementAmount,
    });
  }

  // Zero-sum invariant: sum of net balances must be ~0 (accounting for precision rounding)
  const zeroSumBalanced = Math.abs(sumNetBalances) < 0.01;
  const compressionRatioPct = totalGrossVolume > 0
    ? Math.max(0, Math.round((1 - (totalNetVolume / totalGrossVolume)) * 10000) / 100)
    : 0;

  return {
    cycleId: resolvedCycleId,
    asset,
    totalGrossVolume: normalizeAssetAmount(totalGrossVolume, asset),
    totalNetVolume: normalizeAssetAmount(totalNetVolume, asset),
    compressionRatioPct,
    zeroSumBalanced,
    participantSummaries,
    settlementBatchIds: [],
  };
}
