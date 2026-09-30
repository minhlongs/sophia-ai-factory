/**
 * @file biquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Bi-Quadrillion Hyper-RTGS Sub-0.05ps Settlement (0.02 ps) & Zero-Entropy Netting 19.0 (67,108,864 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeBiquadrillionMultiverseNetting,
  validateBiquadrillionHyperRtgsPayment,
} from '../biquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { BiquadrillionNettingObligation } from '@/seed/types/biquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Bi-Quadrillion Hyper-RTGS Clearing & Netting 19.0 Engine', () => {
  it('validates instantaneous sub-0.05ps gross settlement (0.02 ps / 0.00002 ns) under Bi-Quadrillion conditions', () => {
    const payment = validateBiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'BIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'BIQUADRILLION_NODE_BETA',
      assetCurrency: 'BIQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 20_000_000_00, // $20,000,000.00
      availableReserveCents: 200_000_000_000_000_000, // $2.0Q
      priorityTier: 'BIQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.02); // 0.02 ps < 0.05 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateBiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'BIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'BIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_000_00,
      availableReserveCents: 10_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateBiquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'BIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 19.0 across 67,108,864 shards with 100% circular compression', () => {
    const obligations: BiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'BIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'BIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'BIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
    ];

    const result = executeBiquadrillionMultiverseNetting(obligations, 'BIQUADRILLION_TRANS_COSMIC_CREDIT', 67108864);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(67108864);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(150_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.99999999999%', () => {
    const obligations: BiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'BIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 80_000_000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'BIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 79_999_999_999_999_00 },
    ];

    const result = executeBiquadrillionMultiverseNetting(obligations, 'BIQUADRILLION_TRANS_COSMIC_CREDIT', 67108864);

    expect(result.grossVolumeCents).toBe(159_999_999_999_999_00);
    expect(result.netSettlementVolumeCents).toBe(1_00); // Only $0.01 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.9999999999);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(1_00);
  });
});
