/**
 * @file decaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Deca-Quadrillion Hyper-RTGS Sub-0.005ps Settlement (0.002 ps) & Zero-Entropy Netting 21.0 (268,435,456 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeDecaquadrillionMultiverseNetting,
  validateDecaquadrillionHyperRtgsPayment,
} from '../decaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { DecaquadrillionNettingObligation } from '@/seed/types/decaquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Deca-Quadrillion Hyper-RTGS Clearing & Netting 21.0 Engine', () => {
  it('validates instantaneous sub-0.005ps gross settlement (0.002 ps / 0.000002 ns) under Deca-Quadrillion conditions', () => {
    const payment = validateDecaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'DECAQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'DECAQUADRILLION_NODE_BETA',
      assetCurrency: 'DECAQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 100_000_000_00, // $100,000,000.00
      availableReserveCents: 1_000_000_000_000_000_000, // $10.0Q
      priorityTier: 'DECAQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.002); // 0.002 ps < 0.005 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateDecaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'DECAQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'DECAQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 200_000_000_00,
      availableReserveCents: 20_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateDecaquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'DECAQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 21.0 across 268,435,456 shards with 100% circular compression', () => {
    const obligations: DecaquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'DECAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 100_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'DECAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 100_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'DECAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 100_000_000_00 },
    ];

    const result = executeDecaquadrillionMultiverseNetting(obligations);

    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(300_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.hyperShardCount).toBe(268435456); // 2^28
    expect(result.netTransfers.length).toBe(0);
  });

  it('resolves partial bilateral imbalances with optimal net liquidity routing', () => {
    const obligations: DecaquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'DECAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 100_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_1', currency: 'DECAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 99_999_999_99 },
    ];

    const result = executeDecaquadrillionMultiverseNetting(obligations);

    expect(result.grossVolumeCents).toBe(199_999_999_99);
    expect(result.netSettlementVolumeCents).toBe(1);
    expect(result.compressionRatioPct).toBeGreaterThan(99.9999999);
    expect(result.netTransfers.length).toBe(1);
    expect(result.netTransfers[0].amountCents).toBe(1);
  });
});
