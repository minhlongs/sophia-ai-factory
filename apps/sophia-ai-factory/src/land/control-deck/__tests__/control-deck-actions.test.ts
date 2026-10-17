import { describe, expect, it, vi } from 'vitest';
import {
  dispatchAdvisorCouncilMissionAction,
  rebalanceHalfKellyAction,
} from '../control-deck-actions';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr_founder_01' }),
}));

describe('Land Layer — Stitch Control Deck Server Actions', () => {
  it('dispatches 4-Advisor Council mission with Half-Kelly telemetry', async () => {
    const res = await dispatchAdvisorCouncilMissionAction({
      screenId: 'ask-advisors',
      mcuBudget: 2500,
    });

    expect(res.ok).toBe(true);
    expect(res.actorMode).toBe('authenticated');
    expect(res.missionId).toBe('MSN-STITCH-ASKADVISORS-2500');
    expect(res.consensusConfidencePct).toBeGreaterThan(90);
    expect(res.halfKellyAllocationPct).toBeGreaterThan(0);
    expect(res.message.vi).toContain('Hội đồng 4 Cố vấn');
  });

  it('rebalances Thompson Sampling & Half-Kelly arms for updated MCU budget', async () => {
    const res = await rebalanceHalfKellyAction({ mcuBudget: 5000 });

    expect(res.ok).toBe(true);
    expect(res.mcuBudget).toBe(5000);
    expect(res.mabArms).toHaveLength(3);
    expect(res.message.en).toContain('5000 MCU');
  });
});
