/**
 * Niche Video Server Actions Vitest Suite
 *
 * Verifies authentication enforcement, Zod payload validation,
 * regulatory compliance checks, and Inngest event dispatching.
 *
 * @module forest/actions/__tests__/niche-video-actions.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  previewNicheVideoPlanAction,
  dispatchNicheVideoCampaignAction,
  type CreateNicheVideoCampaignActionInput,
} from '../niche-video-actions';
import * as authSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { inngest } from '@/seed/inngest/client';
import { buildWorkspaceOfferId } from '@/tree/affiliate/offers/workspace-offer-upsert';

vi.mock('@/seed/auth/better-auth-session');
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_test_123'] }),
  },
}));

describe('Niche Video Server Actions', () => {
  const mockUser = {
    id: 'usr_growth_agency_99',
    email: 'creator@agencyos.network',
    tier: 'PREMIUM' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authSession.getCurrentUser).mockResolvedValue(
      mockUser as unknown as Awaited<ReturnType<typeof authSession.getCurrentUser>>,
    );
  });

  describe('previewNicheVideoPlanAction', () => {
    it('rejects unauthenticated requests with Unauthorized status', async () => {
      vi.mocked(authSession.getCurrentUser).mockResolvedValue(null);

      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'https://grsm.io/flowcraft',
      };

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('rejects payload with invalid URL schema', async () => {
      const payload = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'not-a-valid-http-url',
      } as unknown as CreateNicheVideoCampaignActionInput;

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('rejects crypto campaign targeting banned Vietnam jurisdiction', async () => {
      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Bybit VIP',
        productUrl: 'https://bybit.com/register',
        jurisdiction: 'VN',
      };

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('VIETNAM_PROMOTIONAL_BAN');
      expect(result.error).toContain('Decree 52/2024');
    });

    it('successfully generates plan preview for SaaS campaign', async () => {
      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'https://grsm.io/flowcraft',
        targetAudience: 'Agency Founders',
        affiliateCode: 'SOPHIA_GROWTH',
        subId: 'yt_shorts_01',
        vanityCoupon: 'SAVE30',
        locale: 'en',
      };

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(true);
      if (!result.success || !result.data) return;

      expect(result.data.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
      expect(result.data.blueprint.id).toBe('saas_problem_agitation_solution');
      expect(result.data.trackedUrl).toContain('ps_partner_key=SOPHIA_GROWTH');
      expect(result.data.caption).toContain('Exclusive Promo Code: SAVE30');
    });
  });

  describe('dispatchNicheVideoCampaignAction', () => {
    it('successfully plans campaign and dispatches Inngest event', async () => {
      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Binance',
        productUrl: 'https://accounts.binance.com/register',
        jurisdiction: 'US',
        affiliateCode: 'DISCOUNT20',
        subId: 'reels_us_01',
        locale: 'en',
      };

      const result = await dispatchNicheVideoCampaignAction(payload);
      expect(result.success).toBe(true);
      if (!result.success || !result.data) return;

      expect(result.data.dispatched).toBe(true);
      expect(result.data.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'niche.video.campaign.requested',
          data: expect.objectContaining({
            userId: 'usr_growth_agency_99',
            niche: 'crypto_global',
            blueprintId: 'crypto_fee_discount_signup_bonus',
            productName: 'Binance',
          }),
        }),
      );
    });

    it('self-registers verified workspace offer and binds offerId + termsVerified=true when commissionTerms is provided', async () => {
      const db = createFakeD1([
        `CREATE TABLE affiliate_offers (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'system',
          network_id TEXT NOT NULL DEFAULT 'direct',
          external_id TEXT,
          program_name TEXT,
          title TEXT,
          category TEXT,
          product_url TEXT,
          destination_url TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          commission_terms TEXT,
          niche TEXT,
          region TEXT,
          language TEXT,
          created_at INTEGER NOT NULL DEFAULT 1000,
          updated_at INTEGER NOT NULL DEFAULT 1000
        );`,
      ]) as unknown as D1Database;
      vi.mocked(dbClient.getD1).mockResolvedValue(db);

      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_trading_bot_copy_trading',
        productName: 'Binance Global',
        productUrl: 'https://accounts.binance.com/register',
        commissionTerms: '20% Spot & Futures Fee Rebate Share',
        jurisdiction: 'US',
        affiliateCode: 'DISCOUNT20',
        subId: 'reels_us_01',
        locale: 'en',
      };

      const result = await dispatchNicheVideoCampaignAction(payload);
      expect(result.success).toBe(true);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'niche.video.campaign.requested',
          data: expect.objectContaining({
            userId: 'usr_growth_agency_99',
            offerId: buildWorkspaceOfferId(
              'usr_growth_agency_99',
              'crypto_global',
              'https://accounts.binance.com/register',
            ),
            termsVerified: true,
          }),
        }),
      );
    });
  });
});
