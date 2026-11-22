/**
 * Track B1.1 — Explicit MCU & Provider Authorization Contract Tests (G4).
 *
 * Verifies:
 * - Fixture runs charge 0 MCU and never touch MCU ledger or provider calls.
 * - Live inference is fail-closed when disabled, unauthorized, or lacking funds.
 * - Live inference settles idempotently and releases/refunds on failure.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  executeWithMcuAuthorization,
  FIXTURE_ZERO_MCU_ACCOUNTING_REF,
  type McuAuthorizationPort,
} from '@/tree/first-value/mcu-authorization-contract';

function createMockMcuPort(overrides: Partial<McuAuthorizationPort> = {}): McuAuthorizationPort {
  return {
    lookupReservation: vi.fn(async () => null),
    precheckBalance: vi.fn(async ({ requiredMcu }) => ({
      sufficient: true,
      availableMcu: requiredMcu + 10,
      requiredMcu,
      checkedAtIso: '2026-11-22T00:00:00.000Z',
    })),
    reserve: vi.fn(async ({ amountMcu }) => ({
      reserved: true as const,
      reservationId: 'res_001',
      amountMcu,
    })),
    settle: vi.fn(async ({ reservationId }) => ({
      settled: true,
      accountingRef: `mcu_settle_${reservationId}`,
      idempotentReplay: false,
    })),
    release: vi.fn(async () => ({
      released: true,
      idempotentReplay: false,
    })),
    ...overrides,
  };
}

describe('G4 MCU & Provider Authorization Contract', () => {
  it('charges 0 MCU and invokes zero provider/ledger methods for fixture runs', async () => {
    const mcuPort = createMockMcuPort();
    const runLiveProvider = vi.fn(async () => 'should-not-run');

    const res = await executeWithMcuAuthorization({
      provenance: 'fixture_simulated',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_1',
      idempotencyKey: 'idem-fixture-1',
      requiredMcu: 5,
      liveInferenceEnabled: false,
      providerAuthorized: false,
      mcuPort,
      runFixture: async () => 'fixture-script',
      runLiveProvider,
    });

    expect(res).toEqual({
      ok: true,
      output: 'fixture-script',
      mcuCharged: 0,
      accountingRef: FIXTURE_ZERO_MCU_ACCOUNTING_REF,
      paidInferenceExecuted: false,
    });
    expect(runLiveProvider).not.toHaveBeenCalled();
    expect(mcuPort.lookupReservation).not.toHaveBeenCalled();
    expect(mcuPort.precheckBalance).not.toHaveBeenCalled();
    expect(mcuPort.reserve).not.toHaveBeenCalled();
    expect(mcuPort.settle).not.toHaveBeenCalled();
  });

  it('blocks live provider when liveInferenceEnabled is false or authorization is missing', async () => {
    const mcuPort = createMockMcuPort();
    const runLiveProvider = vi.fn(async () => 'live');

    const disabled = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_2',
      idempotencyKey: 'idem-live-disabled',
      requiredMcu: 2,
      liveInferenceEnabled: false,
      providerAuthorized: true,
      mcuPort,
      runFixture: async () => 'fixture',
      runLiveProvider,
    });
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) expect(disabled.code).toBe('LIVE_INFERENCE_DISABLED');

    const unauthorized = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_3',
      idempotencyKey: 'idem-live-unauth',
      requiredMcu: 2,
      liveInferenceEnabled: true,
      providerAuthorized: false,
      mcuPort,
      runFixture: async () => 'fixture',
      runLiveProvider,
    });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) expect(unauthorized.code).toBe('PROVIDER_AUTHORIZATION_REQUIRED');
    expect(runLiveProvider).not.toHaveBeenCalled();
  });

  it('never invokes provider when balance precheck or reservation fails', async () => {
    const runLiveProvider = vi.fn(async () => 'live');
    const lowBalancePort = createMockMcuPort({
      precheckBalance: vi.fn(async ({ requiredMcu }) => ({
        sufficient: false,
        availableMcu: 0,
        requiredMcu,
        checkedAtIso: '2026-11-22T00:00:00.000Z',
      })),
    });

    const insufficient = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_4',
      idempotencyKey: 'idem-low-bal',
      requiredMcu: 5,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort: lowBalancePort,
      runFixture: async () => 'fixture',
      runLiveProvider,
    });
    expect(insufficient.ok).toBe(false);
    if (!insufficient.ok) expect(insufficient.code).toBe('MCU_INSUFFICIENT');
    expect(lowBalancePort.reserve).not.toHaveBeenCalled();
    expect(runLiveProvider).not.toHaveBeenCalled();
  });

  it('releases/refunds reservation when live provider fails and settles on success', async () => {
    const mcuPort = createMockMcuPort();
    const failRes = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_5',
      idempotencyKey: 'idem-fail-refund',
      requiredMcu: 3,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort,
      runFixture: async () => 'fixture',
      runLiveProvider: async () => {
        throw new Error('PROVIDER_502');
      },
    });
    expect(failRes).toEqual({
      ok: false,
      code: 'PROVIDER_EXECUTION_FAILED',
      error: 'Provider execution failed; MCU reservation released',
      mcuCharged: 0,
      released: true,
      providerExecuted: false,
      reservationId: 'res_001',
      reconciliationStatus: 'released',
    });
    expect(mcuPort.release).toHaveBeenCalledTimes(1);
    expect(mcuPort.settle).not.toHaveBeenCalled();

    const okRes = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_6',
      idempotencyKey: 'idem-ok-settle',
      requiredMcu: 3,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort,
      runFixture: async () => 'fixture',
      runLiveProvider: async () => 'live-script',
    });
    expect(okRes).toEqual({
      ok: true,
      output: 'live-script',
      mcuCharged: 3,
      accountingRef: 'mcu_settle_res_001',
      reservationId: 'res_001',
      paidInferenceExecuted: true,
    });
    expect(mcuPort.settle).toHaveBeenCalledTimes(1);
  });

  it('retains reservation with durable reference when settlement fails or returns settled:false', async () => {
    const throwingSettlePort = createMockMcuPort({
      settle: vi.fn(async () => {
        throw new Error('D1_TRANSIENT_SETTLE_ERROR');
      }),
    });

    const settleThrowRes = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_7',
      idempotencyKey: 'idem-settle-throw',
      requiredMcu: 4,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort: throwingSettlePort,
      runFixture: async () => 'fixture',
      runLiveProvider: async () => 'live-output',
    });

    expect(settleThrowRes.ok).toBe(false);
    if (!settleThrowRes.ok) {
      expect(settleThrowRes.code).toBe('MCU_SETTLEMENT_FAILED');
      expect(settleThrowRes.mcuCharged).toBeNull();
      expect(settleThrowRes.released).toBe(false);
      expect(settleThrowRes.providerExecuted).toBe(true);
      expect(settleThrowRes.reservationId).toBe('res_001');
      expect(settleThrowRes.reconciliationStatus).toBe('settlement_uncertain');
    }
    expect(throwingSettlePort.release).not.toHaveBeenCalled();

    const unconfirmedSettlePort = createMockMcuPort({
      settle: vi.fn(async () => ({
        settled: false,
        accountingRef: 'pending',
        idempotentReplay: false,
      })),
    });

    const unconfirmedRes = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_8',
      idempotencyKey: 'idem-settle-false',
      requiredMcu: 4,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort: unconfirmedSettlePort,
      runFixture: async () => 'fixture',
      runLiveProvider: async () => 'live-output',
    });

    expect(unconfirmedRes.ok).toBe(false);
    if (!unconfirmedRes.ok) {
      expect(unconfirmedRes.code).toBe('MCU_SETTLEMENT_FAILED');
      expect(unconfirmedRes.mcuCharged).toBeNull();
      expect(unconfirmedRes.released).toBe(false);
      expect(unconfirmedRes.providerExecuted).toBe(true);
      expect(unconfirmedRes.reservationId).toBe('res_001');
      expect(unconfirmedRes.reconciliationStatus).toBe('settlement_uncertain');
    }
    expect(unconfirmedSettlePort.release).not.toHaveBeenCalled();
  });

  it('prevents provider re-execution, release, and duplicate settlement on retry after ack failure or concurrent isolates', async () => {
    interface LedgerRow {
      orgId: string;
      reservationId: string;
      status: 'in_flight' | 'settlement_pending' | 'settled';
      accountingRef?: string;
    }
    const ledger = new Map<string, LedgerRow>();
    // Exact-balance tenant ledger: reserving 5 MCU drops org_a available balance to 0
    const balances = new Map<string, number>([
      ['org_a', 5],
      ['org_b', 0],
    ]);
    let seq = 0;
    const providerSpy = vi.fn(async () => 'paid-output');
    const releaseSpy = vi.fn(async () => ({ released: true, idempotentReplay: false }));
    const settleSpy = vi.fn(
      async ({ orgId, reservationId, idempotencyKey }: { orgId: string; reservationId: string; idempotencyKey: string }) => {
        const key = `${orgId}:${idempotencyKey}`;
        const row = ledger.get(key);
        if (!row || row.orgId !== orgId || row.reservationId !== reservationId) {
          throw new Error('TENANT_OR_RESERVATION_MISMATCH');
        }
        // Case 5: ledger commits settlement, then ack throws over the wire
        row.status = 'settled';
        row.accountingRef = `acc_${reservationId}`;
        throw new Error('ACK_TIMEOUT_AFTER_LEDGER_COMMIT');
      },
    );

    const sharedPort: McuAuthorizationPort = {
      lookupReservation: vi.fn(async ({ orgId, idempotencyKey }) => {
        const existing = ledger.get(`${orgId}:${idempotencyKey}`);
        if (!existing) return null;
        if (existing.status === 'settled') {
          return {
            status: 'settled' as const,
            reservationId: existing.reservationId,
            accountingRef: existing.accountingRef ?? 'unknown',
          };
        }
        return {
          status: existing.status,
          reservationId: existing.reservationId,
        };
      }),
      precheckBalance: vi.fn(async ({ orgId, requiredMcu }) => {
        const availableMcu = balances.get(orgId) ?? 0;
        return {
          sufficient: availableMcu >= requiredMcu,
          availableMcu,
          requiredMcu,
          checkedAtIso: '2026-11-22T00:00:00.000Z',
        };
      }),
      reserve: vi.fn(async ({ orgId, idempotencyKey, amountMcu }) => {
        const key = `${orgId}:${idempotencyKey}`;
        const existing = ledger.get(key);
        if (existing) {
          if (existing.status === 'settled') {
            return {
              reserved: false as const,
              reason: 'already_settled' as const,
              reservationId: existing.reservationId,
              accountingRef: existing.accountingRef ?? 'unknown',
            };
          }
          return {
            reserved: false as const,
            reason: existing.status,
            reservationId: existing.reservationId,
          };
        }
        const available = balances.get(orgId) ?? 0;
        if (available < amountMcu) {
          return { reserved: false as const, reason: 'insufficient_funds' as const };
        }
        balances.set(orgId, available - amountMcu);
        seq += 1;
        const reservationId = `res_shared_${seq}`;
        ledger.set(key, { orgId, reservationId, status: 'in_flight' });
        return { reserved: true as const, reservationId, amountMcu };
      }),
      settle: settleSpy,
      release: releaseSpy,
    };

    // Case 5 + 7: Two concurrent isolates submit the same (org_a, idem-ack-lost)
    const [first, second] = await Promise.all([
      executeWithMcuAuthorization({
        provenance: 'live_provider',
        orgId: 'org_a',
        userId: 'user_a',
        missionId: 'm_9',
        idempotencyKey: 'idem-ack-lost',
        requiredMcu: 5,
        liveInferenceEnabled: true,
        providerAuthorized: true,
        mcuPort: sharedPort,
        runFixture: async () => 'fixture',
        runLiveProvider: providerSpy,
      }),
      executeWithMcuAuthorization({
        provenance: 'live_provider',
        orgId: 'org_a',
        userId: 'user_a',
        missionId: 'm_9',
        idempotencyKey: 'idem-ack-lost',
        requiredMcu: 5,
        liveInferenceEnabled: true,
        providerAuthorized: true,
        mcuPort: sharedPort,
        runFixture: async () => 'fixture',
        runLiveProvider: providerSpy,
      }),
    ]);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    if (!first.ok) {
      expect(first.code).toBe('MCU_SETTLEMENT_FAILED');
      expect(first.mcuCharged).toBeNull();
      expect(first.reservationId).toBe('res_shared_1');
      expect(first.released).toBe(false);
    }
    if (!second.ok) {
      expect(second.code).toBe('MCU_RECONCILIATION_REQUIRED');
      expect(second.mcuCharged).toBeNull();
      expect(second.reservationId).toBe('res_shared_1');
      expect(second.released).toBe(false);
    }
    expect(balances.get('org_a')).toBe(0);
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(settleSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).not.toHaveBeenCalled();

    // Case 6: Client retries when remaining balance is 0 after ledger committed -> still returns MCU_ALREADY_SETTLED
    const retryAfterAckFail = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_a',
      userId: 'user_a',
      missionId: 'm_9',
      idempotencyKey: 'idem-ack-lost',
      requiredMcu: 5,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort: sharedPort,
      runFixture: async () => 'fixture',
      runLiveProvider: providerSpy,
    });
    expect(retryAfterAckFail.ok).toBe(false);
    if (!retryAfterAckFail.ok) {
      expect(retryAfterAckFail.code).toBe('MCU_ALREADY_SETTLED');
      expect(retryAfterAckFail.mcuCharged).toBeNull();
      expect(retryAfterAckFail.reservationId).toBe('res_shared_1');
      expect(retryAfterAckFail.accountingRef).toBe('acc_res_shared_1');
      expect(retryAfterAckFail.reconciliationStatus).toBe('settled_requires_result_lookup');
    }
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(settleSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).not.toHaveBeenCalled();

    // Cross-tenant isolation: org_b using same idempotencyKey cannot reconcile org_a's reservation
    ledger.set('org_b:idem-ack-lost', {
      orgId: 'org_b',
      reservationId: 'res_org_b_only',
      status: 'settlement_pending',
    });
    const orgBRetry = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_b',
      userId: 'user_b',
      missionId: 'm_9',
      idempotencyKey: 'idem-ack-lost',
      requiredMcu: 5,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort: sharedPort,
      runFixture: async () => 'fixture',
      runLiveProvider: providerSpy,
    });
    expect(orgBRetry.ok).toBe(false);
    if (!orgBRetry.ok) {
      expect(orgBRetry.code).toBe('MCU_RECONCILIATION_REQUIRED');
      expect(orgBRetry.reservationId).toBe('res_org_b_only');
      expect(orgBRetry.reservationId).not.toBe('res_shared_1');
    }
    expect(providerSpy).toHaveBeenCalledTimes(1);
  });

  it('returns MCU_RESERVATION_DENIED without throwing when ledger storage errors occur during pre-check or reserve', async () => {
    const runLiveProvider = vi.fn(async () => 'live');
    const throwingPort = createMockMcuPort({
      lookupReservation: vi.fn(async () => {
        throw new Error('D1_READ_TIMEOUT');
      }),
    });

    const res = await executeWithMcuAuthorization({
      provenance: 'live_provider',
      orgId: 'org_1',
      userId: 'user_1',
      missionId: 'm_10',
      idempotencyKey: 'idem-storage-err',
      requiredMcu: 5,
      liveInferenceEnabled: true,
      providerAuthorized: true,
      mcuPort: throwingPort,
      runFixture: async () => 'fixture',
      runLiveProvider,
    });
    expect(res).toEqual({
      ok: false,
      code: 'MCU_RESERVATION_DENIED',
      error: 'MCU reservation denied: storage_error',
      mcuCharged: 0,
      released: false,
      providerExecuted: false,
      reconciliationStatus: 'not_applicable',
    });
    expect(runLiveProvider).not.toHaveBeenCalled();
  });
});
