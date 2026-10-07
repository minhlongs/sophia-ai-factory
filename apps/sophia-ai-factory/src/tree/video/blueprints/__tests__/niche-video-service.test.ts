/**
 * Niche Video Service & Crypto Compliance Overlay Vitest Suite
 *
 * Verifies end-to-end campaign planning, storyboard calculation,
 * geo-fencing blocking, and FFmpeg compliance filter generation.
 *
 * @module tree/video/blueprints/__tests__/niche-video-service.test
 */

import { describe, it, expect } from 'vitest';
import {
  createNicheVideoCampaignPlan,
  type CreateNicheVideoCampaignInput,
} from '@/tree/video/blueprints/niche-video-service';
import {
  buildCryptoOverlaySpec,
  generateOverlayFfmpegFilter,
} from '@/tree/video/blueprints/crypto-compliance-overlay';

describe('Niche Video Campaign Service & Compliance Overlay', () => {
  describe('Crypto Compliance Overlay Engine', () => {
    it('builds standard 15-second compliance overlay spec with audio ducking', () => {
      const spec = buildCryptoOverlaySpec('US', 60, 'en');

      expect(spec.jurisdiction).toBe('US');
      expect(spec.totalDurationSec).toBe(60);
      expect(spec.endCardStartSec).toBe(45);
      expect(spec.endCardDurationSec).toBe(15);
      expect(spec.audioDuckingDb).toBe(-18);
      expect(spec.bottomThirdBanner.fontSize).toBe(22);
      expect(spec.bottomThirdBanner.opacity).toBe(0.88);
      expect(spec.endCard.headline).toContain('LEGAL & FINANCIAL DISCLOSURE');
      expect(spec.endCard.contrastRatio).toContain('WCAG AAA');
    });

    it('localizes overlay headlines and disclaimers for Vietnamese locale', () => {
      const spec = buildCryptoOverlaySpec('GLOBAL', 60, 'vi');

      expect(spec.endCard.headline).toBe('MINH BẠCH VÀ CẢNH BÁO PHÁP LÝ');
      expect(spec.bottomThirdBanner.text).toContain('Tiền điện tử biến động cao');
    });

    it('generates valid FFmpeg drawtext filter syntax for video composition', () => {
      const spec = buildCryptoOverlaySpec('US', 60, 'en');
      const filter = generateOverlayFfmpegFilter(spec);

      expect(filter).toContain('drawtext=text=');
      expect(filter).toContain("between(t,0,45)");
      expect(filter).toContain("between(t,45,60)");
      expect(filter).toContain('box=1');
    });
  });

  describe('createNicheVideoCampaignPlan', () => {
    it('creates a complete SaaS campaign plan with tracking link, storyboard, and prompts', () => {
      const input: CreateNicheVideoCampaignInput = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'https://grsm.io/flowcraft',
        targetAudience: 'Agency Owners',
        jurisdiction: 'GLOBAL',
        affiliateCode: 'SOPHIA_VIP',
        subId: 'yt_short_01',
        vanityCoupon: 'SAVE30',
        locale: 'en',
      };

      const result = createNicheVideoCampaignPlan(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const plan = result.value;
      expect(plan.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
      expect(plan.blueprint.id).toBe('saas_problem_agitation_solution');
      expect(plan.compliance.isAllowed).toBe(true);
      expect(plan.storyboard.scenes.length).toBeGreaterThanOrEqual(4);
      expect(plan.prompts.systemPrompt).toContain('Global B2B/SaaS software');
      expect(plan.trackedUrl).toContain('ps_partner_key=SOPHIA_VIP');
      expect(plan.trackedUrl).toContain('ps_xid=yt_short_01');
      expect(plan.caption).toContain('Exclusive Promo Code: SAVE30');
      expect(plan.overlaySpec).toBeUndefined();
    });

    it('creates a Crypto campaign plan with mandatory compliance overlay engine enabled', () => {
      const input: CreateNicheVideoCampaignInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Binance',
        productUrl: 'https://accounts.binance.com/register',
        targetAudience: 'Day Traders',
        jurisdiction: 'US',
        affiliateCode: 'DISCOUNT20',
        subId: 'short_us_01',
        locale: 'en',
      };

      const result = createNicheVideoCampaignPlan(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const plan = result.value;
      expect(plan.compliance.isAllowed).toBe(true);
      expect(plan.overlaySpec).toBeDefined();
      expect(plan.overlaySpec?.endCardDurationSec).toBe(15);
      expect(plan.caption).toContain('RISK WARNING');
    });

    it('rejects campaign creation when crypto targets restricted jurisdiction Vietnam', () => {
      const input: CreateNicheVideoCampaignInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Bybit',
        productUrl: 'https://bybit.com/register',
        jurisdiction: 'VN',
      };

      const result = createNicheVideoCampaignPlan(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.code).toBe('VIETNAM_PROMOTIONAL_BAN');
      expect(result.error.message).toContain('Decree 52/2024');
    });

    it('rejects campaign creation when blueprint ID does not exist', () => {
      const input: CreateNicheVideoCampaignInput = {
        niche: 'saas_global',
        blueprintId: 'non_existent_blueprint_123',
        productName: 'RandomApp',
        productUrl: 'https://randomapp.com',
      };

      const result = createNicheVideoCampaignPlan(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.code).toBe('BLUEPRINT_NOT_FOUND');
    });
  });
});
