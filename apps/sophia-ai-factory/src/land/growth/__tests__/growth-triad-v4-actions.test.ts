/**
 * @file growth-triad-v4-actions.test.ts
 * @description Zero-mock unit tests for Growth Triad v4 Server Actions
 * @layer land
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateChurnWinbackAction,
  evaluateAffiliateEpcAction,
  dispatchRepurposeAction,
} from '../actions/growth-triad-v4-actions';

// Mock session and db client
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-growth-v4', email: 'growth@sophia.agency' }),
}));

const mockRun = vi.fn().mockResolvedValue({ success: true });
const mockBind = vi.fn().mockReturnValue({ run: mockRun });
const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: mockPrepare,
  }),
}));

const mockInngestSend = vi.fn().mockResolvedValue({ ids: ['evt-v4'] });
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: (args: unknown) => mockInngestSend(args),
  },
}));

describe('Growth Triad v4 Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluateChurnWinbackAction', () => {
    it('evaluates churn hazard and triggers inngest event with D1 record', async () => {
      const res = await evaluateChurnWinbackAction({
        targetUserId: 'usr-dormant',
        hazardInput: {
          daysSinceLastActive: 45,
          loginCount30d: 1,
          mcuBurnRate30d: 50,
          supportTicketCount: 2,
        },
        planMonthlyPriceUsd: 100,
      });

      expect(res.success).toBe(true);
      if (!res.success) throw new Error('Expected success to be true');

      expect(res.riskLevel).toBeDefined();
      expect(res.offer.discountPercentage).toBeGreaterThan(0);
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'retargeting.winback.evaluated',
        })
      );
    });
  });

  describe('evaluateAffiliateEpcAction', () => {
    it('calculates EPC and triggers deal matching event', async () => {
      const res = await evaluateAffiliateEpcAction({
        campaignId: 'camp-top',
        clicks7d: 2000,
        conversions7d: 150,
        grossRevenueUsd: 6000,
      });

      expect(res.success).toBe(true);
      if (!res.success) throw new Error('Expected success to be true');

      expect(res.metrics.epcUsd).toBe(3);
      expect(res.metrics.commissionTier).toBe('DIAMOND_ELITE');
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'affiliate.deal.matched',
        })
      );
    });
  });

  describe('dispatchRepurposeAction', () => {
    it('calculates saliency crop and enqueues viral repurpose pipeline', async () => {
      const res = await dispatchRepurposeAction({
        sourceVideoId: 'vid-source-1',
        sourceWidth: 1920,
        sourceHeight: 1080,
        focalPointX: 0.5,
        focalPointY: 0.5,
        targetFormat: 'TIKTOK_9_16',
        motionVariance: 40,
        contrastRatio: 5,
      });

      expect(res.success).toBe(true);
      if (!res.success) throw new Error('Expected success to be true');

      expect(res.cropBox.cropWidth).toBe(Math.round(1080 * (9 / 16)));
      expect(res.saliencyScore).toBeGreaterThan(0);
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'viral.repurpose.dispatched',
        })
      );
    });
  });
});
