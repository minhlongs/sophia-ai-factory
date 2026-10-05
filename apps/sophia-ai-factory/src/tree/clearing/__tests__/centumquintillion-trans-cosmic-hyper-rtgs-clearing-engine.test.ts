/**
 * @file centumquintillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Centum-Quintillion Hyper-RTGS & Omniverse Netting 40.0 Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  executeCentumquintillionOmniverseNetting,
  validateCentumquintillionHyperRtgsPayment,
} from '../centumquintillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { CentumquintillionNettingObligation } from '@/seed/types/centumquintillion-trans-cosmic-hyper-rtgs-capital';

describe('Centum-Quintillion Hyper-RTGS & Omniverse Netting 40.0 Engine', () => {
  it('validates and clears instantaneous Centum-Quintillion transaction with sub-0.00000005 ps latency', () => {
    const result = validateCentumquintillionHyperRtgsPayment({
      sourceParticipantId: 'acc-centum-prime',
      targetParticipantId: 'acc-centum-counterparty',
      assetCurrency: 'CENTUMQUINTILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 100_000_000_000_000,
      availableReserveCents: 100_000_000_000_000_000_000_000, // $1,000,000.0Q
      priorityTier: 'CENTUMQUINTILLION_SINGULARITY',
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe('FINALIZED_IRREVOCABLE');
    expect(result.executionLatencyPicoseconds).toBeLessThanOrEqual(0.00000005);
    expect(result.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects transaction when liquidity reserve is deficient', () => {
    const result = validateCentumquintillionHyperRtgsPayment({
      sourceParticipantId: 'acc-centum-deficit',
      targetParticipantId: 'acc-centum-counterparty',
      assetCurrency: 'CENTUMQUINTILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 100_000_000_000_000,
      availableReserveCents: 10_000_000,
      priorityTier: 'STANDARD_CENTUMQUINTILLION',
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe('REJECTED_LIQUIDITY');
    expect(result.error).toContain('Insufficient reserve');
  });

  it('compresses circular debt network to 100% efficiency via Omniverse Netting 40.0 across 8,796,093,022,208 shards', () => {
    const obligations: CentumquintillionNettingObligation[] = [
      {
        fromParticipantId: 'agent-1',
        toParticipantId: 'agent-2',
        currency: 'CENTUMQUINTILLION_TRANS_COSMIC_CREDIT',
        amountCents: 2_000_000_000_000,
      },
      {
        fromParticipantId: 'agent-2',
        toParticipantId: 'agent-3',
        currency: 'CENTUMQUINTILLION_TRANS_COSMIC_CREDIT',
        amountCents: 2_000_000_000_000,
      },
      {
        fromParticipantId: 'agent-3',
        toParticipantId: 'agent-1',
        currency: 'CENTUMQUINTILLION_TRANS_COSMIC_CREDIT',
        amountCents: 2_000_000_000_000,
      },
    ];

    const result = executeCentumquintillionOmniverseNetting(obligations);
    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netSettlementVolumeCents).toBe(0);
    expect(result.netTransfers).toHaveLength(0);
    expect(result.hyperShardCount).toBe(8_796_093_022_208);
  });
});
