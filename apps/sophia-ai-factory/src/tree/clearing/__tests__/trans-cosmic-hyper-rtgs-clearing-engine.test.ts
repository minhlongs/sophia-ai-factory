/**
 * @file trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Trans-Cosmic Hyper-RTGS Sub-500ps Settlement (350 ps) & Hyper Netting 9.0 (65,536 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeHyperNetting,
  validateTransCosmicHyperRtgsPayment,
} from '../trans-cosmic-hyper-rtgs-clearing-engine';
import type { HyperNettingObligation } from '@/seed/types/trans-cosmic-hyper-rtgs-capital';

describe('Trans-Cosmic Hyper-RTGS Clearing & Hyper Netting 9.0 Engine', () => {
  it('validates instantaneous sub-500ps gross settlement (350 ps) under trans-cosmic conditions', () => {
    const payment = validateTransCosmicHyperRtgsPayment({
      sourceParticipantId: 'TRANS_COSMIC_NODE_ALPHA',
      targetParticipantId: 'TRANS_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_000_00, // $1,000,000.00
      availableReserveCents: 1_000_000_000_000_00, // $1.0T
      priorityTier: 'TRANS_COSMIC_EXPEDITE',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(350); // 350 ps < 500 ps (0.35 ns < 0.5 ns)
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateTransCosmicHyperRtgsPayment({
      sourceParticipantId: 'TRANS_COSMIC_NODE_ALPHA',
      targetParticipantId: 'TRANS_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 50_000_000_00,
      availableReserveCents: 5_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateTransCosmicHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'TRANS_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Hyper Netting 9.0 across 65,536 shards with 100% circular compression', () => {
    const obligations: HyperNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 2_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'USDT', amountCents: 2_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 2_000_000_00 },
    ];

    const result = executeHyperNetting(obligations, 'USDT', 65536);

    expect(result.status).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(65536);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(6_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.995%', () => {
    const obligations: HyperNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 100_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 99_998_000_00 },
    ];

    const result = executeHyperNetting(obligations, 'USDT', 65536);

    expect(result.grossVolumeCents).toBe(199_998_000_00);
    expect(result.netSettlementVolumeCents).toBe(2_000_00); // Only $20.00 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.995);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(2_000_00);
  });
});
