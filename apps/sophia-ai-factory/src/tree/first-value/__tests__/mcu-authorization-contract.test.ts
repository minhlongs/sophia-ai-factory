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
      paidInferenceExecuted: true,
    });
    expect(mcuPort.settle).toHaveBeenCalledTimes(1);
  });
});
