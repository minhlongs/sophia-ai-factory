/**
 * @file rtgs-clearing-engine.ts
 * @layer tree/clearing
 * @description Pure domain engine for Real-Time Gross Settlement (RTGS) & Dynamic Multilateral Netting.
 */

import { createHash } from 'node:crypto';
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
  if (input.grossAmountCents <= 0) {
    const receiptHash = createHash('sha256')
      .update(`REJECTED_INVALID_AMOUNT:${input.sourceParticipantId}:${input.grossAmountCents}`)
      .digest('hex');
    return {
      valid: false,
      status: 'REJECTED_INSUFFICIENT_LIQUIDITY',
      reason: 'Gross settlement amount must be strictly positive',
      receiptHash,
    };
  }

  if (input.sourceParticipantId === input.targetParticipantId) {
    const receiptHash = createHash('sha256')
      .update(`REJECTED_SELF_SETTLEMENT:${input.sourceParticipantId}`)
      .digest('hex');
    return {
      valid: false,
      status: 'REJECTED_INSUFFICIENT_LIQUIDITY',
      reason: 'Source and target participants cannot be identical in RTGS',
      receiptHash,
    };
  }

  if (input.availableReserveCents < input.grossAmountCents) {
    const receiptHash = createHash('sha256')
      .update(`REJECTED_INSUFFICIENT_RESERVE:${input.sourceParticipantId}:${input.availableReserveCents}:${input.grossAmountCents}`)
      .digest('hex');
    return {
      valid: false,
      status: 'REJECTED_INSUFFICIENT_LIQUIDITY',
      reason: `Insufficient sovereign reserve balance: available ${input.availableReserveCents} < required ${input.grossAmountCents}`,
      receiptHash,
    };
  }

  const receiptHash = createHash('sha256')
    .update(`FINALIZED_RTGS:${input.sourceParticipantId}:${input.targetParticipantId}:${input.assetCurrency}:${input.grossAmountCents}`)
    .digest('hex');

  return {
    valid: true,
    status: 'FINALIZED_IRREVOCABLE',
    receiptHash,
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
  if (obligations.length === 0) {
    return {
      status: 'NET_EXECUTED',
      grossFlowCount: 0,
      grossVolumeCents: 0,
      netSettlementVolumeCents: 0,
      compressionRatioPct: 100.0,
      netPositions: {},
      netTransfers: [],
      graphSolutionHash: createHash('sha256').update('EMPTY_NETTING').digest('hex'),
    };
  }

  let grossVolumeCents = 0;
  const netPositions: Record<string, number> = {};

  for (const ob of obligations) {
    grossVolumeCents += ob.amountCents;
    netPositions[ob.fromParticipantId] = (netPositions[ob.fromParticipantId] || 0) - ob.amountCents;
    netPositions[ob.toParticipantId] = (netPositions[ob.toParticipantId] || 0) + ob.amountCents;
  }

  // Value conservation invariant check: sum of net positions must sum to 0
  const sumNet = Object.values(netPositions).reduce((acc, val) => acc + val, 0);
  if (Math.abs(sumNet) > 0.0001) {
    return {
      status: 'NET_ABORTED',
      grossFlowCount: obligations.length,
      grossVolumeCents,
      netSettlementVolumeCents: grossVolumeCents,
      compressionRatioPct: 0.0,
      netPositions,
      netTransfers: [],
      graphSolutionHash: createHash('sha256').update(`ABORTED:${sumNet}`).digest('hex'),
    };
  }

  // Partition into Debtors (<0) and Creditors (>0)
  const debtors: Array<{ id: string; balance: number }> = [];
  const creditors: Array<{ id: string; balance: number }> = [];

  for (const [id, balance] of Object.entries(netPositions)) {
    if (balance < 0) {
      debtors.push({ id, balance: -balance }); // convert to positive debt
    } else if (balance > 0) {
      creditors.push({ id, balance });
    }
  }

  // Sort descending to optimize matching
  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const netTransfers: Array<{
    from: string;
    to: string;
    currency: OmniversalCurrency;
    amountCents: number;
  }> = [];

  let dIdx = 0;
  let cIdx = 0;
  let netSettlementVolumeCents = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const settleAmount = Math.min(debtor.balance, creditor.balance);

    if (settleAmount > 0) {
      netTransfers.push({
        from: debtor.id,
        to: creditor.id,
        currency: defaultCurrency,
        amountCents: settleAmount,
      });

      netSettlementVolumeCents += settleAmount;
      debtor.balance -= settleAmount;
      creditor.balance -= settleAmount;
    }

    if (debtor.balance === 0) dIdx++;
    if (creditor.balance === 0) cIdx++;
  }

  const compressionRatioPct =
    grossVolumeCents > 0
      ? Number((((grossVolumeCents - netSettlementVolumeCents) / grossVolumeCents) * 100).toFixed(2))
      : 100.0;

  const graphSolutionHash = createHash('sha256')
    .update(`NET_GRAPH:${grossVolumeCents}:${netSettlementVolumeCents}:${netTransfers.length}`)
    .digest('hex');

  return {
    status: 'NET_EXECUTED',
    grossFlowCount: obligations.length,
    grossVolumeCents,
    netSettlementVolumeCents,
    compressionRatioPct,
    netPositions,
    netTransfers,
    graphSolutionHash,
  };
}
