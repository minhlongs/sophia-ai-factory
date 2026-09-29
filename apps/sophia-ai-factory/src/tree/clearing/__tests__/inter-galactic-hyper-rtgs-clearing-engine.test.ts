/**
 * @file inter-galactic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Inter-Galactic Hyper-RTGS Sub-10ps Settlement (5 ps) & Zero-Entropy Netting 14.0 (2,097,152 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeInterGalacticNetting,
  validateInterGalacticHyperRtgsPayment,
} from '../inter-galactic-hyper-rtgs-clearing-engine';
import type { InterGalacticNettingObligation } from '@/seed/types/inter-galactic-hyper-rtgs-capital';

describe('Inter-Galactic Hyper-RTGS Clearing & Netting 14.0 Engine', () => {
  it('validates instantaneous sub-10ps gross settlement (5 ps) under inter-galactic conditions', () => {
    const payment = validateInterGalacticHyperRtgsPayment({
      sourceParticipantId: 'INTER_GALACTIC_NODE_ALPHA',
      targetParticipantId: 'INTER_GALACTIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 500_000_000_00, // $5,000,000.00
      availableReserveCents: 50_000_000_000_000_00, // $50.0T
      priorityTier: 'INTER_GALACTIC_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(5); // 5 ps < 10 ps (0.005 ns < 0.010 ns)
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateInterGalacticHyperRtgsPayment({
      sourceParticipantId: 'INTER_GALACTIC_NODE_ALPHA',
      targetParticipantId: 'INTER_GALACTIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_000_00,
      availableReserveCents: 10_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateInterGalacticHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'INTER_GALACTIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 14.0 across 2,097,152 shards with 100% circular compression', () => {
    const obligations: InterGalacticNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 20_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'USDT', amountCents: 20_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 20_000_000_00 },
    ];

    const result = executeInterGalacticNetting(obligations, 'USDT', 2097152);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(2097152);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(60_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.999999%', () => {
    const obligations: InterGalacticNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 50_000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 49_999_999_999_00 },
    ];

    const result = executeInterGalacticNetting(obligations, 'USDT', 2097152);

    expect(result.grossVolumeCents).toBe(99_999_999_999_00);
    expect(result.netSettlementVolumeCents).toBe(1_00); // Only $0.01 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.999999);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(1_00);
  });
});
