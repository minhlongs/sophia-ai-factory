/**
 * Parameterized validator for RTGS settlement across arbitrary scale tiers
 *
 * @module tree/clearing/hyper-rtgs/payment-validator
 */

import { createHash } from 'node:crypto';
import type {
  RtgsPaymentValidationParams,
  RtgsPaymentEngineConfig,
  RtgsPaymentValidationResult,
  RtgsViolation,
} from './types';

export function initRtgsBaseResult(config: RtgsPaymentEngineConfig): Partial<RtgsPaymentValidationResult> {
  const latency = config.latency ?? 0;
  const rejectStatus = config.rejectStatus ?? 'REJECTED_LIQUIDITY';
  const baseResult: Partial<RtgsPaymentValidationResult> = {
    valid: false,
    status: rejectStatus,
  };
  if (config.latencyKey === 'executionLatencyNanos' || (!config.latencyKey && latency > 0)) {
    baseResult.executionLatencyNanos = latency;
  } else if (config.latencyKey === 'executionLatencyPicoseconds') {
    baseResult.executionLatencyPicoseconds = latency;
  }
  return baseResult;
}

export function checkRtgsParticipants(
  params: RtgsPaymentValidationParams,
  config: RtgsPaymentEngineConfig,
): RtgsViolation | null {
  if (config.requireParticipants !== false && (!params.sourceParticipantId || !params.targetParticipantId)) {
    const receiptHash = config.errorHashFn
      ? config.errorHashFn('INVALID_PARTICIPANTS', params, config.latency ?? 0)
      : createHash('sha256').update('INVALID_PARTICIPANTS').digest('hex');
    return {
      error: 'Source and target participants must be specified',
      reason: 'Source and target participants must be specified',
      receiptHash,
    };
  }
  return null;
}

export function checkRtgsAmountAndSelf(
  params: RtgsPaymentValidationParams,
  config: RtgsPaymentEngineConfig,
): RtgsViolation | null {
  const latency = config.latency ?? 0;
  if (params.grossAmountCents <= 0) {
    const receiptHash = config.errorHashFn
      ? config.errorHashFn('NON_POSITIVE_AMOUNT', params, latency)
      : createHash('sha256').update(`REJECTED_INVALID_AMOUNT:${params.sourceParticipantId}:${params.grossAmountCents}`).digest('hex');
    return {
      error: 'Gross amount must be strictly positive',
      reason: 'Gross settlement amount must be strictly positive',
      receiptHash,
    };
  }
  if (!config.allowSelfSettlement && params.sourceParticipantId === params.targetParticipantId) {
    const receiptHash = config.errorHashFn
      ? config.errorHashFn('SELF_SETTLEMENT', params, latency)
      : createHash('sha256').update(`REJECTED_SELF_SETTLEMENT:${params.sourceParticipantId}`).digest('hex');
    return {
      error: 'Source and target participants cannot be identical in RTGS',
      reason: 'Source and target participants cannot be identical in RTGS',
      receiptHash,
    };
  }
  return null;
}

export function checkRtgsReserves(
  params: RtgsPaymentValidationParams,
  config: RtgsPaymentEngineConfig,
): RtgsViolation | null {
  if (params.availableReserveCents < params.grossAmountCents) {
    const latency = config.latency ?? 0;
    const receiptHash = config.errorHashFn
      ? config.errorHashFn('RESERVE_DEFICIT', params, latency)
      : createHash('sha256').update(`RESERVE_DEFICIT:${params.availableReserveCents}:${params.grossAmountCents}`).digest('hex');
    const reason = config.reserveDeficitReasonFn
      ? config.reserveDeficitReasonFn(params)
      : `Available reserve ${params.availableReserveCents} cents insufficient for gross requirement ${params.grossAmountCents} cents`;
    return {
      error: `Insufficient reserve: required ${params.grossAmountCents} cents, available ${params.availableReserveCents} cents`,
      reason,
      receiptHash,
    };
  }
  return null;
}

export function generateFinalizedRtgsHash(
  params: RtgsPaymentValidationParams,
  config: RtgsPaymentEngineConfig,
): string {
  const latency = config.latency ?? 0;
  if (config.receiptHashFn) {
    return config.receiptHashFn(params, latency);
  }
  const prefix = config.hashPrefix ?? 'FINALIZED_RTGS';
  return createHash('sha256')
    .update(`${prefix}:${params.sourceParticipantId}:${params.targetParticipantId}:${params.assetCurrency}:${params.grossAmountCents}:${latency}`)
    .digest('hex');
}

/**
 * Parameterized validator for RTGS settlement across arbitrary scale tiers.
 */
export function validateParameterizedRtgsPayment(
  params: RtgsPaymentValidationParams,
  config: RtgsPaymentEngineConfig,
): RtgsPaymentValidationResult {
  const baseResult = initRtgsBaseResult(config);
  const rejectStatus = config.rejectStatus ?? 'REJECTED_LIQUIDITY';

  const violation =
    checkRtgsParticipants(params, config) ||
    checkRtgsAmountAndSelf(params, config) ||
    checkRtgsReserves(params, config);

  if (violation) {
    return {
      ...baseResult,
      valid: false,
      status: rejectStatus,
      receiptHash: violation.receiptHash,
      error: violation.error,
      reason: violation.reason,
    };
  }

  return {
    ...baseResult,
    valid: true,
    status: 'FINALIZED_IRREVOCABLE',
    receiptHash: generateFinalizedRtgsHash(params, config),
  };
}
