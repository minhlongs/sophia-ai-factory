/**
 * @file omniverse-rtgs-clearing-engine.test.ts
 * @layer tree/clearing
 * @description Unit tests for Omniverse-RTGS Planck clearing and Hyper-Dimensional Netting 5.0.
 */

import { describe, it, expect } from 'vitest';
import {
  validateOmniverseRtgsPayment,
  executeHyperDimensionalNetting,
} from '../omniverse-rtgs-clearing-engine';
import type { HyperDimensionalNettingObligation } from '@/seed/types/omniverse-rtgs-capital';

describe('OmniverseRtgsClearingEngine', () => {
  it('validates sub-30ns atomic gross settlement and produces cryptographic receipt', () => {
    const result = validateOmniverseRtgsPayment({
      sourceParticipantId: 'PRIME_UNIVERSE_CENTRAL_VAULT',
      targetParticipantId: 'DIMENSION_THETA_SETTLEMENT_HUB',
      assetCurrency: 'USDT',
      grossAmountCents: 2_500_000_000_00, // $2.5B
      availableReserveCents: 50_000_000_000_00, // $50B
      priorityTier: 'PLANCK_EXPEDITE',
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe('FINALIZED_IRREVOCABLE');
    expect(result.executionLatencyNanos).toBe(28); // 28 ns < 30 ns
    expect(result.receiptHash).toHaveLength(64);
  });

  it('rejects invalid non-positive amounts and reserve shortages', () => {
    const nonPositive = validateOmniverseRtgsPayment({
      sourceParticipantId: 'P1',
      targetParticipantId: 'P2',
      assetCurrency: 'USDT',
      grossAmountCents: 0,
      availableReserveCents: 100_000,
    });
    expect(nonPositive.valid).toBe(false);
    expect(nonPositive.reason).toContain('must be strictly positive');

    const shortReserve = validateOmniverseRtgsPayment({
      sourceParticipantId: 'P1',
      targetParticipantId: 'P2',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_00,
      availableReserveCents: 50_000_00,
    });
    expect(shortReserve.valid).toBe(false);
    expect(shortReserve.reason).toContain('insufficient for gross requirement');
  });

  it('compresses circular hyper-dimensional debt flows with 100% compression', () => {
    const obligations: HyperDimensionalNettingObligation[] = [
      { fromParticipantId: 'DIM_SHARD_1', toParticipantId: 'DIM_SHARD_2', currency: 'USDT', amountCents: 5_000_000_00 },
      { fromParticipantId: 'DIM_SHARD_2', toParticipantId: 'DIM_SHARD_3', currency: 'USDT', amountCents: 5_000_000_00 },
      { fromParticipantId: 'DIM_SHARD_3', toParticipantId: 'DIM_SHARD_1', currency: 'USDT', amountCents: 5_000_000_00 },
    ];

    const netting = executeHyperDimensionalNetting(obligations, 'USDT', 1024);
    expect(netting.status).toBe('NET_EXECUTED');
    expect(netting.multidimensionalShardCount).toBe(1024);
    expect(netting.grossVolumeCents).toBe(15_000_000_00);
    expect(netting.netSettlementVolumeCents).toBe(0);
    expect(netting.compressionRatioPct).toBe(100.0);
    expect(netting.netTransfers).toHaveLength(0);
    expect(netting.hyperDimensionalSolutionHash).toHaveLength(64);
  });
});
