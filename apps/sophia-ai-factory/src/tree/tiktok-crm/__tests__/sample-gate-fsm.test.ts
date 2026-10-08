/**
 * @file sample-gate-fsm.test.ts
 * @description Unit tests for TikTok Shop sample gating state machine & commission tiers
 */

import { describe, it, expect } from 'vitest';
import { evaluateSampleGate, resolveCommissionTier } from '../sample-gate-fsm';

describe('TikTok Creator Sample Gate FSM (Tree Layer)', () => {
  it('auto-approves high GMV creators', () => {
    const res = evaluateSampleGate({
      followerCount: 20000,
      rollingGmv30d: 6500,
      engagementRate: 0.03,
      attributedSalesCount: 10,
    });
    expect(res.status).toBe('AUTO_APPROVED');
  });

  it('auto-approves high follower and high engagement creators', () => {
    const res = evaluateSampleGate({
      followerCount: 80000,
      rollingGmv30d: 2000,
      engagementRate: 0.06,
      attributedSalesCount: 5,
    });
    expect(res.status).toBe('AUTO_APPROVED');
  });

  it('marks moderate creators for manual review', () => {
    const res = evaluateSampleGate({
      followerCount: 15000,
      rollingGmv30d: 800,
      engagementRate: 0.025,
      attributedSalesCount: 0,
    });
    expect(res.status).toBe('MANUAL_REVIEW');
  });

  it('rejects low metrics creators', () => {
    const res = evaluateSampleGate({
      followerCount: 2000,
      rollingGmv30d: 100,
      engagementRate: 0.01,
      attributedSalesCount: 0,
    });
    expect(res.status).toBe('REJECTED_LOW_METRICS');
  });

  it('escalates commission tiers accurately based on sales milestones', () => {
    expect(resolveCommissionTier(10)).toBe('TIER_1_STANDARD');
    expect(resolveCommissionTier(25)).toBe('TIER_2_GROWTH');
    expect(resolveCommissionTier(80)).toBe('TIER_2_GROWTH');
    expect(resolveCommissionTier(100)).toBe('TIER_3_ELITE');
    expect(resolveCommissionTier(250)).toBe('TIER_3_ELITE');
  });
});
