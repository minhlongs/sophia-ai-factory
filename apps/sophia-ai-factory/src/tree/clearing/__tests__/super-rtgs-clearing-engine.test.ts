/**
 * @file super-rtgs-clearing-engine.test.ts
 * @description Unit tests for Super-RTGS clearing and parallel multilateral netting 2.0.
 */

import { describe, expect, it } from 'vitest';
import {
  executeParallelMultilateralNetting,
  validateSuperRtgsPayment,
} from '../super-rtgs-clearing-engine';
import type { ParallelNettingObligation } from '@/seed/types/super-rtgs-capital';

describe('Super-RTGS Clearing & Parallel Netting 2.0', () => {
  it('1. Validates sub-microsecond atomic Super-RTGS payments', () => {
    const valid = validateSuperRtgsPayment({
      sourceParticipantId: 'FED_NY',
      targetParticipantId: 'BOJ_TOKYO',
      assetCurrency: 'KSCE',
      grossAmountCents: 100_000_000_00, // $100M
      availableReserveCents: 500_000_000_00, // $500M
    });
    expect(valid.valid).toBe(true);
    expect(valid.status).toBe('FINALIZED_IRREVOCABLE');
    expect(valid.executionLatencyNanos).toBeLessThanOrEqual(1000);
    expect(valid.receiptHash).toHaveLength(64);

    const rejected = validateSuperRtgsPayment({
      sourceParticipantId: 'FED_NY',
      targetParticipantId: 'BOJ_TOKYO',
      assetCurrency: 'KSCE',
      grossAmountCents: 100_000_000_00,
      availableReserveCents: 50_000_000_00, // insufficient
    });
    expect(rejected.valid).toBe(false);
    expect(rejected.status).toBe('REJECTED_INSUFFICIENT_LIQUIDITY');
  });

  it('2. Solves parallelized multilateral netting with > 95% compression', () => {
    const obligations: ParallelNettingObligation[] = [
      { fromParticipantId: 'NODE_1', toParticipantId: 'NODE_2', currency: 'SSDR', amountCents: 1_000_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_3', currency: 'SSDR', amountCents: 980_000_00 },
      { fromParticipantId: 'NODE_3', toParticipantId: 'NODE_4', currency: 'SSDR', amountCents: 960_000_00 },
      { fromParticipantId: 'NODE_4', toParticipantId: 'NODE_1', currency: 'SSDR', amountCents: 940_000_00 },
      { fromParticipantId: 'NODE_2', toParticipantId: 'NODE_1', currency: 'SSDR', amountCents: 20_000_00 },
    ];

    const result = executeParallelMultilateralNetting(obligations, 'SSDR', 16);
    expect(result.status).toBe('NET_EXECUTED');
    expect(result.parallelPartitionCount).toBe(16);
    expect(result.grossVolumeCents).toBe(3_900_000_00);
    expect(result.netSettlementVolumeCents).toBeLessThan(result.grossVolumeCents);
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(95.0);
  });

  it('3. Handles empty netting batch with 100% compression', () => {
    const result = executeParallelMultilateralNetting([]);
    expect(result.status).toBe('NET_EXECUTED');
    expect(result.grossVolumeCents).toBe(0);
    expect(result.compressionRatioPct).toBe(100.0);
    expect(result.netTransfers).toHaveLength(0);
  });
});
