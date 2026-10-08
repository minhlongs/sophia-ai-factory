/**
 * @file growth-triad-actions.test.ts
 * @description Unit tests for Growth Triad v2 Server Actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  triggerVoiceCartRecoveryAction,
  rebalanceAdArbitrageAction,
  syndicateParasiteArticleAction,
} from '../actions/growth-triad-actions';
import * as betterAuthSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import * as inngestClient from '@/seed/inngest/client';

describe('Growth Triad v2 Server Actions (Land Layer)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects unauthenticated user for triggerVoiceCartRecoveryAction', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue(null);

    const res = await triggerVoiceCartRecoveryAction({
      cartSessionId: 'cart-1',
      customerPhone: '+84987654321',
      cartValue: 500000,
      productNames: ['Product 1'],
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('UNAUTHORIZED');
  });

  it('triggers voice cart closer and dispatches inngest event', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-123',
      name: 'Owner',
      email: 'owner@example.com',
    } as any);

    const mockExecute = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      execute: mockExecute,
    } as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-voice'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const res = await triggerVoiceCartRecoveryAction({
      cartSessionId: 'cart-1',
      customerPhone: '+84987654321',
      customerName: 'Nguyen Van A',
      cartValue: 750000,
      productNames: ['Smartwatch Ultra Series 9'],
    });

    expect(res.success).toBe(true);
    expect(res.callRecord?.userId).toBe('usr-123');
    expect(res.callRecord?.customerPhone).toBe('+84987654321');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'voice.cart.recovery.triggered',
      }),
    );
  });

  it('rebalances ad arbitrage budget and triggers stop loss when unprofitable', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-123',
      name: 'Owner',
      email: 'owner@example.com',
    } as any);

    const mockExecute = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      execute: mockExecute,
    } as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-ad'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const res = await rebalanceAdArbitrageAction({
      campaignId: 'camp-1',
      campaignName: 'TikTok Hook #1',
      platform: 'TIKTOK_ADS',
      dailyBudget: 1000000,
      spend24h: 800000,
      gmv24h: 200000,
      clicks24h: 300,
      conversions24h: 1,
      commissionPerConversion: 150000,
    });

    expect(res.success).toBe(true);
    expect(res.campaign?.status).toBe('PAUSED_STOP_LOSS');
    expect(res.campaign?.recommendedAction).toBe('PAUSE_STOP_LOSS');
    expect(res.campaign?.dailyBudget).toBe(0);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ads.arbitrage.optimized',
      }),
    );
  });

  it('compiles and syndicates parasite SEO article', async () => {
    vi.spyOn(betterAuthSession, 'getCurrentUser').mockResolvedValue({
      id: 'usr-123',
      name: 'Owner',
      email: 'owner@example.com',
    } as any);

    const mockExecute = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      execute: mockExecute,
    } as any);

    const mockSend = vi.fn().mockResolvedValue({ ids: ['evt-seo'] });
    vi.spyOn(inngestClient.inngest, 'send').mockImplementation(mockSend as any);

    const res = await syndicateParasiteArticleAction({
      skuCode: 'SKU-EARBUDS',
      productName: 'Earbuds Pro Wireless',
      price: 490000,
      targetPlatform: 'MEDIUM',
      cloakedBridgeUrl: 'https://sophia.ai/go/earbuds-deal',
      keyFeatures: ['Chống ồn 45dB', 'Pin 30 giờ'],
    });

    expect(res.success).toBe(true);
    expect(res.article?.canonicalSlug).toContain('review-sku-earbuds-medium');
    expect(res.article?.targetPlatform).toBe('MEDIUM');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'seo.parasite.syndicated',
      }),
    );
  });
});
