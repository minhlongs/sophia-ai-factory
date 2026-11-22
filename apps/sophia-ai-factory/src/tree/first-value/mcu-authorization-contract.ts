/**
 * Explicit MCU & Provider Authorization Contract for First-Value Execution (G4).
 *
 * Invariants preserved for B1.1 and future live inference:
 * 1. Fixture runs (`provenance: 'fixture_simulated'`) ALWAYS charge 0 MCU and
 *    NEVER invoke a provider or touch MCU reservations.
 * 2. Live inference (`provenance: 'live_provider'`) is fail-closed unless
 *    explicitly enabled AND authorized AND pre-checked with sufficient tenant
 *    balance AND reserved before any provider call occurs.
 * 3. Settlement is idempotent per `(orgId, reservationId, idempotencyKey)`.
 * 4. Any provider execution failure triggers deterministic refund/release.
 *
 * @module tree/first-value/mcu-authorization-contract
 */

import type { ScriptProvenance } from '@/tree/first-value/first-value-contract';

export const FIXTURE_ZERO_MCU_ACCOUNTING_REF = 'fixture:zero_mcu' as const;

export interface McuBalancePrecheckResult {
  readonly sufficient: boolean;
  readonly availableMcu: number;
  readonly requiredMcu: number;
  readonly checkedAtIso: string;
}

export type McuReservationResult =
  | { readonly reserved: true; readonly reservationId: string; readonly amountMcu: number }
  | {
      readonly reserved: false;
      readonly reason: 'already_settled';
      readonly reservationId: string;
      readonly accountingRef: string;
    }
  | {
      readonly reserved: false;
      readonly reason: 'settlement_pending' | 'in_flight';
      readonly reservationId: string;
    }
  | {
      readonly reserved: false;
      readonly reason: 'insufficient_funds' | 'tenant_mismatch' | 'storage_error';
    };

export interface McuSettlementResult {
  readonly settled: boolean;
  readonly accountingRef: string;
  readonly idempotentReplay: boolean;
}

export interface McuReleaseResult {
  readonly released: boolean;
  readonly idempotentReplay: boolean;
}

/**
 * Authoritative MCU ledger port for future live-inference execution.
 * Every operation is tenant-scoped (`orgId`, `userId`) and idempotent.
 */
export interface McuAuthorizationPort {
  precheckBalance(args: {
    readonly orgId: string;
    readonly userId: string;
    readonly requiredMcu: number;
  }): Promise<McuBalancePrecheckResult>;

  reserve(args: {
    readonly orgId: string;
    readonly userId: string;
    readonly missionId: string;
    readonly idempotencyKey: string;
    readonly amountMcu: number;
  }): Promise<McuReservationResult>;

  settle(args: {
    readonly orgId: string;
    readonly userId: string;
    readonly reservationId: string;
    readonly idempotencyKey: string;
    readonly actualMcu: number;
  }): Promise<McuSettlementResult>;

  release(args: {
    readonly orgId: string;
    readonly userId: string;
    readonly reservationId: string;
    readonly idempotencyKey: string;
    readonly reason: string;
  }): Promise<McuReleaseResult>;
}

export type AuthorizedExecutionErrorCode =
  | 'LIVE_INFERENCE_DISABLED'
  | 'PROVIDER_AUTHORIZATION_REQUIRED'
  | 'MCU_INSUFFICIENT'
  | 'MCU_RESERVATION_DENIED'
  | 'MCU_ALREADY_SETTLED'
  | 'MCU_RECONCILIATION_REQUIRED'
  | 'PROVIDER_EXECUTION_FAILED'
  | 'MCU_SETTLEMENT_FAILED';

export type McuReconciliationStatus =
  | 'not_applicable'
  | 'released'
  | 'release_pending'
  | 'settlement_uncertain'
  | 'settled_requires_result_lookup';

export type AuthorizedExecutionOutcome<T> =
  | {
      readonly ok: true;
      readonly output: T;
      readonly mcuCharged: number;
      readonly accountingRef: string;
      readonly reservationId?: string;
      readonly paidInferenceExecuted: boolean;
    }
  | {
      readonly ok: false;
      readonly code: AuthorizedExecutionErrorCode;
      readonly error: string;
      readonly mcuCharged: 0;
      readonly released: boolean;
      readonly providerExecuted?: boolean;
      readonly reservationId?: string;
      readonly accountingRef?: string;
      readonly reconciliationStatus?: McuReconciliationStatus;
    };

export interface ExecuteWithMcuAuthInput<T> {
  readonly provenance: ScriptProvenance;
  readonly orgId: string;
  readonly userId: string;
  readonly missionId: string;
  readonly idempotencyKey: string;
  readonly requiredMcu: number;
  readonly liveInferenceEnabled: boolean;
  readonly providerAuthorized: boolean;
  readonly mcuPort?: McuAuthorizationPort;
  readonly runFixture: () => Promise<T>;
  readonly runLiveProvider?: () => Promise<T>;
}

function mapReservationDenied<T>(
  reservation: Extract<McuReservationResult, { readonly reserved: false }>,
): AuthorizedExecutionOutcome<T> {
  if (reservation.reason === 'already_settled') {
    return {
      ok: false,
      code: 'MCU_ALREADY_SETTLED',
      error: 'Idempotency key already settled; refusing to re-execute paid provider',
      mcuCharged: 0,
      released: false,
      providerExecuted: true,
      reservationId: reservation.reservationId,
      accountingRef: reservation.accountingRef,
      reconciliationStatus: 'settled_requires_result_lookup',
    };
  }
  if (reservation.reason === 'settlement_pending' || reservation.reason === 'in_flight') {
    return {
      ok: false,
      code: 'MCU_RECONCILIATION_REQUIRED',
      error: `Reservation ${reservation.reservationId} is ${reservation.reason}; refusing to re-execute paid provider`,
      mcuCharged: 0,
      released: false,
      providerExecuted: true,
      reservationId: reservation.reservationId,
      reconciliationStatus: 'settlement_uncertain',
    };
  }
  return {
    ok: false,
    code: 'MCU_RESERVATION_DENIED',
    error: `MCU reservation denied: ${reservation.reason}`,
    mcuCharged: 0,
    released: false,
    providerExecuted: false,
    reconciliationStatus: 'not_applicable',
  };
}

async function releaseOnProviderFailure<T>(
  mcuPort: McuAuthorizationPort,
  input: ExecuteWithMcuAuthInput<T>,
  reservationId: string,
): Promise<AuthorizedExecutionOutcome<T>> {
  let released = false;
  try {
    const releaseRes = await mcuPort.release({
      orgId: input.orgId,
      userId: input.userId,
      reservationId,
      idempotencyKey: input.idempotencyKey,
      reason: 'provider_execution_failed',
    });
    released = releaseRes.released;
  } catch {
    released = false;
  }
  return {
    ok: false,
    code: 'PROVIDER_EXECUTION_FAILED',
    error: released
      ? 'Provider execution failed; MCU reservation released'
      : 'Provider execution failed; MCU reservation release pending reconciliation',
    mcuCharged: 0,
    released,
    providerExecuted: false,
    reservationId,
    reconciliationStatus: released ? 'released' : 'release_pending',
  };
}

async function settleCompletedExecution<T>(
  mcuPort: McuAuthorizationPort,
  input: ExecuteWithMcuAuthInput<T>,
  reservation: Extract<McuReservationResult, { readonly reserved: true }>,
  output: T,
): Promise<AuthorizedExecutionOutcome<T>> {
  try {
    const settlement = await mcuPort.settle({
      orgId: input.orgId,
      userId: input.userId,
      reservationId: reservation.reservationId,
      idempotencyKey: input.idempotencyKey,
      actualMcu: reservation.amountMcu,
    });
    if (!settlement.settled) {
      return {
        ok: false,
        code: 'MCU_SETTLEMENT_FAILED',
        error: 'Provider succeeded but MCU settlement did not confirm; reservation retained for reconciliation',
        mcuCharged: 0,
        released: false,
        providerExecuted: true,
        reservationId: reservation.reservationId,
        reconciliationStatus: 'settlement_uncertain',
      };
    }
    return {
      ok: true,
      output,
      mcuCharged: reservation.amountMcu,
      accountingRef: settlement.accountingRef,
      reservationId: reservation.reservationId,
      paidInferenceExecuted: true,
    };
  } catch {
    return {
      ok: false,
      code: 'MCU_SETTLEMENT_FAILED',
      error: 'Provider succeeded but MCU settlement failed; reservation retained for reconciliation',
      mcuCharged: 0,
      released: false,
      providerExecuted: true,
      reservationId: reservation.reservationId,
      reconciliationStatus: 'settlement_uncertain',
    };
  }
}

/**
 * Executes either a zero-MCU fixture run or a strictly guarded live-provider run.
 * Guarantees zero provider invocation when authorization or funds are insufficient,
 * automatic reservation release on provider failure, and retained reservation with
 * durable reconciliation reference when settlement fails or is unconfirmed.
 */
export async function executeWithMcuAuthorization<T>(
  input: ExecuteWithMcuAuthInput<T>,
): Promise<AuthorizedExecutionOutcome<T>> {
  if (input.provenance === 'fixture_simulated') {
    const output = await input.runFixture();
    return {
      ok: true,
      output,
      mcuCharged: 0,
      accountingRef: FIXTURE_ZERO_MCU_ACCOUNTING_REF,
      paidInferenceExecuted: false,
    };
  }

  if (!input.liveInferenceEnabled) {
    return {
      ok: false,
      code: 'LIVE_INFERENCE_DISABLED',
      error: 'Live provider inference is disabled in B1.1',
      mcuCharged: 0,
      released: false,
    };
  }

  if (!input.providerAuthorized || !input.runLiveProvider || !input.mcuPort) {
    return {
      ok: false,
      code: 'PROVIDER_AUTHORIZATION_REQUIRED',
      error: 'Explicit provider authorization and MCU ledger port are required',
      mcuCharged: 0,
      released: false,
    };
  }

  const precheck = await input.mcuPort.precheckBalance({
    orgId: input.orgId,
    userId: input.userId,
    requiredMcu: input.requiredMcu,
  });
  if (!precheck.sufficient) {
    return {
      ok: false,
      code: 'MCU_INSUFFICIENT',
      error: `Insufficient MCU balance (${precheck.availableMcu} < ${precheck.requiredMcu})`,
      mcuCharged: 0,
      released: false,
    };
  }

  const reservation = await input.mcuPort.reserve({
    orgId: input.orgId,
    userId: input.userId,
    missionId: input.missionId,
    idempotencyKey: input.idempotencyKey,
    amountMcu: input.requiredMcu,
  });
  if (!reservation.reserved) {
    return mapReservationDenied(reservation);
  }

  let output: T;
  try {
    output = await input.runLiveProvider();
  } catch {
    return releaseOnProviderFailure(input.mcuPort, input, reservation.reservationId);
  }

  return settleCompletedExecution(input.mcuPort, input, reservation, output);
}
