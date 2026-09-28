/**
 * @file omnipresent-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Omnipresent Hyper-RTGS Sub-1ns Settlement (800 ps) & Multiverse Netting 8.0 (32,768 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeMultiverseNetting,
  validateOmnipresentHyperRtgsPayment,
} from '../omnipresent-hyper-rtgs-clearing-engine';
import type { MultiverseNettingObligation } from '@/seed/types/omnipresent-hyper-rtgs-capital';

describe('Omnipresent Hyper-RTGS Clearing & Multiverse Netting 8.0 Engine', () => {
  it('validates instantaneous sub-1ns gross settlement (800 ps) under omnipresent multiverse conditions', () => {
    const payment = validateOmnipresentHyperRtgsPayment({
      sourceParticipantId: 'MULTIVERSE_NODE_ALPHA',
      targetParticipantId: 'MULTIVERSE_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 50_000_000_00, // $500,000.00
      availableReserveCents: 500_000_000_000_00, // $500.0B
      priorityTier: 'OMNIPRESENT_EXPEDITE',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(800); // 800 ps < 1000 ps (0.8 ns < 1.0 ns)
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateOmnipresentHyperRtgsPayment({
      sourceParticipantId: 'MULTIVERSE_NODE_ALPHA',
      targetParticipantId: 'MULTIVERSE_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 2_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateOmnipresentHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'MULTIVERSE_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Netting 8.0 across 32,768 shards with 100% circular compression', () => {
    const obligations: MultiverseNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 1_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'USDT', amountCents: 1_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 1_000_000_00 },
    ];

    const result = executeMultiverseNetting(obligations, 'USDT', 32768);

    expect(result.status).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(32768);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(3_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
  });

  it('compresses asymmetric multi-shard obligations with >99.99% compression ratio', () => {
    const obligations: MultiverseNettingObligation[] = [
      { fromParticipantId: 'SHARD_0001', toParticipantId: 'SHARD_0002', currency: 'USDT', amountCents: 50_000_000_00 },
      { fromParticipantId: 'SHARD_0002', toParticipantId: 'SHARD_0001', currency: 'USDT', amountCents: 49_999_900_00 }, // diff 100.00
    ];

    const result = executeMultiverseNetting(obligations, 'USDT', 32768);

    expect(result.status).toBe('NET_EXECUTED');
    expect(result.grossVolumeCents).toBe(99_999_900_00);
    expect(result.netSettlementVolumeCents).toBe(100_00);
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.99);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].amountCents).toBe(100_00);
  });
});
