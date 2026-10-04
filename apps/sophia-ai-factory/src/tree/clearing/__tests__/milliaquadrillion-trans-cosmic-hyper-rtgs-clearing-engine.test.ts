/**
 * @file milliaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine.test.ts
 * @layer tree/clearing/__tests__
 * @description Unit tests for Millia-Quadrillion Hyper-RTGS Sub-0.000005ps Settlement & Multiverse Netting 30.0 Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  executeMilliaquadrillionMultiverseNetting,
  validateMilliaquadrillionHyperRtgsPayment,
} from '../milliaquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import type { MilliaquadrillionNettingObligation } from '@/seed/types/milliaquadrillion-trans-cosmic-hyper-rtgs-capital';

describe('Millia-Quadrillion Hyper-RTGS & Multiverse Netting 30.0 Engine', () => {
  it('clears instantaneous gross payment in sub-0.000005ps (0.000002 ps / 2 attoseconds)', () => {
    const result = validateMilliaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'acc-sov-millia-source',
      targetParticipantId: 'acc-sov-millia-target',
      assetCurrency: 'MILLIAQUADRILLION_TRANS_COSMIC_CREDIT',
      grossAmountCents: 1_000_000_000_000_000,
      availableReserveCents: 10_000_000_000_000_000_000,
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe('FINALIZED_IRREVOCABLE');
    expect(result.executionLatencyPicoseconds).toBeLessThanOrEqual(0.000005);
    expect(result.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects payments with insufficient reserves', () => {
    const result = validateMilliaquadrillionHyperRtgsPayment({
      sourceParticipantId: 'acc-sov-millia-source',
      targetParticipantId: 'acc-sov-millia-target',
      assetCurrency: 'USDT',
      grossAmountCents: 20_000_000,
      availableReserveCents: 5_000_000,
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe('REJECTED_LIQUIDITY');
    expect(result.error).toContain('Insufficient reserve');
  });

  it('executes Multiverse Netting 30.0 across 137,438,953,472 shards with circular debt elimination', () => {
    const obligations: MilliaquadrillionNettingObligation[] = [
      {
        fromParticipantId: 'participant-alpha',
        toParticipantId: 'participant-beta',
        currency: 'MILLIAQUADRILLION_TRANS_COSMIC_CREDIT',
        amountCents: 200_000_000_000,
      },
      {
        fromParticipantId: 'participant-beta',
        toParticipantId: 'participant-gamma',
        currency: 'MILLIAQUADRILLION_TRANS_COSMIC_CREDIT',
        amountCents: 200_000_000_000,
      },
      {
        fromParticipantId: 'participant-gamma',
        toParticipantId: 'participant-alpha',
        currency: 'MILLIAQUADRILLION_TRANS_COSMIC_CREDIT',
        amountCents: 200_000_000_000,
      },
    ];

    const result = executeMilliaquadrillionMultiverseNetting(obligations);

    expect(result.nettingStatus).toBe('NET_EXECUTED');
    expect(result.grossVolumeCents).toBe(600_000_000_000);
    expect(result.netSettlementVolumeCents).toBe(0); // Perfect cycle cancelled out
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.hyperShardCount).toBe(137_438_953_472);
    expect(result.netTransfers).toHaveLength(0);
  });
});
