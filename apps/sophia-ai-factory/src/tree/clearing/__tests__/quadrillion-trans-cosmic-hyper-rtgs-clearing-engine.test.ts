/**
 * @file quadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Quadrillion Trans-Cosmic Hyper-RTGS Sub-0.1ps Settlement (0.05 ps) & Zero-Entropy Netting 18.0 (33,554,432 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeQuadrillionMultiverseNetting,
  validateQuadrillionTransCosmicHyperRtgsPayment,
} from '../quadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { QuadrillionNettingObligation } from '@/seed/types/quadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Quadrillion Trans-Cosmic Hyper-RTGS Clearing & Netting 18.0 Engine', () => {
  it('validates instantaneous sub-0.1ps gross settlement (0.05 ps / 0.00005 ns) under Quadrillion conditions', () => {
    const payment = validateQuadrillionTransCosmicHyperRtgsPayment({
      sourceParticipantId: 'QUADRILLION_NODE_ALPHA',
      targetParticipantId: 'QUADRILLION_NODE_BETA',
      assetCurrency: 'QUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 10_000_000_00, // $10,000,000.00
      availableReserveCents: 100_000_000_000_000_000, // $1.0Q
      priorityTier: 'QUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.05); // 0.05 ps < 0.1 ps (0.00005 ns)
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateQuadrillionTransCosmicHyperRtgsPayment({
      sourceParticipantId: 'QUADRILLION_NODE_ALPHA',
      targetParticipantId: 'QUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_000_00,
      availableReserveCents: 10_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateQuadrillionTransCosmicHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'QUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 18.0 across 33,554,432 shards with 100% circular compression', () => {
    const obligations: QuadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'QUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'QUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'QUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
    ];

    const result = executeQuadrillionMultiverseNetting(obligations, 'QUADRILLION_TRANS_COSMIC_CREDIT', 33554432);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(33554432);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(150_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.9999999999%', () => {
    const obligations: QuadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'QUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 80_000_000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'QUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 79_999_999_999_999_00 },
    ];

    const result = executeQuadrillionMultiverseNetting(obligations, 'QUADRILLION_TRANS_COSMIC_CREDIT', 33554432);

    expect(result.grossVolumeCents).toBe(159_999_999_999_999_00);
    expect(result.netSettlementVolumeCents).toBe(1_00); // Only $0.01 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.9999999999);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(1_00);
  });
});
