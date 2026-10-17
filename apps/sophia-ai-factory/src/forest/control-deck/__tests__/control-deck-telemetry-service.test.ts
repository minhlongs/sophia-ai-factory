import { describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { fetchCurrentUserDashboard } from '@/forest/dashboard/metrics';
import { verifyUserReadiness } from '@/tree/readiness/readiness-checker';
import { computeLiveControlDeckDataset } from '@/tree/control-deck';
import {
  calculateKellyAllocation,
  calculateUCB1,
} from '@/tree/growth-triad';
import { loadLiveControlDeckTelemetry } from '../control-deck-telemetry-service';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/forest/dashboard/metrics', () => ({ fetchCurrentUserDashboard: vi.fn() }));
vi.mock('@/tree/readiness/readiness-checker', () => ({ verifyUserReadiness: vi.fn() }));

describe('Track 1 & 2 — Growth Triad Consolidation & Live Control Deck Telemetry', () => {
  it('re-exports canonical Thompson Bandit and Half-Kelly engines from @/tree/growth-triad', () => {
    const ucb = calculateUCB1(142, 161, 373);
    expect(ucb).toBeGreaterThan(0.8);

    const kelly = calculateKellyAllocation(
      {
        winProbability: 0.88,
        projectedRoas: 4.6,
        halfKelly: true,
        minFraction: 0.05,
        maxFraction: 0.25,
      },
      1000,
    );
    expect(kelly.isPositiveExpectancy).toBe(true);
    expect(kelly.boundedFraction).toBeGreaterThanOrEqual(0.05);
    expect(kelly.boundedFraction).toBeLessThanOrEqual(0.25);
  });

  it('computes live MAB Thompson + Half-Kelly overrides on STITCH_CONTROL_DECK_DATASET', () => {
    const dataset = computeLiveControlDeckDataset({
      mrrFormatted: '$54,200.00',
      mcuBudget: 2500,
      byokReady: true,
    });

    expect(dataset.screens[0]?.primaryKpiValue).toBe('$54,200.00');
    expect(dataset.screens[4]?.statusBadge.en).toContain('BYOK ENCRYPTION ENABLED');
    expect(dataset.mabArms).toHaveLength(3);
    expect(dataset.mabArms[0]?.winProbabilityPct).toBeGreaterThan(80);
  });

  it('gracefully falls back to computed baseline dataset when unauthenticated', async () => {
    const payload = await loadLiveControlDeckTelemetry();
    expect(payload.isLiveAuthenticated).toBe(false);
    expect(payload.dataset.screens).toHaveLength(9);
  });

  it('shows account payments without inventing a provider, split, or Merkle proof', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1', email: 'owner@example.test', full_name: 'Owner', avatar_url: undefined, role: 'user',
    });
    vi.mocked(verifyUserReadiness).mockRejectedValue(new Error('Readiness probe unavailable'));
    vi.mocked(fetchCurrentUserDashboard).mockResolvedValue({
      ok: true,
      data: {
        metrics: [],
        campaignMetrics: {
          totalCampaigns: 0, activeCampaigns: 0, completedCampaigns: 0,
          failedCampaigns: 0, totalVideosGenerated: 0, successRate: 0,
        },
        recentActivities: [
          { id: 'tx-real-1', type: 'payment', date: '2026-10-17', description: 'Invoice', amount: '$25.00', status: 'paid' },
          { id: 'campaign-1', type: 'campaign', date: '2026-10-17', description: 'Campaign', amount: '$100.00', status: 'completed' },
        ],
        topAffiliates: [],
      },
    });

    const payload = await loadLiveControlDeckTelemetry();
    expect(payload.isLiveAuthenticated).toBe(true);
    expect(payload.dataset.settlements).toEqual([
      {
        txId: 'tx-real-1',
        provider: { en: 'Not recorded', vi: 'Chưa ghi nhận' },
        grossAmountUsd: '$25.00',
        status: { en: 'Paid', vi: 'Đã thanh toán' },
        timestampUtc: '2026-10-17',
        source: 'account',
      },
    ]);
    expect(payload.dataset.screens[4]?.statusBadge.en).toContain('DEMO');
  });
});
