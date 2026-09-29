/**
 * @file omni-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Omni-Cosmic Hyper-RTGS Sub-25ps Settlement (15 ps) & Zero-Entropy Netting 13.0 (1,048,576 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeOmniCosmicNetting,
  validateOmniCosmicHyperRtgsPayment,
} from '../omni-cosmic-hyper-rtgs-clearing-engine';
import type { OmniCosmicNettingObligation } from '@/seed/types/omni-cosmic-hyper-rtgs-capital';

describe('Omni-Cosmic Hyper-RTGS Clearing & Netting 13.0 Engine', () => {
  it('validates instantaneous sub-25ps gross settlement (15 ps) under omni-cosmic conditions', () => {
    const payment = validateOmniCosmicHyperRtgsPayment({
      sourceParticipantId: 'OMNI_COSMIC_NODE_ALPHA',
      targetParticipantId: 'OMNI_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 200_000_000_00, // $2,000,000.00
      availableReserveCents: 25_000_000_000_000_00, // $25.0T
      priorityTier: 'OMNI_COSMIC_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(15); // 15 ps < 25 ps (0.015 ns < 0.025 ns)
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateOmniCosmicHyperRtgsPayment({
      sourceParticipantId: 'OMNI_COSMIC_NODE_ALPHA',
      targetParticipantId: 'OMNI_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 50_000_000_00,
      availableReserveCents: 5_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateOmniCosmicHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'OMNI_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 13.0 across 1,048,576 shards with 100% circular compression', () => {
    const obligations: OmniCosmicNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 10_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'USDT', amountCents: 10_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 10_000_000_00 },
    ];

    const result = executeOmniCosmicNetting(obligations, 'USDT', 1048576);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(1048576);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(30_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.99999%', () => {
    const obligations: OmniCosmicNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 10_000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 9_999_999_999_00 },
    ];

    const result = executeOmniCosmicNetting(obligations, 'USDT', 1048576);

    expect(result.grossVolumeCents).toBe(19_999_999_999_00);
    expect(result.netSettlementVolumeCents).toBe(1_00); // Only $0.01 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.99999);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(1_00);
  });
});
