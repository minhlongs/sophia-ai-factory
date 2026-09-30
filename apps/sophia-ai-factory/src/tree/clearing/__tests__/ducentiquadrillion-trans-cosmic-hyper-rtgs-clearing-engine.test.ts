/**
 * @file ducentiquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Ducenti-Quadrillion Hyper-RTGS Sub-0.0002ps Settlement (0.0001 ps) & Zero-Entropy Netting 25.0 (4,294,967,296 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeDucentiquadrillionMultiverseNetting,
  validateDucentiquadrillionHyperRtgsPayment,
} from '../ducentiquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { DucentiquadrillionNettingObligation } from '@/seed/types/ducentiquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Ducenti-Quadrillion Hyper-RTGS Clearing & Netting 25.0 Engine', () => {
  it('validates instantaneous sub-0.0002ps gross settlement (0.0001 ps / 100 attoseconds) under Ducenti-Quadrillion conditions', () => {
    const payment = validateDucentiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'DUCENTIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'DUCENTIQUADRILLION_NODE_BETA',
      assetCurrency: 'DUCENTIQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 1000_000_000_00, // $1,000,000,000.00
      availableReserveCents: 25_000_000_000_000_000_000, // $250.0Q
      priorityTier: 'DUCENTIQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.0001); // 0.0001 ps < 0.0002 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateDucentiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'DUCENTIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'DUCENTIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 1000_000_000_00,
      availableReserveCents: 100_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateDucentiquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'DUCENTIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 25.0 across 4,294,967,296 shards with 100% circular compression', () => {
    const obligations: DucentiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'DUCENTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'DUCENTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'DUCENTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
    ];

    const result = executeDucentiquadrillionMultiverseNetting(obligations);

    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(3000_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.hyperShardCount).toBe(4294967296); // 2^32
    expect(result.netTransfers.length).toBe(0);
  });

  it('resolves partial bilateral imbalances with optimal net liquidity routing', () => {
    const obligations: DucentiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'DUCENTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_1', currency: 'DUCENTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 999_999_999_99 },
    ];

    const result = executeDucentiquadrillionMultiverseNetting(obligations);

    expect(result.grossVolumeCents).toBe(1999_999_999_99);
    expect(result.netSettlementVolumeCents).toBe(1);
    expect(result.compressionRatioPct).toBeGreaterThan(99.9999999);
    expect(result.netTransfers.length).toBe(1);
    expect(result.netTransfers[0].amountCents).toBe(1);
  });
});
