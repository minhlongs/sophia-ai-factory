/**
 * @file hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing
 * @description Unit tests for Hyper-RTGS warp clearing and Distributed Multilateral Netting 3.0.
 */

import { describe, it, expect } from 'vitest';
import {
  validateHyperRtgsPayment,
  executeDistributedMultilateralNetting,
} from '../hyper-rtgs-clearing-engine';
import type { DistributedNettingObligation } from '@/seed/types/hyper-rtgs-capital';

describe('HyperRtgsClearingEngine', () => {
  it('validates sub-300ns atomic gross settlement and produces cryptographic receipt', () => {
    const result = validateHyperRtgsPayment({
      sourceParticipantId: 'ORBITAL_RESERVE_ALPHA',
      targetParticipantId: 'CENTAURI_SETTLEMENT_HUB',
      assetCurrency: 'USDT',
      grossAmountCents: 500_000_000_00, // $500M
      availableReserveCents: 10_000_000_000_00, // $10B
      priorityTier: 'WARP_EXPEDITE',
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe('FINALIZED_IRREVOCABLE');
    expect(result.executionLatencyNanos).toBe(280); // 280 ns < 300 ns
    expect(result.receiptHash).toHaveLength(64);
  });

  it('rejects invalid non-positive amounts and reserve shortages', () => {
    const nonPositive = validateHyperRtgsPayment({
      sourceParticipantId: 'P1',
      targetParticipantId: 'P2',
      assetCurrency: 'USDT',
      grossAmountCents: 0,
      availableReserveCents: 100_000,
    });
    expect(nonPositive.valid).toBe(false);
    expect(nonPositive.reason).toContain('must be strictly positive');

    const shortReserve = validateHyperRtgsPayment({
      sourceParticipantId: 'P1',
      targetParticipantId: 'P2',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_00,
      availableReserveCents: 50_000_00,
    });
    expect(shortReserve.valid).toBe(false);
    expect(shortReserve.reason).toContain('insufficient for gross requirement');
  });

  it('compresses circular distributed debt flows with >98% compression', () => {
    const obligations: DistributedNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'USDT', amountCents: 1_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_3', currency: 'USDT', amountCents: 1_000_000_00 },
      { fromParticipantId: 'NODE_3', toParticipantId: 'NODE_1', currency: 'USDT', amountCents: 1_000_000_00 },
    ];

    const netting = executeDistributedMultilateralNetting(obligations, 'USDT', 64);
    expect(netting.status).toBe('NET_EXECUTED');
    expect(netting.grossVolumeCents).toBe(3_000_000_00);
    expect(netting.netSettlementVolumeCents).toBe(0);
    expect(netting.compressionRatioPct).toBe(100.0);
    expect(netting.graphSolutionHash).toHaveLength(64);
  });
});
