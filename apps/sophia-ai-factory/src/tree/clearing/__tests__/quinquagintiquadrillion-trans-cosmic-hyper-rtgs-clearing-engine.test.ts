/**
 * @file quinquagintiquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Quinquaginti-Quadrillion Hyper-RTGS Sub-0.001ps Settlement (0.0005 ps) & Zero-Entropy Netting 23.0 (1,073,741,824 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeQuinquagintiquadrillionMultiverseNetting,
  validateQuinquagintiquadrillionHyperRtgsPayment,
} from '../quinquagintiquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { QuinquagintiquadrillionNettingObligation } from '@/seed/types/quinquagintiquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Quinquaginti-Quadrillion Hyper-RTGS Clearing & Netting 23.0 Engine', () => {
  it('validates instantaneous sub-0.001ps gross settlement (0.0005 ps / 500 attoseconds) under Quinquaginti-Quadrillion conditions', () => {
    const payment = validateQuinquagintiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'QUINQUAGINTIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'QUINQUAGINTIQUADRILLION_NODE_BETA',
      assetCurrency: 'QUINQUAGINTIQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 500_000_000_00, // $500,000,000.00
      availableReserveCents: 5_000_000_000_000_000_000, // $50.0Q
      priorityTier: 'QUINQUAGINTIQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.0005); // 0.0005 ps < 0.001 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateQuinquagintiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'QUINQUAGINTIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'QUINQUAGINTIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 500_000_000_00,
      availableReserveCents: 50_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateQuinquagintiquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'QUINQUAGINTIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 23.0 across 1,073,741,824 shards with 100% circular compression', () => {
    const obligations: QuinquagintiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'QUINQUAGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 500_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'QUINQUAGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 500_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'QUINQUAGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 500_000_000_00 },
    ];

    const result = executeQuinquagintiquadrillionMultiverseNetting(obligations);

    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(1500_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.hyperShardCount).toBe(1073741824); // 2^30
    expect(result.netTransfers.length).toBe(0);
  });

  it('resolves partial bilateral imbalances with optimal net liquidity routing', () => {
    const obligations: QuinquagintiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'QUINQUAGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 500_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_1', currency: 'QUINQUAGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 499_999_999_99 },
    ];

    const result = executeQuinquagintiquadrillionMultiverseNetting(obligations);

    expect(result.grossVolumeCents).toBe(999_999_999_99);
    expect(result.netSettlementVolumeCents).toBe(1);
    expect(result.compressionRatioPct).toBeGreaterThan(99.9999999);
    expect(result.netTransfers.length).toBe(1);
    expect(result.netTransfers[0].amountCents).toBe(1);
  });
});
