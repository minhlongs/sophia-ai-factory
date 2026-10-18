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
} from './types';
import {
  checkRtgsParticipants,
  checkRtgsAmountAndSelf,
  checkRtgsReserves,
} from './payment-validator-checks';

export {
  checkRtgsParticipants,
  checkRtgsAmountAndSelf,
  checkRtgsReserves,
};

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
