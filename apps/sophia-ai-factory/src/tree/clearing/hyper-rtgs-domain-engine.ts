/**
 * @file hyper-rtgs-domain-engine.ts
 * @layer tree/clearing
 * @description Canonical parameterized domain engine for Atomic RTGS Payment Validation & Multilateral Graph Netting.
 */

import { createHash } from 'node:crypto';

export interface RtgsPaymentValidationParams {
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: string;
  grossAmountCents: number;
  availableReserveCents: number;
  priorityTier?: string;
}

export interface RtgsPaymentEngineConfig {
  latency?: number;
  latencyKey?: 'executionLatencyNanos' | 'executionLatencyPicoseconds' | 'none';
  hashPrefix?: string;
  defaultPriorityTier?: string;
  requireParticipants?: boolean;
  allowSelfSettlement?: boolean;
  rejectStatus?: string;
  receiptHashFn?: (params: RtgsPaymentValidationParams, latency: number) => string;
  errorHashFn?: (reason: string, params: RtgsPaymentValidationParams, latency: number) => string;
  reserveDeficitReasonFn?: (params: RtgsPaymentValidationParams) => string;
}

export interface RtgsPaymentValidationResult {
  valid: boolean;
  status: string;
  executionLatencyNanos?: number;
  executionLatencyPicoseconds?: number;
  receiptHash: string;
  error?: string;
  reason?: string;
}

export interface NettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: number;
  currency?: string;
}

export interface DirectionalNetTransfer {
  participantId: string;
  netPositionCents: number;
  direction: 'RECEIVE' | 'PAY' | 'SETTLED_FLAT';
}

export interface BilateralNetTransfer {
  from: string;
  to: string;
  currency: string;
  amountCents: number;
}

export interface MultilateralNettingContext {
  batchRef: string;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  hyperShardCount: number;
  currency: string;
  netPositions: Record<string, number>;
  netTransfersCount: number;
}

export interface MultilateralNettingConfig {
  currency?: string;
  hyperShardCount?: number;
  hashPrefix?: string;
  precision?: number;
  transferFormat?: 'directional' | 'debtor_creditor';
  batchRef?: string;
  batchRefPrefix?: string;
  solutionHashFn?: (ctx: MultilateralNettingContext) => string;
  emptyHashFn?: (ctx: MultilateralNettingContext) => string;
}

export interface MultilateralNettingResult {
  status?: string;
  nettingStatus?: 'NET_EXECUTED' | 'FAILED';
  batchRef?: string;
  hyperShardCount?: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  netPositions: Record<string, number>;
  netTransfers: BilateralNetTransfer[] | DirectionalNetTransfer[];
  graphSolutionHash?: string;
  transCosmicSolutionHash?: string;
  omniverseSolutionHash?: string;
}

/**
 * Parameterized validator for RTGS settlement across arbitrary scale tiers.
 */
export function validateParameterizedRtgsPayment(
  params: RtgsPaymentValidationParams,
  config: RtgsPaymentEngineConfig
): RtgsPaymentValidationResult {
  const latency = config.latency ?? 0;
  const rejectStatus = config.rejectStatus ?? 'REJECTED_LIQUIDITY';

  const baseResult: Partial<RtgsPaymentValidationResult> = {
    valid: false,
    status: rejectStatus,
  };

  if (config.latencyKey === 'executionLatencyNanos') {
    baseResult.executionLatencyNanos = latency;
  } else if (config.latencyKey === 'executionLatencyPicoseconds') {
    baseResult.executionLatencyPicoseconds = latency;
  } else if (!config.latencyKey && latency > 0) {
    baseResult.executionLatencyNanos = latency;
  }

  // 1. Participant check
  if (config.requireParticipants !== false && (!params.sourceParticipantId || !params.targetParticipantId)) {
    const errorHash = config.errorHashFn
      ? config.errorHashFn('INVALID_PARTICIPANTS', params, latency)
      : createHash('sha256').update('INVALID_PARTICIPANTS').digest('hex');

    return {
      ...baseResult,
      valid: false,
      status: rejectStatus,
      receiptHash: errorHash,
      error: 'Source and target participants must be specified',
      reason: 'Source and target participants must be specified',
    };
  }

  // 2. Gross amount check
  if (params.grossAmountCents <= 0) {
    const errorHash = config.errorHashFn
      ? config.errorHashFn('NON_POSITIVE_AMOUNT', params, latency)
      : createHash('sha256').update(`REJECTED_INVALID_AMOUNT:${params.sourceParticipantId}:${params.grossAmountCents}`).digest('hex');

    return {
      ...baseResult,
      valid: false,
      status: rejectStatus,
      receiptHash: errorHash,
      error: 'Gross amount must be strictly positive',
      reason: 'Gross settlement amount must be strictly positive',
    };
  }

  // 3. Self-settlement check
  if (!config.allowSelfSettlement && params.sourceParticipantId === params.targetParticipantId) {
    const errorHash = config.errorHashFn
      ? config.errorHashFn('SELF_SETTLEMENT', params, latency)
      : createHash('sha256').update(`REJECTED_SELF_SETTLEMENT:${params.sourceParticipantId}`).digest('hex');

    return {
      ...baseResult,
      valid: false,
      status: rejectStatus,
      receiptHash: errorHash,
      error: 'Source and target participants cannot be identical in RTGS',
      reason: 'Source and target participants cannot be identical in RTGS',
    };
  }

  // 4. Reserve sufficiency check
  if (params.availableReserveCents < params.grossAmountCents) {
    const errorHash = config.errorHashFn
      ? config.errorHashFn('RESERVE_DEFICIT', params, latency)
      : createHash('sha256').update(`RESERVE_DEFICIT:${params.availableReserveCents}:${params.grossAmountCents}`).digest('hex');

    return {
      ...baseResult,
      valid: false,
      status: rejectStatus,
      receiptHash: errorHash,
      error: `Insufficient reserve: required ${params.grossAmountCents} cents, available ${params.availableReserveCents} cents`,
      reason: config.reserveDeficitReasonFn
        ? config.reserveDeficitReasonFn(params)
        : `Available reserve ${params.availableReserveCents} cents insufficient for gross requirement ${params.grossAmountCents} cents`,
    };
  }

  // 5. Valid payment finalized
  let receiptHash: string;
  if (config.receiptHashFn) {
    receiptHash = config.receiptHashFn(params, latency);
  } else {
    const prefix = config.hashPrefix ?? 'FINALIZED_RTGS';
    receiptHash = createHash('sha256')
      .update(`${prefix}:${params.sourceParticipantId}:${params.targetParticipantId}:${params.assetCurrency}:${params.grossAmountCents}:${latency}`)
      .digest('hex');
  }

  return {
    ...baseResult,
    valid: true,
    status: 'FINALIZED_IRREVOCABLE',
    receiptHash,
  };
}

/**
 * Parameterized solver for Multilateral Netting across debt matrices.
 */
export function executeParameterizedMultilateralNetting(
  obligations: NettingObligation[],
  config: MultilateralNettingConfig
): MultilateralNettingResult {
  const currency = config.currency ?? 'USDT';
  const shardCount = config.hyperShardCount ?? 1;
  const precision = config.precision ?? 2;
  const batchRef =
    config.batchRef ??
    `${config.batchRefPrefix ?? 'NET-BATCH'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const grossFlowCount = obligations.length;
  let grossVolumeCents = 0;
  const netPositions: Record<string, number> = {};

  for (const ob of obligations) {
    grossVolumeCents += ob.amountCents;
    netPositions[ob.fromParticipantId] = (netPositions[ob.fromParticipantId] || 0) - ob.amountCents;
    netPositions[ob.toParticipantId] = (netPositions[ob.toParticipantId] || 0) + ob.amountCents;
  }

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

  if (grossVolumeCents === 0 || grossFlowCount === 0) {
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

  // Value conservation invariant check: sum of net positions must sum to 0
  const sumNet = Object.values(netPositions).reduce((acc, val) => acc + val, 0);
  if (Math.abs(sumNet) > 0.0001) {
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

  let netSettlementVolumeCents = 0;
  let netTransfers: BilateralNetTransfer[] | DirectionalNetTransfer[];

  if (config.transferFormat === 'directional') {
    const directionalTransfers: DirectionalNetTransfer[] = [];
    for (const [participantId, balance] of Object.entries(netPositions)) {
      if (balance > 0) {
        netSettlementVolumeCents += balance;
        directionalTransfers.push({
          participantId,
          netPositionCents: balance,
          direction: 'RECEIVE',
        });
      } else if (balance < 0) {
        directionalTransfers.push({
          participantId,
          netPositionCents: Math.abs(balance),
          direction: 'PAY',
        });
      } else {
        directionalTransfers.push({
          participantId,
          netPositionCents: 0,
          direction: 'SETTLED_FLAT',
        });
      }
    }
    netTransfers = directionalTransfers.filter((t) => t.direction !== 'SETTLED_FLAT');
  } else {
    // Default: debtor_creditor greedy matching
    const debtors: Array<{ id: string; amount: number }> = [];
    const creditors: Array<{ id: string; amount: number }> = [];

    for (const [id, net] of Object.entries(netPositions)) {
      if (net < 0) {
        debtors.push({ id, amount: Math.abs(net) });
      } else if (net > 0) {
        creditors.push({ id, amount: net });
      }
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const bilateralTransfers: BilateralNetTransfer[] = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const settle = Math.min(debtors[dIdx].amount, creditors[cIdx].amount);
      if (settle > 0) {
        bilateralTransfers.push({
          from: debtors[dIdx].id,
          to: creditors[cIdx].id,
          currency,
          amountCents: settle,
        });
        netSettlementVolumeCents += settle;
        debtors[dIdx].amount -= settle;
        creditors[cIdx].amount -= settle;
      }
      if (debtors[dIdx].amount === 0) dIdx++;
      if (creditors[cIdx].amount === 0) cIdx++;
    }
    netTransfers = bilateralTransfers;
  }

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

  let solutionHash: string;
  if (config.solutionHashFn) {
    solutionHash = config.solutionHashFn(solutionContext);
  } else {
    const prefix = config.hashPrefix ?? 'NET_GRAPH';
    solutionHash = createHash('sha256')
      .update(`${prefix}:${shardCount}:${grossVolumeCents}:${netSettlementVolumeCents}:${compressionRatioPct}:${netTransfers.length}`)
      .digest('hex');
  }

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
