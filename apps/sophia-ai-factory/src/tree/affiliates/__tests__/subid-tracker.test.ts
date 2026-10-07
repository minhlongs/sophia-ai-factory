/**
 * SubID Tracker & Affiliate Caption Vitest Suite
 *
 * Verifies affiliate network detection across SaaS & Crypto networks,
 * correct SubID parameter injection, and FTC/CFTC compliant caption formatting.
 *
 * @module tree/affiliates/__tests__/subid-tracker.test
 */

import { describe, it, expect } from 'vitest';
import {
  detectAffiliateNetwork,
  buildNetworkTrackedUrl,
  formatComplianceCaption,
} from '@/tree/affiliates/subid-tracker';

describe('SubID Tracker & Affiliate Attribution Engine', () => {
  describe('detectAffiliateNetwork', () => {
    it('accurately identifies Impact domains and shortlinks', () => {
      expect(detectAffiliateNetwork('https://impact.com/c/123/brand')).toBe('IMPACT');
      expect(detectAffiliateNetwork('https://brand.sjv.io/c/456')).toBe('IMPACT');
      expect(detectAffiliateNetwork('https://tool.pxf.io/c/789')).toBe('IMPACT');
    });

    it('identifies PartnerStack domains and grsm.io shortlinks', () => {
      expect(detectAffiliateNetwork('https://partnerstack.com/refer/xyz')).toBe('PARTNERSTACK');
      expect(detectAffiliateNetwork('https://grsm.io/growth123')).toBe('PARTNERSTACK');
    });

    it('identifies Rewardful and FirstPromoter tracking patterns', () => {
      expect(detectAffiliateNetwork('https://getflow.io?via=affiliate1')).toBe('REWARDFUL');
      expect(detectAffiliateNetwork('https://usecopy.ai?fpr=partner2')).toBe('FIRSTPROMOTER');
    });

    it('identifies Binance and Bybit exchange domains', () => {
      expect(detectAffiliateNetwork('https://accounts.binance.com/register')).toBe('BINANCE');
      expect(detectAffiliateNetwork('https://www.bybit.com/en/register')).toBe('BYBIT');
    });

    it('defaults to GENERIC for standard web addresses', () => {
      expect(detectAffiliateNetwork('https://mytool.com/signup')).toBe('GENERIC');
    });
  });

  describe('buildNetworkTrackedUrl', () => {
    it('injects subId1 and subId2 for Impact networks', () => {
      const url = buildNetworkTrackedUrl({
        targetUrl: 'https://brand.sjv.io/c/123',
        affiliateCode: 'PARTNER_A',
        subId: 'yt_short_01',
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('subId1')).toBe('PARTNER_A');
      expect(parsed.searchParams.get('subId2')).toBe('yt_short_01');
      expect(parsed.searchParams.get('utm_source')).toBe('youtube_short');
    });

    it('injects ps_partner_key and ps_xid for PartnerStack networks', () => {
      const url = buildNetworkTrackedUrl({
        targetUrl: 'https://grsm.io/partner123',
        affiliateCode: 'SOPHIA_PS',
        subId: 'tiktok_vid_42',
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('ps_partner_key')).toBe('SOPHIA_PS');
      expect(parsed.searchParams.get('ps_xid')).toBe('tiktok_vid_42');
    });

    it('injects ref and sub_id for Binance exchange networks', () => {
      const url = buildNetworkTrackedUrl({
        targetUrl: 'https://accounts.binance.com/register',
        affiliateCode: 'BINANCE_VIP',
        subId: 'reels_campaign_09',
        vanityCoupon: 'BONUS1000',
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('ref')).toBe('BINANCE_VIP');
      expect(parsed.searchParams.get('sub_id')).toBe('reels_campaign_09');
      expect(parsed.searchParams.get('coupon')).toBe('BONUS1000');
    });

    it('safely returns raw string if targetUrl is malformed', () => {
      const invalid = 'not-a-valid-url';
      expect(buildNetworkTrackedUrl({ targetUrl: invalid, affiliateCode: 'CODE' })).toBe(invalid);
    });
  });

  describe('formatComplianceCaption', () => {
    it('generates FTC compliant caption with promo code in English for SaaS', () => {
      const caption = formatComplianceCaption(
        'FlowCraft AI',
        'https://grsm.io/flow?ps_partner_key=SOPHIA',
        'SAVE20',
        false,
        'en',
      );

      expect(caption).toContain('FlowCraft AI');
      expect(caption).toContain('https://grsm.io/flow?ps_partner_key=SOPHIA');
      expect(caption).toContain('Exclusive Promo Code: SAVE20');
      expect(caption).toContain('FTC 16 C.F.R. § 255');
      expect(caption).not.toContain('CẢNH BÁO RỦI RO');
    });

    it('generates high-risk disclosure for Crypto in Vietnamese', () => {
      const caption = formatComplianceCaption(
        'Binance VIP Bonus',
        'https://binance.com/reg?ref=123',
        null,
        true,
        'vi',
      );

      expect(caption).toContain('Binance VIP Bonus');
      expect(caption).toContain('CẢNH BÁO RỦI RO');
      expect(caption).toContain('70-80% tài khoản nhà đầu tư cá nhân thua lỗ');
      expect(caption).toContain('không phải lời khuyên tài chính');
    });
  });
});
