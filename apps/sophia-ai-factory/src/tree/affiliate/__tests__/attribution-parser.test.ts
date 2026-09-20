import { describe, it, expect } from 'vitest';
import { parseAffiliateSubId } from '../attribution-parser';

describe('Attribution Parser (tree/affiliate/attribution-parser)', () => {
  describe('String inputs & tokenized sub-IDs', () => {
    it('parses simple campaign string', () => {
      const result = parseAffiliateSubId('camp_tiktok_viral_01');
      expect(result.campaignId).toBe('camp_tiktok_viral_01');
      expect(result.affiliateUserId).toBe('aff_default');
      expect(result.rawSubId).toBe('camp_tiktok_viral_01');
    });

    it('parses compound token format camp_X_aff_Y_clk_Z', () => {
      const result = parseAffiliateSubId('camp_viral77_aff_creator42_clk_click999');
      expect(result.campaignId).toBe('camp_viral77');
      expect(result.affiliateUserId).toBe('aff_creator42');
      expect(result.clickId).toBe('click999');
    });

    it('parses pipe-delimited key-value sub-IDs (cmp:X|aff:Y|clk:Z)', () => {
      const result = parseAffiliateSubId('cmp:summer_sale|aff:alice_99|clk:clk_abc123');
      expect(result.campaignId).toBe('summer_sale');
      expect(result.affiliateUserId).toBe('alice_99');
      expect(result.clickId).toBe('clk_abc123');
    });
  });

  describe('Network-specific payload mapping', () => {
    it('extracts AccessTrade slots (sub1, sub2, sub3, click_id)', () => {
      const result = parseAffiliateSubId({
        network: 'accesstrade',
        payload: {
          sub1: 'camp_at_vn_01',
          sub2: 'aff_user_vn_88',
          sub3: 'clk_at_slot3',
          order_id: 'ord_at_123',
        },
      });

      expect(result.campaignId).toBe('camp_at_vn_01');
      expect(result.affiliateUserId).toBe('aff_user_vn_88');
      expect(result.clickId).toBe('clk_at_slot3');
      expect(result.orderId).toBe('ord_at_123');
    });

    it('extracts Awin slots (click_ref, click_ref2, click_ref3)', () => {
      const result = parseAffiliateSubId({
        network: 'awin',
        payload: {
          click_ref: 'camp_awin_uk',
          click_ref2: 'aff_creator_awin',
          click_ref3: 'clk_awin_777',
          conversionId: 'awin_conv_99',
        },
      });

      expect(result.campaignId).toBe('camp_awin_uk');
      expect(result.affiliateUserId).toBe('aff_creator_awin');
      expect(result.clickId).toBe('clk_awin_777');
      expect(result.orderId).toBe('awin_conv_99');
    });

    it('extracts ClickBank slots (cvendthru, affiliate, receipt)', () => {
      const result = parseAffiliateSubId({
        network: 'clickbank',
        payload: {
          cvendthru: 'camp_cb_keto_aff_cbuser_clk_cbclk',
          affiliate: 'cb_aff_master',
          receipt: 'CB-ORDER-999',
        },
      });

      expect(result.affiliateUserId).toBe('cb_aff_master');
      expect(result.orderId).toBe('CB-ORDER-999');
      expect(result.rawSubId).toContain('camp_cb_keto');
    });

    it('extracts Amazon Associates slots (tag, ascsubtag)', () => {
      const result = parseAffiliateSubId({
        network: 'amazon_associates',
        payload: {
          tag: 'sophia-20',
          ascsubtag: 'camp_amazon_prime_2026',
          orderId: 'amz_111-222',
        },
      });

      expect(result.orderId).toBe('amz_111-222');
      expect(result.campaignId).toBe('camp_amazon_prime_2026');
    });

    it('extracts TikTok Shop slots (sub_id, affiliate_id)', () => {
      const result = parseAffiliateSubId({
        network: 'tiktok_shop',
        payload: {
          sub_id: 'camp_shorts_dance_aff_ttcreator',
          affiliateId: 'tt_creator_101',
          order_id: 'tts_order_888',
        },
      });

      expect(result.affiliateUserId).toBe('tt_creator_101');
      expect(result.campaignId).toBe('camp_shorts_dance');
      expect(result.orderId).toBe('tts_order_888');
    });
  });

  describe('Query parameter extraction', () => {
    it('extracts sub-ID from URLSearchParams', () => {
      const params = new URLSearchParams('sub_id=camp_promo_spring&affiliate_id=aff_sarah');
      const result = parseAffiliateSubId({ queryParams: params });
      expect(result.campaignId).toBe('camp_promo_spring');
    });

    it('falls back safely when input is empty or null', () => {
      const result = parseAffiliateSubId('');
      expect(result.affiliateUserId).toBe('aff_default');
      expect(result.campaignId).toBeNull();
      expect(result.clickId).toBeNull();
    });
  });
});
