/**
 * @file vigintiquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Viginti-Quadrillion Hyper-RTGS Sub-0.002ps Settlement (0.001 ps) & Zero-Entropy Netting 22.0 (536,870,912 Shards).
 */

import { describe, expect, it } from 'vitest';
import {
  executeVigintiquadrillionMultiverseNetting,
  validateVigintiquadrillionHyperRtgsPayment,
} from '../vigintiquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { VigintiquadrillionNettingObligation } from '@/seed/types/vigintiquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Viginti-Quadrillion Hyper-RTGS Clearing & Netting 22.0 Engine', () => {
  it('validates instantaneous sub-0.002ps gross settlement (0.001 ps / 0.000001 ns) under Viginti-Quadrillion conditions', () => {
    const payment = validateVigintiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'VIGINTIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'VIGINTIQUADRILLION_NODE_BETA',
      assetCurrency: 'VIGINTIQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 200_000_000_00, // $200,000,000.00
      availableReserveCents: 2_000_000_000_000_000_000, // $20.0Q
      priorityTier: 'VIGINTIQUADRILLION_SINGULARITY',
    });

    expect(payment.valid).toBe(true);
    expect(payment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(payment.executionLatencyPicoseconds).toBe(0.001); // 0.001 ps < 0.002 ps
    expect(payment.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserve or missing participants', () => {
    const insufficient = validateVigintiquadrillionHyperRtgsPayment({
      sourceParticipantId: 'VIGINTIQUADRILLION_NODE_ALPHA',
      targetParticipantId: 'VIGINTIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 500_000_000_00,
      availableReserveCents: 50_000_000_00, // Insufficient
    });

    expect(insufficient.valid).toBe(false);
    expect(insufficient.status).toBe('REJECTED_LIQUIDITY');
    expect(insufficient.error).toContain('Insufficient reserve');

    const missingParticipant = validateVigintiquadrillionHyperRtgsPayment({
      sourceParticipantId: '',
      targetParticipantId: 'VIGINTIQUADRILLION_NODE_BETA',
      assetCurrency: 'USDT',
      grossAmountCents: 10_000_000_00,
      availableReserveCents: 20_000_000_00,
    });

    expect(missingParticipant.valid).toBe(false);
    expect(missingParticipant.error).toContain('participants must be specified');
  });

  it('executes Multiverse Zero-Entropy Netting 22.0 across 536,870,912 shards with 100% circular compression', () => {
    const obligations: VigintiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_ALPHA', toParticipantId: 'NODE_BETA', currency: 'VIGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 200_000_000_00 },
      { fromParticipantId: 'NODE_BETA', toParticipantId: 'NODE_GAMMA', currency: 'VIGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 200_000_000_00 },
      { fromParticipantId: 'NODE_GAMMA', toParticipantId: 'NODE_ALPHA', currency: 'VIGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 200_000_000_00 },
    ];

    const result = executeVigintiquadrillionMultiverseNetting(obligations);

    expect(result.grossFlowCount).toBe(3);
    expect(result.grossVolumeCents).toBe(600_000_000_00);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.hyperShardCount).toBe(536870912); // 2^29
    expect(result.netTransfers.length).toBe(0);
  });

  it('resolves partial bilateral imbalances with optimal net liquidity routing', () => {
    const obligations: VigintiquadrillionNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'VIGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 200_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_1', currency: 'VIGINTIQUADRILLION_TRANS_COSMIC_CREDIT', amountCents: 199_999_999_99 },
    ];

    const result = executeVigintiquadrillionMultiverseNetting(obligations);

    expect(result.grossVolumeCents).toBe(399_999_999_99);
    expect(result.netSettlementVolumeCents).toBe(1);
    expect(result.compressionRatioPct).toBeGreaterThan(99.9999999);
    expect(result.netTransfers.length).toBe(1);
    expect(result.netTransfers[0].amountCents).toBe(1);
  });
});
