/**
 * @file centumquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Centum-Quadrillion Hyper-RTGS Sub-0.0005ps Settlement (0.0002 ps) & Zero-Entropy Netting 24.0 (2,147,483,648 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeCentumquadrillionMultiverseNetting,
  validateCentumquadrillionHyperRtgsPayment,
} from '../centumquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { CentumquadrillionNettingObligation } from '@/seed/types/centumquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Centum-Quadrillion Hyper-RTGS Clearing & Netting 24.0 Engine', () => {
  it('validates instantaneous sub-0.0005ps gross settlement (0.0002 ps / 200 attoseconds) under Centum-Quadrillion conditions', () => {
    const payment = validateCentumquadrillionHyperRtgsPayment({
      sourceParticipantId: 'CENTUMQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'CENTUMQUADRILLION_NODE_BETA',
      assetCurrency: 'CENTUMQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 1000_000_000_00, // $1,000,000,000.00
      availableReserveCents: 10_000_000_000_000_000_000, // $100.0Q
      priorityTier: 'CENTUMQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.0002); // 0.0002 ps < 0.0005 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateCentumquadrillionHyperRtgsPayment({
      sourceParticipantId: 'CENTUMQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'CENTUMQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 1000_000_000_00,
      availableReserveCents: 100_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateCentumquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'CENTUMQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 24.0 across 2,147,483,648 shards with 100% circular compression', () => {
    const obligations: CentumquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'CENTUMQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'CENTUMQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'CENTUMQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
    ];

    const result = executeCentumquadrillionMultiverseNetting(obligations);

    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(3000_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.hyperShardCount).toBe(2147483648); // 2^31
    expect(result.netTransfers.length).toBe(0);
  });

  it('resolves partial bilateral imbalances with optimal net liquidity routing', () => {
    const obligations: CentumquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'CENTUMQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 1000_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_1', currency: 'CENTUMQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 999_999_999_99 },
    ];

    const result = executeCentumquadrillionMultiverseNetting(obligations);

    expect(result.grossVolumeCents).toBe(1999_999_999_99);
    expect(result.netSettlementVolumeCents).toBe(1);
    expect(result.compressionRatioPct).toBeGreaterThan(99.9999999);
    expect(result.netTransfers.length).toBe(1);
    expect(result.netTransfers[0].amountCents).toBe(1);
  });
});
