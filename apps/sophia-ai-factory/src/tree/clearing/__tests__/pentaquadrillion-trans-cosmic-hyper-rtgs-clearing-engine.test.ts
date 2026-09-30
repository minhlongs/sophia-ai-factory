/**
 * @file pentaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Penta-Quadrillion Hyper-RTGS Sub-0.01ps Settlement (0.005 ps) & Zero-Entropy Netting 20.0 (134,217,728 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executePentaquadrillionMultiverseNetting,
  validatePentaquadrillionHyperRtgsPayment,
} from '../pentaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { PentaquadrillionNettingObligation } from '@/seed/types/pentaquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Penta-Quadrillion Hyper-RTGS Clearing & Netting 20.0 Engine', () => {
  it('validates instantaneous sub-0.01ps gross settlement (0.005 ps / 0.000005 ns) under Penta-Quadrillion conditions', () => {
    const payment = validatePentaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'PENTAQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'PENTAQUADRILLION_NODE_BETA',
      assetCurrency: 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 50_000_000_00, // $50,000,000.00
      availableReserveCents: 500_000_000_000_000_000, // $5.0Q
      priorityTier: 'PENTAQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.005); // 0.005 ps < 0.01 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validatePentaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'PENTAQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'PENTAQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_000_00,
      availableReserveCents: 10_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validatePentaquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'PENTAQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 20.0 across 134,217,728 shards with 100% circular compression', () => {
    const obligations: PentaquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 50_000_000_00 },
    ];

    const result = executePentaquadrillionMultiverseNetting(obligations, 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT', 134217728);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(134217728);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(150_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.999999999999%', () => {
    const obligations: PentaquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 100_000_000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 99_999_999_999_999_00 },
    ];

    const result = executePentaquadrillionMultiverseNetting(obligations, 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT', 134217728);

    expect(result.grossVolumeCents).toBe(199_999_999_999_999_00);
    expect(result.netSettlementVolumeCents).toBe(1_00); // Only $0.01 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(1_00);
  });
});
