/**
 * @file growth-triad-v3-actions.test.ts
 * @description Unit tests for Growth Triad v3 Server Actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchB2bOutreachAction,
  evaluateTikTokCreatorAction,
  calculateOmnichannelAttributionAction,
} from '../actions/growth-triad-v3-actions';
import * as betterAuthSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import * as inngestClient from '@/seed/inngest/client';

describe('Growth Triad v3 Server Actions (Land Layer)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockDbPrepare = () => {
    const bindFn = vi.fn().mockReturnThis();
    const runFn = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const prepareFn = vi.fn().mockReturnValue({
      bind: bindFn,
      run: runFn,
    });
    return {
      prepare: prepareFn,
      bind: bindFn,
      run: runFn,
    };
  };

  it('rejects unauthenticated user for dispatchB2bOutreachAction', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue(null);

    const res = await dispatchB2bOutreachAction({
      email: 'lead@enterprise.com',
      companyDomain: 'enterprise.com',
      channel: 'EMAIL',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('UNAUTHORIZED');
  });

  it('successfully dispatches B2B outreach with corporate domain', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-v3',
      name: 'Sales Director',
      email: 'sales@enterprise.com',
    } as any);

    const db = mockDbPrepare();
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue(db as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-b2b'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const res = await dispatchB2bOutreachAction({
      email: 'vp@acme-corp.com',
      fullName: 'John Doe',
      companyDomain: 'acme-corp.com',
      channel: 'EMAIL',
      bookingUrl: 'https://cal.com/acme/30min',
    });

    expect(res.success).toBe(true);
    expect(res.isCorporateDomain).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'b2b.outreach.dispatched',
        data: expect.objectContaining({
          userId: 'usr-v3',
          email: 'vp@acme-corp.com',
          channel: 'EMAIL',
        }),
      })
    );
  });

  it('evaluates TikTok creator and auto-approves high GMV creators', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-v3',
      name: 'Brand Lead',
      email: 'lead@brand.com',
    } as any);

    const db = mockDbPrepare();
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue(db as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-tt'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const res = await evaluateTikTokCreatorAction({
      creatorHandle: '@topcreator',
      followerCount: 25000,
      rollingGmv30d: 7500,
      engagementRate: 0.04,
      attributedSalesCount: 30,
    });

    expect(res.success).toBe(true);
    expect(res.sampleStatus).toBe('AUTO_APPROVED');
    expect(res.commissionTier).toBe('TIER_2_GROWTH');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'tiktok.sample.evaluated',
      })
    );
  });

  it('calculates omnichannel attribution and persists touchpoint weights', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-v3',
      name: 'Growth Lead',
      email: 'growth@brand.com',
    } as any);

    const db = mockDbPrepare();
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue(db as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-attrib'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const now = 1770000000000;
    const res = await calculateOmnichannelAttributionAction({
      conversionId: 'conv-999',
      totalGmv: 2000,
      customerLifetimeValue: 800,
      acquisitionCost: 160,
      attributionModel: 'FIRST_TOUCH',
      rawTouchpoints: [
        { channel: 'TIKTOK', timestamp: now - 5000 },
        { channel: 'SEARCH', timestamp: now },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.conversionId).toBe('conv-999');
    expect(res.ltvCacRatio).toBe(5.0);
    expect(res.weights?.[0]?.channel).toBe('TIKTOK');
    expect(res.weights?.[0]?.weightPercentage).toBe(100);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'omnichannel.attribution.calculated',
      })
    );
  });
});
