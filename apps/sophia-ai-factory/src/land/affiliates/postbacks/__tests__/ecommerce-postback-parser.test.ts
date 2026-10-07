import { describe, it, expect } from 'vitest';
import {
  parseTikTokShopWebhook,
  parseShopeeWebhook,
} from '../ecommerce-postback-parser';

describe('E-commerce Affiliate Postback Parsers', () => {
  describe('TikTok Shop Parser', () => {
    it('correctly normalizes a settled order webhook', () => {
      const payload = {
        data: {
          order_id: 'TT_ORD_987654',
          order_status: 'COMPLETED_SETTLED',
          creator_id: 'creator_sophia_vn',
          estimated_commission: 14.5,
          item_price: 95.0,
          currency: 'USD',
          product_sku: 'SKU_VIRAL_MIC',
          product_title: 'Wireless Lapel Mic for TikTok',
          quantity: 2,
        },
      };

      const event = parseTikTokShopWebhook(payload);

      expect(event.network).toBe('tiktok_shop');
      expect(event.orderId).toBe('TT_ORD_987654');
      expect(event.status).toBe('ORDER_SETTLED');
      expect(event.commissionCents).toBe(1450);
      expect(event.itemPriceCents).toBe(9500);
      expect(event.itemCount).toBe(2);
      expect(event.isClearanceMatured).toBe(false);
      expect(event.clearanceDueMs).toBeGreaterThan(Date.now());
    });

    it('handles cancellation and refunds accurately', () => {
      const refundPayload = {
        order_id: 'TT_ORD_REFUNDED',
        status: 'REFUND_APPROVED',
        commission: 0,
      };

      const event = parseTikTokShopWebhook(refundPayload);
      expect(event.status).toBe('ORDER_REFUNDED');
      expect(event.commissionCents).toBe(0);
    });
  });

  describe('Shopee Affiliate Parser', () => {
    it('correctly normalizes completed Shopee orders', () => {
      const payload = {
        order_sn: '241007XYZ890',
        order_status: 3, // Completed
        partner_id: 'affiliate_vietnam_01',
        commission_amount: 120000, // VND
        item_price: 600000,
        currency: 'VND',
        item_id: 'SP_889977',
        item_name: 'Kem Dưỡng Da Collagen Trẻ Hóa',
        item_count: 3,
      };

      const event = parseShopeeWebhook(payload);

      expect(event.network).toBe('shopee');
      expect(event.orderId).toBe('241007XYZ890');
      expect(event.status).toBe('ORDER_SETTLED');
      expect(event.commissionCents).toBe(12000000);
      expect(event.currency).toBe('VND');
      expect(event.clearanceDueMs).toBeGreaterThan(Date.now());
    });
  });
});
