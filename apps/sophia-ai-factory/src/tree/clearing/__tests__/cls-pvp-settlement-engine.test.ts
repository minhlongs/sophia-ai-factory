import { describe, it, expect } from 'vitest';
import {
  validatePvpLegEquivalence,
  executeAtomicPvpSettlement,
} from '../cls-pvp-settlement-engine';
import type {
  ClsPvpSettlementSession,
  PvpExecutionRequest,
} from '@/seed/types/cls-liquidity';

describe('CLS PvP Atomic Settlement Engine Unit Tests', () => {
  const session: ClsPvpSettlementSession = {
    id: 'cls_session_01',
    sessionRef: 'CLS_PVP_2026_001',
    leg1Currency: 'USD',
    leg1AmountCents: 10_000_000_000, // $100M
    leg1SourceInstitution: 'FED_NY_NODE',
    leg2Currency: 'EUR',
    leg2AmountCents: 9_150_000_000,  // €91.5M (Rate: 0.915)
    leg2SourceInstitution: 'ECB_FRANKFURT_NODE',
    exchangeRate: 0.915,
    atomicStatus: 'MATCHED',
    clearingHashSha256: 'a'.repeat(64),
    createdAt: '2026-09-27T00:00:00Z',
  };

  it('validates rate equivalence within allowed divergence tolerance (5 bps)', () => {
    // Exact match: 91.5M / 100M = 0.915 -> divergence 0 bps
    const exactMatch = validatePvpLegEquivalence(10_000_000_000, 9_150_000_000, 0.915);
    expect(exactMatch.valid).toBe(true);
    expect(exactMatch.divergenceBps).toBe(0);

    // Minor acceptable divergence (2 bps)
    const minorDiv = validatePvpLegEquivalence(10_000_000_000, 9_152_000_000, 0.915);
    expect(minorDiv.valid).toBe(true);
    expect(minorDiv.divergenceBps).toBeLessThanOrEqual(5);

    // Unacceptable divergence (100 bps)
    const largeDiv = validatePvpLegEquivalence(10_000_000_000, 9_250_000_000, 0.915);
    expect(largeDiv.valid).toBe(false);
    expect(largeDiv.reason).toContain('exceeds allowed tolerance');
  });

  it('executes atomic PvP settlement when legs match', () => {
    const request: PvpExecutionRequest = {
      sessionRef: session.sessionRef,
      leg1AmountCents: 10_000_000_000,
      leg2AmountCents: 9_150_000_000,
      leg1Currency: 'USD',
      leg2Currency: 'EUR',
      spotRate: 0.915,
    };

    const result = executeAtomicPvpSettlement(session, request);
    expect(result.status).toBe('EXECUTED_PVP');
    expect(result.executedLeg1Cents).toBe(10_000_000_000);
    expect(result.executedLeg2Cents).toBe(9_150_000_000);
    expect(result.atomicSettlementProofSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rolls back settlement atomically if leg amounts are zero or divergent', () => {
    const request: PvpExecutionRequest = {
      sessionRef: session.sessionRef,
      leg1AmountCents: 0, // Invalid leg
      leg2AmountCents: 9_150_000_000,
      leg1Currency: 'USD',
      leg2Currency: 'EUR',
      spotRate: 0.915,
    };

    const result = executeAtomicPvpSettlement(session, request);
    expect(result.status).toBe('ROLLED_BACK_REVERSED');
    expect(result.executedLeg1Cents).toBe(0);
    expect(result.executedLeg2Cents).toBe(0);
  });
});
