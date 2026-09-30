/**
 * @file quinquagintaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Quinquaginta-Quadrillion Hyper-RTGS Sub-0.0001ps Settlement (0.00005 ps) & Zero-Entropy Netting 26.0 (8,589,934,592 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeQuinquagintaquadrillionMultiverseNetting,
  validateQuinquagintaquadrillionHyperRtgsPayment,
} from '../quinquagintaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { QuinquagintaquadrillionNettingObligation } from '@/seed/types/quinquagintaquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Quinquaginta-Quadrillion Hyper-RTGS Clearing & Netting 26.0 Engine', () => {
  it('validates instantaneous sub-0.0001ps gross settlement (0.00005 ps / 50 attoseconds) under Quinquaginta-Quadrillion conditions', () => {
    const payment = validateQuinquagintaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'QUINQUAGINTAQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'QUINQUAGINTAQUADRILLION_NODE_BETA',
      assetCurrency: 'QUINQUAGINTAQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 2000_000_000_00, // $2,000,000,000.00
      availableReserveCents: 50_000_000_000_000_000_000, // $500.0Q
      priorityTier: 'QUINQUAGINTAQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.00005); // 0.00005 ps < 0.0001 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateQuinquagintaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'QUINQUAGINTAQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'QUINQUAGINTAQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 1000_000_000_00,
      availableReserveCents: 100_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateQuinquagintaquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'QUINQUAGINTAQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 26.0 across 8,589,934,592 shards with 100% circular compression', () => {
    const obligations: QuinquagintaquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'QUINQUAGINTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 2000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'QUINQUAGINTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 2000_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'QUINQUAGINTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 2000_000_000_00 },
    ];

    const result = executeQuinquagintaquadrillionMultiverseNetting(obligations);

    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(6000_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.hyperShardCount).toBe(8589934592); // 2^33
    expect(result.netTransfers.length).toBe(0);
  });

  it('resolves partial bilateral imbalances with optimal net liquidity routing', () => {
    const obligations: QuinquagintaquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'QUINQUAGINTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 2000_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_1', currency: 'QUINQUAGINTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1999_999_999_99 },
    ];

    const result = executeQuinquagintaquadrillionMultiverseNetting(obligations);

    expect(result.grossVolumeCents).toBe(3999_999_999_99);
    expect(result.netSettlementVolumeCents).toBe(1);
    expect(result.compressionRatioPct).toBeGreaterThan(99.9999999);
    expect(result.netTransfers.length).toBe(1);
    expect(result.netTransfers[0].amountCents).toBe(1);
  });
});
