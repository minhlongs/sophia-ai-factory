/**
 * @file hyper-rtgs-domain-engine.test.ts
 * @layer tree/clearing
 * @description Unit tests for canonical Hyper-RTGS Domain Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  validateParameterizedRtgsPayment,
  executeParameterizedMultilateralNetting,
  type NettingObligation,
} from '../hyper-rtgs-domain-engine';

describe('HyperRtgsDomainEngine (Canonical Parameterized Clearing Engine)', () => {
  it('validates a valid RTGS payment with positive amount and sufficient reserves', () => {
    const result = validateParameterizedRtgsPayment(
      {
        sourceParticipantId: 'BANK_ALPHA',
        targetParticipantId: 'BANK_BETA',
        assetCurrency: 'USDT',
        grossAmountCents: 50_000_00,
        availableReserveCents: 100_000_00,
      },
      {
        latency: 5,
        latencyKey: 'executionLatencyNanos',
        hashPrefix: 'CANONICAL_RTGS',
      }
    );

    expect(result.valid).toBe(true);
    expect(result.status).toBe('FINALIZED_IRREVOCABLE');
    expect(result.executionLatencyNanos).toBe(5);
    expect(result.receiptHash).toHaveLength(64);
  });

  it('rejects RTGS payments with non-positive amount', () => {
    const result = validateParameterizedRtgsPayment(
      {
        sourceParticipantId: 'BANK_ALPHA',
        targetParticipantId: 'BANK_BETA',
        assetCurrency: 'USDT',
        grossAmountCents: 0,
        availableReserveCents: 100_000_00,
      },
      { latency: 5 }
    );

    expect(result.valid).toBe(false);
    expect(result.status).toBe('REJECTED_LIQUIDITY');
  });

  it('rejects RTGS payments when reserve is insufficient', () => {
    const result = validateParameterizedRtgsPayment(
      {
        sourceParticipantId: 'BANK_ALPHA',
        targetParticipantId: 'BANK_BETA',
        assetCurrency: 'USDT',
        grossAmountCents: 200_000_00,
        availableReserveCents: 50_000_00,
      },
      { latency: 5 }
    );

    expect(result.valid).toBe(false);
    expect(result.status).toBe('REJECTED_LIQUIDITY');
    expect(result.error).toContain('Insufficient reserve');
  });

  it('executes bilateral/multilateral graph netting with 100% compression on circular debts', () => {
    const obligations: NettingObligation[] = [
      { fromParticipantId: 'A', toParticipantId: 'B', amountCents: 1000 },
      { fromParticipantId: 'B', toParticipantId: 'C', amountCents: 1000 },
      { fromParticipantId: 'C', toParticipantId: 'A', amountCents: 1000 },
    ];

    const result = executeParameterizedMultilateralNetting(obligations, {
      currency: 'USDT',
      hyperShardCount: 64,
      transferFormat: 'debtor_creditor',
    });

    expect(result.status).toBe('NET_EXECUTED');
    expect(result.grossVolumeCents).toBe(3000);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.graphSolutionHash).toBeDefined();
  });

  it('executes directional format netting cleanly', () => {
    const obligations: NettingObligation[] = [
      { fromParticipantId: 'A', toParticipantId: 'B', amountCents: 500 },
      { fromParticipantId: 'C', toParticipantId: 'B', amountCents: 500 },
    ];

    const result = executeParameterizedMultilateralNetting(obligations, {
      currency: 'USDT',
      hyperShardCount: 128,
      transferFormat: 'directional',
    });

    expect(result.status).toBe('NET_EXECUTED');
    expect(result.grossVolumeCents).toBe(1000);
    expect(result.netPositions['B']).toBe(1000);
    expect(result.netPositions['A']).toBe(-500);
    expect(result.netPositions['C']).toBe(-500);
  });
});
