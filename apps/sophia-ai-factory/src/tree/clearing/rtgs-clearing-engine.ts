/**
 * @file rtgs-clearing-engine.ts
 * @layer tree/clearing
 * @description Pure domain engine for Real-Time Gross Settlement (RTGS) & Dynamic Multilateral Netting.
 */

import { createHash } from 'node:crypto';
import {
  validateParameterizedRtgsPayment,
  executeParameterizedMultilateralNetting,
} from './hyper-rtgs-domain-engine';
import type {
  NettingObligation,
  NettingStatus,
  OmniversalCurrency,
  RtgsPriorityTier,
  RtgsSettlementStatus,
} from '@/seed/types/omniversal-clearing';

export interface RtgsValidationInput {
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: OmniversalCurrency;
  grossAmountCents: number;
  availableReserveCents: number;
  priorityTier?: RtgsPriorityTier;
}

export interface RtgsValidationOutput {
  valid: boolean;
  status: RtgsSettlementStatus;
  reason?: string;
  receiptHash: string;
}

export interface MultilateralNettingResult {
  status: NettingStatus;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  netPositions: Record<string, number>;
  netTransfers: Array<{
    from: string;
    to: string;
    currency: OmniversalCurrency;
    amountCents: number;
  }>;
  graphSolutionHash: string;
}

/**
 * Validates real-time gross settlement payment against participant liquidity reserves.
 */
export function validateRtgsPayment(input: RtgsValidationInput): RtgsValidationOutput {
  const result = validateParameterizedRtgsPayment(input, {
    rejectStatus: 'REJECTED_INSUFFICIENT_LIQUIDITY',
    requireParticipants: false,
    reserveDeficitReasonFn: (params) =>
      `Insufficient sovereign reserve balance: available ${params.availableReserveCents} < required ${params.grossAmountCents}`,
    errorHashFn: (reason, params) => {
      if (reason === 'NON_POSITIVE_AMOUNT') {
        return createHash('sha256')
          .update(`REJECTED_INVALID_AMOUNT:${params.sourceParticipantId}:${params.grossAmountCents}`)
          .digest('hex');
      }
      if (reason === 'SELF_SETTLEMENT') {
        return createHash('sha256')
          .update(`REJECTED_SELF_SETTLEMENT:${params.sourceParticipantId}`)
          .digest('hex');
      }
      return createHash('sha256')
        .update(`REJECTED_INSUFFICIENT_RESERVE:${params.sourceParticipantId}:${params.availableReserveCents}:${params.grossAmountCents}`)
        .digest('hex');
    },
    receiptHashFn: (params) =>
      createHash('sha256')
        .update(`FINALIZED_RTGS:${params.sourceParticipantId}:${params.targetParticipantId}:${params.assetCurrency}:${params.grossAmountCents}`)
        .digest('hex'),
  });

  return {
    valid: result.valid,
    status: result.status as RtgsSettlementStatus,
    reason: result.reason,
    receiptHash: result.receiptHash,
  };
}

/**
 * Solves multilateral netting matrix across high-frequency payment graph.
 * Minimizes bilateral settlement legs with conservation of value invariant.
 */
export function executeMultilateralNetting(
  obligations: NettingObligation[],
  defaultCurrency: OmniversalCurrency = 'SSDR'
): MultilateralNettingResult {
  const netResult = executeParameterizedMultilateralNetting(obligations, {
    currency: defaultCurrency,
    precision: 2,
    emptyHashFn: () => createHash('sha256').update('EMPTY_NETTING').digest('hex'),
    solutionHashFn: (ctx) =>
      createHash('sha256')
        .update(`NET_GRAPH:${ctx.grossVolumeCents}:${ctx.netSettlementVolumeCents}:${ctx.netTransfersCount}`)
        .digest('hex'),
  });

  return {
    status: netResult.status as NettingStatus,
    grossFlowCount: netResult.grossFlowCount,
    grossVolumeCents: netResult.grossVolumeCents,
    netSettlementVolumeCents: netResult.netSettlementVolumeCents,
    compressionRatioPct: netResult.compressionRatioPct,
    netPositions: netResult.netPositions,
    netTransfers: netResult.netTransfers as Array<{
      from: string;
      to: string;
      currency: OmniversalCurrency;
      amountCents: number;
    }>,
    graphSolutionHash: netResult.graphSolutionHash ?? '',
  };
}
