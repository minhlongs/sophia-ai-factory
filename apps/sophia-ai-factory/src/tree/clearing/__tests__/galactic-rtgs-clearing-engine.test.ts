/**
 * @file galactic-rtgs-clearing-engine.test.ts
 * @layer tree/clearing
 * @description Unit tests for Galactic-RTGS quantum clearing and Fractal Multilateral Netting 4.0.
 */

import { describe, it, expect } from 'vitest';
import {
  validateGalacticRtgsPayment,
  executeFractalMultilateralNetting,
} from '../galactic-rtgs-clearing-engine';
import type { FractalNettingObligation } from '@/seed/types/galactic-rtgs-capital';

describe('GalacticRtgsClearingEngine', () => {
  it('validates sub-100ns atomic gross settlement and produces cryptographic receipt', () => {
    const result = validateGalacticRtgsPayment({
      sourceParticipantId: 'MILKY_WAY_CORE_VAULT',
      targetParticipantId: 'ANDROMEDA_SETTLEMENT_HUB',
      assetCurrency: 'USDT',
      grossAmountCents: 1_000_000_000_00, // $1.0B
      availableReserveCents: 25_000_000_000_00, // $25B
      priorityTier: 'QUANTUM_EXPEDITE',
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe('FINALIZED_IRREVOCABLE');
    expect(result.executionLatencyNanos).toBe(95); // 95 ns < 100 ns
    expect(result.receiptHash).toHaveLength(64);
  });

  it('rejects invalid non-positive amounts and reserve shortages', () => {
    const nonPositive = validateGalacticRtgsPayment({
      sourceParticipantId: 'P1',
      targetParticipantId: 'P2',
      assetCurrency: 'USDT',
      grossAmountCents: 0,
      availableReserveCents: 100_000,
    });
    expect(nonPositive.valid).toBe(false);
    expect(nonPositive.reason).toContain('must be strictly positive');

    const shortReserve = validateGalacticRtgsPayment({
      sourceParticipantId: 'P1',
      targetParticipantId: 'P2',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_00,
      availableReserveCents: 50_000_00,
    });
    expect(shortReserve.valid).toBe(false);
    expect(shortReserve.reason).toContain('insufficient for gross requirement');
  });

  it('compresses circular fractal debt flows with 100% compression', () => {
    const obligations: FractalNettingObligation[] = [
      { fromParticipantId: 'SHARD_1', toParticipantId: 'SHARD_2', currency: 'USDT', amountCents: 2_500_000_00 },
      { fromParticipantId: 'SHARD_2', toParticipantId: 'SHARD_3', currency: 'USDT', amountCents: 2_500_000_00 },
      { fromParticipantId: 'SHARD_3', toParticipantId: 'SHARD_1', currency: 'USDT', amountCents: 2_500_000_00 },
    ];

    const netting = executeFractalMultilateralNetting(obligations, 'USDT', 256);
    expect(netting.status).toBe('NET_EXECUTED');
    expect(netting.hierarchicalShardCount).toBe(256);
    expect(netting.grossVolumeCents).toBe(7_500_000_00);
    expect(netting.netSettlementVolumeCents).toBe(0);
    expect(netting.compressionRatioPct).toBe(100.0);
    expect(netting.netTransfers).toHaveLength(0);
    expect(netting.fractalSolutionHash).toHaveLength(64);
  });
});
