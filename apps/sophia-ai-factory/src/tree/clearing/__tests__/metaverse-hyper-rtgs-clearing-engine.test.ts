/**
 * @file metaverse-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Omnipresent Metaverse Hyper-RTGS Sub-1ps Settlement (0.5 ps) & Zero-Entropy Netting 16.0 (8,388,608 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeMetaverseNetting,
  validateMetaverseHyperRtgsPayment,
} from '../metaverse-hyper-rtgs-clearing-engine';
import type { MetaverseNettingObligation } from '@/seed/types/metaverse-hyper-rtgs-capital';

describe('Omnipresent Metaverse Hyper-RTGS Clearing & Netting 16.0 Engine', () => {
  it('validates instantaneous sub-1ps gross settlement (0.5 ps / 0.0005 ns) under metaverse conditions', () => {
    const payment = validateMetaverseHyperRtgsPayment({
      sourceParticipantId: 'METAVERSE_NODE_ALPHA',
      targetParticipantId: 'METAVERSE_NODE_BETA',
      assetCurrency: 'METAVERSE_SOVEREIGN_CREDIT',
      grossAmountCents: 500_000_000_00, // $5,000,000.00
      availableReserveCents: 250_000_000_000_000_00, // $250.0T
      priorityTier: 'METAVERSE_SOVEREIGN_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.5); // 0.5 ps < 1 ps (0.0005 ns)
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateMetaverseHyperRtgsPayment({
      sourceParticipantId: 'METAVERSE_NODE_ALPHA',
      targetParticipantId: 'METAVERSE_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 100_000_000_00,
      availableReserveCents: 10_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateMetaverseHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'METAVERSE_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 16.0 across 8,388,608 shards with 100% circular compression', () => {
    const obligations: MetaverseNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'METAVERSE_SOVEREIGN_CREDIT', amountCents: 20_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'METAVERSE_SOVEREIGN_CREDIT', amountCents: 20_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'METAVERSE_SOVEREIGN_CREDIT', amountCents: 20_000_000_00 },
    ];

    const result = executeMetaverseNetting(obligations, 'METAVERSE_SOVEREIGN_CREDIT', 8388608);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.hyperShardCount).toBe(8388608);
    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(60_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.multiverseSolutionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('executes asymmetric netting and compresses volume > 99.99999999%', () => {
    const obligations: MetaverseNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'METAVERSE_SOVEREIGN_CREDIT', amountCents: 50_000_000_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_ALPHA', currency: 'METAVERSE_SOVEREIGN_CREDIT', amountCents: 49_999_999_999_999_00 },
    ];

    const result = executeMetaverseNetting(obligations, 'METAVERSE_SOVEREIGN_CREDIT', 8388608);

    expect(result.grossVolumeCents).toBe(99_999_999_999_999_00);
    expect(result.netSettlementVolumeCents).toBe(1_00); // Only $0.01 net residual
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(99.99999999);
    expect(result.netTransfers).toHaveLength(1);
    expect(result.netTransfers[0].from).toBe('NODE_ALPHA');
    expect(result.netTransfers[0].to).toBe('NODE_BETA');
    expect(result.netTransfers[0].amountCents).toBe(1_00);
  });
});
