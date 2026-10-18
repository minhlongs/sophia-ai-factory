/**
 * RTGS participant, amount, and reserve validation checks
 *
 * @module tree/clearing/hyper-rtgs/payment-validator-checks
 */

import { createHash } from 'node:crypto';
import type {
  RtgsPaymentValidationParams,
  RtgsPaymentEngineConfig,
  RtgsViolation,
} from './types';

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
