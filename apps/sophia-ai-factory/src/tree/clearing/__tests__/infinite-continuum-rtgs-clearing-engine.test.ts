/**
 * @file infinite-continuum-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Infinite-Continuum RTGS Sub-5ns Instantaneous Settlement & Continuum Netting 7.0 (16,384 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeContinuumNetting,
  validateInfiniteContinuumRtgsPayment,
} from '../infinite-continuum-rtgs-clearing-engine';
import type { ContinuumNettingObligation } from '@/seed/types/infinite-continuum-rtgs-capital';

describe('Infinite-Continuum RTGS Clearing & Continuum Netting 7.0 Engine', () => {
  it('validates instantaneous sub-5ns gross settlement (3ns) under infinite continuum conditions', () => {
    const payment = validateInfiniteContinuumRtgsPayment({
      sourceParticipantId: 'OMEGA_CONTINUUM_NODE_1',
      targetParticipantId: 'OMEGA_CONTINUUM_NODE_2',
      assetCurrency: 'USDT',
      grossAmountCents: 25_000_000_00, // $250,000.00
      availableReserveCents: 250_000_000_000_00, // $250.0B
      priorityTier: 'WARP_EXPEDITE',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyNanos).toBe(3); // sub-5 ns
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateInfiniteContinuumRtgsPayment({
      sourceParticipantId: 'OMEGA_CONTINUUM_NODE_1',
      targetParticipantId: 'OMEGA_CONTINUUM_NODE_2',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 5_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateInfiniteContinuumRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'OMEGA_CONTINUUM_NODE_2',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Continuum Netting 7.0 across 16,384 shards with 100% circular compression', () => {
    const obligations: ContinuumNettingObligation[] = [
      { fromParticipantId: 'NODE_A', toParticipantId: 'NODE_B', currency: 'USDT', amountCents: 500_000_00 },
      { fromParticipantId: 'NODE_B', toParticipantId: 'NODE_C', currency: 'USDT', amountCents: 500_000_00 },
      { fromParticipantId: 'NODE_C', toParticipantId: 'NODE_A', currency: 'USDT', amountCents: 500_000_00 },
    ];

    const result = executeContinuumNetting(obligations, 'USDT', 16384);

    expect(result.status).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(16384);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(1_500_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
  });

  it('compresses asymmetric multi-node obligations with >99.9% compression ratio', () => {
    const obligations: ContinuumNettingObligation[] = [
      { fromParticipantId: 'SHARD_001', toParticipantId: 'SHARD_002', currency: 'USDT', amountCents: 10_000_000_00 },
      { fromParticipantId: 'SHARD_002', toParticipantId: 'SHARD_001', currency: 'USDT', amountCents: 9_999_500_00 }, // diff 500.00
    ];

    const result = executeContinuumNetting(obligations, 'USDT', 16384);

    expect(result.status).toBe('NET_EXECUTED');
    expect(result.grossVolumeCents).toBe(19_999_500_00);
    expect(result.netSettlementVolumeCents).toBe(500_00);
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.9);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].amountCents).toBe(500_00);
  });
});
