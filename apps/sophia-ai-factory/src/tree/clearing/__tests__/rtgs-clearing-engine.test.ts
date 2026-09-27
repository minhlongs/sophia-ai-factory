/**
 * @file rtgs-clearing-engine.test.ts
 * @description Unit tests for RTGS clearing and multilateral netting engine.
 */

import { describe, expect, it } from 'vitest';
import {
  executeMultilateralNetting,
  validateRtgsPayment,
} from '../rtgs-clearing-engine';
import type { NettingObligation } from '@/seed/types/omniversal-clearing';

describe('RTGS Clearing & Multilateral Netting Engine', () => {
  it('1. Validates RTGS gross settlement payments against liquidity reserves', () => {
    const validPayment = validateRtgsPayment({
      sourceParticipantId: 'BANK_NY',
      targetParticipantId: 'BANK_SG',
      assetCurrency: 'SSDR',
      grossAmountCents: 50_000_000_00, // $50M
      availableReserveCents: 100_000_000_00, // $100M
    });
    expect(validPayment.valid).toBe(true);
    expect(validPayment.status).toBe('FINALIZED_IRREVOCABLE');
    expect(validPayment.receiptHash).toHaveLength(64);

    // Insufficient liquidity rejection
    const rejectedPayment = validateRtgsPayment({
      sourceParticipantId: 'BANK_NY',
      targetParticipantId: 'BANK_SG',
      assetCurrency: 'SSDR',
      grossAmountCents: 50_000_000_00,
      availableReserveCents: 20_000_000_00, // only $20M
    });
    expect(rejectedPayment.valid).toBe(false);
    expect(rejectedPayment.status).toBe('REJECTED_INSUFFICIENT_LIQUIDITY');
  });

  it('2. Solves high-frequency multilateral netting matrix with > 90% compression', () => {
    // 4 participants with circular and reciprocal obligations
    const obligations: NettingObligation[] = [
      { fromParticipantId: 'P1', toParticipantId: 'P2', currency: 'SSDR', amountCents: 100_000_00 },
      { fromParticipantId: 'P2', toParticipantId: 'P3', currency: 'SSDR', amountCents: 95_000_00 },
      { fromParticipantId: 'P3', toParticipantId: 'P4', currency: 'SSDR', amountCents: 90_000_00 },
      { fromParticipantId: 'P4', toParticipantId: 'P1', currency: 'SSDR', amountCents: 85_000_00 },
      { fromParticipantId: 'P2', toParticipantId: 'P1', currency: 'SSDR', amountCents: 10_000_00 },
    ];

    const result = executeMultilateralNetting(obligations);
    expect(result.status).toBe('NET_EXECUTED');
    expect(result.grossVolumeCents).toBe(380_000_00);
    expect(result.netSettlementVolumeCents).toBeLessThan(result.grossVolumeCents);
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(90.0);
    expect(result.netTransfers.length).toBeLessThan(obligations.length);
  });

  it('3. Handles edge case of empty netting batches gracefully', () => {
    const emptyResult = executeMultilateralNetting([]);
    expect(emptyResult.status).toBe('NET_EXECUTED');
    expect(emptyResult.grossVolumeCents).toBe(0);
    expect(emptyResult.compressionRatioPct).toBe(100.0);
    expect(emptyResult.netTransfers).toHaveLength(0);
  });
});
