/**
 * @file fleet-radar-actions.test.ts
 * @description Unit tests for Fleet & Radar Server Actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFleetAccountsAction,
  registerFleetAccountAction,
  launchFleetDeploymentAction,
  ingestTrendingSkuRadarAction,
} from '../actions/fleet-radar-actions';
import * as betterAuthSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import * as inngestClient from '@/seed/inngest/client';

describe('Fleet & Radar Actions (Land Layer)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects unauthenticated user for getFleetAccountsAction', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue(null);

    const res = await getFleetAccountsAction();
    expect(res.success).toBe(false);
    expect(res.error).toBe('UNAUTHORIZED');
  });

  it('registers a fleet account successfully for authenticated user', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-123',
      name: 'Owner',
      email: 'owner@example.com',
    } as any);

    const mockExecute = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      execute: mockExecute,
      query: vi.fn(),
    } as any);

    const res = await registerFleetAccountAction({
      platform: 'TIKTOK',
      handle: '@ai_trend_master',
      displayName: 'AI Trend Master',
      dailyPostLimit: 4,
    });

    expect(res.success).toBe(true);
    expect(res.data?.handle).toBe('@ai_trend_master');
    expect(res.data?.userId).toBe('usr-123');
    expect(mockExecute).toHaveBeenCalled();
  });

  it('launches fleet deployment with staggered schedule and emits inngest event', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-123',
      name: 'Owner',
      email: 'owner@example.com',
    } as any);

    const mockExecute = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'acc-1',
                userId: 'usr-123',
                platform: 'TIKTOK',
                handle: '@acc1',
                displayName: 'Acc 1',
                status: 'ACTIVE',
                dailyPostLimit: 3,
                postsPublishedToday: 0,
                totalViews: 0,
                totalClicks: 0,
                totalGmv: 0,
                totalCommission: 0,
                createdAt: 100,
                updatedAt: 100,
              },
            ],
          }),
        }),
      }),
    });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      from: mockFrom,
      execute: mockExecute,
    } as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-1'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const res = await launchFleetDeploymentAction({
      campaignName: 'Wireless Earbuds Blast',
      targetAccountIds: ['acc-1'],
      hookAngles: ['Stop scrolling if you need better sound!'],
      staggerMinutes: 25,
    });

    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);
    expect(res.scheduledCount).toBe(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'fleet.stagger.publish.requested',
      }),
    );
  });

  it('ingests trending SKU, calculates velocity, and emits trending.sku.detected for breakout', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-123',
      name: 'Owner',
      email: 'owner@example.com',
    } as any);

    const mockExecute = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      execute: mockExecute,
      query: vi.fn(),
    } as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-2'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const res = await ingestTrendingSkuRadarAction({
      skuCode: 'SKU-PODS-PRO',
      platform: 'TIKTOK_SHOP',
      productName: 'Pro Earbuds ANC',
      price: 500000,
      commissionRate: 0.25,
      salesVolume24h: 1200,
      salesVolumeBaseline24h: 200,
      viewCount24h: 30000,
    });

    expect(res.success).toBe(true);
    expect(res.radarItem?.hotTrendTier).toBe('BREAKOUT');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'trending.sku.detected',
      }),
    );
  });
});
