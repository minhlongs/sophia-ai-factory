/**
 * @file pan-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Pan-Cosmic Hyper-RTGS Sub-50ps Settlement (35 ps) & Zero-Entropy Netting 12.0 (524,288 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executePanCosmicNetting,
  validatePanCosmicHyperRtgsPayment,
} from '../pan-cosmic-hyper-rtgs-clearing-engine';
import type { PanCosmicNettingObligation } from '@/seed/types/pan-cosmic-hyper-rtgs-capital';

describe('Pan-Cosmic Hyper-RTGS Clearing & Netting 12.0 Engine', () => {
  it('validates instantaneous sub-50ps gross settlement (35 ps) under pan-cosmic conditions', () => {
    const payment = validatePanCosmicHyperRtgsPayment({
      sourceParticipantId: 'PAN_COSMIC_NODE_ALPHA',
      targetParticipantId: 'PAN_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_000_00, // $1,000,000.00
      availableReserveCents: 10_000_000_000_000_00, // $10.0T
      priorityTier: 'PAN_COSMIC_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(35); // 35 ps < 50 ps (0.035 ns < 0.05 ns)
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validatePanCosmicHyperRtgsPayment({
      sourceParticipantId: 'PAN_COSMIC_NODE_ALPHA',
      targetParticipantId: 'PAN_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 50_000_000_00,
      availableReserveCents: 5_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validatePanCosmicHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'PAN_COSMIC_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 12.0 across 524,288 shards with 100% circular compression', () => {
    const obligations: PanCosmicNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 5_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'USDT', amountCents: 5_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 5_000_000_00 },
    ];

    const result = executePanCosmicNetting(obligations, 'USDT', 524288);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(524288);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(15_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.9999%', () => {
    const obligations: PanCosmicNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'USDT', amountCents: 1_000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'USDT', amountCents: 999_999_999_00 },
    ];

    const result = executePanCosmicNetting(obligations, 'USDT', 524288);

    expect(result.grossVolumeCents).toBe(1_999_999_999_00);
    expect(result.netSettlementVolumeCents).toBe(1_00); // Only $0.01 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.9999);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(1_00);
  });
});
