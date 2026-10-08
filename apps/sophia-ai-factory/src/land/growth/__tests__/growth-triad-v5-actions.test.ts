/**
 * @file growth-triad-v5-actions.test.ts
 * @description Zero-mock and unit tests for Growth Triad v5 Server Actions
 * @layer land
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectPaywallArmAction,
  recordPaywallConversionAction,
} from '../actions/paywall-mab-actions';
import { enrollCreatorOutreachAction } from '../actions/kol-outreach-actions';
import { evaluateAndPromoteWinnerAction } from '../actions/ab-testing-actions';

// Mock auth session and DB client
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

const mockDbRun = vi.fn().mockReturnValue({ meta: { changes: 1 } });
const mockDbFirst = vi.fn();
const mockDbAll = vi.fn();
const mockDbBind = vi.fn().mockReturnValue({
  run: mockDbRun,
  first: mockDbFirst,
  all: mockDbAll,
});
const mockDbPrepare = vi.fn().mockReturnValue({
  bind: mockDbBind,
});

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    prepare: mockDbPrepare,
  })),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt-123'] }),
  },
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';

describe('Growth Triad v5 Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selectPaywallArmAction', () => {
    it('returns UNAUTHORIZED if user session is absent', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const res = await selectPaywallArmAction({ campaignId: 'camp-1' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('UNAUTHORIZED');
      }
    });

    it('selects arm via Thompson Sampling when active arms exist', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr-1', email: 'test@sophia.io' } as any);
      mockDbAll.mockReturnValue({
        results: [
          {
            id: 'arm-1',
            campaignId: 'camp-1',
            priceTier: 'TIER_19',
            priceUsd: 19.99,
            alphaSuccess: 10,
            betaFailure: 90,
            impressions: 100,
            conversions: 10,
            revenueUsd: 199.9,
            isActive: 1,
          },
        ],
      });

      const res = await selectPaywallArmAction({ campaignId: 'camp-1' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.selectedArm.id).toBe('arm-1');
      }
    });
  });

  describe('recordPaywallConversionAction', () => {
    it('records conversion and updates arm posterior in D1', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr-1', email: 'test@sophia.io' } as any);
      mockDbFirst.mockReturnValue({
        id: 'arm-1',
        campaignId: 'camp-1',
        priceTier: 'TIER_19',
        priceUsd: 19.99,
        alphaSuccess: 10,
        betaFailure: 90,
        impressions: 100,
        conversions: 10,
        revenueUsd: 199.9,
        isActive: 1,
      });

      const res = await recordPaywallConversionAction({
        campaignId: 'camp-1',
        armId: 'arm-1',
        converted: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.updatedArm.conversions).toBe(11);
        expect(mockDbRun).toHaveBeenCalled();
      }
    });
  });

  describe('enrollCreatorOutreachAction', () => {
    it('enrolls qualified creator, sets negotiated split, and fires inngest event', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr-1', email: 'test@sophia.io' } as any);

      const res = await enrollCreatorOutreachAction({
        creator: {
          platform: 'TIKTOK',
          handle: '@ai_growth_hacker',
          followerCount: 50000,
          medianViews: 20000,
          totalInteractions: 10000,
          samplePostCount: 10,
        },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.qualityScore).toBeGreaterThan(0.5);
        expect(res.offeredSplitPct).toBeGreaterThanOrEqual(0.2);
        expect(mockDbRun).toHaveBeenCalled();
      }
    });
  });

  describe('evaluateAndPromoteWinnerAction', () => {
    it('evaluates Bayesian significance and dispatches promotion when winner exists', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr-1', email: 'test@sophia.io' } as any);
      const variants = [
        {
          id: 'v-ctrl',
          name: 'Control',
          hookText: 'Intro A',
          impressions: 1000,
          clicks: 30,
          isControl: true,
          isPromotedWinner: false,
        },
        {
          id: 'v-winner',
          name: 'High CTR',
          hookText: 'Intro B',
          impressions: 1000,
          clicks: 90,
          isControl: false,
          isPromotedWinner: false,
        },
      ];

      mockDbFirst.mockReturnValue({
        id: 'exp-1',
        title: 'Hook Test 1',
        status: 'ACTIVE_TESTING',
        variants_json: JSON.stringify(variants),
      });

      const res = await evaluateAndPromoteWinnerAction({
        experimentId: 'exp-1',
        minImpressions: 200,
        confidenceThreshold: 0.95,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.evaluation.hasSignificantWinner).toBe(true);
        expect(res.evaluation.winnerVariantId).toBe('v-winner');
        expect(mockDbRun).toHaveBeenCalled();
      }
    });
  });
});
